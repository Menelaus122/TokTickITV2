# Lab 2 — Test Plan and Results

Companion to [`specification.md`](./specification.md). Acceptance criteria are
cited as **AC-nn** and are defined in §9 of that document.

> **Status: planned.** This plan was written in Issue 1, before implementation.
> Every row's **Final** column reads *Planned* until the test exists and has
> actually been run. Results are filled in as each feature Issue lands, and the
> full run from `main` is recorded in §6 during Issue 10. No row may be marked
> Pass on the strength of a code review or an agent's claim.

---

## 1. Test Strategy

Six levels, each answering a different question:

| Level | Question it answers | Tooling | Location |
| :--- | :--- | :--- | :--- |
| **Unit** | Does an isolated rule behave correctly at its boundaries? | Vitest | `server/tests/lab-02/` |
| **API** | Does the HTTP contract in `api-spec.md` hold, including status codes and ownership? | Vitest + Supertest against the seeded PostgreSQL | `server/tests/lab-02/` |
| **UI component** | Does a screen render the right states and call the API correctly? | Vitest + Testing Library, API mocked | `client/tests/lab-02/` |
| **UI style** | Does the rendered markup carry the classes, attributes, and markers `ui-spec.md` requires? | Vitest + Testing Library | `client/tests/lab-02/` |
| **Responsive** | Does the real page hold up at three viewport sizes? | Playwright | `e2e/lab-02/` |
| **E2E** | Can a Requester actually complete the sprint's journeys against a real backend? | Playwright | `e2e/lab-02/` |

Principles for this sprint:

* **Ownership is tested from the outside.** Every ownership rule is proven by an
  HTTP request made as the wrong Requester, not by a unit test of a helper.
* **Failure paths are first-class.** Each screen's error, empty, and no-results
  states carry their own test.
* **Tests are written with the feature, not after it.** The API and UI tests for
  a screen belong on that screen's feature branch; only the cross-cutting
  levels (UI style, responsive, E2E, screenshots) are deferred to Issue 9.
* **No skipped tests.** A test that cannot pass yet is not committed as
  `.skip` — it is not committed.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UNIT-01 | AC-10 | Unit | Ticket Number generator format | Matches `TT-<YYYY>-<NNNNN>` with the current year and a 5-digit zero-padded sequence | `server/tests/lab-02/ticket-number.test.ts` | Planned |
| UNIT-02 | AC-10 | Unit | Sequence behavior | Increments within a year; restarts at `00001` in a new year | `server/tests/lab-02/ticket-number.test.ts` | Planned |
| UNIT-03 | AC-09 | Unit | Ticket validation boundaries | Summary rejected at 4 and 121 chars, accepted at 5 and 120; Description rejected at 19 and 4001; inputs trimmed before measuring | `server/tests/lab-02/validation.test.ts` | Planned |
| UNIT-04 | AC-13 | Unit | Attachment rule guard | `.exe` and a PNG-named PDF rejected; 5 MB accepted, 5 MB + 1 byte rejected | `server/tests/lab-02/attachment-rules.test.ts` | Planned |
| UNIT-05 | AC-18 | Unit | List query parser | Unknown sort field, `pageSize=7`, and `page=0` each rejected; defaults applied when absent | `server/tests/lab-02/list-query.test.ts` | Planned |

### 2.2 API

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | AC-01 | API | `GET /api/requesters` | 200; only active Requesters; the seeded inactive one absent | `server/tests/lab-02/requesters.api.test.ts` | Planned |
| API-02 | AC-06 | API | No active Requesters | 200 with `[]` | `server/tests/lab-02/requesters.api.test.ts` | Planned |
| API-03 | AC-08 | API | `GET /api/categories` | 200; four active categories in id order | `server/tests/lab-02/reference-data.api.test.ts` | Planned |
| API-04 | AC-08 | API | `GET /api/related-systems` | 200; ≥ 6 active systems in name order | `server/tests/lab-02/reference-data.api.test.ts` | Planned |
| API-05 | AC-07, AC-10 | API | Create a valid Ticket | 201; one row saved; `currentStatus=NEW`; ticket number returned; `requesterId` equals the `X-Requester-Id` header | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | AC-07 | API | Ticket Number uniqueness | Two creations return two different numbers, both matching the format | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-07 | AC-09 | API | Missing Summary | 400 `VALIDATION_FAILED` with `fields.summary`; nothing persisted | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-08 | AC-10 | API | Client-supplied system fields | `ticketNumber`, `requesterId`, `currentStatus` in the body are ignored; saved values come from the server | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-09 | AC-01 | API | Inactive Requester context | 400 `REQUESTER_INACTIVE`; no Ticket created | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-10 | AC-14 | API | List scoping | Requester B's list contains none of Requester A's tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-11 | AC-15 | API | Default paging and sort | 25 tickets → 10 returned, newest first, `totalPages: 3`, `hasNext: true` | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-12 | AC-16 | API | Search | Matches Summary and Ticket Number case-insensitively; a whitespace-only term is ignored | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-13 | AC-17 | API | Filters | Filters combine with AND; a non-matching combination returns `data: []` with `totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-14 | AC-18 | API | Invalid query | `sortBy=summary` → 400 `INVALID_QUERY`; no ticket data in the body | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-15 | AC-15 | API | Page past the end | 200 with `data: []` and correct metadata, not 404 | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-16 | AC-20 | API | Read an owned Ticket | 200 with full payload including attachment metadata | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-17 | AC-19 | API | Read another Requester's Ticket | 404; response body contains no ticket data | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-18 | AC-19 | API | Read a non-existent Ticket | 404 with a body identical to API-17's | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-19 | AC-21 | API | Upload a permitted file | 201 with metadata; `removedAt: null`; a `downloadUrl` present | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-20 | AC-13 | API | Rejected uploads | `.exe` → 415 `UNSUPPORTED_FILE_TYPE`; 6 MB PDF → 413 `FILE_TOO_LARGE`; no metadata row either way | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-21 | AC-21 | API | Active-attachment limit | Fifth upload succeeds; sixth → 409 `ATTACHMENT_LIMIT_REACHED` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-22 | AC-22 | API | Download an active file | 200; `Content-Disposition` carries the original filename; bytes match the upload | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-23 | AC-23 | API | Soft removal | 200; row still exists with `removedAt` and `removalReason` set; file still on disk | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-24 | AC-24 | API | Download a removed file | 410 `ATTACHMENT_REMOVED`; zero file bytes in the response | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-25 | AC-25 | API | Cross-requester download | Requester B downloading A's attachment by direct id → 404 | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-26 | AC-23 | API | Metadata listing | Removed attachments still listed, with `removedAt`, `removalReason`, and `downloadUrl: null` | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-27 | AC-21 | API | Removal frees a slot | After removing one of five, a new upload succeeds | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-28 | AC-23 | API | Removal reason required | Missing or 4-character reason → 400 with `fields.removalReason`; attachment stays active | `server/tests/lab-02/attachments.api.test.ts` | Planned |

### 2.3 UI component

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | AC-01 | UI | Selection dropdown | Renders one option per active Requester; the inactive one is absent | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-02 | AC-06 | UI | Selection empty state | Empty message shown; Continue disabled; no dropdown | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-03 | AC-05 | UI | Selection API failure | Safe error message and a retry action; no dropdown; no stack trace text | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-04 | AC-02 | UI | Route guard | Opening My Tickets with no selection renders the Selection screen | `client/tests/lab-02/RequesterGuard.test.tsx` | Planned |
| UI-05 | AC-03 | UI | Shell identity | Current Requester's name and a Change Requester control render on every app screen | `client/tests/lab-02/AppShell.test.tsx` | Planned |
| UI-06 | AC-04 | UI | Requester switch | After switching, the previous Requester's rows are gone and a refetch was issued for the new id | `client/tests/lab-02/AppShell.test.tsx` | Planned |
| UI-07 | AC-09 | UI | Submit without Summary | Message rendered in the Summary field group; **API not called** | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-08 | AC-08 | UI | Reference data | Category and Related System options come from the mocked API response, not a literal array | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-09 | AC-11 | UI | Busy submit | Button disabled and busy during the request; a double click issues exactly one call | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-10 | AC-12 | UI | API failure retains input | After a rejected request, every entered value and the selected-file list are still present | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-11 | AC-07 | UI | Success state | Success callout shows the Ticket Number returned by the API and offers the next actions | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-12 | AC-13 | UI | Invalid attachment rows | An oversized file and a `.exe` each render their own error row and are not uploaded | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-13 | AC-14 | UI | My Tickets empty state | "no tickets yet" copy plus a Create Ticket action | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-14 | AC-17 | UI | No-results state | Distinct copy from empty, plus a Clear Filters action that resets the query | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-15 | AC-16 | UI | Search wiring | Typing a term issues a request carrying `search` and resets to page 1 | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-16 | AC-20 | UI | Detail is read-only | No `input`, `select`, or `textarea` renders in the ticket information region | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-17 | AC-23 | UI | Removed attachment row | Marked as removed with its reason; no download and no remove control on that row | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-18 | AC-23 | UI | Removal modal | Confirm disabled until a 5–200 character reason is entered; cancel closes without a request | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |

### 2.4 UI style

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| STYLE-01 | AC-27 | UI style | Required markers | Every required field's label renders the red asterisk element | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |
| STYLE-02 | AC-27 | UI style | Read-only vs editable | Read-only fields carry the read-only class and `readonly`/`aria-readonly`; editable fields carry neither | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |
| STYLE-03 | AC-27 | UI style | Message placement | The validation message node is inside the field group and follows its control in DOM order, and is referenced by `aria-describedby` | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |
| STYLE-04 | AC-11 | UI style | Busy button | Submit carries the busy class, `disabled`, and its busy label while in flight | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |
| STYLE-05 | AC-26 | UI style | Badges are not colour-only | Priority and Status badges render their value as text, with identical class names across list, cards, and detail | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |
| STYLE-06 | AC-26 | UI style | Token usage | Header and primary buttons resolve to the Zen Green token variables rather than literal hex values | `client/tests/lab-02/zen-green.style.test.tsx` | Planned |

### 2.5 Responsive

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RESP-01 | AC-26 | Responsive | Horizontal overflow | All four screens at 1280 / 900 / 375 px: `document.scrollWidth <= clientWidth` | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-02 | AC-28 | Responsive | List representation | My Tickets renders a table ≥ 992 px and ticket cards < 768 px | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-03 | AC-26 | Responsive | Clipping and overlap | No label or attachment name is clipped without a tooltip; no two message boxes overlap; screenshots written to `artifacts/lab-02/screenshots/` | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-04 | AC-28 | Responsive | Controls at 375 px | Filters, pagination, and attachment actions remain visible and clickable at ≥ 44 px touch size | `e2e/lab-02/responsive.spec.ts` | Planned |

### 2.6 End-to-end

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | AC-01, AC-07, AC-14, AC-15 | E2E | Full creation journey | Select a Requester → create a Ticket → confirmation shows the official number → the Ticket appears in My Tickets and opens | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | AC-19, AC-25 | E2E | Cross-requester isolation | As Requester B, A's ticket URL and A's attachment download URL both fail and reveal nothing | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | AC-22, AC-23, AC-24 | E2E | Attachment lifecycle | Add → download → soft-remove with a reason → metadata retained → download blocked | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-04 | AC-04 | E2E | Change Requester | Switching from A to B replaces the visible list; none of A's tickets remain | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

**Totals planned:** Unit 5 · API 28 · UI 18 · UI style 6 · Responsive 4 · E2E 4 — **65 tests**.

---

## 3. Acceptance-Criterion Traceability

Every acceptance criterion in `specification.md` §9 has at least one planned
test. No AC is unmapped.

| AC | Covered by |
| :--- | :--- |
| AC-01 | API-01, API-09, UI-01, E2E-01 |
| AC-02 | UI-04 |
| AC-03 | UI-05 |
| AC-04 | UI-06, E2E-04 |
| AC-05 | UI-03 |
| AC-06 | API-02, UI-02 |
| AC-07 | API-05, API-06, UI-11, E2E-01 |
| AC-08 | API-03, API-04, UI-08 |
| AC-09 | UNIT-03, API-07, UI-07 |
| AC-10 | UNIT-01, UNIT-02, API-05, API-08 |
| AC-11 | UI-09, STYLE-04 |
| AC-12 | UI-10 |
| AC-13 | UNIT-04, API-20, UI-12 |
| AC-14 | API-10, UI-13, E2E-01 |
| AC-15 | API-11, API-15, E2E-01 |
| AC-16 | API-12, UI-15 |
| AC-17 | API-13, UI-14 |
| AC-18 | UNIT-05, API-14 |
| AC-19 | API-17, API-18, E2E-02 |
| AC-20 | API-16, UI-16 |
| AC-21 | API-19, API-21, API-27 |
| AC-22 | API-22, E2E-03 |
| AC-23 | API-23, API-26, API-28, UI-17, UI-18, E2E-03 |
| AC-24 | API-24, E2E-03 |
| AC-25 | API-25, E2E-02 |
| AC-26 | STYLE-05, STYLE-06, RESP-01, RESP-03 |
| AC-27 | STYLE-01, STYLE-02, STYLE-03 |
| AC-28 | RESP-02, RESP-04 |

### 3.1 Test distribution by Issue

| Issue | Tests written on that branch |
| :--- | :--- |
| 2 — Database and Seed | seed idempotency covered by API-01/03/04 fixtures |
| 4 — Requester context | API-01, API-02, UI-01 – UI-06 |
| 8 — Reference data and shell | API-03, API-04, UI-05 |
| 5 — Ticket creation | UNIT-01 – UNIT-03, API-05 – API-09, UI-07 – UI-11 |
| 6 — My Tickets | UNIT-05, API-10 – API-15, UI-13 – UI-15 |
| 7 — Detail and attachments | UNIT-04, API-16 – API-28, UI-12, UI-16 – UI-18 |
| 9 — Test suite and artifacts | STYLE-01 – STYLE-06, RESP-01 – RESP-04, E2E-01 – E2E-04, screenshots, §4 checklist |

---

## 4. Responsive and Visual Checklist

Completed in Issue 9 against the screenshots listed in `ui-spec.md` §15 and the
checklist in `ui-spec.md` §14. Recorded here, screen by screen, at 1280 × 800,
900 × 1000, and 375 × 812.

| Check | Desktop | Tablet | Mobile |
| :--- | :--- | :--- | :--- |
| No horizontal page scrolling | ☐ | ☐ | ☐ |
| No clipped labels | ☐ | ☐ | ☐ |
| No overlapping messages or controls | ☐ | ☐ | ☐ |
| No hidden or unreachable buttons | ☐ | ☐ | ☐ |
| Attachment names readable or tooltipped | ☐ | ☐ | ☐ |
| Zen Green tokens applied (header, primary, background) | ☐ | ☐ | ☐ |
| Read-only fields visually distinct from editable | ☐ | ☐ | ☐ |
| Required asterisks present on every required field | ☐ | ☐ | ☐ |
| Validation messages directly beneath their field | ☐ | ☐ | ☐ |
| Button hierarchy correct; one primary per screen | ☐ | ☐ | ☐ |
| Submit busy state visible and disabled | ☐ | ☐ | ☐ |
| Priority and Status badges consistent everywhere | ☐ | ☐ | ☐ |
| Loading, empty, no-results, error states all reachable | ☐ | ☐ | ☐ |
| Ticket list: table ≥ 992 px, cards < 768 px | ☐ | n/a | ☐ |
| Filters and pagination usable | ☐ | ☐ | ☐ |
| Keyboard focus visible throughout | ☐ | ☐ | ☐ |

---

## 5. Test Commands

### Backend — unit and API

Run inside the server container so the tests reach the seeded PostgreSQL over
the compose network (`db:5432`):

```bash
docker exec toktickit-server npx vitest run --reporter=verbose
```

> **Note:** run this via `docker exec`, not a plain `npm test` on the host. A
> native PostgreSQL on `localhost:5432` can shadow the Docker database from the
> host and make the backend tests fail authentication. Running inside the
> container avoids the conflict. This is the same constraint recorded in Lab 1.

Seed first if the database is empty:

```bash
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
```

### Frontend — UI component and UI style

No database needed; the API module is mocked.

```bash
cd client
npx vitest run --reporter=verbose
```

### Responsive and E2E

Requires the stack to be running (`docker compose up -d`) with the seed applied:

```bash
npx playwright test e2e/lab-02 --reporter=list
```

Screenshots are written to `artifacts/lab-02/screenshots/`.

### Everything

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
docker exec toktickit-server npx vitest run --reporter=verbose
(cd client && npx vitest run --reporter=verbose)
npx playwright test e2e/lab-02 --reporter=list
```

---

## 6. Final Results

> To be completed in Issue 10 from a run on the **final `main` branch**, not a
> feature branch. Paste the verbatim runner output and the totals below.

| Level | Planned | Passed | Failed | Skipped |
| :--- | :--- | :--- | :--- | :--- |
| Unit | 5 | — | — | — |
| API | 28 | — | — | — |
| UI component | 18 | — | — | — |
| UI style | 6 | — | — | — |
| Responsive | 4 | — | — | — |
| E2E | 4 | — | — | — |
| **Total** | **65** | — | — | — |

```text
(backend vitest output goes here)
```

```text
(frontend vitest output goes here)
```

```text
(playwright output goes here)
```

---

## 7. Known Limitations and Deferred Tests

| # | Limitation | Reason | Where it goes |
| :--- | :--- | :--- | :--- |
| L-01 | No authentication, authorization, or session tests | Excluded from Lab 2 by labsheet §4.2; the Requester selector is a testing mechanism, not auth (BR-03) | Lab 3 |
| L-02 | No IT Staff, comments, notes, Actions Taken, or status-transition tests | Those features are out of scope; `TicketStatus` has only `NEW` in Lab 2 | Labs 3–4 |
| L-03 | Ticket Number collision is tested by uniqueness of sequential creations, not by forcing a concurrent race | A deterministic concurrency test needs parallel transactions the harness does not set up; the unique constraint plus the retry in `specification.md` §7.4 is the defence | Noted, not tested |
| L-04 | Removed attachment bytes are not tested for deletion | Removal is soft by design (D-05); the file is meant to remain on disk. API-24 proves access is blocked, which is the actual requirement | By design |
| L-05 | Colour contrast is asserted by token choice and review, not by an automated contrast test | No accessibility scanner is in the toolchain this sprint | Manual check in §4 |
| L-06 | Load and performance are untested | Not a Lab 2 requirement; indexes are justified by design in `specification.md` §7.3 | Out of scope |
