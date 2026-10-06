# Lab 4 — Sprint Engineering Specification

**Project:** TokTickIT · **Sprint:** Lab 4 — Actions Taken, Ticket Workflow, Dashboards, and Final Regression
**Status:** Draft for review — Issue 1 ([#67](https://github.com/Menelaus122/TokTickITV2/issues/67)). It becomes *Approved before implementation* when its pull request into `lab4-staging` is approved and merged, before any implementation PR; the approval and merge commit are recorded here at that point. · **Owner:** Menelaus122

> This document is the engineering contract for Sprint 4. Implementation may not
> begin on a feature branch until the section covering it is approved here, and
> the coding agent may report "done" only when the Definition of Done in §10 is
> satisfied.
>
> **Numbering restarts for Lab 4.** `FR-nn`, `BR-nn`, `AC-nn`, and `D-nn` in this
> file belong to Sprint 4 and are unrelated to the identically numbered items in
> `docs/lab-03/specification.md` and `docs/lab-02/specification.md`. A Lab 3 rule
> that Lab 4 keeps is cited as "Lab 3 BR-nn" and is not restated unless Lab 4
> changes it. `BR-01`, `BR-02`, `AC-01`, and `AC-02` are the labsheet's own
> examples, adopted under the same numbers.

---

## 1. Sprint Goal

Finish the core service-desk loop. IT Staff and Administrators record **Actions
Taken** under a Ticket, so the work actually done is visible, attributed, and
reviewable by the Requester. A Ticket cannot be moved to Resolved until that work
has been recorded and no follow-up is left pending, and every status change is
kept in an append-only history. Each role opens on a concise **Dashboard**
computed by the backend, whose cards lead to the detailed screens. Finally, the
whole application from Labs 1 to 3 is hardened — stale and duplicate writes are
handled, feedback is consistent, and accessibility and responsiveness are checked
everywhere — so it behaves as one product under the Zen Green design language.

---

## 2. Stakeholder Request Interpretation

The stakeholder asked for four things:

1. **Actions Taken under each Ticket.** A dated, attributed record of what was
   done, what came of it, and whether anything still has to happen. It is a work
   log, not a task list: the Ticket Owner stays responsible for the Ticket as a
   whole, but any IT Staff member may record an action (BR-02).
2. **Requester advice stays advice.** "Problem Appears Resolved" remains a signal.
   IT Staff review the work and formally resolve, and the backend refuses to
   resolve a Ticket whose work was never recorded, even for a client that bypasses
   the screen (§4.5 of the labsheet).
3. **Concise dashboards.** One for Requesters, one for IT Staff (reused by
   Administrators). Each card is a number the backend computed, with a link to the
   list that explains it. A dashboard never replaces the list.
4. **A polished, hardened product.** Everything from Labs 1 to 3 keeps working,
   and the rough edges — a lost update, a double submit, a raw 500, an unlabelled
   control — are closed or recorded.

Three labsheet statements pull against each other and are settled in §11:
Part 6 grades "assign, complete, cancel, inactive-assignee rejection" while the
Action Taken field list has no assignee or status (D-06); §4.3 gives Administrators
IT Staff behaviour while Lab 3 deliberately excluded them (D-08); and the dashboard
mockups carry trends and shortcuts the data cannot support (D-10, D-11).

---

## 3. Scope

### 3.1 Included

| Area | Included work |
| :--- | :--- |
| Actions Taken | Create, list, view, and edit Action Taken under a Ticket; Requester read-only view |
| Ticket workflow | Final transition matrix, resolution gate, append-only status history, stale-update detection on every staff ticket write |
| Dashboards | Requester dashboard, IT Staff dashboard, Administrator dashboard (the staff one plus account counts), each with drill-down |
| Roles | Administrator gains IT Staff ticket operations; Dashboard becomes each role's landing page |
| Data | Prisma migration (additive), seed extension, indexes for the dashboard queries |
| Hardening | Regression of Labs 1–3, consistent feedback states, duplicate-submit protection, accessibility, responsiveness, closed Lab 3 limitations, README |
| Quality | Unit, API, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E tests plus screenshot evidence |

### 3.2 Explicitly excluded

Per labsheet §4.2 these are **out of scope for Lab 4** and must not be
implemented, not even partially:

* Automatic SLA clocks, escalation engines, on-call scheduling, breach notifications.
* Email, SMS, LINE, push, or any other external notification service.
* Inventory consumption, spare parts, purchasing, cost accounting.
* Time-sheet billing, payroll, labour-cost calculation.
* Multi-level approval workflows and electronic signatures.
* Business-intelligence tools, custom report builders, export warehouses.
* Multi-tenant organisations and production-scale cloud operation.
* Any new feature not approved in this document.

Lab 4 also chooses **not** to build, and a reviewer should treat these as
rejected rather than forgotten:

* A "change from yesterday" trend on any card (D-10).
* An assignee or a status on an Action Taken (D-06).
* Deleting an Action Taken, or keeping a history of its edits (D-13).
* Uploading files against an Action Taken; Attachment Notes are text (BR-03).
* A Profile screen, and a Create Ticket shortcut for IT Staff or Administrators (D-11).
* An automated accessibility scanner; accessibility is asserted and checked by
  hand (§10.2, D-16).

---

## 4. Functional Requirements

### 4.1 Actions Taken

| ID | Requirement |
| :--- | :--- |
| FR-01 | The IT Staff Ticket Detail screen has an **Actions Taken** area that lists every Action Taken of the Ticket in the stable order BR-08 defines, showing all seven fields of each. |
| FR-02 | **Create mode.** IT Staff and Administrators record an Action Taken with Action Date/Time, Action Description, Result, Follow-Up Required?, Follow-up Note, and Attachment Notes. Performed by is filled in from the signed-in user and cannot be typed. Follow-up Note becomes required as soon as Follow-Up Required? is Yes. |
| FR-03 | **View/edit mode.** An existing Action Taken opens in place and may be edited by any IT Staff member or Administrator; Performed by never changes (BR-05, BR-09). |
| FR-04 | A Requester sees every Action Taken of their own Tickets, read-only, on their Ticket Detail screen. No create or edit control and no create or edit endpoint is available to them. |
| FR-05 | Every Action Taken write is authorised and validated by the backend. Hiding a control is feedback, never the boundary (labsheet §4.3). |
| FR-06 | Submitting an Action Taken twice — a double click or a network retry — records it once (BR-28). |
| FR-07 | Editing an Action Taken that changed since the screen loaded is refused as a conflict that shows the latest version, and nothing is overwritten (BR-27). |
| FR-08 | A Ticket with no Action Taken, including every Ticket carried over from Labs 2 and 3, shows an explicit empty state, not a blank region. |

### 4.2 Ticket workflow

| ID | Requirement |
| :--- | :--- |
| FR-09 | The status control offers only the transitions the Ticket can make right now, and says why a blocked one is unavailable (BR-17, BR-18). |
| FR-10 | The backend enforces the transition matrix and the resolution gate for every caller, including one that never opened the screen (BR-15, BR-17). |
| FR-11 | A Requester's "Problem Appears Resolved" stays advisory: it changes neither the status nor the gate (BR-20). |
| FR-12 | Two IT Staff changing the same Ticket's owner, IT Priority, or status cannot silently overwrite each other (BR-25, BR-26). |
| FR-13 | Every change of Current Status is kept in an append-only **Status History** shown as a timeline on the staff and Requester Ticket Detail screens (BR-21 to BR-23). |
| FR-14 | After a successful change, the Ticket summary, the status badge, the permitted transitions, and the timeline refresh without a reload. |

### 4.3 Dashboards

| ID | Requirement |
| :--- | :--- |
| FR-15 | The **Requester Dashboard** summarises only the signed-in Requester's Tickets: four metric cards, a "Needs your attention" list, a "Recently updated" list, and quick actions (BR-32, BR-33). |
| FR-16 | The **IT Staff Dashboard** shows four metric cards, a breakdown by status, three short lists — my Tickets, urgent Tickets, my recent Actions Taken — and quick actions (BR-34 to BR-36). |
| FR-17 | The **Administrator Dashboard** is the IT Staff Dashboard plus a concise account-count panel (BR-38). |
| FR-18 | Every metric card, status row, and list item opens a detailed screen — Ticket Queue, My Tickets, or Ticket Detail — and the list a card opens shows exactly the number on the card (BR-40). The Administrator's account counts are plain numbers and open nothing. |
| FR-19 | Dashboard endpoints return concise, backend-computed data: counts and short bounded lists, never whole Ticket collections (BR-30). |
| FR-20 | Each dashboard has loading, zero-data, forbidden, and safe-failure states and a **Refresh** action (BR-39). |
| FR-21 | My Tickets and the Ticket Queue read their filters from the URL, so a drill-down link and a reloaded page show the same list. |

### 4.4 Application shell and roles

| ID | Requirement |
| :--- | :--- |
| FR-22 | **Dashboard** is the first navigation item and the landing page of every role, with Lab 2's active-page indication (D-09). |
| FR-23 | Administrators open the Ticket Queue and IT Staff Ticket Detail and perform IT Staff ticket operations, under their own identity (BR-42, BR-45). |
| FR-24 | A role never sees a navigation item it may not open, and typing a forbidden URL lands on its own Dashboard with the forbidden callout (carried from Lab 3 FR-14). |

### 4.5 Final regression and hardening

| ID | Requirement |
| :--- | :--- |
| FR-25 | Every Requester, IT Staff, and Administrator screen of Labs 1–3 stays available to the roles that may use it. |
| FR-26 | Loading, validation, success, empty or no-results, forbidden, conflict, not-found, and safe API-failure feedback looks and behaves the same on every screen. |
| FR-27 | Every form that writes sends one request per submission and is safe against a repeated click or a retry (BR-53). |
| FR-28 | Important forms keep what the user typed after a recoverable failure (BR-54). |
| FR-29 | A NUL character in a text body field, or an out-of-range id in a request body, is a `400`, never a `500` (BR-52). |
| FR-30 | Temporary, duplicate, obsolete, and unfinished UI left from earlier labs is removed, and the app shows no console error, broken link, or placeholder text. |
| FR-31 | Keyboard operation, visible focus, semantic labels, non-colour status cues, and accessible dialogs hold on every screen. |
| FR-32 | Every screen is usable at Desktop ≥ 992 px, Tablet 768–991 px, and Mobile < 768 px with no horizontal page scroll, as in Labs 2 and 3. |
| FR-33 | The Ticket Owner label tells an inactive owner from one who is no longer IT Staff (BR-55). |
| FR-34 | `README.md` documents setup, migration, seed, seeded credentials, every test command, and a demonstration path for Lab 4. |

---

## 5. Business Rules

### 5.1 Mandatory rules from the handout

| ID | Rule |
| :--- | :--- |
| BR-01 | An Action Taken belongs to exactly one Ticket. It is created under the Ticket named in the URL and can never be moved to another. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by a different IT Staff member. Performing an action never requires, and never changes, ownership. |

### 5.2 Actions Taken

| ID | Rule |
| :--- | :--- |
| BR-03 | An Action Taken has: **Action Date/Time** (required), **Action Description** (required, 5–2000 characters after trimming), **Result** (required, 2–1000), **Performed by** (automatic, BR-05), **Follow-Up Required?** (required, Yes or No), **Follow-up Note** (BR-04), and **Attachment Notes** (optional, up to 500 characters: which file, screenshot, or image to look for). Attachment Notes are text and upload nothing. |
| BR-04 | **Follow-up Note** is required, 5–1000 characters after trimming, when Follow-Up Required? is Yes. When it is No the note is not stored: a note sent with a No is ignored and the stored note is cleared (D-18). |
| BR-05 | **Performed by** is the signed-in user who created the action. It is set by the server, is immutable, and ignores any value the client sends (Lab 3 BR-40). |
| BR-06 | **Action Date/Time** is entered by the user, defaults to now in the form, and is stored in UTC. It may not be later than the server's clock plus five minutes and may not be earlier than the Ticket's creation time. |
| BR-07 | `createdAt` and `updatedAt` are generated by the server. An edit records who made it (`updatedBy`) and when; a created-but-never-edited action has no `updatedBy`. |
| BR-08 | Actions Taken are listed **oldest first** by Action Date/Time, then by `id` ascending, so the order is stable when two share a time. This is the order for **reading** the list. It is not the order the resolution gate uses: the gate's "latest" is the most recently *recorded* action (BR-17), which Action Date/Time, being typed by the user and editable, cannot change. |
| BR-09 | Any IT Staff member or Administrator may edit any Action Taken on a Ticket they can reach, whether or not they performed it or own the Ticket (BR-02). There is no delete: no route to one exists (D-13). |
| BR-10 | An Action Taken may be created or edited only while the Ticket is `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. On a `RESOLVED`, `CLOSED`, or `CANCELLED` Ticket the write is a `409 TICKET_NOT_ACTIVE`; reopening the Ticket is how more work is recorded (D-14). |
| BR-11 | Creating or editing an Action Taken updates the Ticket's `updatedAt`, so "Last Updated" and the "recently updated" lists reflect it (extends Lab 3 BR-44). It does **not** change the Ticket's `version` (BR-25). |
| BR-12 | Action Taken text is stored and rendered as text. A NUL character in any text field is a `400` (BR-52). |
| BR-13 | Every field of every Action Taken is visible to the Ticket's own Requester, including who performed it (Lab 3 comment authors are shown the same way). Nothing about an Action Taken is internal. |
| BR-14 | An Action Taken has **no assignee and no status of its own**. It records work that was done (D-06). |

### 5.3 Ticket workflow

| ID | Rule |
| :--- | :--- |
| BR-15 | The eight statuses are unchanged: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. The permitted transitions are exactly Lab 3's matrix, restated below; everything else is a conflict. Lab 4 adds a gate on one of them (BR-17), not a new edge. |

| From | To | Notes |
| :--- | :--- | :--- |
| `NEW` | `OPEN`, `CANCELLED` | `OPEN` also happens automatically on claim (Lab 3 BR-34) |
| `OPEN` | `IN_PROGRESS`, `CANCELLED` | |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `RESOLVED` is gated by BR-17 |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | `RESOLVED` is gated by BR-17 |
| `RESOLVED` | `CLOSED`, `REOPENED` | |
| `CLOSED` | `REOPENED` | |
| `REOPENED` | `IN_PROGRESS`, `CANCELLED` | |
| `CANCELLED` | — | terminal |

| ID | Rule |
| :--- | :--- |
| BR-16 | Only IT Staff and Administrators change Current Status. A Requester has no transition at all (Lab 3 BR-32, BR-05). |
| BR-17 | **Resolution gate.** A move to `RESOLVED` is allowed only when the Ticket has at least one *relevant* Action Taken and the **latest** relevant one has Follow-Up Required? = No. *Relevant* means created after the Ticket's most recent entry into `REOPENED`, or any time at all if it was never reopened (D-07). *Latest* means most recently **recorded**: the highest `createdAt`, then the highest `id`. Both are set by the server and never edited, so neither a backdated Action Date/Time nor an edit to one can hide a pending follow-up; BR-08 orders the list for reading, not for the gate. The gate is checked in the same transaction as the transition, so an action added or edited a moment earlier counts. |
| BR-18 | A failed gate is `409 ACTION_REQUIRED` (no relevant action) or `409 FOLLOW_UP_PENDING` (the most recently recorded relevant action still requires follow-up). The Ticket is unchanged. |
| BR-19 | These Lab 3 rules are unchanged and keep their tests: claiming a `NEW` Ticket opens it (BR-34); `RESOLVED` and `CLOSED` need an Owner (BR-35); `RESOLVED`, `CANCELLED`, and `REOPENED` need a 5–2000 character reason stored as a Public Comment in the same transaction (BR-36, BR-37); a transition to the current status is a conflict (BR-38); a status change clears the Requester's appears-resolved signal (BR-30). |
| BR-20 | "Problem Appears Resolved" is advisory. It changes neither `currentStatus` nor the gate, and a Requester who has marked it still cannot cause `RESOLVED` or `CLOSED` (Lab 3 BR-05, BR-29). |
| BR-21 | Every change of `currentStatus` — including the `NEW` → `OPEN` that a claim causes — writes exactly one **status history** row (from, to, who, when) in the same transaction as the change. A refused change writes nothing. |
| BR-22 | Status history is append-only: no endpoint updates or deletes a row. It is listed oldest first by `createdAt`, then `id`. A Ticket that predates Lab 4 has no rows, and the screen shows "Ticket created" from the Ticket's own `createdAt` (BR-47). |
| BR-23 | Status history is visible to anyone who may see the Ticket: its Requester, IT Staff, and Administrators. It carries no internal information. |
| BR-24 | **Check order** for a staff status change: body validation (`400`) → ticket exists (`404`) → stale version (`409 STALE_UPDATE`) → matrix and same-status (`409 INVALID_TRANSITION`) → owner (`409 OWNER_REQUIRED`) → resolution gate (`409 ACTION_REQUIRED` or `FOLLOW_UP_PENDING`). The caller is told the most fundamental reason first. |

### 5.4 Concurrency and duplicates

| ID | Rule |
| :--- | :--- |
| BR-25 | `Ticket.version` starts at 1 and increases by 1 whenever the Ticket's owner, IT Priority, `currentStatus`, or `requesterResolvedAt` actually changes. Resending the value a field already holds is not a change. |
| BR-26 | The staff endpoints that change owner, IT Priority, or status accept an optional `expectedVersion`. When it is present and no longer equals the Ticket's version, the request is refused as `409 STALE_UPDATE` carrying the current Ticket. The Lab 4 screens always send it. It is optional only so Lab 3 clients and tests keep working; `expectedOwnerId` (Lab 3 D-26) keeps its own answer, and is checked first. Because a Requester's "appears resolved" moves `version` (BR-25), a staff save from a screen loaded before it is refused as `STALE_UPDATE`. That is intended: the staff screen should show the advisory before anyone acts on an older view of the Ticket, and the conflict message says so (`ui-spec.md` §1.5). |
| BR-27 | Editing an Action Taken **requires** `expectedVersion` (`400` when missing). A mismatch is `409 STALE_UPDATE` carrying the current action. Each successful edit increases the action's `version` by 1. |
| BR-28 | Creating an Action Taken accepts an optional `requestKey`, a client-generated id for one submission. A second create with the same key on the same Ticket by the same user returns the **original** action with `200` instead of creating another. Every Lab 4 form sends one, and keeps the same key for a retry of the same submission (D-15). A replay is recognised **before** the Ticket's status is checked, so a retry that arrives after the Ticket was resolved still returns the original action with `200` and not `TICKET_NOT_ACTIVE`: the submission already succeeded, and answering it again is the idempotent result. |
| BR-29 | Every write to a Ticket — owner, IT Priority, status, Action Taken, comment — runs inside a transaction that first locks the Ticket's row. Two simultaneous writers are serialised, and the second is judged against the first's result. Lab 3 locked this way for owner and status; Lab 4 extends it to IT Priority. The owner endpoint also reads the proposed owner's role and activation **inside** that transaction, after the Ticket lock, with `SELECT … FOR SHARE` on the user's row. A deactivation racing the assignment is then judged one way or the other, and BR-24's "active at the time of assignment" is exact; Lab 3 read the user before the transaction began. The lock order is always Ticket, then User, and no path takes them the other way round: user management locks user rows only (Lab 3 D-27). |

### 5.5 Dashboards

| ID | Rule |
| :--- | :--- |
| BR-30 | Every dashboard number is computed by the backend, on each request, from the authoritative tables. Nothing is cached, precomputed, or computed in the browser. |
| BR-31 | The **open group** is the five statuses `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`: a Ticket nobody has resolved, closed, or cancelled. "Open" in any dashboard label means this group. |
| BR-32 | **Requester cards**, each counting only the signed-in Requester's own Tickets: *Open Tickets* (the open group), *Waiting for You* (`WAITING_FOR_REQUESTER`), *Resolved* (`RESOLVED`), *Closed* (`CLOSED`). `CANCELLED` has no card; it is reachable in My Tickets. |
| BR-33 | **Requester lists**, own Tickets only, at most 5 each: *Needs your attention* — `WAITING_FOR_REQUESTER`, longest-waiting first (`updatedAt` ascending, then `id` ascending); *Recently updated* — any status, `updatedAt` descending, then `id` descending. A row carries Ticket Number, Summary, status, and `updatedAt`. |
| BR-34 | **IT Staff cards**: *Unassigned* (no owner, in the open group), *Assigned to Me* (owner is the caller, in the open group), *Waiting for Requester* (`WAITING_FOR_REQUESTER`, any owner), *Urgent* (IT Priority `URGENT`, in the open group). These count every Requester's Tickets. |
| BR-35 | **Status breakdown**: one count each for `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`, over all Tickets. |
| BR-36 | **IT Staff lists**, at most 5 each: *My Tickets* — owner is the caller, open group, `updatedAt` descending then `id` descending; *Urgent Tickets* — IT Priority `URGENT`, open group, oldest `createdAt` first then `id` ascending; *My Recent Actions* — Actions Taken the caller performed, `createdAt` descending then `id` descending, each with its Ticket's number. |
| BR-37 | "Me" is the session user and nothing else. A `me`, `userId`, or `requesterId` supplied by the client is ignored (Lab 3 BR-13). |
| BR-38 | The **Administrator** receives everything an IT Staff member does plus `userCounts`: active users per role and the number of inactive users, as plain numbers with no drill-down (BR-40). IT Staff do not receive `userCounts`. |
| BR-39 | A metric with no matching record is `0` and a list with none is empty. The screen renders the `0` and an explicit empty message per list; it never shows a blank card. |
| BR-40 | Every card, status row, and "View all" carries a drill-down link whose list shows exactly the card's number (`totalItems` equals `value`). Where no list can reproduce a number, there is no link, and the screen says it is not a link. That is the case for the Administrator's **four account counts** (`userCounts`): User Management lists every account of a role, active or not, and offers only a search and a role filter (Lab 3 §3.1), so `/users?role=IT_STAFF` would list inactive staff that an *active* count leaves out. Adding a status filter to a Lab 3 screen was considered and not adopted (D-12): the account counts are optional in labsheet §4.6 and drill-down is required only "where practical". |
| BR-41 | No metric uses a calendar-day boundary, so no metric depends on a time zone. Timestamps travel as UTC and are displayed in the browser's time zone (D-10). |

### 5.6 Authorization

| ID | Rule |
| :--- | :--- |
| BR-42 | The matrix below is the contract and is enforced in server middleware. It replaces Lab 3's BR-18 and BR-19 for the **bold** rows and leaves the others as Lab 3 had them. |

| Operation | Requester | IT Staff | Administrator |
| :--- | :--- | :--- | :--- |
| Create a ticket, list own tickets, open own ticket detail | own only | no | no |
| Add or soft-remove attachments | own ticket only | no | no |
| Download attachments | own ticket only | any ticket, staff route | **any ticket, staff route** |
| Post a Public Comment, read Public Comments | own ticket only | any ticket | any ticket |
| Mark "Problem Appears Resolved" | own ticket only | no | no |
| Read or post Internal Notes | no | any ticket | any ticket |
| Read the IT Staff queue | no | yes | **yes** |
| Open IT Staff Ticket Detail | no | yes | **yes** |
| Claim or reassign ownership | no | yes | **yes** |
| Change IT Priority | no | yes | **yes** |
| Change Current Status | no | yes | **yes** |
| Be assigned as Ticket Owner | no | yes | yes |
| **Create or edit an Action Taken** | **no** | **yes** | **yes** |
| **Read Actions Taken and Status History** | **own ticket only** | **any ticket** | **any ticket** |
| **Requester Dashboard** | **yes** | **no** | **no** |
| **IT Staff Dashboard** | **no** | **yes** | **yes, with `userCounts`** |
| Manage users | no | no | yes |

| ID | Rule |
| :--- | :--- |
| BR-43 | The role guard on the `/api/staff` prefix admits `IT_STAFF` and `ADMINISTRATOR`; the guard on `/api/admin` admits `ADMINISTRATOR` only. A Requester is refused from both. Because the guard is mounted on the prefix, it covers every route under it, including ones written later. |
| BR-44 | A Requester asking for another Requester's Ticket — its Actions Taken, its Status History, or anything else — gets `404`, identical to a Ticket that does not exist, never `403` (Lab 3 BR-22). A missing session is `401`; a wrong role is `403` (Lab 3 BR-21). |
| BR-45 | An Administrator performing an IT Staff operation acts as themself: they are the `performedBy` of an action they record, the `changedBy` of a status they change, and the author of a comment or note they post. They gain no other privilege. |

### 5.7 Migration and regression

| ID | Rule |
| :--- | :--- |
| BR-46 | The Lab 4 migration is **additive**: two tables, one column, and an index swap. No Lab 1–3 row is rewritten except that every `Ticket.version` becomes 1. Every User, Ticket, Attachment, Public Comment, and Internal Note stays valid and readable. |
| BR-47 | A legacy Ticket has no Actions Taken and no status history. It behaves as in Lab 3 until someone tries to resolve it, when the gate applies like any other Ticket. Dashboards count it normally, because every Ticket metric reads Ticket columns only; only *My Recent Actions* depends on actions. |
| BR-48 | The gate runs on transitions, not retroactively. A legacy Ticket already `RESOLVED` or `CLOSED` stays so, and can still be reopened and closed under the usual rules. |
| BR-49 | Rollback is a documented SQL script, run after a `pg_dump` taken before migrating, and is exercised by a test against a copy of a database in the Lab 3 state, rolled back before the Lab 4 seed runs (§7.6). |
| BR-50 | The Lab 1, Lab 2, and Lab 3 suites keep passing. A Lab 3 test whose assertion encodes a rule Lab 4 deliberately changes is updated, and each such change is listed with its reason in `tests.md` §6. No other test is weakened. |

### 5.8 Hardening

| ID | Rule |
| :--- | :--- |
| BR-51 | The Lab 3 error envelope is unchanged. Lab 4 adds four codes — `STALE_UPDATE`, `TICKET_NOT_ACTIVE`, `ACTION_REQUIRED`, `FOLLOW_UP_PENDING`, all `409` — and no response ever carries a stack trace, SQL, path, or internal id beyond those the API already exposes. |
| BR-52 | A NUL character in any string of a request body, and an id in a request body outside `1`–`2147483647`, is `400 VALIDATION_FAILED`. This closes two Lab 3 known limitations, which answered `500`. |
| BR-53 | A form that writes disables its submit control while its request is in flight and sends one request per submission. A retry of the same submission is safe by BR-28, BR-38, and the claim conflict of Lab 3 BR-25. |
| BR-54 | After a recoverable failure — validation (`400`), conflict (`409`), or a network error — the form keeps what the user typed. Only a success clears it. |
| BR-55 | The Ticket Owner label distinguishes **Inactive** (the account is deactivated) from **No longer IT Staff** (the account is active but its role is no longer assignable), closing the Lab 3 role-demotion limitation. The owner object therefore carries `role` and `isActive`. |
| BR-56 | **Performance smoke.** On the seed data, each of the Requester dashboard, the IT Staff dashboard, and the Ticket Queue's first page answers 20 consecutive requests with no response slower than 1000 ms (D-16). |

---

## 6. UI Specification Summary

The authoritative visual contract is [`ui-spec.md`](./ui-spec.md). Summary:

* **Theme.** Lab 2's Zen Green tokens and Lab 3's additions are reused unchanged.
  Lab 4 adds only a metric card, an Action Taken entry, a follow-up pill, a
  status timeline, and a conflict callout, each built from existing tokens (FR-26).
* **Shell.** Dashboard is the first navigation item for every role and the landing
  page. Administrators also get Ticket Queue (D-09).
* **Dashboards.** One `/dashboard` route renders the Requester, IT Staff, or
  Administrator dashboard by role. Cards are links; lists are short and link to
  the Ticket; every state is visible.
* **Actions Taken.** A new region on the IT Staff Ticket Detail between the
  operational fields and the attachments: a list of entries with an inline create
  form and in-place edit. The Requester's Ticket Detail shows the same entries
  without controls.
* **Ticket workflow.** The status control lists only reachable moves and explains
  the blocked ones; a Status History timeline sits on both Ticket Detail screens.
* **Drill-down.** My Tickets and the Ticket Queue read their filters from the URL
  and show the filter as a removable chip. The Administrator's account counts are
  plain numbers with no link (BR-40).
* **Responsive.** Desktop ≥ 992 px, Tablet 768–991 px, Mobile < 768 px, no
  horizontal page scroll at any width.

---

## 7. Data Changes

### 7.1 Models

| Model | Change | Fields |
| :--- | :--- | :--- |
| `ActionTaken` | new | `id`, `ticketId`, `actionAt`, `description`, `result`, `performedById`, `followUpRequired`, `followUpNote` (nullable), `attachmentNotes` (nullable), `version` (default 1), `requestKey` (nullable), `updatedById` (nullable), `createdAt`, `updatedAt` |
| `TicketStatusChange` | new | `id`, `ticketId`, `fromStatus`, `toStatus`, `changedById`, `createdAt` |
| `Ticket` | column added, indexes changed | new `version` (default 1); `@@index([ownerId])` replaced by `[ownerId, currentStatus]`; new `[requesterId, currentStatus]` |
| `User`, `Session`, `Category`, `RelatedSystem`, `Attachment`, `PublicComment`, `InternalNote` | unchanged | — |

No enum changes: `TicketStatus`, `Priority`, and `Role` are as Lab 3 left them.

### 7.2 Relationships

* One `Ticket` has many `ActionTaken` (BR-01); each belongs to exactly one Ticket
  and is removed with it, as comments are.
* One `User` has many `ActionTaken` as `performedBy`, and many as `updatedBy`.
  Both foreign keys are `restrict`: users are deactivated, never deleted (Lab 3
  BR-50), so an author can never vanish from under an action.
* One `Ticket` has many `TicketStatusChange`; each has one `changedBy` `User`.

### 7.3 Indexes and constraints

| Index / constraint | Why |
| :--- | :--- |
| `ActionTaken(ticketId, actionAt, id)` | one list read per Ticket in BR-08 order. The gate reads the same few rows and picks the most recently recorded (BR-17), so it needs no index of its own |
| `ActionTaken(performedById, createdAt)` | *My Recent Actions* (BR-36) |
| `ActionTaken` unique `(ticketId, performedById, requestKey)` | BR-28. Rows with no key are not constrained, because Postgres treats nulls as distinct |
| `TicketStatusChange(ticketId, createdAt, id)` | the timeline and the gate's "most recent entry into REOPENED" |
| `Ticket(requesterId, currentStatus)` | the Requester dashboard's grouped counts (BR-32) |
| `Ticket(ownerId, currentStatus)` | *Assigned to Me* and *My Tickets* (BR-34, BR-36); it supersedes the single-column `ownerId` index, which is dropped because its leading column is covered |
| existing `Ticket(currentStatus, itPriority, createdAt)` | already serves the status breakdown, *Unassigned*, and *Urgent* |

### 7.4 Justified design decisions

At least two database decisions are justified, as labsheet §5.1 requires.

| ID | Decision | Why |
| :--- | :--- | :--- |
| D-01 | `ActionTaken` is its own table with real columns, not a JSON blob on `Ticket` and not a reuse of `PublicComment` | Labsheet §5.1 requires one Ticket to contain many Actions Taken, and the gate, *My Recent Actions*, and ordering all need to query, index, and constrain individual fields. A JSON column cannot carry a foreign key to `User` or an index on `performedById`. Reusing comments would put internal-looking work into the thread the Requester reads and bend a table whose rule is "append-only" (Lab 3 BR-42). |
| D-02 | Stale updates are detected with an integer `version`, not by comparing `updatedAt` | `updatedAt` also moves when an action or comment is added (BR-11), so a timestamp token would call a harmless comment a conflict. An integer that only the guarded fields increment (BR-25) is exact, cannot collide on a millisecond, and costs one column. It extends Lab 3 D-26's `expectedOwnerId`, which only guarded owner, to everything staff change. |
| D-03 | Status changes are recorded in an append-only `TicketStatusChange` table, not derived from comments or kept as a single "last changed" column | The labsheet grades append-only behaviour and stable ordering (Part 7). The reason comments Lab 3 already stores exist only for three statuses and carry no actor or from-status. A dedicated table also gives the gate an exact "entered REOPENED at" instant (BR-17) with no parsing. |
| D-04 | Duplicate protection is a unique `(ticketId, performedById, requestKey)` constraint, checked in the same transaction as the insert | A double click or a retry that races past an application-level check still cannot insert twice, because the database is the last line of defence, as the unique `ticketNumber` is for Lab 2 BR-01. Scoping the key to the Ticket and the user means one person's key can never surface another person's action. |
| D-05 | Indexes are composite on the columns each dashboard query filters and groups by | The Requester and staff dashboards run grouped counts per request (BR-30). A composite `(requesterId, currentStatus)` and `(ownerId, currentStatus)` answer them from the index alone; with Labs 1–3's data volumes either design is fast, so this is chosen for the shape of the query rather than for a measured gain, and BR-56 checks the result. |

### 7.5 Seed data

Idempotent, safe to run repeatedly (`npm run prisma:seed` in `server/`), and
additive to Lab 3's seed. It converges documented rows exactly as Lab 3's did, and
leaves rows it does not document alone. Seeded Actions Taken carry fixed
`requestKey`s of the form `seed-<ticket>-<n>`, so a rerun updates them instead of
duplicating them.

| Group | Count | Notes |
| :--- | :--- | :--- |
| Lab 3 accounts | unchanged | the same emails and the shared local-development password, documented in `README.md` |
| **New** Requester with no Tickets | 1 | `no.tickets@toktickit.local`, active, no forced password change: the Requester dashboard's all-zero case |
| **New** IT Staff with no work | 1 | `idle.it@toktickit.local`, active: the IT Staff dashboard's zero case for "me" metrics |
| Tickets | Lab 3's 16 | two per status, across the four active Requesters, every priority, owned and unowned |
| Actions Taken | spread over those Tickets | **zero** on the `NEW` and `CANCELLED` Tickets, **one** on most `OPEN` and `CLOSED` ones, **several** on the `IN_PROGRESS` ones, including one recorded by an IT Staff member who is not the Owner (BR-02) |
| Follow-up | both values | at least one Ticket whose most recently recorded action has Follow-Up Required? = Yes (the gate's `FOLLOW_UP_PENDING` case), and every seeded `RESOLVED` Ticket's most recently recorded action = No. The seed sets `createdAt` explicitly, so recording order is identical on every run, and one Ticket's newest-recorded action is dated earlier than its other one (the backdated case, WF-19) |
| Reopened | both cases | one `REOPENED` Ticket with only a pre-reopen action (resolving is blocked), one with a fresh action after the reopen (resolving is allowed) |
| Status history | one chain per seeded Ticket | so the timeline has content and the gate can find the reopen instant |

The dashboards therefore demonstrate non-zero and zero metrics: Anucha has no
`WAITING_FOR_REQUESTER` Ticket, Pornchai and Suchada each have one, and
`no.tickets@toktickit.local` has none at all; the Administrator Malee owns no open
Ticket while Nattapong owns several. Seeded credentials are **local development
only**. No real password or production secret is committed.

### 7.6 Migration plan

Prisma Migrate has no rename detection (Lab 3 D-21), but this migration renames
nothing. The discipline still holds: generate it with `--create-only`, **read the
SQL**, and apply it only after.

1. **Back up** the database before migrating:
   `docker exec toktickit-db pg_dump -U <user> <db> > backup-pre-lab4.sql`.
2. Edit `schema.prisma`, then
   `npx prisma migrate dev --create-only --name lab4_actions_taken_and_workflow`.
3. The migration, as SQL: create `ActionTaken` and `TicketStatusChange` with their
   indexes and foreign keys; `ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT
   NULL DEFAULT 1` (a constant default fills every existing row in one pass, so no
   backfill statement is needed); create the two new `Ticket` indexes; drop the old
   `Ticket(ownerId)` index.
4. **No other data is touched.** Existing Tickets get `version` 1, no Actions
   Taken, and no status history (BR-46, BR-47).
5. Run `npm run prisma:seed`, which adds the two accounts and the Actions Taken and
   history rows of §7.5.
6. Verify with the migration and regression tests in `tests.md`: row counts of
   every Lab 1–3 table, requester bindings, and ticket numbers identical before and
   after; every `version` is 1; a legacy Ticket loads with empty actions and
   history.

**Rollback.** `server/prisma/rollback/lab4_rollback.sql` drops the two new tables
and the `version` column, drops the two new indexes, and recreates the
single-column `ownerId` index. Prisma's history is then made to agree by deleting
the migration's row from `_prisma_migrations`, after which `prisma migrate status`
lists it as pending and `migrate deploy` applies it again. (An earlier draft said
`prisma migrate resolve --rolled-back`; Prisma refuses that for a migration that
succeeded, with P3012, and it was found by running it in Issue 3.) Every statement
removes something Lab 4 added, so no Lab 1–3
row is lost. MIG-05 pins the comparison: it snapshots the Lab 3 tables of a
scratch database **in the Lab 3 state**, applies the migration, runs the rollback
**without** the Lab 4 seed in between, and checks that the Lab 3 tables equal the
snapshot row for row.

**What the rollback does not undo.** The script removes what the *migration*
added. The Lab 4 *seed* also writes into Lab 3 tables: it adds two `User` rows,
and the Actions Taken it creates move `Ticket.updatedAt` (BR-11). Rolling back a
database that has been seeded after migrating therefore leaves those two accounts
and the moved timestamps behind. For that case the step 1 dump is the recovery,
not the script. If the script were ever unusable, the dump is the recovery then
too.

### 7.7 New dependencies

None. Lab 4 adds no package to `server/`, `client/`, or the root.

---

## 8. API Contract

The authoritative contract is [`api-spec.md`](./api-spec.md). New and changed
endpoints:

| Method | Path | Role | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets/:id/actions-taken` | Requester (own), IT Staff, Administrator | list Actions Taken, BR-08 order |
| `POST` | `/api/staff/tickets/:id/actions-taken` | IT Staff, Administrator | create one (`201`, or `200` on a replayed `requestKey`) |
| `PATCH` | `/api/staff/tickets/:id/actions-taken/:actionId` | IT Staff, Administrator | edit one, with `expectedVersion` |
| `GET` | `/api/tickets/:id/status-history` | Requester (own), IT Staff, Administrator | the append-only timeline |
| `GET` | `/api/dashboard/requester` | Requester | Requester metrics and lists |
| `GET` | `/api/staff/dashboard` | IT Staff, Administrator | staff metrics and lists; `userCounts` for Administrators |
| `GET` | `/api/staff/tickets`, `/api/tickets` | unchanged roles | gain `group=open` (BR-31) |
| `GET` | `/api/staff/tickets/:id` | IT Staff, **Administrator** | gains `version`, `owner.role`, `blockedTransitions` |
| `PATCH` | `/api/staff/tickets/:id/owner`, `.../it-priority`, `.../status` | IT Staff, **Administrator** | gain `expectedVersion`, `version` in the response; status gains the gate |
| every `/api/staff/*` route | — | IT Staff, **Administrator** | the guard widened (BR-43) |

Nothing from Labs 2 and 3 is removed. `GET /api/requesters` was already gone.

---

## 9. Acceptance Criteria

Every criterion is observable and maps to at least one planned test in
[`tests.md`](./tests.md).

### 9.1 Actions Taken

| ID | Criterion |
| :--- | :--- |
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated user as Performed by, whoever owns the Ticket. *(The labsheet's example says "approved assignee"; an Action Taken has none, D-06.)* |
| AC-04 | Given an Action Taken with a missing required field, a description or result outside its length, an Action Date/Time in the future or before the Ticket existed, or Follow-Up Required? = Yes without a note, when it is submitted, then it is rejected with a message on each offending field; and a note sent with No is not stored. |
| AC-05 | Given a Ticket owned by one IT Staff member, when a different IT Staff member or an Administrator creates and edits an Action Taken on it, then it is accepted, Performed by stays the creator, and `updatedBy` records the editor. |
| AC-06 | Given an Action Taken another user edited after the screen loaded, when it is saved with the old version, then the save is refused as a conflict showing the latest version, and nothing is overwritten. |
| AC-07 | Given one submission sent twice — a double click or a retry — when both reach the server, then exactly one Action Taken exists and both calls report success. |
| AC-08 | Given a Requester, when they open their own Ticket, then they see every Action Taken read-only with no create or edit control; when they call a write endpoint, then it is `403`; when they ask for another Requester's Ticket, then it is `404`. |
| AC-09 | Given a `RESOLVED`, `CLOSED`, or `CANCELLED` Ticket, when an Action Taken is created or edited, then it is refused as `TICKET_NOT_ACTIVE` and nothing changes; and it is accepted in the other five statuses. |
| AC-10 | Given several Actions Taken, when the list is read at any time, then it is ordered by Action Date/Time then `id`, and two actions sharing a time keep the same order on every read. |

### 9.2 Ticket workflow

| ID | Criterion |
| :--- | :--- |
| AC-03 | Given a Ticket with no relevant Action Taken, or whose most recently recorded action requires follow-up (whatever Action Date/Time it carries), when IT Staff move it to `RESOLVED` — through the screen or by calling the API directly — then it is refused as `ACTION_REQUIRED` or `FOLLOW_UP_PENDING` and the status is unchanged; when a closing action is recorded, the same move succeeds. |
| AC-11 | Given any Ticket, when a move outside the matrix, a repeat of the current status, or any move by a Requester is attempted, then it is refused and the status is unchanged; and every permitted move succeeds for IT Staff and Administrators. |
| AC-12 | Given a Ticket that was resolved and then reopened, when IT Staff move it to `RESOLVED` again, then it is refused until an Action Taken is recorded after the reopen. |
| AC-13 | Given any status change, including the one a claim causes, when it succeeds, then exactly one history row records the from-status, to-status, actor, and time; a refused change records none; the row is visible to the Requester and staff; and no endpoint can edit or delete it. |
| AC-14 | Given a Ticket changed by someone else after the screen loaded, when owner, IT Priority, or status is saved with the old version, then it is refused as a conflict and the other change survives; of two simultaneous saves with the same version exactly one succeeds; and a Ticket is never assigned to a user whose deactivation committed before the assignment did. |
| AC-15 | Given a Requester who marked the problem as appearing resolved, when anyone looks at the Ticket, then its status is unchanged and the gate still requires an Action Taken. |
| AC-16 | Given the Ticket Detail status control, when it is shown, then it lists only the moves the Ticket can make now, explains each blocked one, refreshes the summary, permitted moves, and timeline after a success, and shows a conflict message after a stale save. |

### 9.3 Roles and shell

| ID | Criterion |
| :--- | :--- |
| AC-17 | Given an Administrator, when they open the Ticket Queue and Ticket Detail and claim, re-prioritise, change status, and record actions, then each works through the screen and the API under their own identity; and a Requester calling any `/api/staff/*` route is `403`, an IT Staff member calling any `/api/admin/*` route is `403`, and no session is `401`. |
| AC-34 | Given a signed-in user of any role, when the application opens or the Dashboard link is used, then that role's dashboard is shown and its navigation item is marked as the current page. |

### 9.4 Dashboards

| ID | Criterion |
| :--- | :--- |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-18 | Given seeded data, when the Requester dashboard is read, then each of its four numbers equals an independent query over that Requester's Tickets, the two lists hold the right Tickets in the right order and at most five, and a Requester with no Tickets gets zeros and empty lists. |
| AC-19 | Given seeded data, when the IT Staff dashboard is read, then every card, status row, and list equals an independent query; the "me" figures differ between two IT Staff members; Cancelled Tickets are in no open count; and an IT Staff member with no work gets zeros and empty lists. |
| AC-20 | Given an Administrator, when the staff dashboard is read, then it carries `userCounts` that equal the user table; IT Staff do not receive it; and a Requester calling the staff dashboard, or staff calling the Requester dashboard, is `403`. |
| AC-21 | Given any dashboard card, status row, or "View all", when its link is followed, then the target list is filtered from the URL and its total equals the number on the card; and an unknown `group` is a `400`. |
| AC-22 | Given a dashboard, when its request is in flight, fails, is refused, or finds nothing, then the matching loading, failure-with-retry, forbidden, or zero state is shown, and Refresh loads it again. |

### 9.5 Migration and regression

| ID | Criterion |
| :--- | :--- |
| AC-23 | Given the Lab 3 database, when the Lab 4 migration runs, then every User, Ticket, Attachment, Public Comment, and Internal Note is preserved, every Ticket's `version` is 1, a legacy Ticket shows empty Actions Taken and history, a legacy resolved Ticket is not re-gated, a legacy open Ticket is gated, and the rollback script restores the Lab 3 shape. |
| AC-24 | Given the seed, when it runs twice, then the database is identical after each run and holds the spread §7.5 lists. |
| AC-25 | Given the finished application, when the Lab 1, Lab 2, and Lab 3 suites run, then they pass, with only the changes `tests.md` §6 lists. |

### 9.6 Hardening

| ID | Criterion |
| :--- | :--- |
| AC-26 | Given a request body carrying a NUL character in any string, or an out-of-range id, when it is sent to any write endpoint, then the answer is `400` and never `500`. |
| AC-27 | Given any write form, when the user clicks submit repeatedly, or the request fails with a validation error, a conflict, or a network error, then one request is sent per submission and what the user typed is still in the form. |
| AC-28 | Given each screen, when a request is in flight, invalid, successful, empty, forbidden, in conflict, not found, or failing, then the same shared component and wording convention is used, and no raw error detail reaches the user. |
| AC-29 | Given every Lab 4 screen and the Lab 3 screens it touches, when viewed at ≥ 992 px, 768–991 px, and < 768 px, then it matches `ui-spec.md` with no horizontal page scroll and no clipped or overlapping content. |
| AC-30 | Given every screen, when used by keyboard alone, then every control is reachable, focus is always visible, every field has a label, no status is shown by colour alone, and no dialog traps focus or fails to close with Escape. |
| AC-31 | Given every screen, when it is rendered, then there is no console error, no placeholder text, no obsolete control, and no broken link. |
| AC-32 | Given the seed data, when each of the three endpoints in BR-56 is called 20 times in a row, then no response takes longer than 1000 ms. |
| AC-33 | Given a Ticket whose Owner is inactive, and another whose Owner's role is no longer assignable, when the Owner is shown, then the first reads "Inactive" and the second "No longer IT Staff". |

---

## 10. Definition of Done

### 10.1 Product completion

* [ ] Every FR in §4 is implemented and every AC in §9 is demonstrated by a
      passing automated test.
* [ ] IT Staff and Administrators create, list, and edit Actions Taken; the
      Requester sees them read-only; every write is enforced on the server.
* [ ] The resolution gate, the transition matrix, and stale-update detection are
      enforced by the API against direct calls, and every status change is in the
      append-only history.
* [ ] The Requester, IT Staff, and Administrator dashboards show the metrics BR-32
      to BR-38 define, each equal to an independent query, each with a working
      drill-down.
* [ ] The Administrator performs IT Staff operations through the screen and the
      API, and every role lands on its Dashboard.
* [ ] The migration preserves all Lab 1–3 data, the rollback is tested, and the
      seed is idempotent and gives non-zero and zero metrics.
* [ ] The Lab 1, 2, and 3 suites pass, with every change to an old test listed.
* [ ] Every screen is responsive, keyboard-operable, and consistent in its
      loading, empty, error, forbidden, and conflict states; no console error or
      placeholder remains; and the Lab 3 limitations §5.8 names are closed.

### 10.2 Evidence completion

* [ ] `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are current
      with the code that shipped, and this file records the PR and commit that
      approved it before implementation began.
* [ ] `tests.md` records planned tests, AC traceability, real test-file paths, and
      the runner's actual output from `main`.
* [ ] Screenshots of every major Lab 4 screen exist at all three breakpoints under
      `artifacts/lab-04/screenshots/`, with the visual and accessibility checklist
      completed in `tests.md`.
* [ ] `reviewer.md` records every PR, its reviewer, comments, responses, and
      approval.
* [ ] `ai-use.md` records the model used, 6–10 key prompts, and the reflection.
* [ ] `README.md` documents setup, migration, seed, seeded credentials, test
      commands, and the demonstration path.
* [ ] Every issue is Done on the board, every feature PR is merged into
      `lab4-staging`, and the release PR into `main` is merged.

---

## 11. Assumptions and Decisions

Design decisions with a separate reason column — D-01 to D-05 — live in §7.4. This
table holds the remaining decisions, each with its reason in the same cell.

| ID | Assumption or decision |
| :--- | :--- |
| D-06 | **An Action Taken is a record of work done: seven fields, no assignee, no status.** The labsheet's field list (§3, §4.1, §8.3) has exactly those seven, and its name is past tense. Part 6's grading words map to behaviour that exists elsewhere: *assign* is the Ticket Owner assignment, *complete* and *cancel* are the Ticket's `RESOLVED` and `CANCELLED` transitions, and *inactive-assignee rejection* is `OWNER_NOT_ASSIGNABLE` (Lab 3 BR-24) shown on the same Ticket Detail screen. The labsheet's AC-01 example mentions an "approved assignee"; AC-01 here reads "authenticated user as Performed by" instead. Confirmed by the owner when this contract was drafted. **The risk is known and recorded.** The other reading — an Action Taken with its own optional assignee and a Planned / In Progress / Completed / Cancelled status — was raised in review (PR #78) and not adopted. If a TA reads Part 6 as grading assign, complete, cancel, and inactive-assignee rejection on the Action Taken itself, D-06 is the decision to reopen. It would change the schema and API (Issues 3 and 4), the Actions Taken screen (Issue 5), and the gate (Issue 6, D-07); it would not change the dashboards, the roles, or the Ticket-level transitions. |
| D-07 | **The gate is "at least one relevant action, and the latest has no follow-up pending".** A bare "at least one action" would make Follow-Up Required? decorative, and "no open follow-ups" would need a way to close one, which an assignee-less record does not have. A follow-up is therefore settled by recording a later action. *Later* means recorded later, not dated later: Action Date/Time is typed by the user and editable, so an action logged afterwards for earlier work is still the newest entry, and its follow-up still counts (BR-17). *Relevant* excludes actions older than the latest reopen, so a reopened Ticket cannot be re-resolved on the strength of work done before it failed. A legacy `REOPENED` Ticket has no history row to date the reopen from, so it is treated as never reopened. Confirmed by the owner. |
| D-08 | **Administrators perform IT Staff ticket operations.** Labsheet §4.3 says an Administrator performs IT Staff behaviour. This supersedes Lab 3's D-11, D-23, and BR-19, and changes Lab 3's AC-09 (an Administrator was refused the queue); the affected Lab 3 tests are updated and listed in `tests.md` §6 (BR-50). User Management stays Administrator-only. Lab 3's decision to exclude them was a narrowing the labsheet permitted, not a requirement. |
| D-09 | **Dashboard is the first navigation item and the landing page of every role.** The wordmark links to it. It replaces Lab 3's landing pages (My Tickets, Ticket Queue, User Management), each of which stays one click away. |
| D-10 | **No time-based metrics and no trends.** The mockup's "from yesterday" needs a daily snapshot table, which is excluded as analytics (§3.2). Every Lab 4 metric is an instantaneous count or a top-5 ordered list, so no day boundary or time zone can change a number (BR-41). Timestamps travel as UTC and are displayed in the browser's time zone, which is Asia/Bangkok on the lab machines. |
| D-11 | **The mockups are visual direction only (labsheet §8.1).** Where they conflict with the contract the contract wins: the product is named TokTickIT, not "TikTockIT"; there is no Profile item, since no profile screen is approved (§3.2); IT Staff and Administrators get no "Create Ticket" quick action, because Lab 3 BR-18 gives them no right to create one; the IT Staff "Quick Actions" are links to the Queue filtered as Unassigned and as Mine. The Requester mockup's cards (Open, In Progress, Resolved, Closed) become Open, Waiting for You, Resolved, Closed, which matches labsheet §4.6 and surfaces what needs the Requester. |
| D-12 | **Drill-down needs a `group=open` filter and URL-driven filters.** "Open" is five statuses, which a single `status` value cannot express, so My Tickets and the Queue gain `group=open` (BR-31) and read their filters from the URL (FR-21). `group` combines with `status` by AND. These are optional parameters, so every Lab 2 and Lab 3 request still works. User Management gains **nothing**: an `active` filter would have let the Administrator's account counts link to exact lists, but it would add a second filter to a Lab 3 screen that Lab 3 deliberately kept to search and role, for numbers the labsheet calls optional (BR-40). Dropping those links was chosen instead. |
| D-13 | **Any IT Staff member or Administrator may edit any Action Taken; none can be deleted, and edits are not kept as history.** This follows BR-02's spirit that work is shared. It deliberately differs from Lab 3's append-only comments, because the labsheet requires an edit mode (§8.3) and grades editing (Part 6). `updatedBy` and `updatedAt` show that a record changed; the Status History, not an action edit log, is Lab 4's audit trail. |
| D-14 | **Actions are recorded only on a Ticket that is not `RESOLVED`, `CLOSED`, or `CANCELLED`.** It keeps one invariant true: a resolved Ticket always satisfied the gate at the moment it was resolved and cannot be changed to stop satisfying it. A forgotten note is recorded by reopening the Ticket, which the history then shows. |
| D-15 | **Server-side duplicate protection exists for Action Taken creation (`requestKey`); every other form relies on single-flight UI and existing conflicts.** Comments and notes have no natural idempotency key, and adding one to each would be a Lab 3 contract change. The residual risk — a network retry of a comment posts it twice — is accepted and recorded in `tests.md` §7. Status changes and claims are already safe because repeating one is a conflict (Lab 3 BR-38, BR-25). |
| D-16 | **Performance smoke is 20 sequential requests, none over 1000 ms, on seed data.** It catches an accidental N+1 or a missing index without becoming a flaky benchmark on a laptop running Docker. It is not a load test, and no claim is made beyond it. |
| D-17 | Test files live under `server/tests/lab-04/`, `client/tests/lab-04/`, and `e2e/lab-04/`. Labsheet §12 writes `client/.../lab-04 tests/`; we follow Lab 3 D-17 and use `client/tests/lab-04/`. |
| D-18 | A Follow-up Note sent with Follow-Up Required? = No is ignored and cleared, not rejected. The form hides the field, so only a stale or hand-built request can send one, and silently storing a contradictory note is worse than dropping it. |
| D-19 | **Part 7's "stable ordering, append-only behaviour" is read as the Actions Taken order (BR-08) and the Status History (BR-21, BR-22).** Actions Taken are editable, so they cannot be the append-only part; the history, which no one can edit, is. |
| D-20 | The rule from Lab 3 D-21 carries over: the migration SQL is generated with `--create-only` and read before it is applied, every time. |
| D-21 | The two new seed accounts exist only so the zero-data dashboard states are demonstrable by signing in. They are documented in `README.md` with the others and are local-development only. |
| D-22 | **Lab 3 known limitations, triaged.** Closed in Lab 4: NUL in text bodies and out-of-range body ids (BR-52), and the owner label after a role change (BR-55). To be investigated: the intermittent `RoleNavigation.test.tsx` and `Navigation.test.tsx` failures, whose cause is not yet found; if it is not found by Issue 9's final run, the limitation stays recorded in `tests.md` §7 with what was tried. Not addressed: CSRF tokens (Lab 3 D-13 stands) and an automated accessibility scanner (§3.2). |
