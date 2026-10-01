# Lab 3 — Zen Green UI Specification

Companion to [`specification.md`](./specification.md). This extends Lab 2's visual
contract (`docs/lab-02/ui-spec.md`); it does **not** replace it.

**Everything in Lab 2's ui-spec still applies unchanged**: colour tokens,
typography, the 4 px spacing scale, control states, labels and the red asterisk,
validation placement beneath the field, the five button variants, the five shared
states, shadows, and the 1120 px centred content width. No Lab 3 screen
introduces a new colour, a new font size, or a second visual system (FR-46).

Lab 3 adds four things to the shared vocabulary — a **Role badge**, an **Owner
presentation**, the seven further **status badges** Lab 2 never needed, and an
**internal region** type — across six screens, five of them new and one an
extension of a Lab 2 screen.

An Administrator has no ticket screen in Lab 3: their navigation is User
Management alone, so the comment and note permissions BR-04 grants them are
reachable through the API only (D-23).

---

## 1. Additions to the shared vocabulary

### 1.1 Role badge

| Role | Presentation |
| :--- | :--- |
| Requester | Pill, `--tt-readonly-bg` background, `--tt-text` text |
| IT Staff | Pill, `--tt-green-pale` background, `--tt-green-primary` text |
| Administrator | Pill, `--tt-green-primary` background, white text |

Uppercase 12 px, same pill geometry as Lab 2's priority and status badges. The
role is always spelled out; the shade is never the only signal.

### 1.2 Owner presentation

| Case | Presentation |
| :--- | :--- |
| Assigned, active | Owner's name as plain text |
| Assigned, inactive account | Owner's name plus a grey outlined "Inactive" pill (BR-26) |
| Unassigned | The word **Unassigned** in `--tt-text-muted` italic, never an empty cell (FR-28) |
| Assigned to the signed-in IT Staff member | Name plus a `--tt-green-pale` "You" pill |

### 1.3 Status badge, extended

Lab 2 defined only `NEW`. The eight statuses keep one pill geometry:

| Status | Background / text |
| :--- | :--- |
| `NEW` | `--tt-green-pale` / `--tt-green-primary` |
| `OPEN`, `IN_PROGRESS` | `--tt-surface` with a 1 px `--tt-green-secondary` border / `--tt-green-secondary` |
| `WAITING_FOR_REQUESTER` | `--tt-warning-bg` / `--tt-warning` |
| `RESOLVED`, `CLOSED` | `--tt-success-bg` / `--tt-success` |
| `REOPENED` | `--tt-error-bg` / `--tt-error` |
| `CANCELLED` | `--tt-disabled-bg` / `--tt-text-muted` |

Labels render in title case with spaces: "Waiting for Requester", not
`WAITING_FOR_REQUESTER`.

### 1.4 Internal region

A new region type for content a Requester must never see:

* `--tt-readonly-bg` background with a 1 px dashed `--tt-border` left edge
* A lock icon plus the caption **"Internal — not visible to the Requester"**
* The caption is text, so the restriction survives greyscale printing and screen
  readers (FR-39, AC-39)

---

## 2. Application shell

Replaces Lab 2's Development Requester display (FR-13, FR-14).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TokTickIT     Ticket Queue                    Wirachat T.  [IT STAFF]   │  ← --tt-green-primary
│                ▔▔▔▔▔▔▔▔▔▔▔▔                     Change Password · Logout │
└──────────────────────────────────────────────────────────────────────────┘
```

* **Identity** — the "TokTickIT" wordmark, left, linking to the role's landing
  page.
* **Navigation** — role-specific, with Lab 2's 3 px white underline and
  `aria-current="page"` on the active item:

| Role | Destinations | Landing page |
| :--- | :--- | :--- |
| Requester | My Tickets, Create Ticket | My Tickets |
| IT Staff | Ticket Queue | Ticket Queue |
| Administrator | User Management | User Management |

* **User** — name plus the Role badge, right, with **Change Password** and
  **Logout** as tertiary actions beneath.
* **Mobile (< 768 px)** — the wordmark stays; navigation, the user block, and both
  actions collapse into the hamburger menu. No horizontal page scroll (FR-15).

Header height stays 64 px desktop, 56 px mobile. A role never sees a destination
it may not open; typing that URL lands on the role's own landing page with a
forbidden callout.

---

## 3. Screen — Login

Route `/login`. No shell, like Lab 2's selection screen. One centred card,
`max-width: 420px`, on `--tt-bg-page`.

```
        ┌────────────────────────────────┐
        │ TokTickIT                      │
        │ Sign in to continue            │
        │                                │
        │ Email *                        │
        │ [____________________________] │
        │ Password *                     │
        │ [____________________________] │
        │                                │
        │ [         Sign in          ]   │  ← primary, full width
        └────────────────────────────────┘
```

| Element | Rule |
| :--- | :--- |
| Email | `type="email"`, `autocomplete="username"`, required, trimmed |
| Password | `type="password"`, `autocomplete="current-password"`, required, never trimmed |
| Submit | Primary, full width, busy label "Signing in…", disabled for the whole in-flight request (FR-01) |

### 3.1 States

| State | Presentation |
| :--- | :--- |
| Validation | Message beneath the offending field, Lab 2 placement |
| Invalid credentials | Error callout above the fields: "Email or password is incorrect." Identical for an unknown email and a wrong password (AC-04). Both fields keep their values; the password is kept so a typo can be corrected |
| Inactive account | Error callout: "This account is not active. Contact an administrator." (AC-03) |
| Too many attempts | Warning callout showing the API's message, which names the wait: "Too many sign-in attempts. Try again in 15 minutes." Both fields keep their values. Sign in stays enabled, because the server is the authority on when the lock ends; a retry inside the lock simply gets the same callout (BR-67, AC-40) |
| API failure | Error callout with a **Try again** action, no raw status code |

### 3.2 Responsive

The card is full-width minus the 16 px gutter below 768 px. Nothing else changes.

---

## 4. Screen — Change Password

Route `/change-password`. No shell when it is mandatory, so there is no navigation
to escape through (FR-03). Reachable voluntarily from the shell, where it keeps
the shell.

| Element | Rule |
| :--- | :--- |
| Context callout | On the mandatory path: "Set your own password before continuing." |
| Current password | Required, always typed, `autocomplete="current-password"`. Never pre-filled, including on the mandatory path |
| New password | Required, 8–72 characters, `autocomplete="new-password"` |
| Confirm new password | Required, must match |
| Rules text | Stated above the fields as helper text: "8–72 characters. Must not be your email address." (BR-07, D-14) |
| Submit | Primary, busy label "Saving…" |

### 4.1 States

| State | Presentation |
| :--- | :--- |
| Validation | Beneath each field: too short, too long, mismatch, same as the email, same as the current password |
| Wrong current password | Error callout, fields retained except the current-password field, which is cleared |
| Success | On the mandatory path, straight to the role's landing page. On the voluntary path, the success callout "Password updated" and the user stays on the page they chose to open |
| Blocked navigation | On the mandatory path, every other route redirects here (AC-02) |
| Logout | On the mandatory path only, a tertiary Logout under the form, for someone who signed in to an account they do not mean to finish setting up. A failed logout keeps them signed in and says so |

---

## 5. Screen — Requester Ticket Detail, extended

Lab 2's read-only detail screen plus two additions (FR-19). Everything Lab 2
specified for the ticket panel and attachment rows is unchanged.

### 5.1 Problem Appears Resolved

A bordered panel below the attachments:

```
┌──────────────────────────────────────────────┐
│ Does this look resolved to you?              │
│ Comment *                                    │
│ [__________________________________________] │
│ [ Mark as appears resolved ]                 │  ← primary
└──────────────────────────────────────────────┘
```

* The comment is required, 5–2000 characters (BR-29).
* Once set, the panel becomes a `--tt-success-bg` callout: "You marked this as
  appearing resolved on 1 Oct 2026" plus a tertiary **Undo** action (BR-30).
* The panel never shows a status control. The screen states "Only IT Staff can
  resolve or close a ticket" as helper text (BR-05).

### 5.2 Public Comments thread

A card titled **Public Comments**, newest at the bottom, each entry carrying the
author's name, their Role badge, and a timestamp. Composer at the bottom: a
textarea plus a primary **Post comment**. Empty thread shows the empty state
"No comments yet." The Requester never sees an Internal Notes region, and the
screen contains no element hinting that one exists (AC-17).

---

## 6. Screen — IT Staff Ticket Queue

Route `/queue`. The IT Staff landing page.

### 6.1 Controls

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Ticket Queue                                                             │
│ [ Search number or summary        ] [Status ▾] [IT Priority ▾]           │
│ [Category ▾] [Owner ▾]  Sort: [IT Priority ▾] [Desc ▾]   Clear Filters   │
└──────────────────────────────────────────────────────────────────────────┘
```

Owner options are **Any**, **Unassigned**, **Assigned to me**, and each active IT
Staff member or Administrator by name (D-18). Every control is labelled; the
search field has a visible label, not a placeholder standing in for one.

### 6.2 Columns

Seven columns on desktop (D-03):

| # | Column | Presentation |
| :--- | :--- | :--- |
| 1 | Ticket Number | Monospace, links to the detail screen |
| 2 | Summary | Truncated with an ellipsis at one line, full text in `title` |
| 3 | Requested Priority | Lab 2 priority badge |
| 4 | IT Priority | Lab 2 priority badge |
| 5 | Current Status | §1.3 status badge |
| 6 | Ticket Owner | §1.2 owner presentation |
| 7 | Last Updated | Relative for under 24 hours ("2 hours ago"), absolute date beyond that, exact timestamp in `title` |

Created Date and Category are deliberately **not** columns: Category is a filter
and both appear on the detail screen (D-03, labsheet §8.3). A row carrying the
Requester's "appears resolved" signal shows a small `--tt-success` check with the
text "Requester says resolved" under the summary.

### 6.3 States

| State | Presentation |
| :--- | :--- |
| Loading | Lab 2 skeleton rows |
| Empty | "No tickets in the queue yet." |
| No results | "No tickets match your filters" plus **Clear Filters** (FR-30) |
| Forbidden | Error callout "You do not have access to the ticket queue." for a role that reaches the route |
| API failure | Error callout with **Try again** |

### 6.4 Responsive

| Width | Presentation |
| :--- | :--- |
| ≥ 992 px | The seven-column table |
| 768–991 px | The same table with columns 3 and 7 moved into a second line inside the row: badges and "Last Updated" sit beneath the summary |
| < 768 px | Card list: Ticket Number and Status on the first line, Summary on the second, both priorities and the owner on the third, Last Updated on the fourth. Filters collapse behind a **Filters** toggle. No horizontal scroll (FR-27) |

---

## 7. Screen — IT Staff Ticket Detail

Route `/queue/:id`. Four regions, in this order (FR-31).

```
┌─ What the Requester submitted ──────────────── read-only ─┐
│ TT-2026-00042 · 28 Sep 2026 · Pornchai Thana [REQUESTER]  │
│ Category: Hardware      Related System: Campus Printers   │
│ Requested Priority: [MEDIUM]   ← never editable           │
│ Summary / Description                                     │
└───────────────────────────────────────────────────────────┘
┌─ Operational ───────────────────────────────── editable ──┐
│ Ticket Owner: [ Wirachat T. ▾ ]  [ Claim ] / [ Reassign ] │
│ IT Priority:  [ HIGH ▾ ]                                  │
│ Status: [IN PROGRESS]  Move to: [ Resolved ▾ ] [ Apply ]  │
└───────────────────────────────────────────────────────────┘
┌─ Attachments ──────────────── Lab 2 rows, unchanged ──────┐
┌─ Public Comments ─────────────────────────────────────────┐
┌─ Internal Notes ──────────── §1.4 internal region ────────┐
```

| Control | Rule |
| :--- | :--- |
| Claim | Shown only when the ticket is unassigned. Confirmation copy states that claiming also moves a `NEW` ticket to Open (BR-34) |
| Reassign | A picker of active IT Staff and Administrators, plus **Unassign** |
| IT Priority | A select; Requested Priority sits directly above it, read-only, so the two are compared at a glance (BR-28) |
| Status | The "Move to" select is populated **only** from `permittedTransitions` returned by the API, never from the full enum (FR-34) |
| Reason | Choosing Resolved, Cancelled, or Reopened reveals a required reason textarea, 5–2000 characters, before Apply is enabled. The helper text says the reason is posted as a Public Comment (BR-36, FR-35) |

### 7.1 The two threads

Public Comments use the same card as §5.2. Internal Notes use the §1.4 internal
region: dashed left edge, `--tt-readonly-bg`, lock icon, and the caption
"Internal — not visible to the Requester". The two composers are never adjacent;
the Public Comments composer ends well above the Internal Notes heading, and the
Internal Notes composer's button reads **Add internal note** while the public one
reads **Post comment**, so the two buttons never read alike (AC-39).

### 7.2 States

Loading, forbidden, not found, API failure, plus a per-action busy state: the
control being used shows the busy style while its own request is in flight and the
other controls are disabled, so two operations cannot overlap (FR-37).

### 7.3 Responsive

Two columns at ≥ 992 px (submitted left, operational right), stacked single column
below that, with the operational region first on mobile because it is why IT Staff
opened the screen. Both threads are always full width.

---

## 8. Screen — Administrator User Management

Route `/users`. The Administrator landing page. Deliberately one screen
(labsheet §8.5).

### 8.1 List

```
┌──────────────────────────────────────────────────────────────────┐
│ User Management                              [ + Create user ]   │
│ [ Search name or email        ]  [ Role: Any ▾ ]                 │
├──────────────┬────────────────────────┬───────────────┬──────────┤
│ Name         │ Email                  │ Role          │ Status   │
├──────────────┼────────────────────────┼───────────────┼──────────┤
│ Pornchai T.  │ pornchai@…             │ [REQUESTER]   │ Active   │ Edit
│ Wirachat T.  │ wirachat@…             │ [IT STAFF]    │ Active   │ Edit
└──────────────┴────────────────────────┴───────────────┴──────────┘
```

Four columns plus Edit (FR-38). No pagination control and no sortable headers —
both are excluded by the labsheet. Status renders as "Active" or "Inactive" text
with a pill, never a bare colour dot. Default order is name ascending.

### 8.2 Create and edit panel

One panel used for both, titled "Create user" or "Edit user":

| Field | Create | Edit |
| :--- | :--- | :--- |
| Full name | required | required |
| Email | required, unique | required, unique |
| Role | required, one of three, radio buttons so "one role" is visible in the control itself (BR-17) | same |
| Active | toggle, defaults on | toggle |
| Initial password | required, 8–72 characters, with helper text "The user must change this at their next sign-in" | absent — issued through §8.3 instead |

Radio buttons rather than a multi-select make the single-role rule structural: the
screen cannot express two roles.

### 8.3 Set new initial password

A secondary action inside the edit panel, opening a small confirmation with one
password field. Confirmation copy: "This signs the user out everywhere and
requires a password change at their next sign-in." (BR-47, AC-34)

### 8.4 Safety rules in the UI

| Rule | Presentation |
| :--- | :--- |
| Own account | The Active toggle and the Role control are disabled on the Administrator's own row, with helper text "You cannot change your own role or deactivate yourself." (BR-48) |
| Last Administrator | If the change would leave none, the server refuses and the panel shows the error callout "At least one active Administrator is required." (BR-49) |
| No delete | No delete control exists anywhere on the screen (BR-50) |

Both rules are enforced by the API regardless of the disabled controls (FR-44) —
the disabled state is feedback, not the boundary.

### 8.5 States

Loading skeleton rows, empty ("No users match this search"), no-results with
**Clear search**, forbidden for a non-Administrator reaching the route, validation
beneath each field, success callout after create, edit, and password issue, and an
API-failure callout with **Try again**.

### 8.6 Responsive

Table at ≥ 768 px; card list below, each card showing name, email, both pills, and
Edit. The create/edit panel is a right-hand drawer at ≥ 992 px and a full-screen
sheet below that.

---

## 9. Required screen modes and feedback

Per labsheet §8.6, each screen declares its modes, and every state below is
covered by a test:

| Screen | Modes | Required feedback |
| :--- | :--- | :--- |
| Login | view | validation, busy, invalid credentials, inactive, API failure |
| Change Password | edit | validation, busy, wrong current password, success |
| My Tickets (Lab 2) | view | loading, empty, no-results, API failure |
| Create Ticket (Lab 2) | create | validation, busy, success, API failure |
| Requester Ticket Detail | view + comment + appears-resolved | loading, not found, validation, busy, success, API failure |
| IT Staff Queue | view | loading, empty, no-results, forbidden, API failure |
| IT Staff Ticket Detail | view + edit per control | loading, not found, forbidden, validation, per-action busy, success, conflict, API failure |
| User Management | view + create + edit | loading, empty, no-results, forbidden, validation, busy, success, conflict, API failure |

A conflict is always shown as its own message, never as a generic failure: "This
ticket was claimed by someone else", "That status change is not allowed from
Resolved", "Another user already has that email."

---

## 10. Accessibility

Lab 2's rules carry over in full. Lab 3 adds:

* The mandatory Change Password redirect moves focus to the page heading and
  announces the reason, so a screen-reader user is not silently relocated.
* Every status, priority, and role badge has text; nothing is colour-only.
* The Internal Notes region is a `<section>` with an `aria-label` repeating
  "Internal, not visible to the Requester", so the restriction is announced and
  not merely drawn.
* The queue table uses real `<th scope="col">` headers; the mobile card list uses
  a definition list per card rather than a table forced into one column.
* Each row's open action is a real link to `/queue/:id`, so it works with keyboard
  and middle-click.
* Focus never leaves a visible outline, including on the queue filter controls.

---

## 11. Responsive summary

| Breakpoint | Rules |
| :--- | :--- |
| Desktop ≥ 992 px | Full tables, two-column ticket detail, drawer panel, 24 px gutters |
| Tablet 768–991 px | Queue table with wrapped secondary line, single-column detail, full-screen panel |
| Mobile < 768 px | Card lists, hamburger navigation, stacked full-width buttons with the primary on top, 16 px gutters |

No horizontal page scroll at any width, including the queue at 320 px (AC-37).

---

## 12. Visual inspection checklist

Checked at all three breakpoints on every new screen and recorded in
[`tests.md`](./tests.md) §4:

* [ ] Design consistency — only Lab 2 tokens, no new colour or font size
* [ ] Role-specific navigation shows nothing a role may not open
* [ ] Active-page indication present and not colour-only
* [ ] Status, Requested Priority, IT Priority, and Role badges correct and spelled out
* [ ] Unassigned renders as the word, never an empty cell
* [ ] Read-only fields visibly distinct from editable ones, and from disabled ones
* [ ] Requested Priority never editable anywhere
* [ ] Validation messages beneath their own field
* [ ] Internal Notes region visually distinct and labelled, with its own button wording
* [ ] No Requester-facing screen hints that Internal Notes exist
* [ ] Focus outline visible on every interactive element
* [ ] No clipping, no overlap, no horizontal overflow
* [ ] Busy states disable their control and block double submission
* [ ] Every empty, no-results, forbidden, and failure state reachable and legible

---

## 13. Screenshot paths

Captured at Desktop 1440×900, Tablet 820×1180, Mobile 390×844, under
`artifacts/lab-03/screenshots/` (labsheet §12):

| Folder | Shots |
| :--- | :--- |
| `authentication/` | login empty, validation, invalid credentials, inactive account, mandatory change password, shell with user and role, after logout |
| `staff-queue/` | populated queue, search, filters applied, no-results, empty, forbidden, mobile card list |
| `staff-ticket-detail/` | unassigned with Claim, owned with transitions, reason required, public comment posted, internal note posted, forbidden |
| `user-management/` | list, search, role filter, create panel, duplicate email error, edit with own account restricted, last-Administrator refusal, new initial password confirmation |

---

## 14. Traceability

| Section | Requirements | Rules | Criteria |
| :--- | :--- | :--- | :--- |
| §2 Shell | FR-13 – FR-15 | BR-17, BR-18 | AC-09, AC-37 |
| §3 Login | FR-01, FR-02 | BR-01, BR-08, BR-16 | AC-01, AC-03, AC-04 |
| §4 Change Password | FR-03, FR-04 | BR-02, BR-07, BR-15 | AC-02, AC-06 |
| §5 Requester detail | FR-19, FR-25 | BR-05, BR-29, BR-30 | AC-15, AC-17 |
| §6 Queue | FR-26 – FR-30 | BR-53 – BR-59 | AC-20, AC-21 |
| §7 Staff detail | FR-31 – FR-37 | BR-24 – BR-38 | AC-22 – AC-27, AC-39 |
| §8 User Management | FR-38 – FR-45 | BR-45 – BR-52 | AC-28 – AC-34 |
| §9 – §12 | FR-46, FR-47 | — | AC-37, AC-38 |
