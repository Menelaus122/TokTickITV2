# Lab 3 — Test Plan and Results

Companion to [`specification.md`](./specification.md). Written **before**
implementation, as the Test DD deliverable requires: every test below was planned
from an acceptance criterion, not reconstructed from code an agent produced.

Status column meaning: **Planned** until the owning issue merges, then the real
runner result. Issue 11 (#44) refreshes §6 with the full run from `lab3-staging`.

---

## 1. Test strategy

| Layer | Tool | Scope |
| :--- | :--- | :--- |
| Unit | Vitest | pure logic — password rules, session token derivation, the transition matrix, queue query parsing |
| API / integration | Vitest + Supertest | every endpoint against a real PostgreSQL database, driven through real login requests |
| Security / authorization | Vitest + Supertest | the BR-18 matrix, hit directly with the wrong role and with no session at all |
| Migration / regression | Vitest | Lab 2 data survives, Lab 1 and Lab 2 suites still pass |
| UI component | Vitest + Testing Library | screen behaviour, validation, modes, states |
| UI style | Vitest + Testing Library | tokens, badges, read-only styling, validation placement, busy and disabled states |
| Responsive | Playwright | Desktop ≥ 992 px, Tablet 768–991 px, Mobile < 768 px |
| End-to-end | Playwright | the three journeys in labsheet §12 |

Principles carried over from Lab 2:

* **Authorization is proven at the API, not the screen.** A hidden button proves
  nothing, so every forbidden case is asserted with a direct request (AC-09).
* **Tests log in like a user.** No test fabricates a session row or stubs the
  guard; they call `POST /api/auth/login` and reuse the cookie.
* **The suite leaves the database as it found it.** Anything created is removed in
  `afterAll`, as Lab 2's API suite does.
* **Seeded passwords only.** No test invents a credential outside §7.5 of the
  specification.
* **Each issue ships its own tests.** Issue 11 adds E2E, responsive, and
  screenshots, not the unit and API tests that belong to earlier issues.

---

## 2. Planned tests

### 2.1 Unit — `server/tests/lab-03/`

| ID | File | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | `password.test.ts` | password rules at 7, 8, 72, 73 characters, and at bcrypt's 72-byte limit | 7 and 73 rejected, 8 and 72 accepted; 25 Thai characters (75 bytes) rejected, 24 (72 bytes) accepted (BR-07) | 3 | Pass |
| UNIT-02 | `password.test.ts` | password equal to the user's email | rejected | 3 | Pass |
| UNIT-03 | `password.test.ts` | hash then verify; a wrong password fails | bcrypt round-trip holds, hash never equals input (BR-06) | 3 | Pass |
| UNIT-04 | `session.test.ts` | token generation and SHA-256 derivation | 32 bytes, URL-safe, never stored raw (BR-09, BR-10) | 3 | Pass |
| UNIT-05 | `session.test.ts` | expiry arithmetic at 8 hours | a session one second past expiry is invalid (BR-11) | 3 | Pass |
| UNIT-06 | `transitions.test.ts` | every pair in the BR-33 matrix | of the 56 ordered pairs of different statuses, exactly the 15 permitted ones allowed and the other 41 refused | 9 | Pass |
| UNIT-07 | `transitions.test.ts` | same-status transition | refused (BR-38) | 9 | Pass |
| UNIT-08 | `transitions.test.ts` | reason requirement per target status | required for Resolved, Cancelled, Reopened only (BR-36, BR-37) | 9 | Pass |
| UNIT-09 | `queue-query.test.ts` | query parsing: defaults, permitted sorts, page sizes; ids and `page` above 2147483647 or not plain digits (`1.0`, `1e0`) | defaults applied; unknown or out-of-range values rejected, never corrected (BR-55, BR-58; api-spec §1.5) | 8 | Pass |
| UNIT-10 | `queue-query.test.ts` | blank `q` after trimming; `%` and `_` kept as typed; a NUL character | treated as absent (BR-53); kept; rejected | 8 | Pass |
| UNIT-11 | `login-throttle.test.ts` | four, then five failures for one email, against an explicit clock | no lock after four; the fifth locks for 15 minutes from itself; the lock lifts exactly at expiry with a clean count (BR-67) | 13 | Pass |
| UNIT-12 | `login-throttle.test.ts` | failures spread across more than 15 minutes | a failure leaves the count once it is 15 minutes old; five inside the window lock (BR-67) | 13 | Pass |
| UNIT-13 | `login-throttle.test.ts` | key normalisation, separate emails, success, and the size cap | case and spaces share one count; emails are independent; success clears; the cap holds, and unlocked emails are forgotten before locked ones (BR-67, D-24) | 13 | Pass |
| UNIT-14 | `login-throttle.test.ts` | attempts reserved but not yet finished | a sixth is refused while five are in flight; in-flight attempts add to earlier failures; failures returned lock; neutral outcomes give the slot back; a success keeps other reservations (BR-67) | 13 | Pass |
| UNIT-15 | `user-rules.test.ts` | user field validation, and the self and last-Administrator rules as a pure decision | name trimmed, email lowercased, exactly one role; a self deactivation or role change refused; removing the last active Administrator refused, by deactivation or demotion (BR-45, BR-48, BR-49) | 10 | Pass |

### 2.2 API — authentication, `server/tests/lab-03/auth.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | AC-01 | valid login for an active user | 201, session cookie set, permitted user shape, no hash or token in the body | 3 | Pass |
| API-02 | AC-04 | unknown email | 401 `INVALID_CREDENTIALS` | 3 | Pass |
| API-03 | AC-04 | wrong password | 401 `INVALID_CREDENTIALS`, byte-identical body to API-02 | 3 | Pass |
| API-04 | AC-03 | correct password, inactive account | 403 `ACCOUNT_INACTIVE`, no session created | 3 | Pass |
| API-05 | AC-01 | malformed email and empty password | 400 `VALIDATION_FAILED` with `fields` | 3 | Pass |
| API-06 | AC-05 | `/api/auth/me` with a valid cookie | 200 with the current user | 3 | Pass |
| API-07 | AC-05 | logout, then reuse the same cookie | 204, then 401 `AUTH_REQUIRED` on every protected endpoint | 3 | Pass |
| API-08 | AC-05 | logout with no session | 204, not an error | 3 | Pass |
| API-09 | AC-02 | change password: too short, too long, mismatch, equal to email, equal to current | 400 on each, per-field messages | 3 | Pass |
| API-10 | AC-02 | change password with a wrong current password | 401 `INVALID_CREDENTIALS` | 3 | Pass |
| API-11 | AC-02 | successful change clears `mustChangePassword` | 200, `/api/auth/me` reports false | 3 | Pass |
| API-12 | AC-06 | after a change, a second session for the same user | refused with 401 (BR-15) | 3 | Pass |
| API-13 | AC-02 | `mustChangePassword` session calling a normal endpoint | 403 `PASSWORD_CHANGE_REQUIRED`; `/me`, `/password`, `/logout` still work (BR-14) | 3 | Pass |
| API-14 | AC-01 | expired session | 401 `AUTH_REQUIRED` (BR-11) | 3 | Pass |
| API-67 | BR-66 | login as a user whose `passwordHash` is null | 401 `INVALID_CREDENTIALS`, identical to a wrong password, no session created | 3 | Pass |
| API-69 | AC-40 | five wrong passwords, then the correct one (`login-throttle.api.test.ts`) | 429 `TOO_MANY_ATTEMPTS` with `Retry-After` of about 15 minutes; no cookie, no session (BR-67) | 13 | Pass |
| API-70 | AC-40 | the same against an email with no account | the same 429 body and `Retry-After` as a real email, so a lock reveals nothing (BR-16) | 13 | Pass |
| API-71 | AC-40 | one email locked while another signs in; four failures, a success, four more; mixed-case spellings | only the locked email is refused; a success clears the count; spellings share one count (BR-45) | 13 | Pass |
| API-73 | AC-40 | twenty wrong passwords at once, and nineteen wrong plus the correct one at once, with `Promise.all` | at most five passwords evaluated (401 or 201), the rest 429, and a session only if the correct one was among the five (BR-67) | 13 | Pass |
| API-72 | BR-67 | six malformed requests, then six correct passwords for an inactive account | never 429: validation errors and an inactive account's correct password are not counted | 13 | Pass |

### 2.3 API — authorization, `server/tests/lab-03/authorization.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-01 | AC-10 | every session-only endpoint with no cookie: `/api/auth/me`, `/api/auth/password`, every `/api/staff/*` and `/api/admin/*` route, and — since Issue 6 — every Lab 2 endpoint (categories, related systems, tickets, attachments), also with only an `X-Requester-Id` header | 401 `AUTH_REQUIRED`, never 403, and the header never stands in for a session | 4, 6 | Pass |
| SEC-02 | AC-09 | Requester calls each `/api/staff/*` endpoint | 403 `FORBIDDEN` | 4 | Pass |
| SEC-03 | AC-09 | Administrator calls each `/api/staff/*` endpoint | 403 `FORBIDDEN` (BR-19) | 4 | Pass |
| SEC-04 | AC-09 | IT Staff and Requester call each `/api/admin/*` endpoint | 403 `FORBIDDEN` | 4 | Pass |
| SEC-05 | AC-08 | Requester reads and posts Internal Notes | 403, no note body, author, or count anywhere in the response | 7 | Pass |
| SEC-06 | AC-11 | Requester opens another Requester's ticket, attachment list, upload, download, and removal | 404 on every route, identical to a nonexistent id. Comments are covered by API-23 when Issue 7 adds them | 4 | Pass |
| SEC-07 | AC-07 | body carries another user's `requesterId`; header carries `X-Requester-Id` | both ignored, session identity used, no cross-Requester data returned | 4, 6 | Pass |
| SEC-08 | AC-07 | `POST /api/tickets` with a body `ticketNumber` and `currentStatus` | both ignored, backend values win (Lab 2 BR-01) | 6 | Pass |
| SEC-09 | AC-10 | guard order: no session **and** wrong role | 401 wins over 403 (api-spec §7) | 4 | Pass |
| SEC-10 | AC-28 | every user-carrying response across the whole API | no `passwordHash`, no `tokenHash`, no `initialPassword` field (BR-52) | 4, 10 | Pass |
| SEC-11 | BR-65 | `POST`, `PATCH`, and a `multipart/form-data` upload carrying a foreign `Origin` header | 403 `FORBIDDEN` before the handler runs; the same requests with the configured origin, and a `GET` with a foreign origin, succeed | 4 | Pass |

### 2.4 API — Requester regression, `server/tests/lab-03/requester-regression.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-15 | AC-13 | create, list, read, attach, download, soft-remove as a logged-in Requester | every Lab 2 behaviour holds | 6 | Pass |
| API-16 | AC-14 | `X-Requester-Id` naming another user; the header alone with no session | ignored with a session, so the session's tickets are returned; 401 without one, and nothing is created | 6 | Pass |
| API-17 | AC-13 | My Tickets search, filters, sort, pagination; the status filter with each of the eight statuses | unchanged from Lab 2's contract; each status filters the session's own tickets, and any other value is 400 `INVALID_QUERY` | 6 | Pass |
| API-18 | AC-12 | `GET /api/requesters` | 404, the endpoint is gone (FR-16) | 6 | Pass |
| API-19 | AC-15 | appears-resolved with a valid comment | 200, `requesterResolvedAt` set, comment created, status unchanged | 7 | Pass |
| API-20 | AC-15 | appears-resolved with a 4-character comment | 400 `VALIDATION_FAILED` | 7 | Pass |
| API-21 | AC-15 | Requester sends `currentStatus: "RESOLVED"` anywhere | no endpoint accepts it; status unchanged (BR-05) | 7 | Pass |

API-19 – API-21 also live in this file, beside the rest of the Requester's own
ticket. The same file also pins a fix from the Issue 4 review: a route id Express
cannot percent-decode (`/api/tickets/%E0`, `/api/attachments/%E0/download`)
answers `400 INVALID_QUERY` with the handler's own "id is not valid" message,
not the JSON-body message. The Lab 2 suites sign in through
`server/tests/helpers/signIn.ts`, which removes exactly the sessions it made.

### 2.5 API — comments and notes, `server/tests/lab-03/comments-notes.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-22 | AC-16 | owning Requester, IT Staff, and Administrator read one thread | all three see the same comments with authors and timestamps | 7 | Pass |
| API-23 | AC-16 | non-owning Requester reads the thread | 404 | 7 | Pass |
| API-24 | AC-18 | empty and whitespace-only bodies, comment and note | 400 on all four | 7 | Pass |
| API-25 | AC-18 | 2001-character body | 400; 2000 accepted | 7 | Pass |
| API-26 | AC-17 | IT Staff posts a note, Requester fetches the ticket and its comments | note absent from every field | 7 | Pass |
| API-27 | AC-19 | `PATCH` and `DELETE` on a comment and a note | 404 — no such route exists (BR-42) | 7 | Pass |
| API-28 | AC-16 | author and timestamp come from the server | client-supplied `authorId` and `createdAt` ignored (BR-40) | 7 | Pass |
| API-29 | BR-44 | posting a comment or note | ticket `updatedAt` advances (BR-44) | 7 | Pass |

### 2.6 API — IT Staff queue, `server/tests/lab-03/staff-queue.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-30 | AC-20 | queue as IT Staff with tickets from several Requesters | all Requesters' tickets present | 8 | Pass |
| API-31 | AC-20 | default ordering | IT Priority descending, oldest `createdAt` first within a priority (BR-55) | 8 | Pass |
| API-32 | AC-21 | `q` against Ticket Number and Summary, case-insensitive; `%` and `_` in `q` | only matches returned; `%` and `_` match literally, not as wildcards | 8 | Pass |
| API-33 | AC-21 | `status`, `itPriority`, `categoryId` filters, alone and combined | AND semantics (BR-54) | 8 | Pass |
| API-34 | AC-21 | `owner=unassigned`, `owner=me`, `owner=<id>` | correct subsets; unassigned returns `owner: null` | 8 | Pass |
| API-35 | AC-21 | `sort` and `direction` across all permitted fields | ordering matches, `id` descending breaks ties (BR-56) | 8 | Pass |
| API-36 | AC-21 | pagination: page 1, page 2, page sizes 10/20/50 | correct slices and metadata (BR-57) | 8 | Pass |
| API-37 | AC-21 | unknown sort, bad direction, `pageSize=15`, `page=0`, unknown status; `categoryId`, `owner`, or `page` above 2147483647; `pageSize=10.0`; a NUL in `q` | 400 `INVALID_QUERY` on each, never 500 (BR-58; api-spec §1.5) | 8 | Pass |
| API-38 | AC-21 | page beyond the last | 200, empty list, correct metadata (BR-59) | 8 | Pass |
| API-39 | BR-26 | owner of a deactivated account | row still carries the owner with `isActive: false` (BR-26) | 8 | Pass |

### 2.7 API — IT Staff ticket detail, `server/tests/lab-03/staff-ticket-detail.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-40 | AC-22 | claim an unassigned `NEW` ticket | 200, owner set, status `OPEN` in one operation (BR-34) | 9 | Pass |
| API-41 | AC-23 | second IT Staff member claims the same ticket, one after the other and at the same time | 409 `TICKET_ALREADY_OWNED`, owner unchanged; exactly one of two simultaneous claims wins (D-26) | 9 | Pass |
| API-42 | AC-22 | reassign to another active IT Staff member, then unassign | both 200 | 9 | Pass |
| API-43 | BR-24 | assign to a Requester, and to an inactive IT Staff member | 409 `OWNER_NOT_ASSIGNABLE` on both (BR-24) | 9 | Pass |
| API-44 | AC-24 | change IT Priority | 200, `requestedPriority` unchanged (BR-27) | 9 | Pass |
| API-45 | AC-25 | every permitted transition in the matrix | 200 for each | 9 | Pass |
| API-46 | AC-25 | refused transitions, including `CANCELLED` → anything | 409 `INVALID_TRANSITION`, status unchanged | 9 | Pass |
| API-47 | AC-26 | Resolved, Cancelled, Reopened without a reason | 400 `VALIDATION_FAILED` | 9 | Pass |
| API-48 | AC-26 | Resolved with a reason | 200 and a Public Comment created in the same transaction (D-08) | 9 | Pass |
| API-49 | BR-35 | Resolve and close a ticket with no owner | 409 `OWNER_REQUIRED` on both | 9 | Pass |
| API-68 | BR-35 | cancel an unassigned `NEW` ticket with a reason | 200 — cancelling needs no owner, unlike resolve and close | 9 | Pass |
| API-50 | BR-30 | any successful transition on a ticket flagged by its Requester | `requesterResolvedAt` cleared (BR-30) | 9 | Pass |
| API-51 | AC-27 | `permittedTransitions` in the detail response | matches the matrix for the current status (FR-34) | 9 | Pass |
| API-52 | AC-27 | attachments on the staff detail response | active ones downloadable, removed ones present as marked metadata | 9 | Pass |

### 2.8 API — administration, `server/tests/lab-03/users-admin.api.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API-53 | AC-28 | user list as Administrator | every user with Name, Email, Role, Status; no password material | 10 | Pass |
| API-54 | AC-29 | `q` against name and email, case-insensitive | only matches | 10 | Pass |
| API-55 | AC-29 | `role` filter, and an unknown role value | correct subset; 400 `INVALID_QUERY` for the unknown value | 10 | Pass |
| API-56 | AC-30 | create a user with one role and an initial password | 201, `mustChangePassword` true (BR-46) | 10 | Pass |
| API-57 | AC-31 | create with an existing email, differing only in case | 409 `EMAIL_IN_USE` on the email field (BR-45) | 10 | Pass |
| API-58 | AC-30 | log in as the created user | succeeds, `mustChangePassword` true, normal endpoints 403 until changed | 10 | Pass |
| API-59 | FR-43 | create with an invalid role, a 7-character password, a blank name | 400 with per-field messages | 10 | Pass |
| API-60 | AC-28 | edit name, email, role, activation | 200 on each | 10 | Pass |
| API-61 | AC-31 | edit an email to one already in use | 409 `EMAIL_IN_USE` | 10 | Pass |
| API-62 | AC-32 | Administrator deactivates self, and changes own role | 409 `SELF_DEACTIVATION` on both (BR-48) | 10 | Pass |
| API-63 | AC-33 | two Administrators, the only active ones, deactivate and demote each other at once; and a change made while another holds the Administrators' lock | exactly one succeeds and one active Administrator remains; the loser is 409 `LAST_ADMINISTRATOR` or already signed out; the second change waits for the lock (BR-49, D-27) | 10 | Pass |
| API-64 | AC-34 | set a new initial password | 200, target's sessions refused afterwards, next login must change (BR-47) | 10 | Pass |
| API-65 | BR-51 | deactivate a user who holds tickets | sessions deleted, ticket ownership retained (BR-26, BR-51) | 10 | Pass |
| API-66 | BR-50 | any delete route for a user | 404 — none exists (BR-50) | 10 | Pass |

### 2.9 Migration and regression — `server/tests/lab-03/migration.regression.test.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| MIG-01 | AC-35 | ticket count, attachment count, and requester bindings before and after migrating | identical (BR-62) | 2 | Pass |
| MIG-02 | AC-35 | `itPriority` on every pre-existing ticket | equals `requestedPriority` (BR-63) | 2 | Pass |
| MIG-03 | AC-35 | migrated Requesters immediately after the migration, before the seed | role `REQUESTER`, `mustChangePassword` true, `passwordHash` null (BR-61, D-22) | 2 | Pass |
| MIG-04 | AC-35 | ids preserved across the rename | every `Ticket.requesterId` still resolves (BR-60) | 2 | Pass |
| MIG-05 | AC-36 | Lab 1 and Lab 2 suites after migration | all pass (BR-64), each signing in through `POST /api/auth/login` instead of sending `X-Requester-Id` | 6 | Pass |
| MIG-06 | BR-61 | seed run twice | the database is identical after the second run, every column of users, tickets, comments, notes, and sessions included — timestamps too, so no row is rewritten when nothing drifted (labsheet §5.3) | 2 | Pass |
| MIG-07 | §7.5 | seed account counts, ticket spread, and timeline | ≥ 4 active Requesters + 1 inactive, ≥ 3 active IT Staff + 1 inactive, ≥ 2 active Administrators; tickets in all 8 statuses and 4 priorities; each seeded ticket's Last Updated follows its own seeded history and is never the moment the seed ran | 2 | Pass |
| MIG-08 | D-22 | migrated Requester after the migration but before the seed, then after it | before: `passwordHash` null, so the documented password cannot verify (BR-66) — the login endpoint's own answer is API-67 in Issue 3; after: the documented password works with no forced change, and `first.login@toktickit.local` is the only seeded account that must change (BR-61, §7.5) | 2 | Pass |
| MIG-09 | §7.5 | change a documented account's password and set its flag, then re-run the seed | the documented password works again and the flag is back to its documented value; an account created through User Management is untouched | 2 | Pass |
| MIG-10 | BR-28 | create a ticket through the Lab 2 endpoint after the migration | `itPriority` equals `requestedPriority` and the ticket is unassigned | 2 | Pass |
| MIG-11 | BR-03 | an IT Staff account trying to act as a Requester: through `X-Requester-Id`, through its own session, and through the selector's list | Issue 2 refused the header as `REQUESTER_INVALID`; since Issue 6 the header alone is 401, the staff session is 403 `FORBIDDEN`, and `/api/requesters` is 404 | 2, 6 | Pass |
| MIG-12 | BR-45 | migrate a Lab 2 Requester whose email has capitals and surrounding spaces | stored as `lower(trim(email))`, and every migrated email is lowercase | 2 | Pass |

### 2.10 UI component — `client/tests/lab-03/`

| ID | AC | File | What it tests | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | AC-01 | `Login.test.tsx` | required-field validation, busy and disabled submit, one request per submission | 5 | Pass |
| UI-02 | AC-04 | `Login.test.tsx` | invalid credentials render one generic message; both fields keep their values | 5 | Pass |
| UI-03 | AC-03 | `Login.test.tsx` | inactive-account message distinct and safe | 5 | Pass |
| UI-04 | AC-38 | `Login.test.tsx` | API failure shows the callout and a Try again action | 5 | Pass |
| UI-05 | AC-02 | `ChangePassword.test.tsx` | rules text, mismatch, too short, too long, success path | 5 | Pass |
| UI-06 | AC-02 | `ChangePassword.test.tsx` | mandatory mode renders without the shell and blocks navigation away | 5 | Pass |
| UI-07 | AC-09 | `RoleNavigation.test.tsx` | each role sees only its own destinations; an unauthorized route shows the forbidden state | 5 | Pass |
| UI-08 | AC-05 | `RoleNavigation.test.tsx` | shell shows name and Role badge, and Logout clears the session | 5 | Pass |
| UI-09 | AC-12 | `RequesterRegression.test.tsx` | no selector, no Change Requester control anywhere, and nothing in localStorage; the old selector URL leads home or to Login; requests never carry `X-Requester-Id`; a 401 mid-session returns to Login and back; eight status labels and filters | 6 | Pass |
| UI-10 | AC-15 | `RequesterComments.test.tsx` | comment composer validation, appears-resolved panel, undo, and the "only IT Staff can resolve" helper text | 7 | Pass |
| UI-11 | AC-17 | `RequesterComments.test.tsx` | no Internal Notes region and no element hinting at one | 7 | Pass |
| UI-12 | AC-21 | `StaffTicketQueue.test.tsx` | search, each filter, sort, page size, and Clear Filters issue the documented requests; a new filter is never requested on the old page, and a late, superseded response never replaces the latest one | 8 | Pass |
| UI-13 | AC-20 | `StaffTicketQueue.test.tsx` | seven columns in order; Unassigned rendered as the word | 8 | Pass |
| UI-14 | AC-38 | `StaffTicketQueue.test.tsx` | loading, empty, no-results, forbidden, failure states | 8 | Pass |
| UI-15 | AC-22 | `StaffTicketDetail.test.tsx` | Claim shown only when unassigned; confirmation mentions the move to Open | 9 | Pass |
| UI-16 | AC-24 | `StaffTicketDetail.test.tsx` | Requested Priority read-only, IT Priority editable, both visible | 9 | Pass |
| UI-17 | AC-25 | `StaffTicketDetail.test.tsx` | the status select offers only `permittedTransitions` | 9 | Pass |
| UI-18 | AC-26 | `StaffTicketDetail.test.tsx` | reason textarea required before Apply for Resolved, Cancelled, Reopened | 9 | Pass |
| UI-19 | AC-39 | `StaffTicketDetail.test.tsx` | the two threads are distinct regions with distinct button wording and the internal caption | 9 | Pass |
| UI-20 | AC-28 | `UserManagement.test.tsx` | list columns, search, role filter, empty and no-results states | 10 | Pass |
| UI-21 | AC-30 | `UserManagement.test.tsx` | create panel: role as radio buttons, required initial password, helper text | 10 | Pass |
| UI-22 | AC-31 | `UserManagement.test.tsx` | duplicate email renders on the email field | 10 | Pass |
| UI-23 | AC-32 | `UserManagement.test.tsx` | own row has Role and Active disabled with the explanatory helper text | 10 | Pass |
| UI-24 | AC-33 | `UserManagement.test.tsx` | last-Administrator refusal renders as its own callout | 10 | Pass |
| UI-25 | AC-34 | `UserManagement.test.tsx` | new-initial-password confirmation states the sign-out consequence | 10 | Pass |

`RequesterComments.test.tsx` also renders the public and internal variants of
the shared `ConversationThread` side by side and checks they cannot be
confused: different accessible names, the "Internal — not visible to the
Requester" caption on the internal one only, the internal region styling, and
different button labels ("Post comment" / "Post internal note"). The IT Staff
screen that places both threads is Issue 9 (UI-15 – UI-19, AC-39).

### 2.11 UI style — `client/tests/lab-03/ZenGreenLab3.test.tsx`

| ID | AC | What it tests | Issue | Status |
| :--- | :--- | :--- | :--- | :--- |
| STYLE-01 | AC-37 | every new screen uses only Lab 2 colour tokens; no hard-coded hex | 5–10 | Planned |
| STYLE-02 | AC-39 | Role, Status, Requested Priority, and IT Priority badges carry text, not colour alone | 8, 9 | Planned |
| STYLE-03 | AC-37 | read-only fields use `--tt-readonly-bg` and `readonly`, distinct from disabled controls | 9 | Pass |
| STYLE-04 | AC-37 | required fields show the red asterisk and still render a validation message when invalid | 5, 10 | Planned |
| STYLE-05 | AC-37 | validation messages sit beneath their own field | 5, 9, 10 | Planned |
| STYLE-06 | AC-38 | busy buttons are disabled, labelled, and permit one request | 5, 9, 10 | Planned |
| STYLE-07 | AC-39 | the Internal Notes region carries its dashed edge, lock icon, and `aria-label` | 9 | Pass |

### 2.12 Responsive — `e2e/lab-03/responsive.spec.ts`

| ID | AC | What it tests | Expected | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RESP-01 | AC-37 | Login and Change Password at all three widths | card fits, no horizontal scroll | 11 | Planned |
| RESP-02 | AC-37 | shell navigation at < 768 px | hamburger menu holds navigation, user, Change Password, Logout | 11 | Planned |
| RESP-03 | AC-37 | queue at ≥ 992, 768–991, < 768 px | table, wrapped table, card list; no horizontal scroll at 320 px | 11 | Planned |
| RESP-04 | AC-37 | staff ticket detail at all three widths | two columns, then stacked with operational first | 11 | Planned |
| RESP-05 | AC-37 | User Management at all three widths | table then card list; panel as drawer then full-screen sheet | 11 | Planned |
| RESP-06 | AC-37 | every new screen at all three widths | no clipping, no overlap, focus outlines visible | 11 | Planned |

### 2.13 End-to-end — `e2e/lab-03/`

| ID | AC | File | Journey | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | AC-01, AC-05 | `authentication.spec.ts` | log in as a Requester, see name and role, log out, then direct access to a protected route is blocked | 11 | Planned |
| E2E-02 | AC-02 | `authentication.spec.ts` | log in with an initial password, be forced to Change Password, set a new one, land in the app | 11 | Planned |
| E2E-03 | AC-03, AC-04 | `authentication.spec.ts` | wrong password, then the inactive account, each with its own message | 11 | Planned |
| E2E-04 | AC-20, AC-22 | `staff-ticket-flow.spec.ts` | IT Staff open the queue, filter to unassigned, claim a `NEW` ticket, see it become Open | 11 | Planned |
| E2E-05 | AC-24, AC-26 | `staff-ticket-flow.spec.ts` | raise IT Priority, move to Resolved with a reason, confirm the Public Comment appears | 11 | Planned |
| E2E-06 | AC-16, AC-17 | `staff-ticket-flow.spec.ts` | IT Staff add a note and a comment; the Requester sees only the comment | 11 | Planned |
| E2E-07 | AC-15 | `staff-ticket-flow.spec.ts` | the Requester marks the problem as appearing resolved; IT Staff see the signal in the queue | 11 | Planned |
| E2E-08 | AC-30, AC-34 | `user-administration.spec.ts` | Administrator creates a user, then that user logs in and must change the password | 11 | Planned |
| E2E-09 | AC-31, AC-33 | `user-administration.spec.ts` | duplicate email is refused; the last-Administrator rule is refused | 11 | Planned |
| E2E-10 | AC-09 | `user-administration.spec.ts` | a Requester typing `/users` is refused, and the API refuses too | 11 | Planned |

---

## 3. Acceptance-criterion traceability

Every criterion has at least one test, and nothing is left to manual inspection
alone.

| AC | Tests |
| :--- | :--- |
| AC-01 | API-01, API-05, API-14, UNIT-03, UI-01, E2E-01 |
| AC-02 | API-09, API-10, API-11, API-13, UNIT-01, UNIT-02, UI-05, UI-06, E2E-02 |
| AC-03 | API-04, UI-03, E2E-03 |
| AC-04 | API-02, API-03, API-67, UI-02, E2E-03 |
| AC-05 | API-06, API-07, API-08, UI-08, E2E-01 |
| AC-06 | API-12, UNIT-04 |
| AC-07 | SEC-07, SEC-08 |
| AC-08 | SEC-05, API-26 |
| AC-09 | SEC-02, SEC-03, SEC-04, UI-07, E2E-10 |
| AC-10 | SEC-01, SEC-09, UNIT-05 |
| AC-11 | SEC-06, API-23 |
| AC-12 | API-18, UI-09 |
| AC-13 | API-15, API-17, MIG-05 |
| AC-14 | API-16, SEC-07 |
| AC-15 | API-19, API-20, API-21, API-50, UI-10, E2E-07 |
| AC-16 | API-22, API-28, E2E-06 |
| AC-17 | API-26, UI-11, E2E-06 |
| AC-18 | API-24, API-25 |
| AC-19 | API-27 |
| AC-20 | API-30, API-31, UI-13, E2E-04 |
| AC-21 | API-32 – API-38, UNIT-09, UNIT-10, UI-12 |
| AC-22 | API-40, API-42, UI-15, E2E-04 |
| AC-23 | API-41 |
| AC-24 | API-44, MIG-10, UI-16, E2E-05 |
| AC-25 | API-45, API-46, API-68, UNIT-06, UNIT-07, UI-17 |
| AC-26 | API-47, API-48, UNIT-08, UI-18, E2E-05 |
| AC-27 | API-51, API-52 |
| AC-28 | API-53, API-60, SEC-10, UI-20 |
| AC-29 | API-54, API-55 |
| AC-30 | API-56, API-58, UI-21, E2E-08 |
| AC-31 | API-57, API-61, UI-22, E2E-09 |
| AC-32 | API-62, UI-23 |
| AC-33 | API-63, UI-24, E2E-09 |
| AC-34 | API-64, UI-25, E2E-08 |
| AC-35 | MIG-01 – MIG-04, MIG-08, MIG-11, MIG-12 |
| AC-36 | MIG-05 |
| AC-37 | RESP-01 – RESP-06, STYLE-01, STYLE-03, STYLE-04, STYLE-05 |
| AC-38 | UI-04, UI-14, STYLE-06 |
| AC-39 | UI-19, STYLE-02, STYLE-07 |
| AC-40 | API-69, API-70, API-71, API-73, UNIT-11, UNIT-12, UNIT-13, UNIT-14 |

### 3.1 Planned test distribution by issue

| Issue | Tests |
| :--- | :--- |
| 2 — User model, migration, seed | MIG-01 – MIG-04, MIG-06 – MIG-12 |
| 3 — Authentication API | UNIT-01 – UNIT-05, API-01 – API-14, API-67 |
| 4 — Authorization | SEC-01 – SEC-04, SEC-06, SEC-07, SEC-09 – SEC-11 |
| 5 — Login and shell | UI-01 – UI-08 |
| 6 — Requester regression | API-15 – API-18, SEC-08, UI-09, MIG-05 |
| 7 — Comments and notes | API-19 – API-29, SEC-05, UI-10, UI-11 |
| 8 — Ticket Queue | UNIT-09, UNIT-10, API-30 – API-39, UI-12 – UI-14 |
| 9 — Staff Ticket Detail | UNIT-06 – UNIT-08, API-40 – API-52, API-68, UI-15 – UI-19, STYLE-03, STYLE-07 |
| 10 — User Management | API-53 – API-66, UI-20 – UI-25 |
| 11 — E2E and visual evidence | RESP-01 – RESP-06, E2E-01 – E2E-10, STYLE-01, STYLE-02, STYLE-04 – STYLE-06 |
| 13 — Login attempt throttling | UNIT-11 – UNIT-14, API-69 – API-73 |

---

## 4. Responsive and visual checklist

Recorded per breakpoint in Issue 11, using the checklist in `ui-spec.md` §12.
Every line is checked at Desktop 1440×900, Tablet 820×1180, and Mobile 390×844,
on Login, Change Password, the shell, the queue, staff ticket detail, Requester
ticket detail, and User Management.

| Item | Desktop | Tablet | Mobile |
| :--- | :--- | :--- | :--- |
| Design consistency, tokens only | | | |
| Role-specific navigation, nothing unauthorized shown | | | |
| Active-page indication, not colour-only | | | |
| Status / priority / role badges correct and spelled out | | | |
| Unassigned shown as a word | | | |
| Read-only vs editable vs disabled distinct | | | |
| Validation beneath its own field | | | |
| Internal Notes region distinct and labelled | | | |
| Focus outlines visible | | | |
| No clipping, overlap, or horizontal overflow | | | |
| Busy states block double submission | | | |
| Empty / no-results / forbidden / failure states legible | | | |

### 4.1 Screenshot artifacts

Per `ui-spec.md` §13, under `artifacts/lab-03/screenshots/` in `authentication/`,
`staff-queue/`, `staff-ticket-detail/`, and `user-management/`.

---

## 5. Test commands

The database must be migrated and seeded first; the API suites log in with the
seeded accounts from `specification.md` §7.5.

### Backend — unit, API, authorization, migration

```sh
cd server
npx prisma migrate deploy
npm run prisma:seed
npx vitest run
```

### Frontend — UI component and UI style

```sh
cd client
npx vitest run
npx tsc --noEmit
```

### Responsive and E2E

```sh
# from the repo root, with server and client running
npx playwright test e2e/lab-03
```

### Everything

```sh
cd server && npx prisma migrate deploy && npm run prisma:seed && npx vitest run
cd ../client && npx vitest run && npx tsc --noEmit
cd .. && npx playwright test
```

---

## 6. Final results

Filled in from the real runner output as each issue merges, and completed in
Issue 11 (#44) from `lab3-staging`. Until then every row in §2 reads **Planned**.

| Suite | Files | Tests | Result |
| :--- | :--- | :--- | :--- |
| `server` unit + API + security + migration | — | — | pending |
| `client` UI component + UI style | — | — | pending |
| `e2e/lab-03` responsive + E2E | — | — | pending |
| Lab 1 + Lab 2 regression | — | — | pending |

Counts recorded here are the runner's own output, never estimated or restated
from memory.

---

## 7. Known limitations and deferred tests

| Area | Limitation |
| :--- | :--- |
| CSRF | No CSRF-token test exists, because Lab 3 relies on `SameSite=Lax` plus the `Origin` check instead of tokens (D-13). SEC-11 covers the `Origin` check; the cookie policy itself is a browser behaviour and is not exercised by Supertest. |
| Session expiry | UNIT-05 and API-14 test expiry with a clock-shifted session row rather than by waiting 8 hours. |
| Password cost | Tests run bcrypt at cost 10 (D-10); production cost is not exercised. |
| Actions Taken | Deferred to Lab 4, so no test covers resolution being blocked by incomplete Actions Taken. |
| Concurrency | API-41 and the status race test send two requests at once against the row lock and the conditional claim, and exactly one wins; sustained parallel load is not tested. |
| Accessibility | Checked by assertions on roles, labels, and focus order plus the manual checklist; no automated axe audit runs in Lab 3. |
| Lab 2 selector suites | `client/tests/lab-02/RequesterContext.test.tsx` tested only the Development Requester selection flow, which Issue 5 removed from the application; it was deleted in Issue 5, and UI-07 and UI-08 cover the shell and navigation that replaced it. Issue 6 deleted the rest of the selector, and with it `client/tests/lab-02/RequesterSelection.test.tsx` (the selection screen) and `server/tests/lab-02/requesters.api.test.ts` (`GET /api/requesters`); UI-09 and API-18 assert both are gone. The Lab 2 tests that asserted `REQUESTER_CONTEXT_REQUIRED`, `REQUESTER_INVALID`, and `REQUESTER_INACTIVE` now assert the session contract that retired those codes (api-spec §1.4). |
| Login throttling | The 15-minute lock and window are tested with an explicit clock (UNIT-11, UNIT-12) rather than by waiting. The counter is in memory (D-24), so the API tests cannot observe a lock surviving a restart, because it does not. |
