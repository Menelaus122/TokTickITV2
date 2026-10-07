# Lab 4 — Zen Green UI Specification

Companion to [`specification.md`](./specification.md). This extends Lab 2's and
Lab 3's visual contracts (`docs/lab-02/ui-spec.md`, `docs/lab-03/ui-spec.md`); it
does **not** replace them.

**Everything in Labs 2 and 3 still applies unchanged**: colour tokens, typography,
the 4 px spacing scale, control states, labels and the red asterisk, validation
placement beneath the field, the five button variants, the five shared states, the
Role, Owner, and Status badges, the Internal region, shadows, and the 1120 px
centred content width. No Lab 4 screen introduces a new colour, a new font size,
or a second visual system (FR-26).

Lab 4 adds five things to the shared vocabulary — a **metric card**, an **Action
Taken entry**, a **follow-up pill**, a **status timeline**, and a **conflict
callout** — across two new dashboards and two extended Ticket Detail screens. It
also changes the shell's navigation and the Owner label.

The labsheet's mockups (`lab_04_staff-dashboard-mockup.png`,
`lab_04_requester-dashboard-mockup.png`) are **visual direction only**. Where this
document differs from them, this document wins; each difference is listed in §3.4
and recorded as D-11.

---

## 1. Additions to the shared vocabulary

### 1.1 Metric card

A card that is also a link. Built from Lab 2's card, so it adds no token.

```
┌────────────────────────┐
│ OPEN TICKETS           │  ← label, 12 px uppercase, --tt-text-muted
│ 3                      │  ← value, 32 px, --tt-green-primary
│ View all  →            │  ← 14 px link text, --tt-green-primary
└────────────────────────┘
```

* The whole card is one `<a>`: it receives the focus outline and `:hover` /
  `:active` states of Lab 2's links. Its accessible name is
  "Open Tickets: 3. View all", so the number and the destination are announced
  together (FR-31).
* A count with no destination (the Administrator's account counts, §3.3) is a plain
  `<div>` with no "View all" and no link, so no dead or misleading link exists
  (BR-40).
* A value of `0` renders as `0`, never blank (BR-39). The card keeps its link.
* The card never encodes meaning in colour alone: the label and value carry it.

### 1.2 Action Taken entry

One Action Taken, drawn as a bordered card (`--tt-surface`, 1 px `--tt-border`) with
its seven fields as a definition list, so a screen reader reads each label with its
value:

```
┌──────────────────────────────────────────────────────────────┐
│ 5 Oct 2026, 10:10   ·   Wirachat T. [IT STAFF]   [Edit]      │
│ Action Description   Replaced the toner cartridge and ran…   │
│ Result               Test page printed cleanly.              │
│ Follow-Up Required?  [FOLLOW-UP NEEDED]                      │
│ Follow-up Note       Check the printer again on Thursday.    │
│ Attachment Notes     Look for the photo of the toner label.  │
│ Recorded 5 Oct 2026, 10:12 · Edited by Siriporn K., 11:02    │
└──────────────────────────────────────────────────────────────┘
```

* Header line: Action Date/Time, then Performed by with the Lab 3 Role badge, then
  the Edit action (IT Staff and Administrators only; absent for a Requester).
* The most recently **recorded** entry carries the text tag **Latest recorded** after
  its Performed by. It is the one the resolution gate reads (BR-17), and it is not
  always the last card, because Action Date/Time is typed by the user. The tag is
  text, not colour, and appears on exactly one entry per Ticket.
* Follow-up Note and Attachment Notes rows are **omitted** when empty rather than
  shown blank. Follow-Up Required? is always shown.
* The footer shows "Recorded …" always and "Edited by …" only after an edit
  (BR-07).
* Long text wraps; nothing is truncated or clipped. `overflow-wrap: anywhere`
  keeps an unbroken string inside the card.

### 1.3 Follow-up pill

Lab 2's pill geometry, with a text label so colour is never the signal (FR-31):

| Value | Presentation |
| :--- | :--- |
| Yes | `--tt-warning-bg` background, `--tt-warning` text, the words **Follow-up needed** |
| No | `--tt-disabled-bg` background, `--tt-text-muted` text, the words **No follow-up** |

### 1.4 Status timeline

An ordered list, oldest first, with a vertical rule on the left in `--tt-border`:

```
 ●  Ticket created                                 28 Sep 2026, 09:10
 │
 ●  [NEW] → [OPEN]          Wirachat T. [IT STAFF]   4 Oct 2026, 15:20
 │
 ●  [OPEN] → [IN PROGRESS]  Wirachat T. [IT STAFF]   4 Oct 2026, 15:40
```

* Each step uses the Lab 3 status badges, spelled out ("In Progress", never
  `IN_PROGRESS`), and the actor's name with a Role badge.
* The first line, "Ticket created", comes from the Ticket's own `createdAt` and is
  the only line a legacy Ticket has (BR-22).
* It is an `<ol>`, so the order is announced. The newest step is not highlighted by
  colour; it is simply last.

### 1.5 Conflict callout

Lab 3 already showed a conflict as its own message (`ui-spec.md` Lab 3 §9). Lab 4
gives it one shape: the warning callout (`--tt-warning-bg`, `--tt-warning`,
`role="alert"`) with the sentence, and a **Show latest** button where the screen
can offer it:

| Conflict | Copy |
| :--- | :--- |
| `STALE_UPDATE` on a Ticket | "This ticket changed while you were working on it — for example a colleague moved it, or the Requester marked the problem as appearing resolved. It is now **In Progress**, owned by Siriporn K. Review it and try again." |
| `STALE_UPDATE` on an action | "Someone else edited this action while you were working on it. Your changes are still in the form." |
| `TICKET_ALREADY_OWNED` | "Someone else claimed this ticket first." (unchanged) |
| `TICKET_NOT_ACTIVE` | "This ticket is Resolved, so no more actions can be recorded. Reopen it first." Shown beside the button as the helper text of §4.4, where the status is known. When the API answers it while a form is open, the ticket has changed under the person and the screen does not yet know its new status, so the callout shows the API's own sentence ("This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed.") followed by "Everything you typed is still in the form." |
| `ACTION_REQUIRED` | "Record at least one action before resolving this ticket." |
| `FOLLOW_UP_PENDING` | "The most recently recorded action still needs follow-up. Record the follow-up as a new action first." |

A conflict never clears the form (BR-54), and never reads as a generic failure.

### 1.6 Owner label, corrected

Lab 3's Owner presentation gains one case, closing the role-demotion limitation
(BR-55):

| Case | Presentation |
| :--- | :--- |
| Assigned, account inactive | Name plus the grey outlined **Inactive** pill (as Lab 3) |
| Assigned, active, no longer IT Staff or Administrator | Name plus the grey outlined **No longer IT Staff** pill |

---

## 2. Application shell

Replaces Lab 3's navigation table (Lab 3 `ui-spec.md` §2). Header, identity block,
Change Password, Logout, the hamburger below 768 px, and Lab 2's 3 px white
underline with `aria-current="page"` are unchanged.

| Role | Destinations, in order | Landing page |
| :--- | :--- | :--- |
| Requester | **Dashboard**, My Tickets, Create Ticket | **Dashboard** |
| IT Staff | **Dashboard**, Ticket Queue | **Dashboard** |
| Administrator | **Dashboard**, **Ticket Queue**, User Management | **Dashboard** |

* The wordmark links to the Dashboard (D-09).
* Dashboard shows the active-page indication on `/dashboard`. While a Ticket Detail
  is open, its parent list — My Tickets or Ticket Queue — is the active item, as in
  Lab 3.
* A role never sees a destination it may not open. Typing a forbidden URL lands on
  the role's Dashboard with the forbidden callout (FR-24).
* There is no Profile item (D-11).

The shell gains no other element. Obsolete shell content left from earlier labs —
the placeholder `RoleHome` page and any unused component — is removed (FR-30).

---

## 3. Screens — Dashboards

One route, `/dashboard`, shows the dashboard of the signed-in role. It loads its
data once on arrival and again on **Refresh**.

### 3.1 Requester Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Welcome, Jennifer                                         [ Refresh ]    │
├────────────────┬────────────────┬────────────────┬───────────────────────┤
│ OPEN TICKETS   │ WAITING FOR YOU│ RESOLVED       │ CLOSED                │
│ 3              │ 1              │ 5              │ 12                    │
│ View all →     │ View all →     │ View all →     │ View all →            │
├────────────────┴────────────────┴────────────────┴───────────────────────┤
│ Needs your attention                                                     │
│ TT-2026-00031 · Grade upload rejects…  [WAITING FOR REQUESTER]  3 Oct    │
├──────────────────────────────────────────────────────────────────────────┤
│ Recently updated                                          View all →     │
│ TT-2026-00042 · Printer on floor 3…  [IN PROGRESS]   5 Oct, 10:12        │
├──────────────────────────────────────────────────────────────────────────┤
│ Quick actions   [ Create Ticket ]   [ View My Tickets ]                  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | Content | Source |
| :--- | :--- | :--- |
| Greeting | "Welcome, <first name>" | the session user |
| Cards | Open Tickets, Waiting for You, Resolved, Closed; each links as §1.1 | BR-32 |
| Needs your attention | up to 5 Tickets waiting on the Requester, longest waiting first | BR-33 |
| Recently updated | up to 5 Tickets, newest change first; "View all" opens My Tickets | BR-33 |
| Quick actions | **Create Ticket** (primary), **View My Tickets** (secondary) | — |

A list row is one link to the Ticket Detail: Ticket Number in monospace, Summary
(one line, ellipsis, full text in `title`), status badge, and the date. A Requester
sees only their own Tickets (AC-02).

**Zero data.** Every card shows `0`. *Needs your attention* reads "Nothing is
waiting on you." and *Recently updated* reads "You have no tickets yet." beside
**Create Ticket**. Neither region is hidden, so the layout does not jump (BR-39).

### 3.2 IT Staff Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Welcome back, Michael                                     [ Refresh ]    │
├────────────────┬────────────────┬────────────────┬───────────────────────┤
│ UNASSIGNED     │ ASSIGNED TO ME │ WAITING FOR    │ URGENT                │
│ 2              │ 4              │ REQUESTER  2   │ 2                     │
├────────────────┴────────────────┴────────────────┴───────────────────────┤
│ By status    New 2 · Open 2 · In Progress 2 · Waiting 2 · Reopened 2     │
├────────────────────────────────────┬─────────────────────────────────────┤
│ My Tickets                         │ Urgent Tickets                      │
│ …5 rows…                           │ …5 rows…                            │
├────────────────────────────────────┴─────────────────────────────────────┤
│ My Recent Actions                                                        │
│ TT-2026-00042 · 5 Oct, 10:10 · Replaced the toner cartridge…  [Follow-up]│
├──────────────────────────────────────────────────────────────────────────┤
│ Quick actions   [ Open Ticket Queue ]  [ Unassigned Tickets ]  [ My Queue ]│
└──────────────────────────────────────────────────────────────────────────┘
```

| Region | Content | Source |
| :--- | :--- | :--- |
| Cards | Unassigned, Assigned to Me, Waiting for Requester, Urgent | BR-34 |
| By status | five count links: New, Open, In Progress, Waiting for Requester, Reopened — each with the Lab 3 status badge and its count | BR-35 |
| My Tickets, Urgent Tickets | up to 5 rows each: Ticket Number, Summary, status badge, IT Priority badge, Owner (Lab 3 §1.2 with §1.6 here), `updatedAt` | BR-36 |
| My Recent Actions | up to 5 rows: Ticket Number (a link to the Ticket), Action Date/Time, the first 120 characters of the description, the follow-up pill | BR-36 |
| Quick actions | **Open Ticket Queue**, **Unassigned Tickets** (`/queue?owner=unassigned&group=open`), **My Queue** (`/queue?owner=me&group=open`) | D-11 |

"View all" beside *My Tickets* opens `/queue?owner=me&group=open`; beside *Urgent
Tickets*, `/queue?itPriority=URGENT&group=open`. There is **no Create Ticket**
shortcut, since IT Staff and Administrators cannot create Tickets (Lab 3 BR-18),
and **no "change from yesterday"** line (D-10).

**Zero data.** An IT Staff member with no work sees `0` on *Assigned to Me*, "No
tickets are assigned to you." under *My Tickets*, and "You have not recorded any
actions yet." under *My Recent Actions*. *Urgent Tickets* reads "No urgent tickets
right now." The four cards and the status row always render.

### 3.3 Administrator Dashboard

The IT Staff dashboard of §3.2, unchanged, plus one region after *By status*:

```
│ Accounts   Requesters 6  ·  IT Staff 4  ·  Administrators 2  ·  Inactive 2   [Open User Management →] │
```

All four are **plain numbers with no link**. A link to `/users?role=IT_STAFF` would
open a list that also shows inactive staff, so it could show 5 where the number says
4, and the contract promises that a link's list matches its number (BR-40, D-12).
The region says "Active accounts by role, and inactive accounts counted
separately", and offers one ordinary link, **Open User Management**, which opens
`/users` unfiltered and claims nothing about any count. IT Staff do not see this region
(BR-38).

### 3.4 Differences from the mockups

| Mockup | This contract | Why |
| :--- | :--- | :--- |
| "TikTockIT" | **TokTickIT** | the product's name |
| Profile in the header | none | no profile screen is approved (§3.2 of the specification) |
| "from yesterday" under each card | none | needs a daily snapshot, excluded as analytics (D-10) |
| Staff cards New 14, Open 23, In Progress 18, Waiting 7, My Assigned 16 | four cards plus a status row | the status breakdown keeps all five counts; the cards lead with what needs action (BR-34, BR-35) |
| Staff quick action "Create Ticket" | removed | IT Staff cannot create Tickets (Lab 3 BR-18) |
| Staff quick action "Search Tickets" | "Open Ticket Queue", which has the search field | one Search implementation, not two |
| Requester cards Open, In Progress, Resolved, Closed | Open, **Waiting for You**, Resolved, Closed | surfaces what needs the Requester (D-11) |
| "Welcome back, Michael!" | "Welcome back, <first name>" | no exclamation mark; same copy rule as Labs 2 and 3 |

### 3.5 States

| State | Presentation |
| :--- | :--- |
| Loading | Lab 2 skeletons shaped like the cards and lists, so the layout does not jump |
| Zero data | as §3.1 and §3.2; a dashboard with every value `0` is a valid screen, not an error |
| Forbidden | Error callout "You do not have access to this dashboard." (a role reaching a dashboard it may not have) |
| API failure | Error callout "The dashboard could not be loaded." with **Try again**; the shell stays usable |
| Refresh | the **Refresh** button is busy and disabled while loading; the old numbers stay visible until the new ones arrive, then replace them; a failed refresh keeps the old numbers and shows the failure callout above them |

### 3.6 Responsive

| Width | Presentation |
| :--- | :--- |
| ≥ 992 px | four cards in one row; the two staff lists side by side; quick actions in one row |
| 768–991 px | cards two by two; lists stacked full width; By status wraps to two lines |
| < 768 px | cards one per row, full width; lists stacked; Refresh below the greeting; quick actions stacked, primary on top. No horizontal scroll at 320 px (FR-32) |

---

## 4. Screen — Actions Taken on the IT Staff Ticket Detail

Route `/queue/:id`, for IT Staff and Administrators. Lab 3's four regions become
five, in this order (FR-01):

```
┌─ What the Requester submitted ─────────────── read-only ─┐
┌─ Operational ──────────────────────────────── editable ──┐   ← status control, §5
┌─ Actions Taken (3) ───────────────────────── [ + Add action ] ┐
┌─ Attachments ─────────────────── Lab 2 rows, unchanged ──┐
┌─ Public Comments ────────────────────────────────────────┐
┌─ Internal Notes ─────────────── Lab 3 internal region ───┐
┌─ Status History ─────────────────────────────────────────┐   ← §6
```

Actions Taken sits immediately after the operational fields because the resolution
gate (BR-17) makes recording an action part of moving the Ticket, and the status
control's blocked-move messages link to this region.

### 4.1 List

Entries are §1.2 cards in BR-08 order, **oldest Action Date/Time first**. That is the
order for reading; it is not the order the gate uses. The gate reads the most
recently *recorded* entry, which carries the **Latest recorded** tag (§1.2) and may
sit above the last card when someone logged earlier work afterwards. The heading
shows the count: "Actions Taken (3)".

A card does not move when anything but its own Action Date/Time is edited. Changing
the date re-sorts the entry; the screen says "Moved to its new position by date."
in the status message and focus follows the card, so a re-sort is never silent.

### 4.2 Create mode

**+ Add action** opens an inline form at the top of the region, above the list, and
moves focus to its first field. No modal dialog is used (FR-31).

| Field | Control | Rule |
| :--- | :--- | :--- |
| Action Date/Time * | date-time input, defaults to now | not in the future, not before the Ticket existed (BR-06) |
| Action Description * | textarea, 4 rows | 5–2000 characters (BR-03) |
| Result * | textarea, 2 rows | 2–1000 characters (BR-03) |
| Performed by | read-only: the signed-in user's name and Role badge | automatic (BR-05); the field never looks editable |
| Follow-Up Required? * | two radio buttons, **No** and **Yes**; No preselected | — |
| Follow-up Note | textarea, shown only when **Yes** is chosen; the asterisk and `required` appear with it | required, 5–1000 characters, when Yes (BR-04) |
| Attachment Notes | textarea, 2 rows, optional | up to 500 characters; helper text "Say which file, screenshot, or image to look for. This does not upload a file." |

Buttons: **Save action** (primary) and **Cancel** (tertiary). Choosing **No** again
hides Follow-up Note, and its text is kept in the form but not sent (D-18).

Behaviour on submit:

* **Busy.** Save is disabled and labelled "Saving…" while the request is in
  flight; Cancel and the other controls in the region are disabled too, so two
  submissions cannot overlap (BR-53).
* **Validation.** Messages appear beneath their own field, with the red asterisk
  on required labels, exactly as Labs 2 and 3. Focus moves to the first invalid
  field.
* **One key per submission.** The form creates its `requestKey` when it opens. A
  retry after a network failure sends the **same** key, so a request that did reach
  the server is not recorded twice (BR-28, D-15).
* **Success.** The form closes, the new card appears in its place in the order,
  focus moves to that card's heading, and the status message "Action recorded."
  is announced.
* **Failure.** A `400`, a `409`, or a network error leaves every typed value in the
  form and shows its own message (BR-54).

### 4.3 View and edit mode

A card is in **view mode** by default. **Edit** replaces that card, in place, with
the same form as §4.2 filled with the stored values. Performed by stays read-only
and shows the original performer; the footer keeps "Recorded …". **Save changes**
and **Cancel** replace the Save action buttons. Only one card is editable at a time.

* The save sends the card's `version` as `expectedVersion` (BR-27).
* A `STALE_UPDATE` shows the §1.5 conflict callout inside the card, **keeps the
  user's edits**, and offers **Show latest**, which replaces the form's values with
  the server's after a confirmation that the edits will be lost.
* On success the card returns to view mode with "Edited by …" in its footer, and
  focus returns to its Edit button. If the edit changed Action Date/Time the card
  moves to its new place (§4.1) and focus follows it.

### 4.4 States

| State | Presentation |
| :--- | :--- |
| Loading | skeleton cards inside the region only; the rest of the screen is already usable |
| Empty | "No actions recorded yet." with a one-line explanation "Record what you do on this ticket so the Requester can see it." and the **+ Add action** button (FR-08). Legacy Tickets land here |
| Ticket not active | `RESOLVED`, `CLOSED`, or `CANCELLED`: **+ Add action** and every **Edit** are disabled with the helper text "This ticket is Resolved, so no more actions can be recorded. Reopen it first." The status is spelled as the badge spells it ("Closed", "Cancelled"), and for **Cancelled** the sentence ends after "recorded", because a cancelled ticket cannot be reopened (Lab 3 BR-33) and the advice would be false. Each disabled control is tied to the sentence with `aria-describedby`. The existing entries stay readable (BR-10) |
| API failure | Error callout inside the region with **Try again**; the other regions are unaffected |
| Forbidden | not reachable by a role that can open the screen; if the API still answers `403`, the Error callout "You do not have access to record actions." |

### 4.5 Responsive

Cards are one column at every width, so the layout needs no table-to-card
switch. At ≥ 992 px a card's label
column is 180 px and its values fill the rest; below 992 px each label sits above
its value. The create form is full width below 768 px, with Save and Cancel
stacked, Save on top. No horizontal scroll at 320 px.

---

## 5. Screen — Ticket workflow controls

The **Status** control in the Operational region of §4 changes; the rest of the
region is Lab 3's.

```
 Status  [IN PROGRESS]        Move to:  [ Waiting for Requester ▾ ]  [ Apply ]
 Not available now
   Resolved — Record at least one action before resolving this ticket.  [Go to Actions Taken]
```

| Element | Rule |
| :--- | :--- |
| "Move to" select | populated **only** from `permittedTransitions`, never from the full enum (FR-09) |
| "Not available now" | one line per `blockedTransitions` entry: the status, an em dash, the API's message, and, for `ACTION_REQUIRED` and `FOLLOW_UP_PENDING`, a **Go to Actions Taken** link that scrolls to and focuses the §4 region; for `OWNER_REQUIRED`, **Claim this ticket** focuses the owner control |
| Reason | choosing Resolved, Cancelled, or Reopened reveals the required reason textarea of Lab 3, 5–2000 characters, before **Apply** is enabled; helper text says it is posted as a Public Comment |
| Apply | busy and disabled while in flight; sends the Ticket's `version` as `expectedVersion` |
| Terminal ticket | for `CANCELLED` neither list has an entry: the control shows "This ticket is cancelled and cannot change." |
| Held back, nothing permitted | when the matrix allows moves but none is permitted yet, the select is not drawn: the control says "No move is available yet." above the "Not available now" list |

After a success (FR-14) the Ticket summary, the status badge, the select's options,
the "Not available now" list, and the Status History of §6 all refresh from the
response, with no reload, and the status message "Status changed to In Progress."
is announced. A `STALE_UPDATE` shows the §1.5 conflict callout and **Show latest**,
which reloads the Ticket and keeps any reason the user typed. A gate refusal that
reaches the server anyway — a race — shows its own §1.5 message, never a generic
failure; the screen then reads the Ticket again, so the options and the list show
what is true, and what the person had chosen and typed is kept (BR-54).

The gate reads the Actions Taken, so the control also reads the Ticket again after
an action is **recorded or edited** on the same screen: Resolved joins "Move to" when
the gate opens, and moves to "Not available now" when an edit leaves the latest
recorded action needing follow-up. The move and the reason already chosen are kept
when that move is still offered. If the read fails, the screen stays as it is and the
API still enforces the gate.

An Administrator sees exactly this control, because the API permits it (BR-42).

### 5.1 Requester Ticket Detail

The Lab 3 "Problem Appears Resolved" panel is unchanged, and its helper text now
reads "Only IT Staff can resolve a ticket. This tells them you think it is
fixed." The Requester has **no** status control, no Apply button, and no select.

---

## 6. Screen — Actions Taken and Status History for the Requester

On the Requester Ticket Detail (`/tickets/:id`), two **read-only** regions follow
the Ticket summary, in this order: **Actions Taken**, then **Status History**; the
Lab 3 Attachments and Public Comments follow. A Requester sees:

* every Action Taken as the §1.2 card, with **no** Edit and **no** Add action, and
  no hint of either (FR-04, AC-08);
* the §1.4 timeline, identical to staff's.

The Requester's empty state for Actions Taken is "IT Staff have not recorded any
actions yet." There is no Internal Notes region and nothing that hints one exists
(Lab 3 AC-17). Loading, failure with **Try again**, and not-found are as Lab 3's
Requester Ticket Detail.

### 6.1 Status History on the staff screen

The same §1.4 timeline, as the last region of `/queue/:id`. Loading skeleton, and
an API-failure callout with **Try again** confined to the region.

---

## 7. Drill-down: filters read from the URL

My Tickets and the Ticket Queue read their filters from the query string on load and
write them back as the user changes them, so a dashboard link, a reload, and a
bookmark all show the same list (FR-21). User Management is **not** part of this: no
dashboard link opens it with a filter (§3.3, BR-40).

| Screen | Parameters it reads | Notes |
| :--- | :--- | :--- |
| My Tickets (`/tickets`) | `group`, `status`, plus Lab 2's search, sort, page | `group=open` is new |
| Ticket Queue (`/queue`) | `group`, `status`, `itPriority`, `owner`, plus Lab 3's | `group=open` is new |

* An active `group` appears as a removable chip, "Open tickets ✕", next to the
  other filters, so the list's scope is visible and **Clear Filters** removes it.
* A parameter the screen does not recognise is ignored, never an error, so a
  hand-edited URL cannot break the page; an unrecognised *value* for a known
  parameter is dropped to its default and the filter control shows the default.
* Changing a filter resets the page to 1, as Lab 3 does.
* The number the list shows is the API's `totalItems`; for a dashboard link it
  equals the card's number (BR-40, AC-21).

---

## 8. Required screen modes and feedback

Per labsheet §8.6, each screen declares its modes, and every state below is
covered by a test:

| Screen | Modes | Required feedback |
| :--- | :--- | :--- |
| Login, Change Password, Create Ticket, My Tickets (Labs 2–3) | as before | as before |
| Requester Dashboard | view | loading, zero data, forbidden, API failure, refresh |
| IT Staff / Administrator Dashboard | view | loading, zero data, forbidden, API failure, refresh |
| Requester Ticket Detail | view + comment + appears-resolved | loading, not found, validation, busy, success, API failure; Actions Taken and Status History read-only with their own empty and failure states |
| IT Staff Ticket Detail | view + edit per control | loading, not found, forbidden, validation, per-action busy, success, conflict, API failure |
| Actions Taken region | view + create + edit | loading, empty, ticket not active, validation, busy, success, conflict, API failure |
| Status control | edit | validation, busy, success, blocked, conflict, API failure |
| Ticket Queue, User Management (Lab 3) | view (+ create + edit) | loading, empty, no-results, forbidden, validation, busy, success, conflict, API failure — unchanged |

**Every screen uses the same components and wording for the same state** (FR-26):
the Lab 2 skeleton for loading, the empty-state card, the Error callout with **Try
again**, the forbidden callout, the §1.5 warning callout for a conflict, and the
success status message. A conflict is never shown as a generic failure, and no raw
error detail — a code, a stack, SQL — is ever shown (AC-28).

---

## 9. Accessibility

Lab 2's and Lab 3's rules carry over in full (labsheet §8.6). Lab 4 adds:

* A metric card is one link whose accessible name carries the label, the value, and
  the destination (§1.1). The dashboard's regions are `<section>`s with a heading
  each, so a screen reader can jump between them.
* Lists of Tickets and of actions are `<ul>`; the Status History is an `<ol>`.
* An Action Taken entry's fields are a `<dl>`, so every value has its label.
* The create and edit forms use real `<label>`s, a `<fieldset>` with a
  `<legend>` for the Follow-Up Required? radio group, and `aria-describedby` to tie
  each validation message to its field. Required fields carry `required` as well
  as the red asterisk.
* Focus management: opening the create form focuses its first field; a successful
  save focuses the new card's heading; a successful edit returns focus to the
  card's Edit button; **Go to Actions Taken** focuses the region heading; the
  first invalid field takes focus after a failed submit.
* Success and conflict messages are announced: success in a `role="status"`
  region, a conflict or failure in a `role="alert"`.
* No dialog is introduced. The only confirmation — discarding edits in **Show
  latest** — is an inline confirm that does not trap focus, closes with Escape, and
  returns focus to its trigger.
* Status, priority, role, and follow-up are never colour-only: each has a text
  label (FR-31).
* Every control, including each metric card, shows a visible focus outline and is
  reachable by keyboard in reading order.

---

## 10. Responsive summary

| Breakpoint | Rules |
| :--- | :--- |
| Desktop ≥ 992 px | four-card dashboard rows, staff lists side by side, 180 px label column in Action Taken cards, two-column Ticket Detail as Lab 3 |
| Tablet 768–991 px | two-by-two cards, stacked lists, single-column Ticket Detail |
| Mobile < 768 px | one card per row, stacked full-width buttons with the primary on top, hamburger navigation, 16 px gutters |

No horizontal page scroll at any width, including every Lab 4 screen at 320 px
(AC-29).

---

## 11. Visual and accessibility inspection checklist

Checked at all three breakpoints on every Lab 4 screen and on the Lab 3 screens it
touches, and recorded in [`tests.md`](./tests.md) §5:

* [ ] Design consistency — only Lab 2 and Lab 3 tokens, no new colour or font size
* [ ] Role navigation shows nothing a role may not open; Dashboard is first and
      marked as the current page on `/dashboard`
* [ ] Every metric card has a label, a value, and a working "View all"; a zero
      shows as `0`
* [ ] The dashboard's drill-down lists show the number on the card they came from
* [ ] The Administrator's account counts are plain numbers with no link, and only
      **Open User Management** is a link
* [ ] Zero-data, loading, forbidden, and failure states are reachable and legible
      on both dashboards
* [ ] Actions Taken: all seven fields visible, Performed by read-only, Follow-up
      Note appears with its asterisk only for Yes, empty fields omitted
* [ ] Exactly one entry carries **Latest recorded**, also when it is not the last
      card, and a date edit that re-sorts a card is announced
* [ ] Editable and read-only fields are visibly different, and read-only is
      different from disabled (Requester view, a resolved Ticket)
* [ ] The Requester Ticket Detail shows Actions Taken and Status History with no
      create, edit, or status control
* [ ] The status control offers only reachable moves and explains each blocked one
* [ ] Status History is in order, spelled out, and starts with "Ticket created"
* [ ] Validation messages sit beneath their own field
* [ ] Conflict, gate, and not-active messages are distinct from a generic failure
* [ ] The Owner label tells Inactive from No longer IT Staff
* [ ] Keyboard: every control reachable, visible focus everywhere, focus moves to
      the right place after create, edit, and **Go to Actions Taken**
* [ ] Status, priority, role, and follow-up are readable with colour removed
* [ ] No clipping, no overlap, no horizontal overflow at 320 px
* [ ] No console error, placeholder text, obsolete control, or broken link

---

## 12. Screenshot paths

Captured at Desktop 1440×900, Tablet 820×1180, Mobile 390×844, under
`artifacts/lab-04/screenshots/` (labsheet §12). Each file is
`<shot>-<desktop|tablet|mobile>.png`.

| Folder | Shots |
| :--- | :--- |
| `requester-dashboard/` | populated, zero-data, loading, failure, drill-down result, mobile layout |
| `staff-dashboard/` | IT Staff populated, IT Staff zero-data, Administrator with accounts, loading, failure, forbidden, drill-down result |
| `actions-taken/` | list with several actions, empty state, create form, follow-up note required, validation errors, edit mode, conflict, ticket-not-active, Requester read-only view |
| `ticket-workflow/` | status control with a blocked move, gate refusal, success, status history, stale-update conflict, Administrator on Ticket Detail |
| `regression/` | one screenshot each of the Lab 2 and Lab 3 screens, after Lab 4 (Part 8) |

---

## 13. Traceability

| Section | Requirements | Rules | Criteria |
| :--- | :--- | :--- | :--- |
| §1 Vocabulary (§1.1 – §1.6) | FR-26, FR-31, FR-33 | BR-39, BR-40, BR-55 | AC-28, AC-30, AC-33 |
| §2 Shell | FR-22 – FR-24 | BR-42, BR-43 | AC-17, AC-34 |
| §3 Dashboards | FR-15 – FR-20 | BR-30 – BR-41 | AC-02, AC-18 – AC-22 |
| §4 Actions Taken | FR-01 – FR-08 | BR-01 – BR-14, BR-27, BR-28 | AC-01, AC-04 – AC-10 |
| §5 Workflow controls | FR-09 – FR-14 | BR-15 – BR-26 | AC-03, AC-11 – AC-16 |
| §6 Requester view | FR-04, FR-13 | BR-13, BR-23, BR-44 | AC-08, AC-13 |
| §7 Drill-down | FR-18, FR-21 | BR-31, BR-40 | AC-21 |
| §8 – §11 | FR-26 – FR-32 | BR-53, BR-54 | AC-27 – AC-31 |
