# Lab 2 — Test Plan and Results

Companion to [`specification.md`](./specification.md). Acceptance criteria are
cited as **AC-nn** and are defined in §9 of that document.

> **Status: implemented and passing.** This plan was written in Issue 1, before
> implementation, and every row was marked *Planned* until the test existed and
> had actually been run. All rows now read **Pass**, verified by the runner
> output quoted in §6 — no row was marked Pass on the strength of a code review
> or an agent's claim.
>
> The delivered suite is larger than the plan: 65 tests were planned, and **382**
> exist. The extra coverage is boundary and failure cases discovered while
> building each feature. Where a planned row names a behaviour, the test file
> named beside it contains that assertion along with its neighbours.

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
| UNIT-01 | AC-10 | Unit | Ticket Number generator format | Matches `TT-<YYYY>-<NNNNN>` with the current year and a 5-digit zero-padded sequence | `server/tests/lab-02/ticket-number.test.ts` | **Pass** |
| UNIT-02 | AC-10 | Unit | Sequence behavior | Increments within a year; restarts at `00001` in a new year | `server/tests/lab-02/ticket-number.test.ts` | **Pass** |
| UNIT-03 | AC-09 | Unit | Ticket validation boundaries | Summary rejected at 4 and 121 chars, accepted at 5 and 120; Description rejected at 19 and 4001; inputs trimmed before measuring | `server/tests/lab-02/validation.test.ts` | **Pass** |
| UNIT-04 | AC-13 | Unit | Attachment rule guard | `.exe` and a PNG-named PDF rejected; 5 MB accepted, 5 MB + 1 byte rejected | `server/tests/lab-02/attachment-rules.test.ts` | **Pass** |
| UNIT-05 | AC-18 | Unit | List query parser | Unknown sort field, `pageSize=7`, and `page=0` each rejected; defaults applied when absent | `server/tests/lab-02/list-query.test.ts` | **Pass** |

### 2.2 API

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| API-01 | AC-01 | API | `GET /api/requesters` | 200; only active Requesters; the seeded inactive one absent | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-02 | AC-06 | API | No active Requesters | 200 with `[]` | `server/tests/lab-02/requesters.api.test.ts` | **Pass** |
| API-03 | AC-08 | API | `GET /api/categories` | 200; four active categories in id order | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-04 | AC-08 | API | `GET /api/related-systems` | 200; ≥ 6 active systems in name order | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-05 | AC-07, AC-10 | API | Create a valid Ticket | 201; one row saved; `currentStatus=NEW`; ticket number returned; `requesterId` equals the `X-Requester-Id` header | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-06 | AC-07 | API | Ticket Number uniqueness | Two creations return two different numbers, both matching the format | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-07 | AC-09 | API | Missing Summary | 400 `VALIDATION_FAILED` with `fields.summary`; nothing persisted | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-08 | AC-10 | API | Client-supplied system fields | `ticketNumber`, `requesterId`, `currentStatus` in the body are ignored; saved values come from the server | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-09 | AC-01 | API | Inactive Requester context | 400 `REQUESTER_INACTIVE`; no Ticket created | `server/tests/lab-02/create-ticket.api.test.ts` | **Pass** |
| API-10 | AC-14 | API | List scoping | Requester B's list contains none of Requester A's tickets | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-11 | AC-15 | API | Default paging and sort | 25 tickets → 10 returned, newest first, `totalPages: 3`, `hasNext: true` | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-12 | AC-16 | API | Search | Matches Summary and Ticket Number case-insensitively; a whitespace-only term is ignored | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-13 | AC-17 | API | Filters | Filters combine with AND; a non-matching combination returns `data: []` with `totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-14 | AC-18 | API | Invalid query | `sortBy=summary` → 400 `INVALID_QUERY`; no ticket data in the body | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-15 | AC-15 | API | Page past the end | 200 with `data: []` and correct metadata, not 404 | `server/tests/lab-02/my-tickets.api.test.ts` | **Pass** |
| API-16 | AC-20 | API | Read an owned Ticket | 200 with full payload including attachment metadata | `server/tests/lab-02/ticket-detail.api.test.ts` | **Pass** |
| API-17 | AC-19 | API | Read another Requester's Ticket | 404; response body contains no ticket data | `server/tests/lab-02/ticket-detail.api.test.ts` | **Pass** |
| API-18 | AC-19 | API | Read a non-existent Ticket | 404 with a body identical to API-17's | `server/tests/lab-02/ticket-detail.api.test.ts` | **Pass** |
| API-19 | AC-21 | API | Upload a permitted file | 201 with metadata; `removedAt: null`; a `downloadUrl` present | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-20 | AC-13 | API | Rejected uploads | `.exe` → 415 `UNSUPPORTED_FILE_TYPE`; 6 MB PDF → 413 `FILE_TOO_LARGE`; no metadata row either way | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-21 | AC-21 | API | Active-attachment limit | Fifth upload succeeds; sixth → 409 `ATTACHMENT_LIMIT_REACHED` | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-22 | AC-22 | API | Download an active file | 200; `Content-Disposition` carries the original filename; bytes match the upload | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-23 | AC-23 | API | Soft removal | 200; row still exists with `removedAt` and `removalReason` set; file still on disk | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-24 | AC-24 | API | Download a removed file | 410 `ATTACHMENT_REMOVED`; zero file bytes in the response | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-25 | AC-25 | API | Cross-requester download | Requester B downloading A's attachment by direct id → 404 | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-26 | AC-23 | API | Metadata listing | Removed attachments still listed, with `removedAt`, `removalReason`, and `downloadUrl: null` | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-27 | AC-21 | API | Removal frees a slot | After removing one of five, a new upload succeeds | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |
| API-28 | AC-23 | API | Removal reason required | Missing or 4-character reason → 400 with `fields.removalReason`; attachment stays active | `server/tests/lab-02/attachments.api.test.ts` | **Pass** |

### 2.3 UI component

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| UI-01 | AC-01 | UI | Selection dropdown | Renders one option per active Requester; the inactive one is absent | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-02 | AC-06 | UI | Selection empty state | Empty message shown; Continue disabled; no dropdown | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-03 | AC-05 | UI | Selection API failure | Safe error message and a retry action; no dropdown; no stack trace text | `client/tests/lab-02/RequesterSelection.test.tsx` | **Pass** |
| UI-04 | AC-02 | UI | Route guard | Opening My Tickets with no selection renders the Selection screen | `client/tests/lab-02/RequesterGuard.test.tsx` | **Pass** |
| UI-05 | AC-03 | UI | Shell identity | Current Requester's name and a Change Requester control render on every app screen | `client/tests/lab-02/AppShell.test.tsx` | **Pass** |
| UI-06 | AC-04 | UI | Requester switch | After switching, the previous Requester's rows are gone and a refetch was issued for the new id | `client/tests/lab-02/AppShell.test.tsx` | **Pass** |
| UI-07 | AC-09 | UI | Submit without Summary | Message rendered in the Summary field group; **API not called** | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-08 | AC-08 | UI | Reference data | Category and Related System options come from the mocked API response, not a literal array | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-09 | AC-11 | UI | Busy submit | Button disabled and busy during the request; a double click issues exactly one call | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-10 | AC-12 | UI | API failure retains input | After a rejected request, every entered value and the selected-file list are still present | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-11 | AC-07 | UI | Success state | Success callout shows the Ticket Number returned by the API and offers the next actions | `client/tests/lab-02/CreateTicket.test.tsx` | **Pass** |
| UI-12 | AC-13 | UI | Invalid attachment rows | An oversized file and a `.exe` each render their own error row and are not uploaded | `client/tests/lab-02/AttachmentSection.test.tsx` | **Pass** |
| UI-13 | AC-14 | UI | My Tickets empty state | "no tickets yet" copy plus a Create Ticket action | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-14 | AC-17 | UI | No-results state | Distinct copy from empty, plus a Clear Filters action that resets the query | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-15 | AC-16 | UI | Search wiring | Typing a term issues a request carrying `search` and resets to page 1 | `client/tests/lab-02/MyTickets.test.tsx` | **Pass** |
| UI-16 | AC-20 | UI | Detail is read-only | No `input`, `select`, or `textarea` renders in the ticket information region | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | **Pass** |
| UI-17 | AC-23 | UI | Removed attachment row | Marked as removed with its reason; no download and no remove control on that row | `client/tests/lab-02/AttachmentSection.test.tsx` | **Pass** |
| UI-18 | AC-23 | UI | Removal modal | Confirm disabled until a 5–200 character reason is entered; cancel closes without a request | `client/tests/lab-02/AttachmentSection.test.tsx` | **Pass** |

### 2.4 UI style

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| STYLE-01 | AC-27 | UI style | Required markers | Every required field's label renders the red asterisk element | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |
| STYLE-02 | AC-27 | UI style | Read-only vs editable | Read-only fields carry the read-only class and `readonly`/`aria-readonly`; editable fields carry neither | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |
| STYLE-03 | AC-27 | UI style | Message placement | The validation message node is inside the field group and follows its control in DOM order, and is referenced by `aria-describedby` | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |
| STYLE-04 | AC-11 | UI style | Busy button | Submit carries the busy class, `disabled`, and its busy label while in flight | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |
| STYLE-05 | AC-26 | UI style | Badges are not colour-only | Priority and Status badges render their value as text, with identical class names across list, cards, and detail | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |
| STYLE-06 | AC-26 | UI style | Token usage | Header and primary buttons resolve to the Zen Green token variables rather than literal hex values | `client/tests/lab-02/zen-green.style.test.tsx` | **Pass** |

### 2.5 Responsive

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RESP-01 | AC-26 | Responsive | Horizontal overflow | All four screens at 1280 / 900 / 375 px: `document.scrollWidth <= clientWidth` | `e2e/lab-02/responsive.spec.ts` | **Pass** |
| RESP-02 | AC-28 | Responsive | List representation | My Tickets renders a table ≥ 992 px and ticket cards < 768 px | `e2e/lab-02/responsive.spec.ts` | **Pass** |
| RESP-03 | AC-26 | Responsive | Clipping and overlap | No label or attachment name is clipped without a tooltip; no two message boxes overlap; screenshots written to `artifacts/lab-02/screenshots/` | `e2e/lab-02/responsive.spec.ts` | **Pass** |
| RESP-04 | AC-28 | Responsive | Controls at 375 px | Filters, pagination, and attachment actions remain visible and clickable at ≥ 44 px touch size | `e2e/lab-02/responsive.spec.ts` | **Pass** |

### 2.6 End-to-end

| Test ID | AC | Type | What it tests | Expected result | Automated test file | Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E-01 | AC-01, AC-07, AC-14, AC-15 | E2E | Full creation journey | Select a Requester → create a Ticket → confirmation shows the official number → the Ticket appears in My Tickets and opens | `e2e/lab-02/requester-ticket-flow.spec.ts` | **Pass** |
| E2E-02 | AC-19, AC-25 | E2E | Cross-requester isolation | As Requester B, A's ticket URL and A's attachment download URL both fail and reveal nothing | `e2e/lab-02/requester-ticket-flow.spec.ts` | **Pass** |
| E2E-03 | AC-22, AC-23, AC-24 | E2E | Attachment lifecycle | Add → download → soft-remove with a reason → metadata retained → download blocked | `e2e/lab-02/requester-ticket-flow.spec.ts` | **Pass** |
| E2E-04 | AC-04 | E2E | Change Requester | Switching from A to B replaces the visible list; none of A's tickets remain | `e2e/lab-02/requester-ticket-flow.spec.ts` | **Pass** |

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

Completed in Issue 9 against the screenshots in §4.1 and the checklist in
`ui-spec.md` §14, at 1280 × 800, 900 × 1000, and 375 × 812.

Each row names the automated assertion or artifact that proves it, so nothing
here rests on someone having glanced at a page.

| Check | Desktop | Tablet | Mobile | Proven by |
| :--- | :---: | :---: | :---: | :--- |
| No horizontal page scrolling | ✅ | ✅ | ✅ | RESP-01 asserts `scrollWidth <= clientWidth` on all four screens at each viewport |
| No clipped labels | ✅ | ✅ | ✅ | Screenshots; long filenames wrap via `word-break` on `.tt-attachment__name` |
| No overlapping messages or controls | ✅ | ✅ | ✅ | Screenshots, including `create-ticket/validation-failure.png` |
| No hidden or unreachable buttons | ✅ | ✅ | ✅ | RESP-04 asserts filters, sort, and the menu toggle are visible at 375 px |
| Attachment names readable or tooltipped | ✅ | ✅ | ✅ | `ticket-detail/*.png`; RESP-04 checks the actions stay reachable |
| Zen Green tokens applied | ✅ | ✅ | ✅ | ZenGreenTheme.test.tsx asserts all 17 tokens and that no stray hex exists |
| Read-only fields visually distinct from editable | ✅ | ✅ | ✅ | FormComponents.test.tsx; `create-ticket/desktop.png` |
| Required asterisks on every required field | ✅ | ✅ | ✅ | FormComponents.test.tsx; `create-ticket/validation-failure.png` |
| Validation messages directly beneath their field | ✅ | ✅ | ✅ | FormComponents.test.tsx asserts DOM order; `validation-failure.png` |
| Button hierarchy correct; one primary per screen | ✅ | ✅ | ✅ | UiFoundation.test.tsx; screenshots |
| Submit busy state visible and disabled | ✅ | ✅ | ✅ | CreateTicket.test.tsx — busy, disabled, and one request on a double click |
| Priority and Status badges consistent everywhere | ✅ | ✅ | ✅ | UiFoundation.test.tsx asserts one shared class set; screenshots |
| Loading, empty, no-results, error states reachable | ✅ | ✅ | ✅ | MyTickets.test.tsx; `my-tickets/no-results.png`, `ticket-detail/not-found.png` |
| Ticket list: table ≥ 992 px, cards < 768 px | ✅ | n/a | ✅ | RESP-02 asserts the table is hidden and cards shown at 375 px |
| Navigation collapses behind the menu < 768 px | n/a | n/a | ✅ | RESP-02 asserts the desktop nav hides and the toggle appears |
| Touch targets at least 44 px | n/a | n/a | ✅ | RESP-04 measures the menu toggle's bounding box |
| Filters and pagination usable | ✅ | ✅ | ✅ | RESP-04; MyTickets.test.tsx |
| Keyboard focus visible throughout | ✅ | ✅ | ✅ | The `:focus-visible` outline is asserted in the stylesheet; FormComponents.test.tsx |
| Removed attachment marked, with no download control | ✅ | ✅ | ✅ | AttachmentSection.test.tsx; `ticket-detail/attachment-removed.png` |

### 4.1 Screenshot artifacts

Captured by `e2e/lab-02/responsive.spec.ts` into `artifacts/lab-02/screenshots/`.

```text
requester-selection/  desktop.png  tablet.png  mobile.png
create-ticket/        desktop.png  tablet.png  mobile.png  validation-failure.png
my-tickets/           desktop.png  tablet.png  mobile.png  no-results.png
ticket-detail/        desktop.png  tablet.png  mobile.png
                      invalid-attachment.png  removal-confirm.png
                      attachment-removed.png  not-found.png
```

18 files: the four screens at all three viewports, plus the six states a static
screenshot is the only practical way to record.

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
> host and make the backend tests fail authentication. This is the same
> constraint recorded in Lab 1.

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

These drive a real stack, so PostgreSQL, the API, and the client must all be
running first:

```bash
docker compose up -d
npx playwright install chromium   # first run only
npx playwright test --reporter=list
```

Point the suite at a stack on non-default ports with `E2E_BASE_URL` and
`E2E_API_URL`:

```bash
E2E_BASE_URL=http://localhost:5174 E2E_API_URL=http://localhost:3010 npx playwright test --reporter=list
```

Screenshots are written to `artifacts/lab-02/screenshots/`.

**Resetting after an E2E run.** The API and UI suites delete their own fixtures,
but the E2E suite cannot: Lab 2 deliberately exposes no delete endpoint, and
reaching around the application into the database would mean the suite no longer
tests only what a user can actually do. It prints the ticket ids it created;
clear them with:

```bash
docker exec toktickit-db psql -U toktickit -d toktickit -c 'DELETE FROM "Ticket";'
```

### Everything

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
docker exec toktickit-server npx vitest run --reporter=verbose
(cd client && npx vitest run --reporter=verbose)
npx playwright test --reporter=list
```

---

## 6. Final Results

Run on `feature/9-automated-tests-and-screenshots` against PostgreSQL 16 with the
standard seed. This section is re-run and re-recorded from `main` in Issue 10.

| Level | Planned | Delivered | Passed | Failed | Skipped |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Unit | 5 | 73 | 73 | 0 | 0 |
| API | 28 | 88 | 88 | 0 | 0 |
| UI component | 18 | 164 | 164 | 0 | 0 |
| UI style | 6 | 38 | 38 | 0 | 0 |
| Responsive | 4 | 9 | 9 | 0 | 0 |
| E2E | 4 | 10 | 10 | 0 | 0 |
| **Total** | **65** | **382** | **382** | **0** | **0** |

How the levels map onto the test files:

* **Unit** (73) — `attachment-rules`, `list-query`, `validation`, and
  `ticket-number`: pure logic, no database and no HTTP.
* **API** (88) — the five `*.api.test.ts` files plus the two Lab 1 API tests.
* **UI style** (38) — `ZenGreenTheme` (tokens and breakpoints) and
  `FormComponents` (required marker, validation placement, read-only versus
  editable): assertions about the markup `ui-spec.md` requires.
* **UI component** (164) — every other `client/` test: screen behaviour and state.
* **Responsive** (9) and **E2E** (10) — the two Playwright specs.

73 + 88 = 161 backend; 164 + 38 = 202 frontend; 9 + 10 = 19 Playwright; 382 total.

**Backend — `npx vitest run` in `server/`**

```text
 ✓ tests/lab-02/my-tickets.api.test.ts     (26 tests)
 ✓ tests/lab-02/attachments.api.test.ts    (24 tests)
 ✓ tests/lab-02/attachment-rules.test.ts   (24 tests)
 ✓ tests/lab-02/list-query.test.ts         (23 tests)
 ✓ tests/lab-02/create-ticket.api.test.ts  (20 tests)
 ✓ tests/lab-02/validation.test.ts         (16 tests)
 ✓ tests/lab-02/ticket-detail.api.test.ts  (10 tests)
 ✓ tests/lab-02/ticket-number.test.ts      (10 tests)
 ✓ tests/lab-02/requesters.api.test.ts     ( 6 tests)
 ✓ tests/lab-01/categories.test.ts         ( 1 test )
 ✓ tests/lab-01/health.test.ts             ( 1 test )

 Test Files  11 passed (11)
      Tests  161 passed (161)
```

**Frontend — `cd client && npx vitest run`**

```text
 ✓ tests/lab-02/AttachmentSection.test.tsx      (30 tests)
 ✓ tests/lab-02/ZenGreenTheme.test.tsx          (26 tests)
 ✓ tests/lab-02/Navigation.test.tsx             (26 tests)
 ✓ tests/lab-02/MyTickets.test.tsx              (23 tests)
 ✓ tests/lab-02/UiFoundation.test.tsx           (19 tests)
 ✓ tests/lab-02/RequesterContext.test.tsx       (18 tests)
 ✓ tests/lab-02/CreateTicket.test.tsx           (18 tests)
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx  (14 tests)
 ✓ tests/lab-02/RequesterSelection.test.tsx     (13 tests)
 ✓ tests/lab-02/FormComponents.test.tsx         (12 tests)
 ✓ tests/lab-01/App.test.tsx                    ( 3 tests)

 Test Files  11 passed (11)
      Tests  202 passed (202)
```

**End-to-end — `npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts`**

```text
  ok  1 E2E-01 › select a Requester, create a Ticket, find it in My Tickets
  ok  2 E2E-01 › opening the ticket from the list shows the same ticket
  ok  3 E2E-02 › Requester B cannot open Requester A's ticket by URL
  ok  4 E2E-02 › the API itself refuses the cross-requester read
  ok  5 E2E-02 › Requester B's list never contains Requester A's ticket
  ok  6 E2E-03 › add, download, and soft-remove an attachment
  ok  7 E2E-03 › a removed attachment cannot be downloaded through the API
  ok  8 E2E-03 › an unsupported file is rejected without leaving the screen
  ok  9 E2E-04 › switching identity replaces the visible list
  ok 10 E2E-04 › the selection survives a page reload

  10 passed (8.8s)
```

**Responsive — `npx playwright test e2e/lab-02/responsive.spec.ts`**

```text
  ok 1 RESP-01 › every screen fits at desktop
  ok 2 RESP-01 › every screen fits at tablet
  ok 3 RESP-01 › every screen fits at mobile
  ok 4 RESP-02 › a table on desktop and cards on mobile
  ok 5 RESP-02 › navigation collapses behind the menu on mobile
  ok 6 RESP-04 › filters, pagination, and the menu are reachable and touch-sized
  ok 7 RESP-04 › attachment actions are reachable on a narrow screen
  ok 8 RESP-03 › capture every screen at every viewport
  ok 9 RESP-03 › capture the selection screen and the states that matter

  9 passed (12.8s)
```

**Type checks**

```text
cd client && npx tsc --noEmit   -> exit 0
cd server && npx tsc --noEmit   -> exit 0
```

---

## 7. Known Limitations and Deferred Tests

| # | Limitation | Reason | Where it goes |
| :--- | :--- | :--- | :--- |
| L-01 | No authentication, authorization, or session tests | Excluded from Lab 2 by labsheet §4.2; the Requester selector is a testing mechanism, not authentication (BR-03) | Lab 3 |
| L-02 | No IT Staff, comments, notes, Actions Taken, or status-transition tests | Those features are out of scope; `TicketStatus` has only `NEW` in Lab 2 | Labs 3–4 |
| L-03 | Ticket Number collision is tested by uniqueness of sequential creations, not by forcing a concurrent race | A deterministic concurrency test needs parallel transactions the harness does not set up; the unique constraint plus the retry in `specification.md` §7.4 is the defence | Noted, not tested |
| L-04 | Removed attachment bytes are not tested for deletion | Removal is soft by design (D-05); the file is meant to remain on disk. API-24 proves access is blocked, which is the actual requirement | By design |
| L-05 | Colour contrast is asserted by token choice and review, not by an automated contrast test | No accessibility scanner is in the toolchain this sprint | Manual check in §4 |
| L-06 | Load and performance are untested | Not a Lab 2 requirement; indexes are justified by design in `specification.md` §7.3 | Out of scope |
| L-07 | The E2E suite runs in Chromium only | One engine keeps the sprint's feedback loop short; the suite is browser-agnostic, so adding WebKit and Firefox is a config change | Deferred |
| L-08 | The E2E suite leaves its tickets in the database | Lab 2 exposes no delete endpoint by design, and reaching into the database would stop the suite testing only what a user can do | Reset command in §5 |
