# Lab 4 — Test Plan and Results

Companion to [`specification.md`](./specification.md). Written **before**
implementation, as the Test DD deliverable requires: every test below was planned
from an acceptance criterion, not reconstructed from code an agent produced.

The **Final** column reads **Planned** until the owning issue merges, then the
real runner result. **Partial** means the part of the test that can exist at that
issue passes, and the rest arrives with the issue §3.1 names; it never means
that a test fails. Issue 10 (#76) refreshes §8 with the full run from
`lab4-staging`, and Issue 11 (#77) repeats it from `main`. Counts in §8 are only
ever the runner's own output.

---

## 1. Test strategy

| Layer | Tool | Scope |
| :--- | :--- | :--- |
| Unit | Vitest | pure logic — Action Taken validation, the resolution gate, transition options, `group` and body-guard parsing |
| API / integration | Vitest + Supertest | every endpoint against a real PostgreSQL database, driven through real login requests |
| Authorization | Vitest + Supertest | the BR-42 matrix, hit directly with the wrong role and with no session |
| Workflow | Vitest + Supertest | the transition matrix, the gate, the status history, and stale and simultaneous changes |
| Dashboard calculation | Vitest + Supertest | every metric against an **independent** query on the seed data, and every drill-down total |
| Migration / regression | Vitest | Lab 1–3 data survives, the rollback restores Lab 3, the seed is idempotent |
| Performance smoke | Vitest + Supertest | three endpoints, 20 requests each, none over 1000 ms |
| UI component | Vitest + Testing Library | screen behaviour, validation, modes, states, keyboard and focus |
| UI style | Vitest + Testing Library | tokens, badges, read-only styling, validation placement, busy and disabled states |
| Responsive | Playwright | Desktop ≥ 992 px, Tablet 768–991 px, Mobile < 768 px |
| End-to-end | Playwright | the three journeys in labsheet §12 |

Principles carried over from Labs 2 and 3:

* **Authorization is proven at the API, not the screen.** Every forbidden case is
  a direct request (AC-17).
* **Tests log in like a user.** No test fabricates a session or stubs a guard.
* **Seeded passwords only.** No test invents a credential outside the
  specification's §7.5.
* **The suite leaves the database as it found it.** What a test creates, it
  removes in `afterAll`.
* **Fixtures are chosen in `id` order and never depend on physical row order.**
  Lab 3's final run found a latent failure that way.
* **Each issue ships its own tests.** Issue 10 adds E2E, responsive, and
  screenshots, not the unit and API tests that belong to earlier issues.

Two principles are new:

* **A dashboard number is checked against a second query.** A test never asserts a
  literal count that the seed happens to produce; it computes the expected value
  with its own query and compares (AC-18, AC-19).
* **A drill-down is checked by following it.** The test calls the list endpoint
  with the card's `href` query and compares `totalItems` with `value`
  (AC-21).

---

## 2. Planned tests

Columns follow labsheet §10. **Requirement / AC** cites the acceptance criterion
first, then the rule or requirement where it adds precision.

### 2.1 Unit — `server/tests/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | Unit | AC-04, BR-03 | description, result, follow-up note, and attachment-notes lengths at each boundary: description 4/5 and 2000/2001, result 1/2 and 1000/1001, note 4/5 and 1000/1001, attachment notes 500/501 | the inner values accepted, the outer rejected, one message per field | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-02 | Unit | AC-04, BR-04, D-18 | Follow-up Note against Follow-Up Required?, including an edit that merges onto the stored record | required for Yes; ignored and cleared for No; an edit that sets Yes onto a record with no note is rejected without a note in the same request | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-03 | Unit | AC-04, BR-06 | Action Date/Time bounds against an explicit clock: now + 5 min, + 5 min 1 s; the Ticket's `createdAt`, 1 ms before it; a non-ISO value; a day that does not exist (31 February, 29 February in 2023 and 1900, the day after the end of every month) and `24:00`, each on a Ticket old enough that no other rule could refuse them | the two inner values accepted, the three outer rejected; 29 February accepted in 2024 and 2000; a date that does not exist is refused, never moved to one that does | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-04 | Unit | AC-04, AC-26, BR-12 | a NUL character and whitespace-only text in every text field | rejected, never passed on to the database | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-05 | Unit | AC-10, BR-08 | the reading-order comparator | oldest `actionAt` first, ties by `id`; the order says nothing about which action is the gate's "latest" (UNIT-08) | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-06 | Unit | AC-07, BR-28 | `requestKey` validation at 7/8 and 64/65 characters and over the allowed character set | 8–64 of `A–Z a–z 0–9 - _` accepted; the rest rejected | `server/tests/lab-04/action-taken-rules.test.ts` | Pass |
| UNIT-07 | Unit | AC-03, BR-17 | the gate with no actions | `ACTION_REQUIRED` | `server/tests/lab-04/resolution-gate.test.ts` | Planned |
| UNIT-08 | Unit | AC-03, BR-17, D-07 | the gate against the most recently **recorded** action | a most-recently-recorded Yes is `FOLLOW_UP_PENDING`; a No passes; an earlier-recorded Yes followed by a No passes; "latest" is `createdAt` then `id`, never `actionAt`, so a Yes recorded last but dated earliest still blocks, and changing any `actionAt` cannot change the outcome | `server/tests/lab-04/resolution-gate.test.ts` | Planned |
| UNIT-09 | Unit | AC-12, BR-17, D-07 | the gate across a reopen | actions created before the latest reopen are ignored, those after count, and a Ticket with no history row is treated as never reopened | `server/tests/lab-04/resolution-gate.test.ts` | Planned |
| UNIT-10 | Unit | AC-11, AC-16, BR-15 | transition options for all 8 statuses, with and without an owner, with each gate result | permitted and blocked together are exactly the matrix row, and each blocked entry carries `OWNER_REQUIRED`, `ACTION_REQUIRED`, or `FOLLOW_UP_PENDING` | `server/tests/lab-04/resolution-gate.test.ts` | Planned |
| UNIT-11 | Unit | AC-21, BR-31 | `group` query parsing | `open` accepted; an unknown or repeated value rejected; combines with `status` by AND | `server/tests/lab-04/group-filter.test.ts` | Planned |
| UNIT-12 | Unit | AC-26, BR-52 | the body guards | a NUL in any nested string found; ids accepted from 1 to 2147483647 and rejected at 0, 2147483648, `1.5`, and `"1"` | `server/tests/lab-04/body-guards.test.ts` | Planned |

### 2.2 API — Actions Taken, `server/tests/lab-04/actions-taken.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | API | AC-10, AC-23, FR-08 | list the Actions Taken of a Ticket that has none, including a legacy one | `200` with `"actions": []` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | AC-10, BR-08 | list a Ticket with several actions, two of them sharing a time | ordered by `actionAt` then `id`, identical on every read | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-01, BR-01, BR-05 | Create a valid Actions Taken as a permitted IT Staff user | `201`, created under the correct Ticket with the authenticated user as Performed by, `version` 1, and the Ticket's `updatedAt` moved | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-01, AC-05, BR-02 | create as the Ticket Owner, as a different IT Staff member, and as an Administrator | each `201`, each `performedBy` the caller, ownership unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-05, BR-09 | a different user edits an action | `200`, `performedBy` unchanged, `updatedBy` is the editor, `version` + 1 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-01, BR-05 | a body carrying `performedBy`, `ticketId`, `createdAt`, and `version` | all ignored; the session user and the path's Ticket win | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | AC-04, BR-03 | missing, blank, too-short, and too-long required fields | `400 VALIDATION_FAILED` with `fields`, one message per offending field | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | AC-04, BR-04 | follow-up rules on create and edit | Yes without a note is `400`; No stores `null` for a note that was sent; an edit to No clears the stored note | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | AC-04, BR-06 | `actionAt` in the future, before the Ticket existed, and not ISO; then a date that does not exist, on create and on edit, using a Ticket old enough that the rolled-over date would be allowed | `400` on `actionAt` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-10 | API | AC-06, BR-11, BR-27 | a successful edit | action `version` + 1; the Ticket's `updatedAt` moved; the Ticket's own `version` unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-11 | API | AC-06, BR-27 | an edit with no `expectedVersion`, then with a stale one | `400` on `expectedVersion`; then `409 STALE_UPDATE` whose `error.current` is the latest action, with the stored row unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-12 | API | AC-06, BR-29 | two simultaneous edits with the same `expectedVersion`, sent with `Promise.all` | exactly one `200` and one `409`, and the stored row holds the winner's values | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-13 | API | AC-07, BR-28, D-04 | the same `requestKey` sent twice, in sequence and with `Promise.all`; then the same key from another user | one row for the first pair, the second answer `200` with the same body; the other user's key makes a separate row; the same key sent again **after the Ticket was resolved** is `200` with the existing action, not `TICKET_NOT_ACTIVE` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-14 | API | AC-09, BR-10 | create and edit on `RESOLVED`, `CLOSED`, and `CANCELLED` Tickets, then on the other five statuses | `409 TICKET_NOT_ACTIVE` and nothing written; the other five succeed | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-15 | API | AC-08, BR-13, BR-44 | a Requester on their own Ticket, then writing, then another Requester's Ticket | the list returns every field of every action; `POST` and `PATCH` are `403`; the other Ticket is `404`, byte-identical to a nonexistent id | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-16 | API | AC-05, BR-01, BR-09 | `DELETE` on an action, and an `actionId` belonging to a different Ticket | the unknown-route `404`; and `404` for the other Ticket's action | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-17 | API | AC-26, BR-52 | a NUL character in each text field, and an out-of-range id in the path | `400`, never `500` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |

### 2.3 API — authorization, `server/tests/lab-04/authorization.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-01 | Authorization | AC-17 | every Lab 4 endpoint with no cookie | `401 AUTH_REQUIRED`, never `403` | `server/tests/lab-04/authorization.api.test.ts` | Partial |
| SEC-02 | Authorization | AC-08, AC-17, BR-43 | a Requester calls every `/api/staff/*` route, new and old | `403 FORBIDDEN` with no ticket data in the body | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| SEC-03 | Authorization | AC-17, BR-42, D-08 | IT Staff and an Administrator call every `/api/staff/*` route, read and write | both succeed on every route; the Administrator's queue, detail, owner, IT Priority, status, and Actions Taken calls all work | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| SEC-04 | Authorization | AC-17, BR-43 | IT Staff and a Requester call every `/api/admin/*` route | `403 FORBIDDEN` | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| SEC-05 | Authorization | AC-20, BR-42 | IT Staff and an Administrator call the Requester dashboard; a Requester calls the staff dashboard | `403 FORBIDDEN` each way | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-06 | Authorization | AC-17, BR-44 | guard order: no session and wrong role together; a Requester posting to a missing Ticket on a staff route | `401` wins over `403`; `403` wins over `404` | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| SEC-07 | Authorization | AC-02, AC-19, BR-37 | `requesterId`, `userId`, and `me` in query, body, and header on both dashboards and the Actions Taken endpoints | all ignored; the session identity is used and no other user's data appears | `server/tests/lab-04/authorization.api.test.ts` | Partial |
| SEC-08 | Authorization | AC-17, BR-45 | an Administrator records an action, changes a status, and posts a comment | `performedBy`, `changedBy`, and the author are the Administrator | `server/tests/lab-04/authorization.api.test.ts` | Partial |
| SEC-09 | Authorization | AC-17, Lab 3 BR-65 | `POST` and `PATCH` to the new endpoints with a foreign `Origin` | `403` before the handler runs; the configured origin succeeds; a `GET` with a foreign origin succeeds | `server/tests/lab-04/authorization.api.test.ts` | Partial |

### 2.4 API — Ticket workflow, `server/tests/lab-04/ticket-workflow.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| WF-01 | Workflow | AC-11, BR-15, BR-16 | every permitted transition, as IT Staff and as an Administrator, with the owner, reason, and gate satisfied | `200` for all 15 pairs | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-02 | Workflow | AC-11, BR-15 | every non-permitted pair, and a transition to the current status | `409 INVALID_TRANSITION`, status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-03 | Workflow | AC-11, AC-15, BR-16, BR-20 | a Requester calls each status route; a Requester marks "appears resolved" | `403`; the signal is recorded and `currentStatus` is unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-04 | Workflow | AC-03, BR-17, BR-18 | `RESOLVED` on an owned Ticket with no Action Taken | `409 ACTION_REQUIRED`, status unchanged, no history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-05 | Workflow | AC-03, BR-17, BR-18 | `RESOLVED` when the most recently recorded action requires follow-up, then after a closing action | `409 FOLLOW_UP_PENDING`; then `200` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-06 | Workflow | AC-03, FR-10 | the gate on a direct API call that never opened the screen, as IT Staff and as an Administrator | the same refusal as WF-04 and WF-05 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-07 | Workflow | AC-12, BR-17, D-07 | resolve, reopen, then resolve again with no new action, then with one | the second resolve is `409 ACTION_REQUIRED`; with a post-reopen action it is `200` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-08 | Workflow | AC-15, BR-20, FR-11 | "appears resolved" on a Ticket with no relevant action | status unchanged; the gate still answers `ACTION_REQUIRED` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-09 | Workflow | AC-13, BR-21 | a transition, a claim that moves `NEW` to `OPEN`, and a refused transition | one history row each for the first two, with from, to, actor, and time; none for the refusal | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-10 | Workflow | AC-13, BR-22, BR-23 | read the history as the Requester, another Requester, IT Staff, and an Administrator; `PATCH` and `DELETE` a row | oldest first; own Ticket `200`; another's `404`; staff `200`; no update or delete route | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-11 | Workflow | AC-14, BR-25 | `version` after owner, IT Priority, status, and "appears resolved" changes; after a no-op; after an action and a comment | + 1 for each real change; unchanged for the no-op, the action, and the comment | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-12 | Workflow | AC-14, BR-26, FR-12 | a stale `expectedVersion` on each of owner, IT Priority, and status, including one made stale only by a Requester's "appears resolved"; and a stale `expectedOwnerId` | `409 STALE_UPDATE` whose `error.current` is the Ticket, the other change intact; `TICKET_ALREADY_OWNED` for the owner id, checked first | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-13 | Workflow | AC-14, BR-29 | two simultaneous status changes with the same `expectedVersion`, sent with `Promise.all` | exactly one `200` and one `409`, and one history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-14 | Workflow | AC-11, BR-24 | a request that is stale and invalid; one that is unowned and ungated | `STALE_UPDATE` first; `OWNER_REQUIRED` before the gate | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-15 | Workflow | AC-11, BR-19 | reasons for `RESOLVED`, `CANCELLED`, and `REOPENED` (Lab 3 BR-36, BR-37 carried) | `400` without a 5–2000 character reason; a Public Comment is created in the same transaction | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-16 | Workflow | AC-16, BR-17 | `GET /api/staff/tickets/:id` for each status, then after an action is recorded | `permittedTransitions` and `blockedTransitions` together are the matrix row; each blocked entry has its code and message; recording an action moves `RESOLVED` into `permittedTransitions` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-17 | Workflow | AC-14, BR-25, BR-29 | IT Priority change with a stale version; resending the same value | `409 STALE_UPDATE`; the resend is `200` with `version` unchanged; `requestedPriority` never changes | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-18 | Workflow | AC-33, BR-55 | the owner object in the staff detail and queue for an inactive owner and for an owner whose role was changed to Requester | `role` and `isActive` present and correct in both | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-19 | Workflow | AC-03, AC-10, BR-08, BR-17 | the gate with a backdated action: action #1 recorded first, `actionAt` 10:00, No; action #2 recorded after it, `actionAt` 09:00, Yes; then edit #1's `actionAt` earlier and later; then record a closing action | `RESOLVED` is `409 FOLLOW_UP_PENDING` although #2 sorts first in the list; no edit to any `actionAt` changes the answer; the closing action makes it `200`; the list stays in `actionAt` order throughout | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-20 | Workflow | AC-14, BR-24, BR-29 | an assignment racing the deactivation of the proposed owner: a second transaction holds the user row's lock, the owner `PATCH` is sent, then the deactivation commits | the assignment waits for the lock and, once the deactivation has committed, answers `409 OWNER_NOT_ASSIGNABLE` with the Ticket's owner unchanged; in the other order the assignment succeeds and the owner stays (Lab 3 BR-26) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |

### 2.5 API — dashboards

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DASH-01 | Dashboard | AC-02, BR-32 | a Requester's dashboard on seed data with other Requesters' Tickets present | counts and lists contain only that Requester's Tickets | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-02 | Dashboard | AC-18, BR-32 | each of the four cards against an independent count of that Requester's Tickets | every `value` equals its independent query | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-03 | Dashboard | AC-18, BR-39 | `no.tickets@toktickit.local` | four `0` values and two empty lists | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-04 | Dashboard | AC-18, BR-33 | both lists for a Requester with more than five Tickets | at most 5; *Needs your attention* longest-waiting first; *Recently updated* newest first; ties by `id` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-05 | Dashboard | AC-20, BR-43 | IT Staff, an Administrator, and no session call the Requester dashboard | `403`, `403`, `401` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-06 | Dashboard | AC-02, BR-37 | a `requesterId` query parameter and an `X-Requester-Id` header | both ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-07 | Dashboard | AC-21, BR-40 | follow each Requester `href` against `GET /api/tickets` | `totalItems` equals the card's `value` for every card | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-08 | Dashboard | AC-21, BR-31 | `group=open` on My Tickets, alone, with `status`, repeated, and unknown | the open group; AND with `status`; `400 INVALID_QUERY` for the last two | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-09 | Dashboard | AC-18, FR-19 | the exact key set of the response and the size of the lists | only the documented keys; no `description`; lists bounded at 5 | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-10 | Dashboard | AC-19, BR-34 | the four staff cards against independent queries | every `value` equals its independent query | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-11 | Dashboard | AC-19, BR-35 | `byStatus` | exactly five rows in the documented order, each equal to an independent count | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-12 | Dashboard | AC-19, BR-37 | two different IT Staff members, and a `me` parameter | "me" figures differ per user and ignore the parameter | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-13 | Dashboard | AC-19, BR-39 | `idle.it@toktickit.local` | `assignedToMe` is `0`; `myTickets` and `myRecentActions` are empty | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-14 | Dashboard | AC-19, BR-36 | the three lists, with a description over 120 characters | order and limit per BR-36; the description cut at 120 characters with an ellipsis | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-15 | Dashboard | AC-19, BR-31 | a `CANCELLED` Ticket with no owner and a `CANCELLED` urgent Ticket | counted in no open metric | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-16 | Dashboard | AC-20, BR-38 | an Administrator and an IT Staff member read the dashboard | the Administrator's `userCounts` (active per role, and inactive) equal the user table and no entry has an `href`; IT Staff have no `userCounts` key | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-17 | Dashboard | AC-21, BR-40 | follow each staff `href` against `GET /api/staff/tickets` | `totalItems` equals `value` for every card and status row; the account counts carry no `href`, so nothing is followed for them | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-18 | Dashboard | AC-21, BR-31 | `group=open` on the queue, alone, with `status`, `owner`, and `itPriority`, repeated, and unknown | AND with every filter; `400 INVALID_QUERY` for the last two | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-19 | Dashboard | AC-20, BR-43 | a Requester and no session call the staff dashboard | `403` and `401` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |

### 2.6 Migration and regression — `server/tests/lab-04/migration.regression.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MIG-01 | Migration | AC-23, BR-46 | row counts of User, Ticket, Attachment, PublicComment, and InternalNote before and after the migration | identical | `server/tests/lab-04/migration.regression.test.ts` | Pass |
| MIG-02 | Migration | AC-23, BR-46 | requester bindings, owners, and ticket numbers; every `Ticket.version` | unchanged; every `version` is 1 | `server/tests/lab-04/migration.regression.test.ts` | Pass |
| MIG-03 | Migration | AC-23, BR-47 | open a legacy Ticket: its detail, actions, and history | the detail loads; actions and history are `[]`; no error | `server/tests/lab-04/migration.regression.test.ts` | Partial |
| MIG-04 | Migration | AC-23, BR-48 | a legacy `RESOLVED` and `CLOSED` Ticket, and a legacy `IN_PROGRESS` one | the first two are not re-gated and can be reopened; the third is gated | `server/tests/lab-04/migration.regression.test.ts` | Partial |
| MIG-05 | Migration | AC-23, BR-49 | snapshot the Lab 3 tables of a scratch database **in the Lab 3 state**, apply the Lab 4 migration, then run the rollback script **without** the Lab 4 seed in between | the Lab 3 tables equal the snapshot row for row; the two new tables and `version` are gone; the single-column `ownerId` index is back | `server/tests/lab-04/migration.regression.test.ts` | Pass |
| MIG-06 | Migration | AC-24, BR-46 | run the seed twice | identical row counts after each; no duplicate account, action, or history row | `server/tests/lab-04/migration.regression.test.ts` | Pass |
| MIG-07 | Migration | AC-24, specification §7.5 | the seeded spread | all 8 statuses, owned and unowned, zero / one / several actions, an action by a non-owner, follow-up Yes and No, both reopened cases, and the two zero-data accounts | `server/tests/lab-04/migration.regression.test.ts` | Pass |
| MIG-08 | Migration | AC-23, BR-28, D-01, D-04, D-05 | the migrated schema: the two new tables with their columns, lengths, and nullability, `Ticket.version`, the unique `(ticketId, performedById, requestKey)` key, every index §7.3 names, the dropped single-column owner index, and each foreign key; then the constraints in use: a duplicate key is refused, two keyless rows are not, a user who is only a performer, only an editor, or only a status-changer cannot be deleted until that row is gone, and deleting a Ticket removes its actions and history | all as §7.1 – §7.3 specify; each author foreign key is `RESTRICT` and each Ticket foreign key `CASCADE` | `server/tests/lab-04/migration.regression.test.ts` | Pass |

### 2.7 Hardening and performance smoke

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| HARD-01 | Hardening | AC-26, BR-52 | a NUL character in each text field of every write endpoint: tickets, removal reason, comments, notes, appears-resolved, status reason, user management, login, password, Actions Taken | `400 VALIDATION_FAILED` on the field; never `500` | `server/tests/lab-04/hardening.api.test.ts` | Planned |
| HARD-02 | Hardening | AC-26, BR-52 | `categoryId` and `relatedSystemId` outside `1`–`2147483647` in `POST /api/tickets`; the same for `ownerId` | `400 VALIDATION_FAILED` on the field | `server/tests/lab-04/hardening.api.test.ts` | Planned |
| HARD-03 | Hardening | AC-28, BR-51 | an unknown `/api` route, malformed JSON, an oversized body, and a forced server error, across several endpoints | the standard envelope with `404`, `400`, `413`, and `500`; no stack, SQL, or path in any body | `server/tests/lab-04/hardening.api.test.ts` | Planned |
| PERF-01 | Performance-smoke | AC-32, BR-56 | 20 consecutive requests to the Requester dashboard on seed data | no response over 1000 ms | `server/tests/lab-04/performance.smoke.test.ts` | Planned |
| PERF-02 | Performance-smoke | AC-32, BR-56 | 20 consecutive requests to the staff dashboard | no response over 1000 ms | `server/tests/lab-04/performance.smoke.test.ts` | Planned |
| PERF-03 | Performance-smoke | AC-32, BR-56 | 20 consecutive requests to the queue's first page | no response over 1000 ms | `server/tests/lab-04/performance.smoke.test.ts` | Planned |

### 2.8 UI component — `client/tests/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | UI | AC-10, AC-23, FR-01, FR-08 | the Actions Taken list, and a Ticket with none | entries in BR-08 reading order showing all seven fields, empty ones omitted; the **Latest recorded** tag on exactly one entry, the most recently recorded, including when it is not the last card; the explicit empty state | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-02 | UI | AC-04, FR-02 | create mode | every field present, Performed by read-only, red asterisks, Follow-up Note shown and required only for Yes | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-03 | UI | AC-04, AC-27, BR-54 | validation and a failed save | messages beneath their own fields, focus on the first invalid field, every typed value kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-04 | UI | AC-07, AC-27, BR-28 | repeated clicks on Save, then a network failure and a retry | one request per submission, Save busy and disabled; the retry reuses the same `requestKey` | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-05 | UI | AC-05, AC-06, FR-03 | edit mode | the form opens in place with the stored values; Performed by read-only; the save sends `expectedVersion`; the card returns to view mode with "Edited by"; an edit that changes Action Date/Time moves the card, announces "Moved to its new position by date.", and keeps focus on it | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-06 | UI | AC-06, AC-27, FR-07 | a `409 STALE_UPDATE` on an edit | the conflict callout inside the card, the user's edits kept, **Show latest** asks before replacing them | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-07 | UI | AC-08, FR-04 | the Requester's view | every action read-only; no **Add action**, no **Edit**, no hint of either | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-08 | UI | AC-09, BR-10 | a `RESOLVED`, `CLOSED`, or `CANCELLED` Ticket | **Add action** and **Edit** disabled with the explanation; the entries stay readable; a `409 TICKET_NOT_ACTIVE` shows its own message | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-09 | UI | AC-28 | the region's loading, API-failure, and forbidden states | skeleton cards; a callout with **Try again** that leaves the other regions alone; the forbidden callout | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-10 | UI | AC-16, FR-09 | the status select and the "Not available now" list | the select offers only `permittedTransitions`; each `blockedTransitions` entry is listed with its message | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-11 | UI | AC-16, BR-19 | reasons for Resolved, Cancelled, and Reopened | the reason textarea is required before **Apply** is enabled | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-12 | UI | AC-03, AC-16 | a gate refusal that reaches the server | the `ACTION_REQUIRED` and `FOLLOW_UP_PENDING` messages as their own callout, with **Go to Actions Taken** focusing the region | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-13 | UI | AC-16, FR-14 | a successful change | the summary, badge, select options, blocked list, and timeline refresh from the response, without a reload | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-14 | UI | AC-14, BR-26 | a `409 STALE_UPDATE` on a status change | the conflict callout naming the current status and owner; **Show latest** reloads and keeps the typed reason | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-15 | UI | AC-13, FR-13 | the Status History on the staff and Requester screens | an ordered list starting with "Ticket created"; badges spelled out; actor and time on each step | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-16 | UI | AC-15, BR-20 | the Requester's appears-resolved panel | helper text says only IT Staff can resolve; no status control exists on the Requester screen | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-17 | UI | AC-33, BR-55 | an Owner who is inactive, and one who is no longer IT Staff | "Inactive" for the first; "No longer IT Staff" for the second | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-18 | UI | AC-18, AC-21, FR-15 | the four Requester cards | each shows its label and value; each is one link with an accessible name that includes the destination | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-19 | UI | AC-18, FR-15 | the two Requester lists | rows link to the Ticket Detail; empty lists show their explicit message | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-20 | UI | AC-18, BR-39 | all-zero data | every card shows `0` and keeps its link; both lists show their empty message; the quick actions remain | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-21 | UI | AC-22, FR-20 | loading, forbidden, failure, and Refresh | skeletons; the forbidden callout; a failure callout with **Try again**; Refresh disables itself, keeps the old numbers until the new ones arrive, and keeps them if the refresh fails | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-22 | UI | AC-19, AC-21, FR-16 | the four staff cards and the status row | values and links per BR-34 and BR-35; every `href` followed unchanged | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-23 | UI | AC-19, FR-16 | the three staff lists | rows link to the Ticket; the follow-up pill carries text; descriptions are cut | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-24 | UI | AC-20, FR-17 | an Administrator, then IT Staff | the Administrator sees the accounts region with all four counts as plain numbers and only **Open User Management** as a link; IT Staff do not | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-25 | UI | AC-22, FR-20 | loading, zero data, forbidden, failure, and Refresh | as UI-21; zero data keeps the cards and shows the staff empty messages | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-26 | UI | AC-19, D-11 | the quick actions | **Open Ticket Queue**, **Unassigned Tickets**, and **My Queue** only; no Create Ticket, no Profile, no "from yesterday" | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-27 | UI | AC-17, FR-23, FR-24 | the Administrator's navigation and routes | **Ticket Queue** is offered and opens; a Requester typing `/queue` or `/users` lands on their Dashboard with the forbidden callout | `client/tests/lab-04/RoleNavigation.test.tsx` | Partial |
| UI-28 | UI | AC-17, BR-45 | an Administrator on the Ticket Detail | the owner, IT Priority, status, and Actions Taken controls are present and send requests under the session | `client/tests/lab-04/RoleNavigation.test.tsx` | Partial |
| UI-29 | UI | AC-21, FR-21 | My Tickets opened with `?group=open&status=…` | the request carries both; the filter chip shows; Clear Filters removes it; an unknown parameter is ignored | `client/tests/lab-04/DrillDown.test.tsx` | Planned |
| UI-30 | UI | AC-27, BR-53 | every write form: create ticket, comment, note, owner, IT Priority, status, user management, Action Taken | one request per submission under repeated clicks | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-31 | UI | AC-27, BR-54 | a recoverable failure on the same forms | the typed values are still in the form | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-32 | UI | AC-28, FR-26 | the loading, empty, forbidden, conflict, and failure states of every screen | each uses the shared component and wording; no raw code or stack is shown | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-33 | UI | AC-31, FR-30 | render every screen with `console.error` and `console.warn` spied | no call | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-34 | UI | AC-31, FR-30 | search every screen for placeholder text, the old `RoleHome` page, and any Development Requester control | none found | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-35 | UI | AC-30, FR-31 | keyboard: tab order, visible focus, labels, and the focus moves after create, edit, and **Go to Actions Taken** | every control reachable and named; focus lands where `ui-spec.md` §9 says | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-36 | UI | AC-30, FR-31 | status, priority, role, and follow-up badges | each carries text, not colour alone | `client/tests/lab-04/FinalRegression.test.tsx` | Planned |
| UI-37 | UI | AC-34, FR-22, D-09 | each role's navigation and landing page | **Dashboard** first and marked `aria-current="page"` on `/dashboard`; the wordmark links to it; each role lands on its own dashboard | `client/tests/lab-04/RoleNavigation.test.tsx` | Planned |
| UI-38 | UI | AC-21, FR-21 | the Ticket Queue with `?owner=unassigned&group=open` | the filters read from the URL and written back; the chip shows; Clear Filters works | `client/tests/lab-04/DrillDown.test.tsx` | Planned |

### 2.9 UI style — `client/tests/lab-04/ZenGreenLab4.test.tsx`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| STYLE-01 | UI style | AC-29, FR-26 | every Lab 4 screen's styles | only Lab 2 and Lab 3 tokens; no hard-coded hex | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |
| STYLE-02 | UI style | AC-29, `ui-spec.md` §1.1 | the metric card | label, value, and "View all" in the specified sizes and tokens; the focus outline present | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |
| STYLE-03 | UI style | AC-30, AC-04 | the follow-up pill and the Follow-up Note's asterisk | the pill carries text; the red asterisk appears with the note's `required` for Yes only | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |
| STYLE-04 | UI style | AC-29 | read-only against disabled | `readonly` fields use `--tt-readonly-bg`, distinct from a disabled **Add action** | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |
| STYLE-05 | UI style | AC-27 | validation placement and busy buttons | messages sit beneath their own field; a busy button is disabled, labelled, and permits one request | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |
| STYLE-06 | UI style | AC-29, `ui-spec.md` §1.2, §1.4 | the Action Taken card and the timeline | the card's definition-list structure and the timeline's `<ol>` with its tokens | `client/tests/lab-04/ZenGreenLab4.test.tsx` | Planned |

### 2.10 Responsive — `e2e/lab-04/responsive.spec.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RESP-01 | Responsive | AC-29, AC-34 | the Requester dashboard at ≥ 992, 768–991, and < 768 px | cards four across, two by two, then one per row; no horizontal scroll at 320 px | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-02 | Responsive | AC-29, AC-34 | the staff and Administrator dashboards at all three widths | the two lists side by side, then stacked; the accounts region wraps; no horizontal scroll | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-03 | Responsive | AC-29 | the Actions Taken region and its create form on the staff Ticket Detail at all three widths | one column of cards; labels beside values at ≥ 992 px and above them below; the form stacks its buttons on mobile | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-04 | Responsive | AC-29 | the Requester Ticket Detail with Actions Taken and Status History at all three widths | both regions read-only and unclipped | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-05 | Responsive | AC-25, AC-29 | the Lab 3 Queue, User Management, and Login at all three widths | still as Lab 3 specified, with the Dashboard navigation item present | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-06 | Responsive | AC-30 | every Lab 4 screen at all three widths | no clipping, no overlap, a focus outline visible on every interactive element | `e2e/lab-04/responsive.spec.ts` | Planned |

### 2.11 End-to-end — `e2e/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | E2E | AC-01, AC-05, AC-08 | an IT Staff Owner records an action; a different IT Staff member records another and edits the first; the Requester opens the Ticket | both actions listed with the right Performed by; the edit shows "Edited by"; the Requester sees them read-only | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-03 | an IT Staff member tries to resolve a Ticket with no action, records a closing action, resolves, then closes | blocked with its message and the link to the region; then `RESOLVED`; then `CLOSED`; the timeline shows each step | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-14 | two browser contexts load the same Ticket; one changes the status; the other saves a different change | the second sees the conflict message with the current status and the first change survives | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-04 | E2E | AC-04, AC-07, AC-27 | submit the create form empty, then with Yes and no note, then with valid data double-clicked | messages on the offending fields with the typed values kept; one action exists after the double click | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-05 | E2E | AC-02, AC-18, AC-21, AC-34 | a Requester signs in, lands on the dashboard, and follows each card | the numbers match their own Tickets; each link opens My Tickets with the same count; no other Requester's data appears | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-06 | E2E | AC-19, AC-20, AC-21 | an IT Staff member and an Administrator open the dashboard and follow the cards | the numbers match the queue; the Administrator also has the accounts region; every link opens the filtered list | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-07 | E2E | AC-17 | an Administrator opens the queue and a Ticket and records an action, changes IT Priority, and moves the status; a Requester types `/queue` | each works under the Administrator's name; the Requester is sent to their Dashboard and the API refuses too | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-08 | E2E | AC-12, AC-13, AC-15 | a Requester marks "appears resolved"; IT Staff resolve, reopen, and try to resolve again | the status is unchanged by the signal; the second resolve is blocked until a new action; the timeline shows every step | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |

### 2.12 Regression suites

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| REG-01 | Regression | AC-25, BR-50 | the full server suites of Labs 1, 2, and 3 on `lab4-staging` | all pass, with only the changes §6 lists | `server/tests/lab-01`, `server/tests/lab-02`, `server/tests/lab-03` | Planned |
| REG-02 | Regression | AC-25, BR-50 | the full client suites of Labs 1, 2, and 3 | all pass, with only the changes §6 lists | `client/tests/lab-01`, `client/tests/lab-02`, `client/tests/lab-03` | Planned |
| REG-03 | Regression | AC-25, BR-50 | the Playwright suites of Labs 2 and 3 | all pass, with only the changes §6 lists | `e2e/lab-02`, `e2e/lab-03` | Planned |

---

## 3. Acceptance-criterion traceability

Every criterion has at least one test, and nothing is left to manual inspection
alone.

| AC | Tests |
| :--- | :--- |
| AC-01 | API-03, API-04, API-06, E2E-01 |
| AC-02 | DASH-01, DASH-06, SEC-07, E2E-05 |
| AC-03 | UNIT-07, UNIT-08, WF-04, WF-05, WF-06, WF-19, UI-12, E2E-02 |
| AC-04 | UNIT-01 – UNIT-04, API-07, API-08, API-09, UI-02, UI-03, STYLE-03, E2E-04 |
| AC-05 | API-04, API-05, API-16, UI-05, E2E-01 |
| AC-06 | API-10, API-11, API-12, UI-05, UI-06 |
| AC-07 | UNIT-06, API-13, UI-04, E2E-04 |
| AC-08 | API-15, SEC-02, UI-07, E2E-01 |
| AC-09 | API-14, UI-08 |
| AC-10 | UNIT-05, API-01, API-02, WF-19, UI-01 |
| AC-11 | UNIT-10, WF-01, WF-02, WF-03, WF-14, WF-15 |
| AC-12 | UNIT-09, WF-07, E2E-08 |
| AC-13 | WF-09, WF-10, UI-15, E2E-08 |
| AC-14 | WF-11, WF-12, WF-13, WF-17, WF-20, UI-14, E2E-03 |
| AC-15 | WF-03, WF-08, UI-16, E2E-08 |
| AC-16 | UNIT-10, WF-16, UI-10, UI-11, UI-12, UI-13 |
| AC-17 | SEC-01 – SEC-04, SEC-06, SEC-08, SEC-09, UI-27, UI-28, E2E-07 |
| AC-18 | DASH-02, DASH-03, DASH-04, DASH-09, UI-18, UI-19, UI-20, E2E-05 |
| AC-19 | SEC-07, DASH-10 – DASH-15, UI-22, UI-23, UI-26, E2E-06 |
| AC-20 | SEC-05, DASH-05, DASH-16, DASH-19, UI-24, E2E-06 |
| AC-21 | UNIT-11, DASH-07, DASH-08, DASH-17, DASH-18, UI-18, UI-22, UI-29, UI-38, E2E-05, E2E-06 |
| AC-22 | UI-21, UI-25 |
| AC-23 | MIG-01 – MIG-05, MIG-08, API-01, UI-01 |
| AC-24 | MIG-06, MIG-07 |
| AC-25 | REG-01, REG-02, REG-03, RESP-05 |
| AC-26 | UNIT-04, UNIT-12, API-17, HARD-01, HARD-02 |
| AC-27 | UI-03, UI-04, UI-06, UI-30, UI-31, STYLE-05, E2E-04 |
| AC-28 | UI-09, UI-32, HARD-03 |
| AC-29 | RESP-01 – RESP-05, STYLE-01, STYLE-02, STYLE-04, STYLE-06 |
| AC-30 | UI-35, UI-36, RESP-06, STYLE-03 |
| AC-31 | UI-33, UI-34 |
| AC-32 | PERF-01, PERF-02, PERF-03 |
| AC-33 | UI-17, WF-18 |
| AC-34 | UI-37, RESP-01, RESP-02, E2E-05 |

### 3.1 Planned test distribution by issue

152 tests are planned: 12 unit, 17 Actions Taken API, 9 authorization, 20
workflow, 19 dashboard, 8 migration, 3 hardening, 3 performance smoke, 38 UI
component, 6 UI style, 6 responsive, 8 E2E, and 3 regression suites.

| Issue | Tests |
| :--- | :--- |
| 2 — Administrator access to IT Staff ticket operations (#68) | SEC-01 – SEC-04, SEC-06, SEC-08, SEC-09, UI-27, UI-28, each for the endpoints and screens that exist at Issue 2 (see below) |
| 3 — Actions Taken data model, migration, and seed (#69) | MIG-01 – MIG-08 (MIG-03 and MIG-04 for the data only, see below) |
| 4 — Actions Taken API (#70) | UNIT-01 – UNIT-06, API-01 – API-17; extends SEC-01, SEC-07, SEC-08 (`performedBy`), and SEC-09 for the Actions Taken routes |
| 5 — Actions Taken UI on Ticket Detail (#71) | UI-01 – UI-09, STYLE-03 |
| 6 — Ticket workflow and resolution gate (#72) | UNIT-07 – UNIT-10, WF-01 – WF-17, WF-19, WF-20, UI-10 – UI-16, STYLE-06; extends SEC-01 for the status-history route and SEC-08 (`changedBy`) |
| 7 — Requester Dashboard (#73) | UNIT-11, DASH-01 – DASH-09, UI-18 – UI-21, UI-29, UI-37 (Requester), STYLE-02; completes SEC-05 (the Requester dashboard half) and extends SEC-01 and SEC-07 |
| 8 — IT Staff and Administrator Dashboard (#74) | DASH-10 – DASH-19, UI-22 – UI-26, UI-37 (IT Staff and Administrator), UI-38; completes SEC-05 (the staff dashboard half) and extends SEC-01 and SEC-07 |
| 9 — Final hardening and full regression (#75) | UNIT-12, WF-18, UI-17, HARD-01 – HARD-03, PERF-01 – PERF-03, UI-30 – UI-36, STYLE-01, STYLE-04, STYLE-05 |
| 10 — Lab 4 E2E suite and visual evidence (#76) | RESP-01 – RESP-06, E2E-01 – E2E-08, REG-01 – REG-03 |
| 11 — Staging integration, documentation, and delivery (#77) | no new tests: the final run from `main` |

Each issue also keeps every earlier test passing, and updates the old tests §6
names in the issue that changes the behaviour they check.

**Tests that grow across issues.** This table first assigned all of SEC-01 –
SEC-09, UI-27, and UI-28 to Issue 2. Writing Issue 2 showed that parts of them
exercise endpoints and screens that do not exist until later, so they could not
pass, or even be written honestly, in Issue 2. They are completed in the issue
that adds the thing they test, by appending a row to the route tables in
`server/tests/lab-04/authorization.api.test.ts` and by extending the client test:

| Test | Complete at Issue 2 | Completed in |
| :--- | :--- | :--- |
| SEC-01 | no cookie → 401 on every staff and admin route, including one that is not written | ~~4~~ (done: the Actions Taken routes), 6, 7, 8 add the status-history and dashboard routes |
| SEC-05 | not possible: both dashboards are later | 7 (Requester half), 8 (staff half) |
| SEC-07 | not possible: the dashboards and Actions Taken take no ids yet | ~~4~~ (done: the Actions Taken endpoints), 7, 8 |
| SEC-08 | an Administrator is the author of their comments and notes, and the Owner of what they claim | ~~4~~ (done: `performedBy`), 6 (`changedBy`) |
| SEC-09 | a foreign `Origin` is refused on an Administrator's writes to the existing staff routes | ~~4~~ (done: the Actions Taken writes) |
| UI-27 | the Administrator's navigation and routes; the sign-in deep link; the refusals; "sent home" means the role's Lab 3 home | 7, 8: the Dashboard becomes the home (UI-37) |
| UI-28 | the owner, IT Priority, and status controls, and the Internal Notes region | 5: the Actions Taken controls |

SEC-02, SEC-03, SEC-04, and SEC-06 are complete at Issue 2.

The same happened at Issue 3: MIG-03 and MIG-04 were assigned to it whole, but each
has a half that needs something built later. What the migration itself guarantees
is tested now, against the data; what a screen or the gate does with it is tested
when that exists:

| Test | Complete at Issue 3 (the data) | Completed in |
| :--- | :--- | :--- |
| MIG-03 | a legacy Ticket has no row in `ActionTaken` or `TicketStatusChange` and keeps its version 1 | ~~4~~ (done: the actions list answers `[]` for a seeded legacy Ticket, in API-01), 6 (the status history answers `[]` and the detail screen loads) |
| MIG-04 | a legacy `RESOLVED`, `CLOSED`, and `IN_PROGRESS` Ticket is exactly as it was, with its owner | 6: a legacy `RESOLVED` or `CLOSED` Ticket can be reopened, and a legacy `IN_PROGRESS` one is gated like any other |

MIG-08 was added in Issue 3 for what the plan lacked: a test of the migrated
schema itself. It was not in the plan approved in PR #78, which had 151 tests, and
it brings the plan to 152.

---

## 4. Test commands

The database must be migrated and seeded first; the API suites log in with the
seeded accounts from `specification.md` §7.5.

### Backend — unit, API, authorization, workflow, dashboards, migration

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
npx playwright test e2e/lab-04
```

### Everything, including the Lab 1–3 regression

```sh
cd server && npx prisma migrate deploy && npm run prisma:seed && npx vitest run
cd ../client && npx vitest run && npx tsc --noEmit
cd .. && npx playwright test
```

To start again from a clean database:

```sh
docker exec toktickit-server npx prisma migrate reset --force
```

The migration test (MIG-05) and the rollback need a scratch copy of the database
and never touch the working one; the exact commands are recorded with the test.

---

## 5. Responsive, visual, and accessibility checklist

The checklist is `ui-spec.md` §11. It is completed **in Issue 10 (#76)** by
inspecting every Lab 4 screen, and the Lab 3 screens it touches, at all three
breakpoints. Until then each row reads **Pending**.

| Check | Desktop | Tablet | Mobile |
| :--- | :--- | :--- | :--- |
| Design consistency — only Lab 2 and Lab 3 tokens | Pending | Pending | Pending |
| Role navigation; Dashboard first and current on `/dashboard` | Pending | Pending | Pending |
| Metric cards: label, value, working "View all", `0` shown as `0` | Pending | Pending | Pending |
| Drill-down lists show the number on their card | Pending | Pending | Pending |
| Dashboard zero-data, loading, forbidden, and failure states | Pending | Pending | Pending |
| Actions Taken: seven fields, Performed by read-only, Follow-up Note rule | Pending | Pending | Pending |
| Editable, read-only, and disabled are visibly different | Pending | Pending | Pending |
| Requester Ticket Detail: Actions Taken and Status History with no controls | Pending | Pending | Pending |
| Status control offers only reachable moves and explains blocked ones | Pending | Pending | Pending |
| Status History in order, spelled out, starting with "Ticket created" | Pending | Pending | Pending |
| Validation messages beneath their own field | Pending | Pending | Pending |
| Conflict, gate, and not-active messages distinct from a generic failure | Pending | Pending | Pending |
| Owner label tells Inactive from No longer IT Staff | Pending | Pending | Pending |
| Keyboard reach, visible focus, and focus movement after create, edit, and **Go to Actions Taken** | Pending | Pending | Pending |
| Readable with colour removed: status, priority, role, follow-up | Pending | Pending | Pending |
| No clipping, no overlap, no horizontal overflow, including 320 px | Pending | Pending | Pending |
| No console error, placeholder text, obsolete control, or broken link | Pending | Pending | Pending |

### 5.1 Screenshot artifacts

Per `ui-spec.md` §12, under `artifacts/lab-04/screenshots/` in
`requester-dashboard/`, `staff-dashboard/`, `actions-taken/`, `ticket-workflow/`,
and `regression/`. Each file is `<shot>-<desktop|tablet|mobile>.png`, captured by
`e2e/lab-04/responsive.spec.ts` at 1440×900, 820×1180, and 390×844. The count is
recorded here when Issue 10 completes.

---

## 6. Changes to Lab 1–3 tests

BR-50 allows an old test to change only where a rule Lab 4 deliberately changed
is encoded in it, and requires every such change to be listed with its reason.
These are the changes foreseen from reading the Lab 3 suites against the contract.
Each is made in the issue named, in the same pull request as the behaviour that
forces it, and the **Status** column records it when it is done.

| Lab 3 test | What it asserted | Change in Lab 4 | Reason | Issue | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `server/tests/lab-03/authorization.api.test.ts` — SEC-03 "refuses an Administrator on every IT Staff route (BR-19)" | an Administrator is `403` on every `/api/staff/*` route | an Administrator is allowed on them; the Requester and no-session cases are untouched | D-08 and BR-43: labsheet §4.3 gives Administrators IT Staff behaviour, superseding Lab 3 BR-19 | 2 | Done: now asserts the Administrator is *not* refused (the route answers), so it still guards something |
| `server/tests/lab-03/staff-queue.api.test.ts` — "is refused to a Requester and an Administrator (BR-19)" and the same name under "assignable users" (two cases) | queue endpoints refuse an Administrator | each splits in two: refuse a Requester (unchanged assertions), and a new case that an Administrator is let in (the queue returns the same `totalItems` IT Staff see) | D-08 | 2 | Done |
| `server/tests/lab-03/staff-ticket-detail.api.test.ts` — "is refused to a Requester and an Administrator…" and "refuses a Requester and an Administrator on each operation" | detail and every operation refuse an Administrator | refuse a Requester only (same assertions, `before`/after row unchanged); a new case that an Administrator opens the detail | D-08 | 2 | Done |
| `server/tests/lab-03/staff-ticket-detail.api.test.ts` — "keeps the staff download to IT Staff, and keeps IT Staff off the Requester routes (BR-18)" | **not foreseen when this table was written; found by running the suite.** The staff attachment-download route refuses an Administrator | the Requester is still `403`, an Administrator now gets `200`, and IT Staff are still refused the Requester's route | D-08: the guard is on the `/api/staff` prefix, so this route opens too | 2 | Done |
| `client/tests/lab-03/RoleNavigation.test.tsx` — UI-07 | the Administrator's only item is User Management; the first nav link is the current page after landing; an Administrator typing `/queue` is sent home | the list is Ticket Queue then User Management; the current-page assertion names the landing link (User Management) because the first link is no longer it; the `/queue` row is removed (it is allowed now and the Lab 4 suite covers it) | D-08. Landing stays User Management until the Dashboard (Issue 8) | 2 (nav and `/queue`); 7, 8 (Dashboard-first lists) | Issue 2 part Done; Dashboard part Planned |
| `server/tests/lab-03/staff-ticket-detail.api.test.ts` — API-51 and the assertions that compare `permittedTransitions` with the bare matrix | `permittedTransitions` equals the matrix row | `permittedTransitions` plus `blockedTransitions` equals the matrix row | BR-17, api-spec §3.1: the list now excludes moves the owner rule or the gate blocks | 6 | Planned |
| `server/tests/lab-03/staff-ticket-detail.api.test.ts` — the cases that move a Ticket to `RESOLVED` | a Ticket resolves with only an owner and a reason | the fixture records an Action Taken first; a new case proves it is refused without one | BR-17: the gate. Lab 3 D-20 said this would come | 6 | Planned |
| `client/tests/lab-03/StaffTicketDetail.test.tsx` | the mocked detail has no `version` or `blockedTransitions` | the mock gains both | api-spec §3.1: a mock-shape change, no assertion changes | 6 | Planned |
| `e2e/lab-03/staff-ticket-flow.spec.ts` — E2E-05 | an IT Staff member resolves a Ticket with only a reason | the journey records an Action Taken first | BR-17 | 6 | Planned |
| `client/tests/lab-03/RequesterRegression.test.tsx` — "a signed-in Requester lands on My Tickets" | the landing page is My Tickets | the landing page is the Dashboard | D-09 | 7 | Planned |
| `e2e/lab-03/authentication.spec.ts` — E2E-01 and the landing-page table | the Requester's navigation is exactly My Tickets and Create Ticket; IT Staff land on `/queue` and an Administrator on `/users` | the Administrator's list gains Ticket Queue (**Issue 2, Done**: `Ticket Queue, User Management`, landing still `/users`); then each role's navigation starts with Dashboard and each lands on `/dashboard` (Issues 7, 8) | D-08, D-09 | 2, 7, 8 | Issue 2 part Done; Dashboard part Planned |
| `client/tests/lab-02/Navigation.test.tsx` | iterates the Requester's navigation items | expected to pass unchanged because it iterates `NAV_ITEMS`; re-verified, not edited, unless it does not | D-09 | 7 | Planned |
| `client/tests/lab-02/RequesterTicketDetail.test.tsx` | mocks each client call with `vi.spyOn(api, …)`: the ticket detail, comments, and attachments | the mocks gain the two calls the Requester Ticket Detail now makes, `fetchActionsTaken` (Issue 5) and `fetchStatusHistory` (Issue 6); no assertion changes | the screen loads two more resources; an unmocked call would reach the network | 5, 6 | Planned |
| `client/tests/lab-03/RequesterComments.test.tsx` | the same per-call mocks, with `fetchComments` | the same two mocks are added | as above | 5, 6 | Planned |

No Lab 1 test changes. A change not in this table is a defect to be fixed in the
code, not in the test. If implementation finds a Lab 3 test that must change and
is not listed, the issue adds it here with its reason in the same pull request.

---

## 7. Known limitations and deferred tests

| Area | Limitation |
| :--- | :--- |
| Duplicate protection | Only Action Taken creation has a server-side idempotency key (D-15). A comment or note retried across a network failure after the server accepted it is posted twice; the UI single-flight (UI-30) and the conflicts on status and claim are what protect the rest. |
| Dashboards | There is no trend and no time window (D-10), so no test asserts a "since yesterday" figure. Dashboard numbers are instantaneous and are not cached (BR-30). |
| Performance | PERF-01 to PERF-03 are a smoke check on seed data, not a load or scaling test (D-16). |
| Accessibility | Checked by assertions on roles, labels, and focus (UI-35, UI-36, RESP-06) plus the manual checklist of §5. No automated scanner runs, and none is added (§3.2 of the specification). |
| Concurrency | WF-13, API-12, and API-13 send two requests at once against the row lock and the unique key; sustained parallel load is not tested. |
| Action edit history | Edits overwrite in place and are not kept (D-13); no test can assert what an action said before an edit. |
| Rollback | MIG-05 proves the rollback on a scratch database in the Lab 3 state, **before** the Lab 4 seed runs. A database seeded after migrating keeps the seed's two accounts and the moved `Ticket.updatedAt` values after a rollback, because the script undoes the migration and not the seed (`specification.md` §7.6); the dump taken before migrating is the recovery for that case, and for one that already holds real Lab 4 actions, which a rollback loses by design. |
| Inherited | CSRF has no token test (Lab 3 D-13). The intermittent `RoleNavigation.test.tsx` and `Navigation.test.tsx` failures (Lab 3 §7) are to be investigated in Issue 9 (D-22 of the specification); if the cause is not found, this row records what was tried. |

---

## 8. Final results

Filled in from the real runner output as each issue merges, completed in Issue 10
(#76) from `lab4-staging`, and repeated from `main` in Issue 11 (#77). Until then
every row in §2 reads **Planned**, and this section holds no number. Nothing here
is estimated or restated from memory.
