# Lab 4 — REST API Contract

Companion to [`specification.md`](./specification.md). Business rules are cited as
**BR-nn**, acceptance criteria as **AC-nn**, decisions as **D-nn** — all of them
Lab 4 numbers. References to the earlier sprints say so: "Lab 3 BR-22".

**Base URL:** `http://localhost:3000` (server), consumed by the client through
`VITE_API_URL`.

Lab 3's contract (`docs/lab-03/api-spec.md`) and Lab 2's still describe everything
this document does not mention. Where this document says "unchanged", the earlier
request and response shapes hold exactly. It records only what Lab 4 adds or
changes, and §9 lists every Lab 2 and Lab 3 endpoint and whether it changed.

---

## 1. Conventions

### 1.1 What carries over unchanged

Authentication by the `tt_sid` session cookie, the `Origin` check on every
non-`GET` request, the error envelope `{ "error": { "code", "message", "fields?" } }`,
the shared field formats, and the permitted user shape are exactly Lab 3's
(`docs/lab-03/api-spec.md` §1.1, §1.2, §1.5, §1.6). `Cache-Control: no-store` is
sent on every Lab 4 response.

Lab 4 adds one shape, the **author** shape, which is what Lab 3's comments already
use for their author and carries no email:

```json
{ "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF" }
```

### 1.2 New and changed status codes and error codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `STALE_UPDATE` | 409 | the record changed since the caller loaded it: `expectedVersion` no longer matches (BR-26, BR-27). The body carries the current record in `error.current` |
| `TICKET_NOT_ACTIVE` | 409 | an Action Taken was created or edited on a `RESOLVED`, `CLOSED`, or `CANCELLED` Ticket (BR-10) |
| `ACTION_REQUIRED` | 409 | a move to `RESOLVED` with no relevant Action Taken (BR-17, BR-18) |
| `FOLLOW_UP_PENDING` | 409 | a move to `RESOLVED` whose most recently recorded relevant Action Taken still requires follow-up (BR-17, BR-18) |
| `VALIDATION_FAILED` | 400 | now also: a NUL character in any body string, or a body id outside `1`–`2147483647` (BR-52) |

Every other code and status is Lab 3's. `201` is used for a created Action Taken
and `200` for a replayed one (§2.2).

A `STALE_UPDATE` body looks like this, and `current` is always in the shape the
endpoint itself returns:

```json
{
  "error": {
    "code": "STALE_UPDATE",
    "message": "This ticket changed while you were working on it. Review the latest version and try again.",
    "current": { "id": 12, "version": 4, "currentStatus": "IN_PROGRESS" }
  }
}
```

### 1.3 The Action Taken shape

```json
{
  "id": 31,
  "ticketId": 12,
  "actionAt": "2026-10-05T03:10:00.000Z",
  "description": "Replaced the toner cartridge and ran a test page.",
  "result": "Test page printed cleanly.",
  "performedBy": { "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF" },
  "followUpRequired": true,
  "followUpNote": "Check the printer again on Thursday.",
  "attachmentNotes": "Look for the photo of the toner label.",
  "version": 1,
  "createdAt": "2026-10-05T03:12:41.000Z",
  "updatedAt": "2026-10-05T03:12:41.000Z",
  "updatedBy": null
}
```

`followUpNote` is `null` when `followUpRequired` is `false` (BR-04).
`attachmentNotes` is `null` when empty. `updatedBy` is `null` until the first edit,
then an author shape (BR-07). There is no `assignee` and no `status` (BR-14, D-06).

### 1.4 The ticket-concise row

Dashboards list Tickets in this smaller row, never in the queue's full shape
(FR-19):

```json
{
  "id": 12,
  "ticketNumber": "TT-2026-00042",
  "summary": "Printer on floor 3 will not print",
  "currentStatus": "IN_PROGRESS",
  "updatedAt": "2026-10-05T03:12:41.000Z"
}
```

The staff lists add `itPriority` and `owner` (`null`, or `{ id, fullName }`).

---

## 2. Actions Taken

### 2.1 `GET /api/tickets/:id/actions-taken`

Owning Requester, any IT Staff member, any Administrator (BR-42).

**200**

```json
{ "actions": [ { "...": "the §1.3 shape" } ] }
```

Ordered by `actionAt` ascending, then `id` ascending (BR-08, AC-10): the order for
reading. The action the resolution gate reads is a different one, the most recently
**recorded** (highest `createdAt`, then `id`, BR-17), and it is not always the last
in this list, because `actionAt` is typed by the user. Every action carries
`createdAt` and `id`, so a client can mark it. Not
paginated: a lab Ticket does not accumulate enough work to need it. A Ticket with
none answers `200` with `"actions": []` (FR-08).

| Condition | Response |
| :--- | :--- |
| No session | `401 AUTH_REQUIRED` |
| Requester asking for a Ticket that is not theirs, or does not exist | `404 NOT_FOUND`, identical bodies (BR-44) |
| Ticket id malformed or out of range | `400 INVALID_QUERY` |

### 2.2 `POST /api/staff/tickets/:id/actions-taken`

IT Staff or Administrator. A Requester is `403 FORBIDDEN`.

```json
{
  "actionAt": "2026-10-05T03:10:00.000Z",
  "description": "Replaced the toner cartridge and ran a test page.",
  "result": "Test page printed cleanly.",
  "followUpRequired": true,
  "followUpNote": "Check the printer again on Thursday.",
  "attachmentNotes": "Look for the photo of the toner label.",
  "requestKey": "6f1c2d3e-8a47-4b0e-9d52-0c7a1e5f93aa"
}
```

| Field | Rule |
| :--- | :--- |
| `actionAt` | required, ISO 8601 date and time **with a zone**, a day that exists (31 February is refused, not moved to 3 March) and a time from `00:00` to `23:59:59` (`24:00` is refused, not read as the next midnight); not later than server time + 5 minutes, not before the Ticket's `createdAt` (BR-06) |
| `description` | required string, 5–2000 characters after trimming (BR-03) |
| `result` | required string, 2–1000 characters after trimming (BR-03) |
| `followUpRequired` | required boolean |
| `followUpNote` | required, 5–1000 characters after trimming, when `followUpRequired` is `true`; ignored and stored `null` when `false` (BR-04, D-18) |
| `attachmentNotes` | optional, at most 500 characters; empty after trimming is stored `null` |
| `requestKey` | optional, 8–64 characters of `A–Z a–z 0–9 - _`; makes a resend safe (BR-28) |

`performedBy`, `ticketId`, `createdAt`, `version`, and any other field are ignored
if sent: the Ticket is the one in the path (BR-01) and the performer is the
session user (BR-05). No string may contain a NUL character (BR-12, BR-52).

**201** `{ "action": { "...": "§1.3" } }`

**200** `{ "action": { "...": "§1.3" } }` — the same `requestKey`, on the same
Ticket, from the same user, was already used: the action that submission created is
returned, as it is stored now, and nothing is created (BR-28, AC-07). A client need
not tell the two answers apart.

| Condition | Response |
| :--- | :--- |
| A `requestKey` already used on this Ticket by this user | `200` with the existing action — **even if the Ticket has since been resolved**, closed, or cancelled, and even if the body differs: the key names the submission (BR-28) |
| Missing or invalid field | `400 VALIDATION_FAILED` with `fields`, one message per offending field (AC-04) |
| A `requestKey` that is present but not 8–64 characters of `A–Z a–z 0–9 - _` (`null` counts as absent) | `400 VALIDATION_FAILED` on `requestKey` |
| A body that is not a JSON object | `400 VALIDATION_FAILED`: a JSON array names every required field; other values get the parser's own message |
| `actionAt` in the future or before the Ticket existed | `400 VALIDATION_FAILED` on `actionAt` |
| Ticket is `RESOLVED`, `CLOSED`, or `CANCELLED` (and the key is new) | `409 TICKET_NOT_ACTIVE` (BR-10, AC-09) |
| Ticket does not exist | `404 NOT_FOUND` |
| Requester, or no session | `403 FORBIDDEN`, or `401 AUTH_REQUIRED` |

The checks run in this order: role, Ticket exists, **replayed key**, validation,
Ticket active, then the insert. A replay is answered before validation and the
status check, so a retry never turns into an error because the world moved on.

Creating an action updates the Ticket's `updatedAt` and not its `version` (BR-11).
The write runs under the Ticket's row lock (BR-29).

### 2.3 `PATCH /api/staff/tickets/:id/actions-taken/:actionId`

IT Staff or Administrator, on any action of the Ticket whoever performed it
(BR-09).

```json
{
  "expectedVersion": 1,
  "result": "Test page printed cleanly; toner level is at 100%.",
  "followUpRequired": false
}
```

`expectedVersion` is **required**. Any subset of `actionAt`, `description`,
`result`, `followUpRequired`, `followUpNote`, and `attachmentNotes` may follow; a
field that is not sent is left alone. The rules of §2.2 apply to the **merged**
result: sending `followUpRequired: true` onto an action with no note needs a
`followUpNote` in the same request, and sending `false` clears the note.
`performedBy`, `ticketId`, and `createdAt` are never editable and are ignored.

**200** `{ "action": { "...": "§1.3, with version + 1, updatedBy and updatedAt set" } }`

| Condition | Response |
| :--- | :--- |
| `expectedVersion` missing, not an integer, or less than 1 | `400 VALIDATION_FAILED` on `expectedVersion` (BR-27) |
| `expectedVersion` no longer matches | `409 STALE_UPDATE`, `error.current` is the latest action (AC-06) |
| Ticket is `RESOLVED`, `CLOSED`, or `CANCELLED` | `409 TICKET_NOT_ACTIVE`, checked before the version (BR-10) |
| Field invalid | `400 VALIDATION_FAILED` with `fields` |
| `actionId` not an action of this Ticket, or malformed | `404 NOT_FOUND`, or `400 INVALID_QUERY` for a malformed id; an action of another Ticket is `404` (BR-01) |
| A body that changes nothing | `200`, `version` unchanged |

Of two simultaneous edits carrying the same version, the row lock lets one commit
and the other sees a newer version and answers `409 STALE_UPDATE` (BR-29, AC-06).

The checks run in this order: role, Ticket exists, action exists on that Ticket,
validation (`expectedVersion` included), Ticket active, version, then the write. So
an invalid edit of a resolved Ticket is `400`, a valid one is `409 TICKET_NOT_ACTIVE`
whatever version it carries, and only an edit of an active Ticket can be
`409 STALE_UPDATE`.

There is **no** `DELETE` route. `DELETE .../actions-taken/:actionId` answers IT Staff
and Administrators with the unknown-route `404 NOT_FOUND` of Lab 3 §7 (BR-09, D-13).
A Requester is `403 FORBIDDEN` and a caller with no session `401 AUTH_REQUIRED`
first, as on every `/api/staff` route (SEC-02, SEC-06).

---

## 3. Ticket workflow

### 3.1 Changes to `GET /api/staff/tickets/:id`

Now open to IT Staff **and Administrators** (BR-43). The `ticket` object keeps
every Lab 3 field and gains:

```json
{
  "ticket": {
    "id": 12,
    "currentStatus": "IN_PROGRESS",
    "version": 4,
    "owner": { "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF", "isActive": true },
    "permittedTransitions": ["WAITING_FOR_REQUESTER", "CANCELLED"],
    "blockedTransitions": [
      {
        "to": "RESOLVED",
        "code": "ACTION_REQUIRED",
        "message": "Record at least one action before resolving this ticket."
      }
    ]
  }
}
```

* `version` is what the client sends back as `expectedVersion` (BR-25, BR-26).
* `owner` gains `role` beside `isActive`, so the screen can tell a deactivated
  owner from one who is no longer IT Staff (BR-55, AC-33).
* `permittedTransitions` lists the moves **the Ticket can make right now**: the
  matrix targets (BR-15) minus any blocked by the owner rule (Lab 3 BR-35) or the
  gate (BR-17). The screen offers only these (FR-09).
* `blockedTransitions` lists the matrix targets that are not permitted yet, each
  with the `code` the API would answer (`OWNER_REQUIRED`, `ACTION_REQUIRED`, or
  `FOLLOW_UP_PENDING`) and a message safe to show. Together the two arrays are
  exactly the matrix row for the current status, in matrix order.

Lab 3's `permittedTransitions` was the bare matrix row; Lab 4 narrows it. A client
that offers only `permittedTransitions` stays correct; the API still enforces
everything, so a stale list is a `409`, never a wrong write.

### 3.2 `PATCH /api/staff/tickets/:id/owner`, `.../it-priority`, `.../status`

Each is open to IT Staff and Administrators and gains an optional `expectedVersion`
(BR-26). Each success returns `{ "ticket": … }` in the §3.1 shape, so `version` is
always the new one.

```json
{ "currentStatus": "RESOLVED", "reason": "Toner replaced and test page printed.", "expectedVersion": 4 }
```

| Condition | Response |
| :--- | :--- |
| `expectedVersion` present and no longer the Ticket's version | `409 STALE_UPDATE`, `error.current` is the §3.1 `ticket` (AC-14) |
| `expectedVersion` present but not an integer from 1 to 2 147 483 647 (a string, a decimal, `0`, a negative number, a boolean, or `null`) | `400 VALIDATION_FAILED` on `expectedVersion`, before the Ticket is read |
| `expectedOwnerId` no longer matches (owner endpoint) | `409 TICKET_ALREADY_OWNED`, as Lab 3 D-26; checked **before** `expectedVersion` |
| Status: target not reachable, or equal to the current | `409 INVALID_TRANSITION` |
| Status: `RESOLVED` or `CLOSED` on an unowned Ticket | `409 OWNER_REQUIRED` |
| Status: `RESOLVED` with no relevant Action Taken | `409 ACTION_REQUIRED` (AC-03) |
| Status: `RESOLVED` whose most recently recorded relevant Action Taken requires follow-up | `409 FOLLOW_UP_PENDING` (AC-03) |
| Status: `RESOLVED`, `CANCELLED`, or `REOPENED` without a 5–2000 character `reason` | `400 VALIDATION_FAILED` on `reason` |

**Owner endpoint.** It reads the proposed owner's role and `isActive` **inside** the
transaction, after the Ticket's row lock, with `SELECT … FOR SHARE` on the user's
row (BR-29). A deactivation that commits first makes the assignment
`409 OWNER_NOT_ASSIGNABLE`; one that arrives after leaves the new owner in place
(Lab 3 BR-26). Lab 3 read the user before the transaction, which left a gap.

The owner endpoint answers in this order, and the first that applies wins: body
validation (`400`) → no such Ticket (`404`) → the proposed owner does not exist
(`400`) or is not assignable (`409 OWNER_NOT_ASSIGNABLE`) → a cancelled Ticket
(`409 INVALID_TRANSITION`) → `expectedOwnerId` no longer matches
(`409 TICKET_ALREADY_OWNED`) → `expectedVersion` no longer matches
(`409 STALE_UPDATE`) → unassigning a `RESOLVED` or `CLOSED` Ticket
(`409 OWNER_REQUIRED`). A request that sends both a stale `expectedOwnerId` and a
stale `expectedVersion` is therefore told who owns the Ticket, not that it is stale.

**A Requester's "appears resolved" moves `version`** (BR-25), so an owner, priority,
or status save made from a screen loaded before it is a `409 STALE_UPDATE`. That is
intended: the staff screen should show the advisory before anyone acts on an older
view. Marking the Ticket again, with a new comment, is a change and moves `version`
a second time; withdrawing a signal that is not set is not a change, answers as it
did in Lab 3, and leaves `version` where it was.

The status handler checks in the order BR-24 sets: validation → exists → stale →
matrix and same-status → owner → gate. So a request that is both stale and invalid
is told it is stale, and one that is both unowned and ungated is told to claim
first.

"Invalid" here means a move the matrix does not allow, or a repeat of the current
status. A **malformed body** (an unknown `currentStatus`, a bad `expectedVersion`,
or a missing or out-of-range `reason`) is a `400` before the Ticket is read, so it is
told it is malformed whether or not it is also stale.

`it-priority` now locks the Ticket's row like the other two (BR-29), where Lab 3
wrote it unlocked. Resending the IT Priority a Ticket already has is a `200` that
changes nothing and does not move `version` (BR-25).

A successful status change writes its history row in the same transaction (BR-21)
and, as in Lab 3, posts the reason as a Public Comment. A claim of a `NEW` Ticket
that moves it to `OPEN` writes the history row too.

### 3.3 `GET /api/tickets/:id/status-history`

Owning Requester, any IT Staff member, any Administrator (BR-23, BR-42).

**200**

```json
{
  "history": [
    {
      "id": 9,
      "fromStatus": "NEW",
      "toStatus": "OPEN",
      "changedBy": { "id": 7, "fullName": "Wirachat T.", "role": "IT_STAFF" },
      "createdAt": "2026-10-04T08:20:00.000Z"
    }
  ]
}
```

Oldest first by `createdAt`, then `id` (BR-22). A Ticket with no change, including
a legacy one, answers `"history": []`; the screen shows "Ticket created" from the
Ticket's own `createdAt`. The creation of a Ticket is not a row. The responses and
errors are those of §2.1. No endpoint creates, updates, or deletes a row: they are
written only by a status change (BR-21, AC-13).

---

## 4. Dashboards

Both endpoints are computed on every request from the tables (BR-30), take **no
query parameters**, and ignore any they are sent (BR-37). Every metric card and
status row is `{ "value": <integer ≥ 0>, "href": <client route> }`. `href` is a route
in the web client, with its query string, not an API path; following it shows a list
whose total equals `value` (BR-40, AC-21). The one exception is `userCounts`
(§4.2), whose entries are `{ "value": <integer ≥ 0> }` and have **no** `href`.
`generatedAt` is an ISO 8601 UTC timestamp.
The full definitions are in §6.

### 4.1 `GET /api/dashboard/requester`

Requester only. IT Staff and Administrators are `403 FORBIDDEN`; no session is
`401 AUTH_REQUIRED`. The caller is the session user and nothing else (BR-37).

**200**

```json
{
  "generatedAt": "2026-10-05T09:00:00.000Z",
  "metrics": {
    "openTickets":   { "value": 3,  "href": "/tickets?group=open" },
    "waitingForYou": { "value": 1,  "href": "/tickets?status=WAITING_FOR_REQUESTER" },
    "resolved":      { "value": 5,  "href": "/tickets?status=RESOLVED" },
    "closed":        { "value": 12, "href": "/tickets?status=CLOSED" }
  },
  "needsAttention": [ { "...": "§1.4 row" } ],
  "recentTickets":  [ { "...": "§1.4 row" } ]
}
```

`needsAttention` and `recentTickets` hold at most 5 rows each, in the order BR-33
sets, and are empty arrays when nothing matches (BR-39). A Requester with no
Tickets gets four `0` values and two empty arrays (AC-18).

### 4.2 `GET /api/staff/dashboard`

IT Staff and Administrators. A Requester is `403 FORBIDDEN`.

**200**

```json
{
  "generatedAt": "2026-10-05T09:00:00.000Z",
  "metrics": {
    "unassigned":          { "value": 2, "href": "/queue?owner=unassigned&group=open" },
    "assignedToMe":        { "value": 4, "href": "/queue?owner=me&group=open" },
    "waitingForRequester": { "value": 2, "href": "/queue?status=WAITING_FOR_REQUESTER" },
    "urgent":              { "value": 2, "href": "/queue?itPriority=URGENT&group=open" }
  },
  "byStatus": [
    { "status": "NEW",                   "value": 2, "href": "/queue?status=NEW" },
    { "status": "OPEN",                  "value": 2, "href": "/queue?status=OPEN" },
    { "status": "IN_PROGRESS",           "value": 2, "href": "/queue?status=IN_PROGRESS" },
    { "status": "WAITING_FOR_REQUESTER", "value": 2, "href": "/queue?status=WAITING_FOR_REQUESTER" },
    { "status": "REOPENED",              "value": 2, "href": "/queue?status=REOPENED" }
  ],
  "myTickets":       [ { "...": "§1.4 row plus itPriority and owner" } ],
  "urgentTickets":   [ { "...": "§1.4 row plus itPriority and owner" } ],
  "myRecentActions": [
    {
      "id": 31,
      "ticketId": 12,
      "ticketNumber": "TT-2026-00042",
      "actionAt": "2026-10-05T03:10:00.000Z",
      "description": "Replaced the toner cartridge and ran a test page.",
      "followUpRequired": true
    }
  ],
  "userCounts": {
    "activeRequesters":     { "value": 6 },
    "activeItStaff":        { "value": 4 },
    "activeAdministrators": { "value": 2 },
    "inactive":             { "value": 2 }
  }
}
```

* `userCounts` is **present only for an Administrator** and absent for IT Staff
  (BR-38, AC-20). None of the four entries has an `href`: `GET /api/admin/users`
  returns inactive users too, so `/users?role=IT_STAFF` would list 5 where
  `activeItStaff` says 4 (BR-40, D-12). The counts are plain numbers.
* `byStatus` always has the five open statuses in this order (BR-35), `0` where
  none.
* `myTickets`, `urgentTickets`, and `myRecentActions` hold at most 5 entries in the
  order BR-36 sets. `description` in `myRecentActions` is cut to 120 characters
  with an ellipsis; the full text is on the Ticket.
* "Me" is the session user, so two IT Staff members calling it get different
  `assignedToMe`, `myTickets`, and `myRecentActions` (AC-19).

---

## 5. Filters that make drill-down exact

### 5.1 `group=open`

`GET /api/tickets` (Requester) and `GET /api/staff/tickets` (IT Staff,
Administrator) accept one new optional parameter:

| Parameter | Values | Default |
| :--- | :--- | :--- |
| `group` | `open` — `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED` (BR-31) | none |

It combines with every other filter by AND, `status` included: `group=open` with
`status=CLOSED` is an empty list, not an error. An unknown value, or the parameter
given twice, is `400 INVALID_QUERY`, as Lab 3 BR-58 treats every parameter. The
response shape is unchanged. Every dashboard `href` in §4 is a client route whose
query string these endpoints accept, so `totalItems` of the list a card opens
equals the card's `value` (AC-21); DASH-14 checks every card against it.

### 5.2 Existing filters used by the links

`status`, `itPriority`, and `owner` (`unassigned` | `me` | an id) are Lab 3's
(`docs/lab-03/api-spec.md` §5.1). Nothing else changes. `GET /api/admin/users` is
untouched, and the Administrator's account counts link to nothing, because that list
includes inactive users and no filter could make it match an *active* count (BR-40,
D-12). The client reads the filters above from its own URL (FR-21); that is a client
behaviour and has no endpoint.

---

## 6. Metric definitions

The query behind every number, so a reviewer can run the equivalent SQL and
compare. "Open group" is BR-31; all counts exclude nothing else unless stated.

| Metric | Definition | Drill-down |
| :--- | :--- | :--- |
| `openTickets` | Tickets where `requesterId` = caller and `currentStatus` in the open group | `/tickets?group=open` |
| `waitingForYou` | `requesterId` = caller and `currentStatus` = `WAITING_FOR_REQUESTER` | `/tickets?status=WAITING_FOR_REQUESTER` |
| `resolved` | `requesterId` = caller and `currentStatus` = `RESOLVED` | `/tickets?status=RESOLVED` |
| `closed` | `requesterId` = caller and `currentStatus` = `CLOSED` | `/tickets?status=CLOSED` |
| `needsAttention` | the caller's `WAITING_FOR_REQUESTER` Tickets, `updatedAt` ascending, `id` ascending, first 5 | the row's Ticket |
| `recentTickets` | the caller's Tickets, `updatedAt` descending, `id` descending, first 5 | the row's Ticket |
| `unassigned` | `ownerId` is null and `currentStatus` in the open group | `/queue?owner=unassigned&group=open` |
| `assignedToMe` | `ownerId` = caller and `currentStatus` in the open group | `/queue?owner=me&group=open` |
| `waitingForRequester` | `currentStatus` = `WAITING_FOR_REQUESTER`, any owner | `/queue?status=WAITING_FOR_REQUESTER` |
| `urgent` | `itPriority` = `URGENT` and `currentStatus` in the open group | `/queue?itPriority=URGENT&group=open` |
| `byStatus[s]` | `currentStatus` = `s`, for the five open statuses, any owner | `/queue?status=<s>` |
| `myTickets` | `ownerId` = caller, open group, `updatedAt` descending, `id` descending, first 5 | the row's Ticket |
| `urgentTickets` | `itPriority` = `URGENT`, open group, `createdAt` ascending, `id` ascending, first 5 | the row's Ticket |
| `myRecentActions` | Actions Taken with `performedById` = caller, `createdAt` descending, `id` descending, first 5 | the action's Ticket |
| `userCounts.active*` | users with `isActive` and the role | none: no list can reproduce an *active* count (BR-40) |
| `userCounts.inactive` | users with `isActive` false | none |

No definition has a date window, so none has a day boundary or a time zone
(BR-41, D-10). A `CANCELLED` Ticket is in no open metric (BR-31).

---

## 7. Hardening changes

| Change | Detail |
| :--- | :--- |
| NUL in a body string | Every write endpoint — tickets, attachments' removal reason, comments, notes, appears-resolved, owner, status reason, user management, login, password, Actions Taken — answers `400 VALIDATION_FAILED` on the offending field. Lab 3 answered `500` (BR-52, AC-26). |
| Body ids | `categoryId` and `relatedSystemId` in `POST /api/tickets`, and every id in an owner request, outside `1`–`2147483647` is `400 VALIDATION_FAILED` on that field, not `500`. Lab 3 bounded path and query ids only. |
| Owner shape | `owner` in the staff Ticket shapes carries `role` (BR-55). |
| Row lock | IT Priority joins owner and status under the Ticket's row lock (BR-29). |

No other Lab 2 or Lab 3 contract changes.

---

## 8. Guard order

Every request passes the same guards in the same order, extending Lab 3 §7:

`Origin` (Lab 3 BR-65) → session → `mustChangePassword` → role → ownership →
input validation → ticket state → version → business rules.

The role guard is mounted on the `/api/staff` and `/api/admin` prefixes. `/api/staff`
admits `IT_STAFF` and `ADMINISTRATOR`; `/api/admin` admits `ADMINISTRATOR` only
(BR-43). The Requester dashboard resolves the caller as a Requester and refuses
every other role with `403`. A caller therefore learns "log in" before "you may
not", and "you may not" before anything about a resource: a Requester posting to
`/api/staff/tickets/9999/actions-taken` is `403`, never `404`.

---

## 9. Endpoint summary

`Role` lists who may call it. **Bold** marks what Lab 4 adds or changes.

| Method | Path | Session | Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | no | public |
| `POST` | `/api/auth/login` | no | public |
| `POST` | `/api/auth/logout` | optional | any |
| `GET` | `/api/auth/me` | yes | any, incl. must-change |
| `POST` | `/api/auth/password` | yes | any, incl. must-change |
| `GET` | `/api/categories`, `/api/related-systems` | yes | any |
| `POST` | `/api/tickets` | yes | Requester |
| `GET` | **`/api/tickets`** | yes | Requester — **gains `group`** |
| `GET` | `/api/tickets/:id` | yes | Requester (own) |
| `PATCH` | `/api/tickets/:id/appears-resolved` | yes | Requester (own) — now bumps `version` |
| `POST` `GET` | `/api/tickets/:id/attachments` | yes | Requester (own) |
| `GET` | `/api/attachments/:id/download` | yes | Requester (own) |
| `PATCH` | `/api/attachments/:id/remove` | yes | Requester (own) |
| `GET` `POST` | `/api/tickets/:id/comments` | yes | Requester (own), IT Staff, Administrator |
| `GET` `POST` | `/api/tickets/:id/notes` | yes | IT Staff, Administrator |
| **`GET`** | **`/api/tickets/:id/actions-taken`** | yes | **Requester (own), IT Staff, Administrator** |
| **`GET`** | **`/api/tickets/:id/status-history`** | yes | **Requester (own), IT Staff, Administrator** |
| **`GET`** | **`/api/dashboard/requester`** | yes | **Requester** |
| **`GET`** | **`/api/staff/dashboard`** | yes | **IT Staff, Administrator** |
| **`GET`** | **`/api/staff/tickets`** | yes | **IT Staff, Administrator — gains `group`** |
| **`GET`** | **`/api/staff/tickets/:id`** | yes | **IT Staff, Administrator — gains `version`, `owner.role`, `blockedTransitions`** |
| **`POST`** | **`/api/staff/tickets/:id/actions-taken`** | yes | **IT Staff, Administrator** |
| **`PATCH`** | **`/api/staff/tickets/:id/actions-taken/:actionId`** | yes | **IT Staff, Administrator** |
| **`PATCH`** | **`/api/staff/tickets/:id/owner`** | yes | **IT Staff, Administrator — `expectedVersion`** |
| **`PATCH`** | **`/api/staff/tickets/:id/it-priority`** | yes | **IT Staff, Administrator — `expectedVersion`, row lock** |
| **`PATCH`** | **`/api/staff/tickets/:id/status`** | yes | **IT Staff, Administrator — `expectedVersion`, the gate, history** |
| **`GET`** | **`/api/staff/attachments/:id/download`** | yes | **IT Staff, Administrator** |
| **`GET`** | **`/api/staff/assignable-users`** | yes | **IT Staff, Administrator** |
| `GET` `POST` | `/api/admin/users` | yes | Administrator |
| `PATCH` | `/api/admin/users/:id` | yes | Administrator |
| `POST` | `/api/admin/users/:id/initial-password` | yes | Administrator |

---

## 10. Traceability

| Area | Requirements | Rules | Criteria |
| :--- | :--- | :--- | :--- |
| §2 Actions Taken | FR-01 – FR-08 | BR-01 – BR-14, BR-27, BR-28 | AC-01, AC-04 – AC-10 |
| §3 Ticket workflow | FR-09 – FR-14 | BR-15 – BR-26, BR-29 | AC-03, AC-11 – AC-16 |
| §4, §6 Dashboards | FR-15 – FR-20 | BR-30 – BR-41 | AC-02, AC-18 – AC-22, AC-34 |
| §5 Filters | FR-18, FR-21 | BR-31, BR-40 | AC-21 |
| §7 Hardening | FR-29, FR-33 | BR-51, BR-52, BR-55 | AC-26, AC-33 |
| §8, §9 Guards and roles | FR-22 – FR-24 | BR-42 – BR-45 | AC-17 |
