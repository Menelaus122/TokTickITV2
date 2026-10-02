# Lab 3 — REST API Contract

Companion to [`specification.md`](./specification.md). Business rules are cited as
**BR-nn**, acceptance criteria as **AC-nn**, decisions as **D-nn** — all of them
Lab 3 numbers.

**Base URL:** `http://localhost:3000` (server), consumed by the client through
`VITE_API_URL`.

Lab 2's contract (`docs/lab-02/api-spec.md`) still describes the Requester ticket
and attachment endpoints. This document records only what Lab 3 adds or changes;
where it says "unchanged", the Lab 2 request and response shapes hold exactly.

---

## 1. Conventions

### 1.1 Authentication

Identity travels in one place only: the session cookie (BR-09, BR-13).

```http
Cookie: tt_sid=<opaque 32-byte base64url token>
```

| Attribute | Value | Why |
| :--- | :--- | :--- |
| `HttpOnly` | yes | JavaScript cannot read the token, so an XSS bug cannot steal the session |
| `SameSite` | `Lax` | a cross-site POST cannot carry it (D-13) |
| `Secure` | production only | local development is plain HTTP |
| `Path` | `/` | every endpoint |
| `Max-Age` | 8 hours | matches the server-side expiry (BR-11, D-12) |

The server stores only `sha256(token)` (BR-10). Every authenticated request is one
indexed lookup on `Session.tokenHash`, joined to `User`; an expired row is treated
as no session at all.

`X-Requester-Id` from Lab 2 is **ignored** (FR-18, AC-14); it is not an error to
send it, and it never stands in for a session. A Requester endpoint called
without a session cookie answers `401 AUTH_REQUIRED` like every other protected
route — header or not. (Issues 4 and 5 kept a header-only fallback so the Lab 2
screens worked in between; Issue 6 removed it with the selector.)

A session whose role is not `REQUESTER` gets `403 FORBIDDEN` from every Requester
endpoint, header or not (BR-18).

The client sends `credentials: "include"` on every request. The server sets
`cors({ origin: <client origin>, credentials: true })`.

Any request other than `GET` that arrives with an `Origin` header not equal to the
configured client origin is refused with **403 `FORBIDDEN`** before any handler
runs (BR-65). This is the companion control to `SameSite=Lax`: the attachment
upload endpoint accepts `multipart/form-data`, which a cross-site HTML form can
produce, so the content type is not a defence (D-13).

### 1.2 Error shape

Unchanged from Lab 2 — one envelope for every failure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields are invalid.",
    "fields": {
      "email": "Enter a valid email address."
    }
  }
}
```

`fields` appears only on validation failures. `message` is always safe to show a
user: no stack traces, SQL, file paths, internal ids, or password material
(FR-47).

### 1.3 Status codes

| Status | Used for |
| :--- | :--- |
| `200` | successful retrieval or state change |
| `201` | session, user, comment, or note created |
| `204` | logout |
| `400` | invalid body or invalid query parameters |
| `401` | no session, expired session, or failed login (BR-21) |
| `403` | authenticated but not permitted, including password-change-required (BR-21) |
| `404` | resource missing **or** owned by another Requester (BR-22) |
| `409` | conflict — duplicate email, already claimed, invalid transition, last Administrator, self-deactivation |
| `410` | download of a soft-removed Attachment (Lab 2) |
| `429` | sign-in refused because the email is locked after repeated failures (BR-67) |
| `413` / `415` | attachment too large / unsupported type (Lab 2); a request body over the JSON limit / in an unsupported charset or encoding |
| `500` | unexpected server error, no internal detail in the body |

### 1.4 Error codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `AUTH_REQUIRED` | 401 | no session cookie, or the session expired or was deleted |
| `INVALID_CREDENTIALS` | 401 | unknown email **or** wrong password — one message for both (BR-16) |
| `ACCOUNT_INACTIVE` | 403 | credentials were correct but the account is not active (BR-08, D-09) |
| `PASSWORD_CHANGE_REQUIRED` | 403 | the session must change its password first (BR-14) |
| `FORBIDDEN` | 403 | the role may not perform this operation (BR-18) |
| `VALIDATION_FAILED` | 400 | one or more body fields invalid |
| `INVALID_QUERY` | 400 | unknown sort field, bad page, unpermitted page size, unknown filter value (BR-58) |
| `NOT_FOUND` | 404 | missing, or not owned by this Requester |
| `EMAIL_IN_USE` | 409 | another user already has this email (BR-45) |
| `TICKET_ALREADY_OWNED` | 409 | claim lost the race (BR-25) |
| `INVALID_TRANSITION` | 409 | the status change is not in the BR-33 matrix, or repeats the current status (BR-38) |
| `OWNER_REQUIRED` | 409 | resolve or close attempted on an unowned ticket; cancelling one is permitted (BR-35) |
| `OWNER_NOT_ASSIGNABLE` | 409 | the proposed owner is not an active IT Staff member or Administrator (BR-24) |
| `SELF_DEACTIVATION` | 409 | an Administrator targeted their own account (BR-48) |
| `LAST_ADMINISTRATOR` | 409 | the change would leave zero active Administrators (BR-49) |
| `TOO_MANY_ATTEMPTS` | 429 | five failed sign-ins for this email within 15 minutes; locked for 15 minutes (BR-67) |
| `REQUEST_TOO_LARGE` | 413 | the request body is over the JSON body limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | the request body's charset or encoding is not supported |
| `INTERNAL_ERROR` | 500 | unexpected failure, including a database that cannot be reached; the body carries no detail and the server keeps serving |

Lab 2's `ATTACHMENT_*`, `FILE_TOO_LARGE`, and `UNSUPPORTED_FILE_TYPE` codes are
unchanged. `REQUESTER_CONTEXT_REQUIRED`, `REQUESTER_INVALID`, and
`REQUESTER_INACTIVE` are **retired** with the selector; their jobs are now done by
`AUTH_REQUIRED` and `ACCOUNT_INACTIVE`.

### 1.5 Shared field formats

| Field | Format |
| :--- | :--- |
| Timestamps | ISO 8601 UTC, e.g. `2026-10-01T09:14:22.310Z` |
| `ticketNumber` | `TT-<YYYY>-<NNNNN>` (Lab 2 BR-04) |
| `role` | `REQUESTER` \| `IT_STAFF` \| `ADMINISTRATOR` |
| `requestedPriority`, `itPriority` | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| `currentStatus` | `NEW` \| `OPEN` \| `IN_PROGRESS` \| `WAITING_FOR_REQUESTER` \| `RESOLVED` \| `CLOSED` \| `REOPENED` \| `CANCELLED` |

### 1.6 The permitted user shape

Every response that carries a user uses this shape and nothing wider. There is no
field for a password, a hash, or a session token anywhere in the API (BR-52).

```json
{
  "id": 3,
  "fullName": "Pornchai Thana",
  "email": "pornchai@toktickit.local",
  "role": "REQUESTER",
  "isActive": true
}
```

`mustChangePassword` is added only on `/api/auth/login` and `/api/auth/me`, where
the client needs it to route. `department` and `lastLoginAt` appear only in the
Administrator's user list.

---

## 2. Authentication

### 2.1 `POST /api/auth/login`

Public. Creates a session (AC-01).

```json
{ "email": "pornchai@toktickit.local", "password": "Toktickit#2026" }
```

**201** — sets `Set-Cookie: tt_sid=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`

```json
{
  "user": {
    "id": 3,
    "fullName": "Pornchai Thana",
    "email": "pornchai@toktickit.local",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": false
  }
}
```

| Condition | Response |
| :--- | :--- |
| Missing or malformed email or password | `400 VALIDATION_FAILED` with `fields` |
| Unknown email | `401 INVALID_CREDENTIALS` |
| Wrong password | `401 INVALID_CREDENTIALS` — byte-identical to the line above (AC-04) |
| Correct password, inactive account | `403 ACCOUNT_INACTIVE`, no session created (AC-03) |
| Already holding a valid session | the old session row is deleted and replaced, so one browser holds one session |
| Email locked after five failures within 15 minutes, **any** password | `429 TOO_MANY_ATTEMPTS` with `Retry-After: <seconds>`, no session created (BR-67, AC-40) |

Order of operations: validate the body; refuse a locked email (BR-67); look up
the email, compare the hash, and only then check `isActive` (BR-08). An unknown
email still runs a bcrypt comparison against a dummy hash so the response time
does not reveal whether the email exists.

**Throttling (BR-67).** Only a `401 INVALID_CREDENTIALS` counts as a failure, and
it counts the same for an email with no account. A `400` and a `403
ACCOUNT_INACTIVE` do not count. A `201` clears the email's count. The lock is
checked before the database is read, so a locked real email and a locked unknown
one get byte-identical answers:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900
```

```json
{ "error": { "code": "TOO_MANY_ATTEMPTS", "message": "Too many sign-in attempts. Try again in 15 minutes." } }
```

`lastLoginAt` is stamped on success.

### 2.2 `POST /api/auth/logout`

Any session. **204**, no body. Deletes the session row and clears the cookie
(BR-12, AC-05). Called without a session it is still **204** — logging out twice
is not an error.

### 2.3 `GET /api/auth/me`

Any session, permitted even while `mustChangePassword` is set (BR-14).

**200**

```json
{
  "user": {
    "id": 7,
    "fullName": "Wirachat T.",
    "email": "wirachat@toktickit.local",
    "role": "IT_STAFF",
    "isActive": true,
    "mustChangePassword": true
  }
}
```

**401 `AUTH_REQUIRED`** when there is no cookie, the token is unknown, or the
session has expired.

### 2.3a While a password change is required

A session whose user has `mustChangePassword` set reaches only `GET /api/auth/me`,
`POST /api/auth/password`, and `POST /api/auth/logout`. Every other request it
makes is answered `403 PASSWORD_CHANGE_REQUIRED` before any handler runs (BR-14).
`POST /api/auth/login` and `GET /api/health` stay reachable because they are
public and do not act through the session; logging in as someone else simply
replaces it.

### 2.4 `POST /api/auth/password`

Any session, permitted while `mustChangePassword` is set.

```json
{
  "currentPassword": "Toktickit#2026",
  "newPassword": "my-own-password",
  "confirmPassword": "my-own-password"
}
```

**200** `{ "changed": true }`. Clears `mustChangePassword`, keeps the calling
session alive, and deletes every other session for that user (BR-15, AC-06).

| Condition | Response |
| :--- | :--- |
| `newPassword` shorter than 8 or longer than 72 characters, or longer than 72 bytes in UTF-8 | `400 VALIDATION_FAILED` on `newPassword` (BR-07) |
| `newPassword` equal to the user's email | `400 VALIDATION_FAILED` on `newPassword` |
| `confirmPassword` different | `400 VALIDATION_FAILED` on `confirmPassword` |
| `currentPassword` wrong | `401 INVALID_CREDENTIALS` |
| `newPassword` equal to `currentPassword` | `400 VALIDATION_FAILED` on `newPassword` |

---

## 3. Requester endpoints carried over from Lab 2

| Endpoint | Change |
| :--- | :--- |
| `GET /api/health` | unchanged, public |
| `GET /api/categories`, `GET /api/related-systems` | unchanged shapes; now require a session |
| `POST /api/tickets` | unchanged shape; Requester comes from the session (BR-03) |
| `GET /api/tickets` | unchanged shape and query contract; scoped to the session's Requester |
| `GET /api/tickets/:id` | unchanged, plus `requesterResolvedAt` (ISO timestamp or `null`) so the screen can show the Requester's own signal (§3.1); 404 for another Requester's ticket (BR-22) |
| `POST /api/tickets/:id/attachments`, `GET /api/tickets/:id/attachments`, `GET /api/attachments/:id/download`, `PATCH /api/attachments/:id/remove` | unchanged, ownership now resolved from the session |
| `GET /api/requesters` | **removed** with the selector (FR-16) |

A Requester-scoped endpoint called by IT Staff or an Administrator returns
**403 `FORBIDDEN`**: those roles have no "own tickets" in Lab 3 (BR-18). A ticket
belonging to a different Requester is **404**, never 403.

New on the Requester's own ticket:

### 3.1 `PATCH /api/tickets/:id/appears-resolved`

Requester, own ticket only (BR-29, AC-15).

```json
{ "appearsResolved": true, "comment": "Printer works again since this morning." }
```

**200**

```json
{
  "ticket": { "id": 12, "requesterResolvedAt": "2026-10-01T09:14:22.310Z", "currentStatus": "IN_PROGRESS" },
  "comment": { "id": 44, "body": "Printer works again since this morning.", "createdAt": "2026-10-01T09:14:22.310Z" }
}
```

| Condition | Response |
| :--- | :--- |
| `appearsResolved: true` with a comment shorter than 5 or longer than 2000 characters | `400 VALIDATION_FAILED` |
| `appearsResolved: false` | clears `requesterResolvedAt`; no comment required (BR-30) |
| Ticket owned by another Requester | `404 NOT_FOUND` |
| Any attempt to send `currentStatus` | ignored — the field does not exist on this endpoint (BR-05) |

---

## 4. Public Comments and Internal Notes

Both threads live on the ticket and are append-only (BR-42). Neither has an
update or delete route; none exists to be found.

### 4.1 `GET /api/tickets/:id/comments`

Owning Requester, any IT Staff, any Administrator (BR-04).

**200**

```json
{
  "comments": [
    {
      "id": 44,
      "body": "We have ordered the replacement toner.",
      "createdAt": "2026-10-01T09:14:22.310Z",
      "author": { "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF" }
    }
  ]
}
```

Ordered by `createdAt` ascending, then `id` ascending. Not paginated: a lab ticket
does not accumulate enough conversation to need it.

### 4.2 `POST /api/tickets/:id/comments`

Same roles. `{ "body": "..." }` → **201** with the created comment.

| Condition | Response |
| :--- | :--- |
| Empty or whitespace-only `body` | `400 VALIDATION_FAILED` (BR-41, AC-18) |
| `body` longer than 2000 characters after trimming | `400 VALIDATION_FAILED` |
| Requester, another Requester's ticket | `404 NOT_FOUND` |

Posting updates the ticket's `updatedAt` (BR-44).

### 4.3 `GET /api/tickets/:id/notes`

IT Staff and Administrator only.

**200** — same shape as comments, under `"notes"`.

**403 `FORBIDDEN`** for a Requester, with no body field revealing whether notes
exist (BR-23, AC-08). No Requester-facing response anywhere carries a note count.

An Administrator may call this endpoint and §4.1–§4.2 for any ticket, but has no
queue, no ticket list, and no ticket screen to find one through: in Lab 3 the
permission is reachable through the API with a known ticket id only (D-23).

### 4.4 `POST /api/tickets/:id/notes`

IT Staff and Administrator only. `{ "body": "..." }` → **201**. Same validation as
comments; **403** for a Requester.

---

## 5. IT Staff ticket operations

Every endpoint in this section is IT Staff only. A Requester or an Administrator
calling one receives **403 `FORBIDDEN`** (BR-19, AC-09).

### 5.1 `GET /api/staff/tickets` — the queue

Query parameters (BR-53 to BR-59):

| Parameter | Values | Default |
| :--- | :--- | :--- |
| `q` | free text, matched case-insensitively against Ticket Number and Summary | none |
| `status` | one `currentStatus` value | none |
| `itPriority` | one priority value | none |
| `categoryId` | an existing category id | none |
| `owner` | `any` \| `unassigned` \| `me` \| a user id (D-18) | `any` |
| `sort` | `itPriority` \| `createdAt` \| `updatedAt` | `itPriority` |
| `direction` | `asc` \| `desc` | `desc` for `itPriority`, with `createdAt` ascending as the tie-break (BR-55) |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | `10` \| `20` \| `50` | `10` |

**200**

```json
{
  "tickets": [
    {
      "id": 12,
      "ticketNumber": "TT-2026-00042",
      "summary": "Printer on floor 3 will not print",
      "categoryName": "Hardware",
      "requestedPriority": "MEDIUM",
      "itPriority": "HIGH",
      "currentStatus": "IN_PROGRESS",
      "owner": { "id": 7, "fullName": "Wirachat T.", "isActive": true },
      "requesterResolvedAt": null,
      "createdAt": "2026-09-28T02:10:00.000Z",
      "updatedAt": "2026-10-01T09:14:22.310Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 37,
  "totalPages": 4
}
```

`owner` is `null` for an unassigned ticket, which the screen renders as an explicit
"Unassigned" (FR-28). `isActive` on the owner lets the queue mark work held by a
deactivated account (BR-26).

| Condition | Response |
| :--- | :--- |
| Unknown `sort`, `direction`, `status`, `itPriority`, or `owner` value | `400 INVALID_QUERY` (AC-21) |
| `pageSize` outside 10/20/50, or `page` below 1 | `400 INVALID_QUERY` |
| `page` beyond the last page | `200` with an empty `tickets` array and correct metadata (BR-59) |
| `q` empty after trimming | treated as absent, not as a filter matching nothing (BR-53) |
| `categoryId` or `owner` not a positive integer | `400 INVALID_QUERY` |
| `categoryId` or `owner` a well-formed id that matches nothing | `200` with an empty `tickets` array — the filter is applied as asked, not looked up first |
| Any parameter given more than once | `400 INVALID_QUERY` |

### 5.2 `GET /api/staff/tickets/:id`

One ticket for operations. **200** with the queue row's fields plus `description`,
`relatedSystemName`, the Requester's permitted user shape, the attachment list in
Lab 2's shape, and `permittedTransitions`:

```json
{
  "ticket": { "id": 12, "currentStatus": "IN_PROGRESS", "permittedTransitions": ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"] }
}
```

`permittedTransitions` is computed from the BR-33 matrix on the server, so the
screen cannot offer a transition the API would refuse (FR-34). **404** for an id
that does not exist.

### 5.3 `PATCH /api/staff/tickets/:id/owner` — claim, assign, reassign

```json
{ "ownerId": 7 }
```

`{ "ownerId": null }` unassigns. Omitting the field is a validation error rather
than an implicit claim.

**200** with the updated ticket, including `currentStatus` — which may have moved
from `NEW` to `OPEN` in the same transaction (BR-34, AC-22).

| Condition | Response |
| :--- | :--- |
| Ticket already has a different owner and the request is a claim of an unassigned ticket | `409 TICKET_ALREADY_OWNED` (AC-23) |
| `ownerId` is not an active IT Staff member or Administrator | `409 OWNER_NOT_ASSIGNABLE` (BR-24) |
| `ownerId` refers to a user that does not exist | `400 VALIDATION_FAILED` |
| Ticket is `CANCELLED` | `409 INVALID_TRANSITION` — a cancelled ticket is terminal |

The claim path is a single conditional update (`WHERE id = :id AND ownerId IS
NULL`) so two simultaneous claims cannot both succeed.

### 5.4 `PATCH /api/staff/tickets/:id/it-priority`

```json
{ "itPriority": "URGENT" }
```

**200** with the updated ticket. `requestedPriority` is never touched (BR-27,
AC-24). An unknown value is `400 VALIDATION_FAILED`.

### 5.5 `PATCH /api/staff/tickets/:id/status`

```json
{ "currentStatus": "RESOLVED", "reason": "Toner replaced and test page printed." }
```

**200**

```json
{
  "ticket": { "id": 12, "currentStatus": "RESOLVED", "requesterResolvedAt": null, "permittedTransitions": ["CLOSED", "REOPENED"] },
  "comment": { "id": 45, "body": "Toner replaced and test page printed.", "createdAt": "2026-10-01T10:02:00.000Z" }
}
```

| Condition | Response |
| :--- | :--- |
| Target status not reachable from the current one | `409 INVALID_TRANSITION` (AC-25) |
| Target status equals the current one | `409 INVALID_TRANSITION` (BR-38) |
| `RESOLVED`, `CANCELLED`, or `REOPENED` without a 5–2000 character `reason` | `400 VALIDATION_FAILED` (BR-36, BR-37, AC-26) |
| `RESOLVED` or `CLOSED` on a ticket with no owner | `409 OWNER_REQUIRED` (BR-35) |
| `CANCELLED` on a ticket with no owner | permitted — a ticket that should never have been opened is cancelled without claiming it first (BR-35) |

A successful transition clears `requesterResolvedAt` (BR-30) and, where a reason
was required, creates the Public Comment in the same transaction (D-08).

### 5.6 `GET /api/staff/assignable-users`

**200** `{ "users": [ { "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF", "isActive": true } ] }`

Active IT Staff and Administrators only, ordered by name — the reassignment
picker's source (BR-24).

---

## 6. Administrator user management

Administrator only; every other role gets **403 `FORBIDDEN`**.

### 6.1 `GET /api/admin/users`

| Parameter | Values | Default |
| :--- | :--- | :--- |
| `q` | free text, matched case-insensitively against name and email | none |
| `role` | one role value | none |

No pagination and no sorting parameters: labsheet §8.5 excludes both for the user
list. Default order is name ascending.

**200**

```json
{
  "users": [
    {
      "id": 3,
      "fullName": "Pornchai Thana",
      "email": "pornchai@toktickit.local",
      "role": "REQUESTER",
      "isActive": true,
      "department": "Registrar",
      "mustChangePassword": false,
      "lastLoginAt": "2026-10-01T08:55:00.000Z"
    }
  ]
}
```

An unknown `role` value is `400 INVALID_QUERY`. No response field carries password
material (BR-52, AC-28).

### 6.2 `POST /api/admin/users`

```json
{
  "fullName": "New Person",
  "email": "new.person@toktickit.local",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "Welcome#2026"
}
```

**201** with the created user. `mustChangePassword` is always `true` on creation
(BR-46, AC-30); the field cannot be set by the caller.

| Condition | Response |
| :--- | :--- |
| Missing or malformed field | `400 VALIDATION_FAILED` with `fields` |
| `role` not one of the three values | `400 VALIDATION_FAILED` on `role` |
| `initialPassword` outside 8–72 characters | `400 VALIDATION_FAILED` |
| Email already in use, compared case-insensitively | `409 EMAIL_IN_USE`, reported on `email` (BR-45, AC-31) |

### 6.3 `PATCH /api/admin/users/:id`

Any subset of `fullName`, `email`, `role`, `isActive`. **200** with the updated
user.

| Condition | Response |
| :--- | :--- |
| Email already in use by another user | `409 EMAIL_IN_USE` |
| `isActive: false` or a `role` change on the calling Administrator's own account | `409 SELF_DEACTIVATION` (BR-48, AC-32) |
| A change that would leave zero active Administrators | `409 LAST_ADMINISTRATOR` (BR-49, AC-33) |
| `id` does not exist | `404 NOT_FOUND` |
| Any attempt to send `passwordHash`, `mustChangePassword`, or `initialPassword` | ignored; password changes go through §6.4 |

Deactivating a user deletes their sessions (BR-51) and keeps their ticket
ownership (BR-26).

### 6.4 `POST /api/admin/users/:id/initial-password`

```json
{ "initialPassword": "Welcome#2026" }
```

**200** `{ "mustChangePassword": true }`. Sets the hash, sets
`mustChangePassword`, and deletes that user's sessions (BR-47, AC-34).

Refused with `409 SELF_DEACTIVATION` on the caller's own account — an
Administrator changes their own password through `/api/auth/password`, which
requires knowing the current one.

---

## 7. Endpoint summary

| Method | Path | Session | Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | no | public |
| `POST` | `/api/auth/login` | no | public |
| `POST` | `/api/auth/logout` | optional | any |
| `GET` | `/api/auth/me` | yes | any, incl. must-change |
| `POST` | `/api/auth/password` | yes | any, incl. must-change |
| `GET` | `/api/categories` | yes | any |
| `GET` | `/api/related-systems` | yes | any |
| `POST` | `/api/tickets` | yes | Requester |
| `GET` | `/api/tickets` | yes | Requester |
| `GET` | `/api/tickets/:id` | yes | Requester (own) |
| `PATCH` | `/api/tickets/:id/appears-resolved` | yes | Requester (own) |
| `POST` `GET` | `/api/tickets/:id/attachments` | yes | Requester (own) |
| `GET` | `/api/attachments/:id/download` | yes | Requester (own) |
| `PATCH` | `/api/attachments/:id/remove` | yes | Requester (own) |
| `GET` `POST` | `/api/tickets/:id/comments` | yes | Requester (own), IT Staff, Administrator |
| `GET` `POST` | `/api/tickets/:id/notes` | yes | IT Staff, Administrator |
| `GET` | `/api/staff/tickets` | yes | IT Staff |
| `GET` | `/api/staff/tickets/:id` | yes | IT Staff |
| `PATCH` | `/api/staff/tickets/:id/owner` | yes | IT Staff |
| `PATCH` | `/api/staff/tickets/:id/it-priority` | yes | IT Staff |
| `PATCH` | `/api/staff/tickets/:id/status` | yes | IT Staff |
| `GET` | `/api/staff/assignable-users` | yes | IT Staff |
| `GET` `POST` | `/api/admin/users` | yes | Administrator |
| `PATCH` | `/api/admin/users/:id` | yes | Administrator |
| `POST` | `/api/admin/users/:id/initial-password` | yes | Administrator |

Guard order on every request: `Origin` (BR-65) → session → `mustChangePassword` →
role → ownership → input validation → business rules. The role guard is mounted
on the `/api/staff` and `/api/admin` prefixes, so it covers every route under them,
including ones not written yet. An `/api` path that matches no route answers
`404 NOT_FOUND` in the usual envelope, and a body that is not valid JSON answers
`400 VALIDATION_FAILED`. A caller therefore learns "log in" before "you
may not", and "you may not" before anything about the resource.

---

## 8. Traceability

| Area | Requirements | Rules | Criteria |
| :--- | :--- | :--- | :--- |
| §2 Authentication | FR-01 – FR-07 | BR-01, BR-02, BR-06 – BR-16 | AC-01 – AC-06 |
| §1.1, §7 Guards | FR-08 – FR-12 | BR-17 – BR-23 | AC-07 – AC-11 |
| §3 Requester carry-over | FR-16 – FR-19 | BR-03, BR-60 – BR-64 | AC-12 – AC-15 |
| §4 Comments and notes | FR-20 – FR-25 | BR-04, BR-39 – BR-44 | AC-16 – AC-19 |
| §5 Queue and operations | FR-26 – FR-37 | BR-24 – BR-38, BR-53 – BR-59 | AC-20 – AC-27 |
| §6 Administration | FR-38 – FR-45 | BR-45 – BR-52 | AC-28 – AC-34 |
