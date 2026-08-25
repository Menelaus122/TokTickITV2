# Lab 2 — Sprint Engineering Specification

**Project:** TokTickIT · **Sprint:** Lab 2 — Requester Ticketing MVP with UI Foundation
**Status:** Approved before implementation · **Owner:** Menelaus122

> This document is the engineering contract for Sprint 2. Implementation may not
> begin on a feature branch until the section covering it is approved here, and
> the coding agent may report "done" only when the Definition of Done in §10 is
> satisfied.

---

## 1. Sprint Goal

Deliver the Requester-facing half of TokTickIT: a Requester can be selected
through a temporary development selector, create an IT support ticket with
supporting attachments, receive a backend-generated Ticket Number, find that
ticket again in a searchable and paginated My Tickets list, open its read-only
detail screen, and add, download, or soft-remove its attachments — all of it
scoped so that one Requester can never see another Requester's data, and all of
it presented in a reusable Zen Green visual system that later sprints extend
rather than replace.

---

## 2. Stakeholder Request Interpretation

IT is ready to take real requests, so the product needs a complete
end-user path from "I have a problem" to "my request is recorded and I can
check on it." Four things are being asked for at once:

1. **A working ticket intake.** Describe a problem, classify it (category and
   related system), state how urgent it feels, attach evidence, submit.
2. **A way back in.** After submitting, the Requester must be able to find the
   ticket, search their own history, and open it to review what was recorded.
3. **Data safety without login.** The backend owns the Ticket Number and must
   refuse to hand one Requester another Requester's ticket — even though real
   authentication does not arrive until Lab 3. A temporary Development
   Requester selector stands in for login purely as a testing mechanism.
4. **A visual foundation.** The Zen Green theme, form conventions, badges,
   list behavior, and state handling defined here are the house style; Lab 3
   and beyond reuse them instead of inventing new ones per screen.

The stakeholder request is deliberately incomplete. The business rules in §5
and the validation limits in §4 are this team's decisions, derived from that
request and approved before coding.

---

## 3. Scope

### 3.1 Included

| Area | Included work |
| :--- | :--- |
| Development Requester context | Active-requester API, selection screen, persisted selection, shell display, Change Requester, guarded routes |
| Reference data | Active Categories API, active Related Systems API |
| Create Ticket | Form, client + server validation, backend Ticket Number generation, attachments at creation, success and failure states |
| My Tickets | Requester-scoped paginated list with search, filters, sorting, and loading / empty / no-results / error states |
| Requester Ticket Detail | Read-only ticket view with backend-enforced ownership |
| Attachment lifecycle | Upload, metadata listing, download of active files, soft removal with a reason, retained metadata for removed files |
| UI foundation | Zen Green tokens, reusable form / list / badge / state components, application shell and navigation, responsive rules |
| Quality | Unit, API, UI component, UI style, responsive, and E2E tests plus screenshot evidence |

### 3.2 Explicitly excluded

Per labsheet §4.2, the following are **out of scope for Lab 2** and must not be
implemented, not even partially:

* Authentication and security — login, logout, passwords, hashing, sessions,
  tokens, authenticated identity, real role-based authorization. The
  Development Requester selector is a testing mechanism and is **not**
  authentication.
* IT Staff workflow — staff dashboard, queue, claiming, reassignment, IT
  Priority.
* Collaboration — Public Comments, Internal Notes, Actions Taken.
* Ticket lifecycle past creation — any status change beyond the initial `NEW`,
  including resolve, close, reopen, cancel.
* Administration — managing users, requesters, roles, or reference data.

---

## 4. Functional Requirements

### 4.1 Development Requester context

| ID | Requirement |
| :--- | :--- |
| FR-01 | The Development Requester Selection screen lists every **active** Requester loaded from PostgreSQL through the API, in a keyboard-accessible dropdown. |
| FR-02 | A **Continue** action stores the chosen Requester as the current testing context and routes the user into the application. |
| FR-03 | The application shell displays the current Requester's name on every screen, together with a **Change Requester** action. |
| FR-04 | Changing the Requester clears cached requester-scoped data and reloads My Tickets and any open detail view for the new identity. |
| FR-05 | Any requester-scoped route opened with no Requester selected redirects to the Selection screen. |
| FR-06 | The Selection screen renders distinct **loading**, **empty** (no active Requesters), and **API failure** states, each with a safe message and, where applicable, a retry action. |

### 4.2 Reference data and shell

| ID | Requirement |
| :--- | :--- |
| FR-07 | The API exposes active Categories and active Related Systems; the Create Ticket and My Tickets screens populate every classification control from those endpoints, never from hard-coded arrays. |
| FR-08 | The application shell provides TokTickIT identity, **My Tickets** and **Create Ticket** navigation, and clear active-page indication. |
| FR-09 | Navigation collapses to a touch-friendly mobile presentation below 768 px with no horizontal page scrolling. |

### 4.3 Create Ticket

| ID | Requirement |
| :--- | :--- |
| FR-10 | The Create Ticket screen captures Category, Related System, Ticket Summary, Requested Priority, Description, and Attachments, and displays the system-generated Ticket Number, Ticket Date, and Requester as visually distinct read-only values. |
| FR-11 | The client validates every required field before submission and renders each message directly beneath its own field. |
| FR-12 | The backend independently validates the whole payload and is the authority; a request that passes client validation but fails server validation returns field-level errors that the form renders in the same place. |
| FR-13 | On success the backend generates a unique official Ticket Number, persists the Ticket with status `NEW` bound to the selected Requester, and returns the saved record. |
| FR-14 | The success state displays the generated Ticket Number and offers next actions (view the ticket, create another). |
| FR-15 | The Requester may attach up to five permitted files during creation; each file is validated for type and size before upload. |
| FR-16 | While a submission is in flight the Submit button shows a busy state and is disabled, and no second request can be issued. |
| FR-17 | If the API is unreachable or returns an error, the screen shows a safe error state and **retains every value the Requester typed**, including the selected attachments list. |

### 4.4 My Tickets

| ID | Requirement |
| :--- | :--- |
| FR-18 | My Tickets shows only Tickets owned by the currently selected Requester, paginated. |
| FR-19 | The list supports free-text search across Ticket Number and Summary. |
| FR-20 | The list supports filtering by Category, Related System, Requested Priority, and Current Status. |
| FR-21 | The list supports sorting by Ticket Date and Last Updated, with a documented default and a stable secondary sort. |
| FR-22 | The list supports pagination with a documented default page size, a permitted page-size set, and page metadata. |
| FR-23 | The screen distinguishes **loading**, **empty** (this Requester has no tickets at all), **no-results** (filters or search matched nothing), and **error** states, and offers a Clear Filters action in the no-results state. |
| FR-24 | Each row or card carries enough information to identify and open a Ticket, and opening one navigates to its detail screen. |

### 4.5 Ticket Detail and attachments

| ID | Requirement |
| :--- | :--- |
| FR-25 | The Requester Ticket Detail screen presents all Ticket information read-only; no field on it is editable in Lab 2. |
| FR-26 | The backend rejects any attempt to read a Ticket or Attachment that does not belong to the requesting Requester, regardless of what the client sends. |
| FR-27 | The Requester may add permitted attachments to an existing owned Ticket, subject to the active-attachment limit. |
| FR-28 | The Requester may download any **active** attachment on an owned Ticket. |
| FR-29 | The Requester may soft-remove an attachment on an owned Ticket after confirming and supplying a removal reason. |
| FR-30 | A removed attachment remains visible as metadata, is visually marked as removed, and can no longer be downloaded or previewed through any route. |
| FR-31 | If a Ticket is created successfully but one or more attachment uploads fail, the Ticket is kept and the failures are reported per file so the Requester can retry from the detail screen. |

### 4.6 Cross-cutting

| ID | Requirement |
| :--- | :--- |
| FR-32 | Every screen conforms to the Zen Green specification in `ui-spec.md` at desktop, tablet, and mobile breakpoints. |
| FR-33 | Every error surfaced to the user is safe: no stack traces, SQL, file paths, or internal identifiers. |

---

## 5. Business Rules

### 5.1 Mandatory rules from the handout

| ID | Rule |
| :--- | :--- |
| BR-01 | The official Ticket Number is generated by the backend and must be unique. A client-supplied ticket number is ignored. |
| BR-02 | A new Ticket begins with Current Status `NEW`. |
| BR-03 | Lab 2 uses a Development Requester selector instead of login. The selected identity is for testing only and is not authentication. |

### 5.2 Ticket defaults and system-generated values

| ID | Rule |
| :--- | :--- |
| BR-04 | The Ticket Number format is `TT-<YYYY>-<NNNNN>` — literal `TT`, the four-digit creation year, and a five-digit sequence that restarts at `00001` each calendar year (e.g. `TT-2026-00042`). |
| BR-05 | Ticket Date is the server-side creation timestamp. The client never supplies it and cannot override it. |
| BR-06 | The Ticket's Requester is taken from the request's Requester context, never from the request body. A Ticket's Requester is fixed at creation and immutable in Lab 2. |
| BR-07 | Requested Priority is an explicit Requester choice with no default. One of `LOW`, `MEDIUM`, `HIGH`, `URGENT` must be selected. |
| BR-08 | `Ticket.updatedAt` changes when the Ticket or any of its attachments changes, so "Last Updated" is meaningful in My Tickets. |

### 5.3 Requester selection and switching

| ID | Rule |
| :--- | :--- |
| BR-09 | Only Requesters with `isActive = true` are returned by the active-requesters endpoint and are therefore the only ones selectable. |
| BR-10 | The selected Requester is persisted in browser `localStorage` under `toktickit.devRequesterId` so a page reload keeps the testing context. It is never sent to or stored by the backend as a session. |
| BR-11 | Switching Requester discards all cached requester-scoped state and refetches. No data belonging to the previous Requester may remain on screen. |
| BR-12 | A request carrying a Requester id that does not exist or is inactive is rejected; the API never falls back to a default Requester. |
| BR-13 | If no active Requesters exist, the Selection screen shows its empty state and the Continue action stays disabled. |

### 5.4 Ownership

| ID | Rule |
| :--- | :--- |
| BR-14 | Every requester-scoped request carries the current Requester in the `X-Requester-Id` header. Ownership is decided by that header on the server only; query parameters and request bodies are never trusted for identity. |
| BR-15 | Ticket and Attachment reads are filtered by owner in the database query itself, not by fetching first and comparing afterwards. |
| BR-16 | A request for a Ticket or Attachment that exists but belongs to another Requester returns **404 Not Found**, identical to a request for something that does not exist. Existence of another Requester's data is never disclosed. |
| BR-17 | Ownership is enforced on every route independently, including download. A direct link to another Requester's attachment must fail even with a valid attachment id. |

### 5.5 Search, filtering, sorting, pagination

| ID | Rule |
| :--- | :--- |
| BR-18 | Search matches case-insensitively against Ticket Number and Summary. The search term is trimmed; a term that is empty after trimming is ignored rather than treated as a filter. |
| BR-19 | Filters are Category, Related System, Requested Priority, and Current Status. Multiple filters combine with AND. Search combines with filters using AND. |
| BR-20 | Default sort is Ticket Date descending (newest first). Permitted sort fields are `createdAt` and `updatedAt`, ascending or descending. |
| BR-21 | Every sort has `id` descending as its secondary key so ordering is stable and pagination cannot repeat or skip a row when timestamps tie. |
| BR-22 | Pagination is one-based. Default page size is 10; permitted page sizes are 10, 20, and 50. |
| BR-23 | An unknown sort field, an unpermitted page size, or a non-positive page number is a client error and returns **400**. Invalid input is never silently corrected to a default, because silent correction hides bugs from the test suite. |
| BR-24 | A page number beyond the last page is valid input and returns an empty result set with correct metadata, not a 404. |

### 5.6 Validation and duplicate submission

| ID | Rule |
| :--- | :--- |
| BR-25 | All string inputs are trimmed before validation and stored trimmed. Internal whitespace is preserved. |
| BR-26 | Ticket Summary is required, 5–120 characters after trimming. Short enough to stay readable as one line in the list, long enough to describe a real problem. |
| BR-27 | Description is required, 20–4000 characters after trimming. The lower bound rejects "it broken"; the upper bound keeps a pasted log from becoming an unbounded column. |
| BR-28 | Category, Related System, and Requested Priority are required. Category and Related System must reference rows that exist and are active. |
| BR-29 | Validation runs on both client and server with identical limits. The server is authoritative; the client copy exists only to give fast feedback. |
| BR-30 | The Submit control is disabled for the entire duration of an in-flight submission, and the client permits at most one Create Ticket request at a time. Two identical tickets can only result from two deliberate submissions. |
| BR-31 | After any submission failure — validation or transport — every value the Requester entered is retained in the form, including the chosen attachment list. Nothing is cleared except on success. |

### 5.7 Attachments

| ID | Rule |
| :--- | :--- |
| BR-32 | Permitted types are JPG/JPEG, PNG, WEBP, and PDF, checked by file extension **and** MIME type. A mismatch is rejected. |
| BR-33 | Maximum file size is 5 MB (5 × 1024 × 1024 bytes) per file. Enforced by the server; the client checks first only for fast feedback. |
| BR-34 | A Ticket may hold at most five **active** attachments. Soft-removed attachments do not count toward the limit, so removing one frees a slot. |
| BR-35 | Files are stored on disk under `server/uploads/` with a generated opaque filename (`<uuid><ext>`). The original filename is kept only as metadata and is never used as a path. |
| BR-36 | Required attachment metadata: original filename, stored filename, MIME type, size in bytes, upload timestamp, owning Ticket. |
| BR-37 | Only the Requester who owns the Ticket may add, download, or remove its attachments. |
| BR-38 | Removal is always soft. The row is retained and stamped with `removedAt` and `removalReason`; the stored file is not deleted in Lab 2. |
| BR-39 | Removal requires an explicit confirmation step and a removal reason of 5–200 characters after trimming. A blank reason is rejected. |
| BR-40 | A removed attachment stays visible in the attachment list as metadata, clearly marked as removed and showing its removal reason, but its download and preview controls are gone. |
| BR-41 | A download request for a removed attachment returns **410 Gone** and never streams file bytes, whatever the UI shows. |
| BR-42 | If the Ticket is created but an attachment upload fails, the Ticket is **kept** and the failed files are reported individually. Ticket creation is never rolled back because of an attachment failure — the Requester's typed problem description is more valuable than an atomic write, and the compensation is a retry from the Ticket Detail screen. |
| BR-43 | Attachment upload is committed only after the file is written to disk. A failed disk write leaves no metadata row behind. |

### 5.8 States and transition to Lab 3

| ID | Rule |
| :--- | :--- |
| BR-44 | Empty and no-results are distinct states with distinct copy. "You have no tickets yet" invites creating one; "No tickets match your filters" invites clearing them. |
| BR-45 | Ticket Detail is reachable only for a Ticket owned by the current Requester; any other id resolves to the not-found state (per BR-16). |
| BR-46 | In Lab 3 the `X-Requester-Id` header is replaced by an authenticated identity resolved from a session or token. No request body, response shape, or ownership query changes — only the source of the identity. The `RequesterUser` model is designed to grow authentication columns rather than be replaced. |

---

## 6. UI Specification Summary

The authoritative visual contract is [`ui-spec.md`](./ui-spec.md). Summary:

* **Theme.** Zen Green — primary `#006B3C`, secondary `#0B7A46`, pale
  `#EAF6EF`, page background `#F5F7F6`, white surfaces, charcoal-green text.
  Tokens are declared once as CSS custom properties and consumed everywhere;
  no screen hard-codes a hex value.
* **Shell.** Green header with TokTickIT identity, My Tickets and Create Ticket
  navigation with an active-page indicator, and the current Development
  Requester with a Change Requester action. Collapses to a mobile menu
  below 768 px.
* **Screens.** Development Requester Selection, Create Ticket, My Tickets,
  Requester Ticket Detail.
* **Field states.** Editable (white, neutral border), read-only (soft
  gray-green, clearly distinct but readable), invalid (dark red border with the
  message immediately beneath the field), disabled (visibly inert), focused
  (visible focus ring for keyboard users).
* **Required fields.** Red asterisk beside the label, which supplements rather
  than replaces the validation message.
* **Buttons.** Primary, secondary, tertiary, destructive, disabled, and busy
  variants; every button carries visible text; every icon-only control carries
  an accessible label and tooltip.
* **Badges.** Requested Priority and Current Status render as badges whose
  meaning does not depend on color alone.
* **States.** Every data-driven region defines loading, empty, no-results,
  error, and success presentations.
* **Responsive.** Desktop ≥ 992 px multi-column and a ticket table; tablet
  768–991 px two columns where practical; mobile < 768 px stacked fields and
  ticket cards, touch-friendly targets, no horizontal page scroll.
* **Accessibility.** Labels above controls and programmatically associated,
  visible focus, non-color status indicators, keyboard-operable forms.

---

## 7. Data Changes

### 7.1 Models

New and changed Prisma models. Full field-level detail lives in the schema;
this table is the approved design.

| Model | Purpose | Key fields |
| :--- | :--- | :--- |
| `RequesterUser` | Temporary Lab 2 Development Requester | `id`, `fullName`, `email` (unique), `department`, `isActive` (default `true`), `createdAt`, `updatedAt` |
| `Category` | Ticket classification (**exists from Lab 1**) | `id`, `name` (unique), **new:** `isActive` (default `true`) |
| `RelatedSystem` | Affected service, app, device, or platform | `id`, `name` (unique), `isActive` (default `true`), `createdAt` |
| `Ticket` | The support request | `id`, `ticketNumber` (unique), `requesterId` → `RequesterUser`, `categoryId` → `Category`, `relatedSystemId` → `RelatedSystem`, `summary`, `description`, `requestedPriority`, `currentStatus`, `createdAt`, `updatedAt` |
| `Attachment` | Uploaded supporting evidence | `id`, `ticketId` → `Ticket`, `originalFilename`, `storedFilename` (unique), `mimeType`, `sizeBytes`, `uploadedAt`, `removedAt` (nullable), `removalReason` (nullable) |

Enums:

* `RequestedPriority` — `LOW`, `MEDIUM`, `HIGH`, `URGENT`
* `TicketStatus` — `NEW` only in Lab 2; the enum exists so Lab 4's lifecycle
  values are an additive migration rather than a column type change.

### 7.2 Relationships

| Relationship | Cardinality |
| :--- | :--- |
| `RequesterUser` → `Ticket` | one-to-many; a Ticket belongs to exactly one Requester |
| `Category` → `Ticket` | one-to-many |
| `RelatedSystem` → `Ticket` | one-to-many |
| `Ticket` → `Attachment` | one-to-many; attachments cascade-delete with their Ticket |

Reference rows are never hard-deleted while a Ticket points at them; they are
deactivated with `isActive = false`, which keeps historical tickets readable.

### 7.3 Indexes and constraints

| Target | Decision | Reason |
| :--- | :--- | :--- |
| `Ticket.ticketNumber` | `@unique` | BR-01; the database is the last line of defence against a duplicate number |
| `Ticket(requesterId, createdAt)` | composite index | serves every My Tickets query — the owner filter plus the default sort |
| `Attachment.ticketId` | index | attachment lists are always fetched per Ticket |
| `Attachment.storedFilename` | `@unique` | guarantees no two rows can point at one file on disk |
| `RequesterUser.email` | `@unique` | identifies a Requester and becomes the natural login field in Lab 3 |
| `RequesterUser.isActive` | index | the selector query filters on it on every app start |
| `Category.name`, `RelatedSystem.name` | `@unique` | makes the seed idempotent through `upsert` |

Nullable by design: `RequesterUser.department`, `Attachment.removedAt`,
`Attachment.removalReason`. Everything else is required.

### 7.4 Justified design decisions

**Soft removal is a nullable `removedAt` timestamp, not an `isRemoved`
boolean.** A boolean plus a separate timestamp allows the contradictory state
`isRemoved = true, removedAt = null`, and every query then has to trust that
the two agree. One nullable timestamp carries both facts in a single column:
`removedAt IS NULL` *is* the definition of active, and the removal time comes
free. Every active-attachment query and the five-attachment limit in BR-34 read
that one predicate, so the invariant cannot drift.

**Ticket Number is generated inside the creating transaction and defended by a
unique constraint.** The per-year sequence is computed from the current maximum
for that year within the same transaction that inserts the row; a unique-
constraint violation (Prisma `P2002`) is retried up to three times. A cached
in-process counter would break the moment a second server process existed, and
a fully separate counter table adds a second write to every creation for a
collision that the retry already handles.

**Ownership is a request header, not a body field or query parameter.**
`X-Requester-Id` is the single place identity enters the server, for reads and
writes alike. In Lab 3 that header is swapped for an authenticated identity and
nothing else in the contract moves — no request body changes shape, no query
loses a parameter, no test's expected payload changes (BR-46).

### 7.5 Seed data

The seed stays idempotent by using `upsert` on the unique name/email columns,
so repeated runs never duplicate (extending the Lab 1 pattern in
`server/prisma/seed.ts`).

| Data | Required content |
| :--- | :--- |
| Categories | The four required: Account and Access, Hardware, Software, Network |
| Related Systems | At least six realistic entries: Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop |
| Requesters | At least four **active** with realistic names and emails |
| Requesters | At least one **inactive**, which must not appear in the selector |

### 7.6 Migration plan

One migration adds `RelatedSystem`, `RequesterUser`, `Ticket`, `Attachment`,
both enums, and the new `Category.isActive` column. `isActive` is added with a
default of `true` so the four rows already seeded in Lab 1 remain valid and no
backfill script is needed.

### 7.7 New dependencies

| Dependency | Side | Purpose |
| :--- | :--- | :--- |
| `multer` | server | multipart upload handling |
| `react-router-dom` | client | routing across four screens and route guards |
| `@playwright/test` | root | E2E flow and responsive screenshot capture |

---

## 8. API Contract

Full request and response shapes, parameter tables, and error cases are in
[`api-spec.md`](./api-spec.md). The surface is:

| Capability | Endpoint |
| :--- | :--- |
| Retrieve active Categories | `GET /api/categories` |
| Retrieve active Related Systems | `GET /api/related-systems` |
| Retrieve active Development Requesters | `GET /api/requesters` |
| Create a Ticket | `POST /api/tickets` |
| Retrieve the selected Requester's Tickets | `GET /api/tickets` |
| Retrieve one owned Ticket | `GET /api/tickets/:id` |
| Upload an Attachment | `POST /api/tickets/:id/attachments` |
| Retrieve Attachment metadata | `GET /api/tickets/:id/attachments` |
| Download an active Attachment | `GET /api/attachments/:id/download` |
| Soft-remove an Attachment | `PATCH /api/attachments/:id/remove` |

Conventions that hold across every Lab 2 endpoint:

* Requester-scoped endpoints require the `X-Requester-Id` header (BR-14).
* Errors use one shape:
  `{ "error": { "code": "...", "message": "...", "fields": { ... } } }` where
  `fields` is present only for validation failures.
* Status codes: `200` read, `201` created, `400` invalid input, `404` missing
  **or not owned** (BR-16), `409` conflict such as the attachment limit, `410`
  removed attachment download, `413` file too large, `415` unsupported file
  type, `500` unexpected. The `500` body never contains internal detail.
* `GET /api/health` keeps its Lab 1 shape unchanged.

---

## 9. Acceptance Criteria

### 9.1 Requester context

| ID | Criterion |
| :--- | :--- |
| AC-01 | Given the database holds four active and one inactive Requester, when the Selection screen loads, then exactly the four active Requesters appear in the dropdown and the inactive one does not. |
| AC-02 | Given no Development Requester is selected, when the user attempts to open My Tickets, then the Requester Selection screen is shown. |
| AC-03 | Given a Requester is selected and Continue is pressed, when any application screen renders, then the shell shows that Requester's name and a Change Requester action. |
| AC-04 | Given Requester A is selected and their tickets are on screen, when the user changes to Requester B, then A's tickets are no longer displayed and B's list is loaded. |
| AC-05 | Given the requesters endpoint returns an error, when the Selection screen loads, then a safe failure message and a retry action are shown, and no dropdown is rendered. |
| AC-06 | Given no active Requesters exist, when the Selection screen loads, then the empty state is shown and Continue is disabled. |

### 9.2 Create Ticket

| ID | Criterion |
| :--- | :--- |
| AC-07 | Given valid Ticket data, when the Requester submits the form, then one Ticket is saved and the official Ticket Number is displayed. |
| AC-08 | Given the Create Ticket screen has loaded, when the Category and Related System controls are inspected, then their options match the active rows in the database. |
| AC-09 | Given the Summary field is empty, when the Requester submits, then a message appears beneath the Summary field and no API request is issued. |
| AC-10 | Given a Ticket is created, when it is read back from the database, then its status is `NEW`, its requester id matches the selected Requester, and its Ticket Number matches `TT-<YYYY>-<NNNNN>`. |
| AC-11 | Given a submission is in flight, when the Requester clicks Submit again, then the button is disabled and busy and only one request reaches the API. |
| AC-12 | Given the backend is unreachable, when the Requester submits, then a safe error state appears and every entered value is still present in the form. |
| AC-13 | Given a 7 MB PDF and a `.exe` file are selected, when they are attached, then each is rejected with its own message and no upload request is issued for it. |

### 9.3 My Tickets

| ID | Criterion |
| :--- | :--- |
| AC-14 | Given Requester A owns tickets and Requester B owns none, when B opens My Tickets, then the empty state is shown and none of A's tickets appear. |
| AC-15 | Given a Requester owns 25 tickets, when My Tickets loads with default settings, then 10 tickets are shown newest first and the metadata reports 3 pages. |
| AC-16 | Given a search term matching one ticket's summary, when the search is applied, then only matching tickets are listed. |
| AC-17 | Given filters that match nothing, when they are applied, then the no-results state is shown with a Clear Filters action, distinct from the empty state. |
| AC-18 | Given an unknown sort field is requested, when the list endpoint is called, then it responds 400 and no ticket data is returned. |

### 9.4 Ticket Detail and attachments

| ID | Criterion |
| :--- | :--- |
| AC-19 | Given Requester B is selected, when a Ticket belonging to Requester A is requested, then the Ticket data is not returned and the response is 404. |
| AC-20 | Given an owned Ticket, when its detail screen opens, then all ticket fields render read-only and no editable control is present. |
| AC-21 | Given an owned Ticket with four active attachments, when a fifth permitted file is uploaded, then it succeeds; when a sixth is attempted, then it is rejected with 409. |
| AC-22 | Given an active attachment on an owned Ticket, when it is downloaded, then the response streams the file with its original filename. |
| AC-23 | Given an attachment is soft-removed with a reason, when the detail screen reloads, then the attachment is still listed as metadata, marked removed with its reason, and has no download control. |
| AC-24 | Given a soft-removed attachment, when its download URL is requested directly, then the response is 410 and no file bytes are returned. |
| AC-25 | Given Requester B is selected, when the download URL of an attachment owned by Requester A is requested directly, then the response is 404. |

### 9.5 UI and responsive

| ID | Criterion |
| :--- | :--- |
| AC-26 | Given any Lab 2 screen at 1280 px, 900 px, and 375 px, when it is rendered, then there is no horizontal page scrolling, no clipped label, and no overlapping message. |
| AC-27 | Given the Create Ticket form, when it is inspected, then every required field shows a red asterisk and every read-only field is visually distinct from an editable one. |
| AC-28 | Given My Tickets at 375 px, when it renders, then tickets appear as cards rather than a horizontally scrolling table, and filter and pagination controls remain usable. |

---

## 10. Definition of Done

### 10.1 Product completion

- [ ] Every FR in §4 is implemented.
- [ ] Every BR in §5 is enforced in code, with server-side enforcement for all
      ownership and validation rules.
- [ ] Every AC in §9 is linked to at least one passing automated test in
      `tests.md`.
- [ ] Tests exist and pass at all six levels: unit, API/integration, UI
      component, UI style, responsive, E2E.
- [ ] No required test is skipped, disabled, commented out, or passing for an
      unrelated reason.
- [ ] All tests pass from the documented commands **on the final `main`
      branch**, not only on a feature branch.
- [ ] The Prisma schema matches §7; the migration applies cleanly to an empty
      database.
- [ ] The seed runs twice in a row with no duplicates.
- [ ] Implemented screens match `ui-spec.md`; deviations are either corrected or
      recorded in §11.
- [ ] Screenshots for Create Ticket, My Tickets, and Ticket Detail exist at
      desktop, tablet, and mobile under `artifacts/lab-02/screenshots/`.
- [ ] The visual checklist in `tests.md` is completed against those screenshots.
- [ ] No excluded feature from §3.2 has been implemented.
- [ ] `README.md` setup, seed, and test instructions are current and were run
      as written on a clean checkout.

### 10.2 Course delivery

- [ ] Every Issue in `MyIssue.md` exists on GitHub, is on the Project board,
      and ends in **Done**.
- [ ] Every Issue was implemented on its own feature branch and reached
      `lab2-staging` through a Pull Request. Nothing was pushed directly to
      `lab2-staging` or `main`.
- [ ] Every PR was reviewed by the peer reviewer, has an explicit approval, and
      was merged by the reviewer.
- [ ] Every review comment received a written reply.
- [ ] Each PR is linked to its Issue through the Development panel, verified by
      the PR sidebar naming the Issue.
- [ ] One release PR from `lab2-staging` to `main` is opened and merged.
- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`,
      `reviewer.md`, and `ai-use.md` are present and current.
- [ ] Evidence that `specification.md` existed **before** the implementation
      PRs is captured.
- [ ] The single PDF is submitted using the headings *Answer Part 1* through
      *Answer Part 9* in order.

---

## 11. Assumptions and Decisions

| # | Decision | Rationale |
| :--- | :--- | :--- |
| D-01 | Identity travels in the `X-Requester-Id` header rather than a `requesterId` body field. | One mechanism for reads and writes, and a one-line swap in Lab 3 (BR-46). The labsheet's `{"requesterId": 1, ...}` sample is explicitly a partial illustration that students must finalise. |
| D-02 | Ownership failure returns 404, not 403. | A 403 confirms that a ticket with that id exists and belongs to somebody else. 404 leaks nothing (BR-16). |
| D-03 | Invalid query parameters return 400 instead of falling back to defaults. | Silent correction hides client bugs and makes AC-18 untestable. |
| D-04 | Ticket creation is not rolled back when an attachment upload fails. | The written problem description is the valuable part; losing it to a failed file write would be a worse outcome than a ticket with a missing attachment. Compensation is a retry from Ticket Detail (BR-42). |
| D-05 | Removed attachment files are retained on disk, not deleted. | Lab 2 requires soft removal and retained metadata; deleting bytes would make the removal irreversible and is out of scope. Access is blocked at the API (BR-41). |
| D-06 | Requester selection is stored in `localStorage`, not a cookie or server session. | A session would be authentication, which §3.2 excludes. `localStorage` is visibly a client-side testing convenience. |
| D-07 | Summary 5–120 and Description 20–4000 characters. | Summary must fit one list line; Description must hold a real explanation without becoming unbounded. |
| D-08 | `TicketStatus` is an enum containing only `NEW`. | Lab 2 forbids other statuses, but a later lifecycle should be an additive enum migration, not a column type change. |
| D-09 | `Category.isActive` is added rather than a new table. | Lab 1 already seeds and serves `Category`; extending it keeps the existing endpoint and its Lab 1 test valid. |
| D-10 | Bootstrap 5 (already a dependency) is kept for layout, with Zen Green applied through CSS custom properties. | Reuses what the project has; the theme is expressed as tokens so the palette stays in one place. |

---

## 12. Traceability

`tests.md` maps every AC in §9 to the automated tests that prove it, together
with each test's file path and final result.
