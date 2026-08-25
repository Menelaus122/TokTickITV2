# Lab 2 — REST API Contract

Companion to [`specification.md`](./specification.md). Business rules are cited
as **BR-nn**, acceptance criteria as **AC-nn**.

**Base URL:** `http://localhost:3000` (server), consumed by the client through
`VITE_API_URL`.

---

## 1. Conventions

### 1.1 Requester context

Every requester-scoped endpoint requires the current Development Requester in a
request header (BR-14):

```http
X-Requester-Id: 3
```

Identity is never read from the request body or query string. In Lab 3 this
header is replaced by an authenticated identity with no other change to the
contract (BR-46).

| Header condition | Response |
| :--- | :--- |
| Missing or not an integer | `400 REQUESTER_CONTEXT_REQUIRED` |
| Refers to a Requester that does not exist | `400 REQUESTER_INVALID` |
| Refers to an inactive Requester | `400 REQUESTER_INACTIVE` |

### 1.2 Error shape

Every Lab 2 error uses one envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields are invalid.",
    "fields": {
      "summary": "Summary must be between 5 and 120 characters.",
      "categoryId": "Category is required."
    }
  }
}
```

`fields` is present only on validation failures. `message` is always safe to
show a user: no stack traces, SQL, file paths, or internal ids (FR-33).

> `GET /api/health` predates this contract and keeps its Lab 1 body
> (`{ "status": "ok", "service": "TokTickIT API" }`) unchanged.

### 1.3 Status codes

| Status | Used for |
| :--- | :--- |
| `200` | Successful retrieval or successful state change |
| `201` | Ticket or Attachment created |
| `400` | Invalid input, invalid query parameters, invalid requester context |
| `404` | Resource missing **or owned by another Requester** (BR-16) |
| `409` | Conflict — active-attachment limit reached, attachment already removed |
| `410` | Download requested for a soft-removed Attachment (BR-41) |
| `413` | Uploaded file exceeds 5 MB (BR-33) |
| `415` | Uploaded file is not JPG/JPEG, PNG, WEBP, or PDF (BR-32) |
| `500` | Unexpected server error; body carries no internal detail |

### 1.4 Error codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `REQUESTER_CONTEXT_REQUIRED` | 400 | `X-Requester-Id` missing or malformed |
| `REQUESTER_INVALID` | 400 | Requester id does not exist |
| `REQUESTER_INACTIVE` | 400 | Requester exists but is inactive (BR-12) |
| `VALIDATION_FAILED` | 400 | One or more body fields invalid |
| `INVALID_QUERY` | 400 | Unknown sort field, bad page, unpermitted page size (BR-23) |
| `NOT_FOUND` | 404 | Missing or not owned |
| `ATTACHMENT_LIMIT_REACHED` | 409 | Ticket already has five active attachments (BR-34) |
| `ATTACHMENT_ALREADY_REMOVED` | 409 | Attachment is already soft-removed |
| `ATTACHMENT_REMOVED` | 410 | Download refused for a removed attachment |
| `FILE_TOO_LARGE` | 413 | Over 5 MB |
| `UNSUPPORTED_FILE_TYPE` | 415 | Extension or MIME type not permitted |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

### 1.5 Shared field formats

| Field | Format |
| :--- | :--- |
| Timestamps | ISO 8601 UTC, e.g. `2026-08-25T09:14:22.310Z` |
| `ticketNumber` | `TT-<YYYY>-<NNNNN>`, e.g. `TT-2026-00042` (BR-04) |
| `requestedPriority` | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| `currentStatus` | `NEW` (only value in Lab 2, BR-02) |

---

## 2. Reference data

### 2.1 `GET /api/categories`

Active ticket categories for classification controls.

* Requester context: **not required**
* Query parameters: none

**200**

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

Ordered by `id` ascending. Only rows with `isActive = true` are returned.

| Case | Response |
| :--- | :--- |
| Database unavailable | `500 INTERNAL_ERROR` |

> **Lab 1 compatibility.** This endpoint already exists and returns
> `{ id, name }` in id order. Lab 2 adds the `isActive` filter only; the
> response shape and the Lab 1 test remain valid (D-09).

### 2.2 `GET /api/related-systems`

Active related systems — the service, application, device, or platform a ticket
is about.

* Requester context: **not required**

**200**

```json
[
  { "id": 1, "name": "Campus Wi-Fi" },
  { "id": 2, "name": "Corporate Laptop" },
  { "id": 3, "name": "Email" },
  { "id": 4, "name": "Grade Submission App" },
  { "id": 5, "name": "LEB2 App" },
  { "id": 6, "name": "Printer" },
  { "id": 7, "name": "VPN" }
]
```

Ordered by `name` ascending, because this list is long enough that a user scans
it alphabetically. Only `isActive = true` rows are returned.

### 2.3 `GET /api/requesters`

Active Development Requesters for the Lab 2 selection screen (FR-01, BR-09).

* Requester context: **not required** — this is the endpoint that establishes it

**200**

```json
[
  { "id": 1, "fullName": "Anucha Wongsawat", "email": "anucha.wong@kmutt.ac.th", "department": "Civil Engineering" },
  { "id": 2, "fullName": "Kanya Srisai",     "email": "kanya.sris@kmutt.ac.th",  "department": "Registrar" },
  { "id": 3, "fullName": "Pornchai Thana",   "email": "pornchai.than@kmutt.ac.th","department": "Library" },
  { "id": 4, "fullName": "Suchada Meesuk",   "email": "suchada.mees@kmutt.ac.th", "department": "Finance" }
]
```

Ordered by `fullName` ascending. Inactive Requesters are never returned
(AC-01). An empty array is a valid response and drives the selection screen's
empty state (BR-13).

Passwords, roles, and tokens are deliberately absent — this model has none in
Lab 2 (BR-03).

---

## 3. Tickets

### 3.1 `POST /api/tickets` — create a Ticket

* Requester context: **required**
* Content type: `application/json`

**Request**

```json
{
  "categoryId": 2,
  "relatedSystemId": 2,
  "summary": "Laptop battery drains within 30 minutes",
  "description": "Since Monday the corporate laptop battery falls from 100% to 5% in about half an hour, even with only a browser open. It was replaced last year.",
  "requestedPriority": "MEDIUM"
}
```

| Field | Type | Required | Rules |
| :--- | :--- | :--- | :--- |
| `categoryId` | integer | yes | must exist and be active (BR-28) |
| `relatedSystemId` | integer | yes | must exist and be active (BR-28) |
| `summary` | string | yes | trimmed, 5–120 chars (BR-26) |
| `description` | string | yes | trimmed, 20–4000 chars (BR-27) |
| `requestedPriority` | enum | yes | one of the four values, no default (BR-07) |

`ticketNumber`, `ticketDate`, `currentStatus`, and `requesterId` are **not**
accepted in the body. Any such field is ignored (BR-01, BR-05, BR-06).

**201**

```json
{
  "id": 42,
  "ticketNumber": "TT-2026-00042",
  "ticketDate": "2026-08-25T09:14:22.310Z",
  "summary": "Laptop battery drains within 30 minutes",
  "description": "Since Monday the corporate laptop battery falls ...",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "requester": { "id": 3, "fullName": "Pornchai Thana" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 2, "name": "Corporate Laptop" },
  "attachments": [],
  "createdAt": "2026-08-25T09:14:22.310Z",
  "updatedAt": "2026-08-25T09:14:22.310Z"
}
```

| Case | Response |
| :--- | :--- |
| Any field invalid | `400 VALIDATION_FAILED` with a `fields` entry per invalid field (AC-09) |
| `categoryId` or `relatedSystemId` missing / inactive | `400 VALIDATION_FAILED` |
| Requester context missing or inactive | `400 REQUESTER_CONTEXT_REQUIRED` / `REQUESTER_INACTIVE` |
| Ticket Number collision | retried up to 3 times internally; only a persistent failure surfaces as `500` |
| Unexpected failure | `500 INTERNAL_ERROR`, no partial Ticket persisted |

Attachments are uploaded through §4.1 after the Ticket exists. The client
submits the form, then uploads each selected file to the returned Ticket id; a
file that fails does not undo the Ticket (BR-42, FR-31).

### 3.2 `GET /api/tickets` — the selected Requester's Tickets

* Requester context: **required**
* Returns only Tickets owned by that Requester, filtered in the query itself
  (BR-15, FR-18)

**Query parameters**

| Parameter | Type | Default | Rules |
| :--- | :--- | :--- | :--- |
| `search` | string | — | trimmed; matches `ticketNumber` or `summary`, case-insensitive; empty after trim is ignored (BR-18) |
| `categoryId` | integer | — | filter |
| `relatedSystemId` | integer | — | filter |
| `requestedPriority` | enum | — | filter |
| `currentStatus` | enum | — | filter |
| `sortBy` | enum | `createdAt` | `createdAt` or `updatedAt` only (BR-20) |
| `sortDir` | enum | `desc` | `asc` or `desc` |
| `page` | integer | `1` | one-based, ≥ 1 (BR-22) |
| `pageSize` | integer | `10` | one of 10, 20, 50 (BR-22) |

Filters combine with AND, and with `search` (BR-19). Every sort carries
`id desc` as its secondary key so paging is stable (BR-21).

**Example**

```http
GET /api/tickets?search=laptop&categoryId=2&sortBy=createdAt&sortDir=desc&page=1&pageSize=10
X-Requester-Id: 3
```

**200**

```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TT-2026-00042",
      "ticketDate": "2026-08-25T09:14:22.310Z",
      "summary": "Laptop battery drains within 30 minutes",
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 2, "name": "Corporate Laptop" },
      "activeAttachmentCount": 2,
      "updatedAt": "2026-08-25T10:02:11.004Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 25,
    "totalPages": 3,
    "hasPrev": false,
    "hasNext": true
  }
}
```

`description` is omitted from list rows on purpose — it can be 4000 characters
and no list column shows it.

| Case | Response |
| :--- | :--- |
| Requester owns nothing and no filters applied | `200` with `data: []`, `totalItems: 0` — the UI's **empty** state (BR-44) |
| Filters match nothing | `200` with `data: []` — the UI's **no-results** state (BR-44) |
| `page` beyond the last page | `200` with `data: []` and correct metadata, not 404 (BR-24) |
| `sortBy=summary`, `pageSize=7`, `page=0`, or a non-integer | `400 INVALID_QUERY` (BR-23, AC-18) |
| Requester context missing | `400 REQUESTER_CONTEXT_REQUIRED` |

Empty and no-results are the same status and shape; the client distinguishes
them by whether any search or filter is active.

### 3.3 `GET /api/tickets/:id` — one owned Ticket

* Requester context: **required**

**200**

```json
{
  "id": 42,
  "ticketNumber": "TT-2026-00042",
  "ticketDate": "2026-08-25T09:14:22.310Z",
  "summary": "Laptop battery drains within 30 minutes",
  "description": "Since Monday the corporate laptop battery falls ...",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "requester": { "id": 3, "fullName": "Pornchai Thana" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 2, "name": "Corporate Laptop" },
  "attachments": [
    {
      "id": 90,
      "originalFilename": "battery-report.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 184320,
      "uploadedAt": "2026-08-25T09:20:00.000Z",
      "removedAt": null,
      "removalReason": null,
      "downloadUrl": "/api/attachments/90/download"
    },
    {
      "id": 91,
      "originalFilename": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 402113,
      "uploadedAt": "2026-08-25T09:21:00.000Z",
      "removedAt": "2026-08-25T10:02:11.004Z",
      "removalReason": "Uploaded the wrong screenshot",
      "downloadUrl": null
    }
  ],
  "createdAt": "2026-08-25T09:14:22.310Z",
  "updatedAt": "2026-08-25T10:02:11.004Z"
}
```

A removed attachment keeps its metadata and reports `downloadUrl: null`, so a
client cannot construct a working link from the response (BR-40).

| Case | Response |
| :--- | :--- |
| Ticket does not exist | `404 NOT_FOUND` |
| Ticket belongs to another Requester | `404 NOT_FOUND` — identical body (BR-16, AC-19) |
| `:id` is not an integer | `400 INVALID_QUERY` |

---

## 4. Attachments

Permitted types: JPG/JPEG, PNG, WEBP, PDF. Maximum 5 MB per file. Maximum five
**active** attachments per Ticket (BR-32, BR-33, BR-34).

### 4.1 `POST /api/tickets/:id/attachments` — upload

* Requester context: **required**
* Content type: `multipart/form-data`
* Field name: `file` (one file per request, so a partial failure is reported
  per file per FR-31)

**201**

```json
{
  "id": 90,
  "ticketId": 42,
  "originalFilename": "battery-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 184320,
  "uploadedAt": "2026-08-25T09:20:00.000Z",
  "removedAt": null,
  "removalReason": null,
  "downloadUrl": "/api/attachments/90/download"
}
```

| Case | Response |
| :--- | :--- |
| Ticket missing or not owned | `404 NOT_FOUND` (BR-37) |
| Extension or MIME type not permitted, or they disagree | `415 UNSUPPORTED_FILE_TYPE` (BR-32) |
| File over 5 MB | `413 FILE_TOO_LARGE` (BR-33) |
| Ticket already has five active attachments | `409 ATTACHMENT_LIMIT_REACHED` (BR-34, AC-21) |
| No `file` part in the request | `400 VALIDATION_FAILED` |
| Disk write fails | `500 INTERNAL_ERROR` and **no** metadata row is created (BR-43) |

The stored file is written as `<uuid><ext>` under `server/uploads/`; the
original name is metadata only and is never used as a path (BR-35).

### 4.2 `GET /api/tickets/:id/attachments` — metadata list

* Requester context: **required**

**200**

```json
[
  {
    "id": 90,
    "originalFilename": "battery-report.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 184320,
    "uploadedAt": "2026-08-25T09:20:00.000Z",
    "removedAt": null,
    "removalReason": null,
    "downloadUrl": "/api/attachments/90/download"
  }
]
```

Returns active **and** removed attachments in `uploadedAt` ascending order;
removed ones carry `removedAt`, `removalReason`, and `downloadUrl: null`
(BR-40).

| Case | Response |
| :--- | :--- |
| Ticket missing or not owned | `404 NOT_FOUND` |

### 4.3 `GET /api/attachments/:id/download` — download an active file

* Requester context: **required**
* Ownership is re-checked here independently; a direct link is not a bypass
  (BR-17, AC-25)

**200** — the file bytes.

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="battery-report.pdf"
Content-Length: 184320
```

| Case | Response |
| :--- | :--- |
| Attachment does not exist | `404 NOT_FOUND` |
| Attachment's Ticket belongs to another Requester | `404 NOT_FOUND` (AC-25) |
| Attachment is soft-removed | `410 ATTACHMENT_REMOVED`, no bytes streamed (BR-41, AC-24) |
| File missing from disk | `500 INTERNAL_ERROR` |

### 4.4 `PATCH /api/attachments/:id/remove` — soft removal

* Requester context: **required**
* Content type: `application/json`

**Request**

```json
{ "removalReason": "Uploaded the wrong screenshot" }
```

| Field | Type | Required | Rules |
| :--- | :--- | :--- | :--- |
| `removalReason` | string | yes | trimmed, 5–200 chars (BR-39) |

**200**

```json
{
  "id": 91,
  "originalFilename": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 402113,
  "uploadedAt": "2026-08-25T09:21:00.000Z",
  "removedAt": "2026-08-25T10:02:11.004Z",
  "removalReason": "Uploaded the wrong screenshot",
  "downloadUrl": null
}
```

Sets `removedAt` and `removalReason`, leaves the row and the file on disk in
place, and touches the parent Ticket's `updatedAt` (BR-08, BR-38). Removing an
attachment frees a slot against the five-active limit (BR-34).

| Case | Response |
| :--- | :--- |
| Attachment missing, or its Ticket is owned by another Requester | `404 NOT_FOUND` (BR-37) |
| Already removed | `409 ATTACHMENT_ALREADY_REMOVED` |
| Reason missing, blank, or outside 5–200 chars | `400 VALIDATION_FAILED` with a `removalReason` entry |

Hard deletion is not exposed in Lab 2 (D-05).

---

## 5. Endpoint summary

| Capability | Method | Path | Requester context | Success |
| :--- | :--- | :--- | :--- | :--- |
| Active Categories | GET | `/api/categories` | no | 200 |
| Active Related Systems | GET | `/api/related-systems` | no | 200 |
| Active Development Requesters | GET | `/api/requesters` | no | 200 |
| Create a Ticket | POST | `/api/tickets` | yes | 201 |
| List owned Tickets | GET | `/api/tickets` | yes | 200 |
| Read one owned Ticket | GET | `/api/tickets/:id` | yes | 200 |
| Upload an Attachment | POST | `/api/tickets/:id/attachments` | yes | 201 |
| Attachment metadata | GET | `/api/tickets/:id/attachments` | yes | 200 |
| Download an active Attachment | GET | `/api/attachments/:id/download` | yes | 200 |
| Soft-remove an Attachment | PATCH | `/api/attachments/:id/remove` | yes | 200 |

---

## 6. Traceability

| Endpoint | Acceptance criteria |
| :--- | :--- |
| `GET /api/requesters` | AC-01, AC-05, AC-06 |
| `GET /api/categories`, `GET /api/related-systems` | AC-08 |
| `POST /api/tickets` | AC-07, AC-10, AC-11, AC-12 |
| `GET /api/tickets` | AC-14, AC-15, AC-16, AC-17, AC-18 |
| `GET /api/tickets/:id` | AC-19, AC-20 |
| `POST /api/tickets/:id/attachments` | AC-13, AC-21 |
| `GET /api/tickets/:id/attachments` | AC-23 |
| `GET /api/attachments/:id/download` | AC-22, AC-24, AC-25 |
| `PATCH /api/attachments/:id/remove` | AC-23 |
