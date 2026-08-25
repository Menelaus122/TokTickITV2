# Lab 2 — Zen Green UI Specification

Companion to [`specification.md`](./specification.md). This is the visual
contract for Lab 2 and the house style that later sprints reuse rather than
replace. Where a screen's behavior is described here, the implementation must
match it or the deviation must be recorded in `specification.md` §11.

Stack: React 18 + Vite, Bootstrap 5 for layout primitives only. All Zen Green
colour, spacing, and state styling comes from the tokens below — no screen
hard-codes a hex value (D-10).

---

## 1. Colour tokens

Declared once as CSS custom properties on `:root` and consumed by every
component.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--tt-green-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--tt-green-secondary` | `#0B7A46` | Active tab/nav indicator, focus accent, links, hover |
| `--tt-green-pale` | `#EAF6EF` | Selected rows, success backgrounds, subtle section emphasis |
| `--tt-bg-page` | `#F5F7F6` | Page background |
| `--tt-surface` | `#FFFFFF` | Cards, panels, table surface |
| `--tt-border` | `#D8E0DB` | Card borders, table rules, input borders |
| `--tt-text` | `#1C2B24` | Body text — dark charcoal-green, never pure black |
| `--tt-text-muted` | `#5B6B63` | Helper text, metadata, placeholders |
| `--tt-readonly-bg` | `#EDF1EE` | Read-only field background |
| `--tt-error` | `#A4161A` | Error text, invalid borders |
| `--tt-error-bg` | `#FBE9E9` | Error callout background |
| `--tt-warning` | `#B26A00` | Warning text |
| `--tt-warning-bg` | `#FDF3E2` | Warning callout background |
| `--tt-success` | `#1B7A4B` | Success text |
| `--tt-success-bg` | `#E8F5EE` | Success callout background |
| `--tt-disabled-bg` | `#EFF1F0` | Disabled control background |
| `--tt-disabled-text` | `#9AA5A0` | Disabled control text |

**Rules.** Warning colour is reserved for genuine warnings and is never
decoration. No status, priority, or validation outcome is communicated by
colour alone — every one carries text or an icon as well.

Shadows are restrained: cards use `0 1px 2px rgba(28, 43, 36, .06)`; nothing on
a Lab 2 screen uses a heavier elevation.

---

## 2. Typography and spacing

| Element | Rule |
| :--- | :--- |
| Font stack | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Body | 16 px / 1.5 |
| Page title (`h1`) | 28 px, 600 |
| Section heading (`h2`) | 20 px, 600 |
| Field label | 14 px, 600, `--tt-text` |
| Helper / metadata | 13 px, `--tt-text-muted` |
| Validation message | 13 px, `--tt-error` |

Spacing uses a 4 px scale: `4, 8, 12, 16, 24, 32, 48`.

| Gap | Value |
| :--- | :--- |
| Label → control | 4 px |
| Control → validation message | 4 px |
| Between form fields | 16 px |
| Between form sections | 24 px |
| Card padding | 24 px desktop, 16 px mobile |
| Page gutter | 24 px desktop, 16 px mobile |

Content is centred with `max-width: 1120px` on desktop.

---

## 3. Control states

| State | Presentation |
| :--- | :--- |
| **Editable** | `--tt-surface` background, 1 px `--tt-border`, 6 px radius, 40 px height |
| **Read-only** | `--tt-readonly-bg` background, same border and height, `--tt-text` text (readable, not greyed out), `readonly`/`aria-readonly`, no focus ring change |
| **Invalid** | 1 px `--tt-error` border, message immediately beneath the field, `aria-invalid="true"`, `aria-describedby` pointing at the message |
| **Disabled** | `--tt-disabled-bg` background, `--tt-disabled-text` text, `not-allowed` cursor, not focusable, cannot be activated |
| **Focused** | 2 px `--tt-green-secondary` outline with 2 px offset — always visible, never removed for mouse users |

**Read-only vs disabled** are visually and semantically different: a read-only
field shows a real value the Requester should read (Ticket Number, Ticket Date,
Requester); a disabled control is an action that is currently unavailable.

All inputs share one 40 px height. The Description textarea is taller (6 rows,
~150 px) and vertically resizable only — horizontal resize is disabled so it
cannot break the layout.

### 3.1 Labels and required marker

* Labels sit **above** their control, left-aligned, consistent weight and
  spacing, and are programmatically associated (`<label for>`).
* A required field shows a red asterisk after the label text, marked
  `aria-hidden="true"` with the requirement also conveyed by the `required`
  attribute.
* **The asterisk never replaces the validation message.** A field that fails
  validation shows both.

### 3.2 Validation placement

Messages appear directly beneath their own field (FR-11) — never only as one
summary at the top. A form-level summary may appear **in addition** when a
submission fails, and its entries link to the offending fields.

---

## 4. Buttons

| Variant | Style | Used for |
| :--- | :--- | :--- |
| **Primary** | Solid `--tt-green-primary`, white text | Submit Ticket, Continue |
| **Secondary** | White, 1 px `--tt-green-primary` border, green text | Cancel, Back to My Tickets |
| **Tertiary** | Text-only, `--tt-green-secondary`, underline on hover | Clear Filters, Change Requester |
| **Destructive** | White, 1 px `--tt-error` border, `--tt-error` text; solid `--tt-error` in the confirmation dialog | Remove Attachment |
| **Disabled** | `--tt-disabled-bg` / `--tt-disabled-text`, no hover | Any unavailable action |
| **Busy** | Disabled appearance plus a spinner and changed label ("Submitting…") | In-flight submission |

Rules:

* Every button shows visible text. Icons may support text but never replace it.
* Every icon-only control (attachment download, attachment remove) carries an
  `aria-label` **and** a tooltip.
* The Submit button is busy and disabled for the whole in-flight request
  (FR-16, BR-30) and returns to its normal state on success or failure.
* Exactly one primary button per screen.
* Button order: primary right, secondary left of it, on desktop; full-width
  stacked with primary on top on mobile.

---

## 5. Badges

| Badge | Values | Presentation |
| :--- | :--- | :--- |
| Requested Priority | LOW, MEDIUM, HIGH, URGENT | Pill, uppercase 12 px. LOW neutral grey; MEDIUM `--tt-green-pale` on green text; HIGH `--tt-warning-bg` on `--tt-warning`; URGENT `--tt-error-bg` on `--tt-error` with a bold border |
| Current Status | NEW | Pill, `--tt-green-pale` background, `--tt-green-primary` text |
| Attachment | Active / Removed | Removed renders as a grey outlined pill with the text "Removed" |

Every badge spells its value out; colour is never the only signal. Badge
styling is identical everywhere it appears — list, cards, and detail.

---

## 6. Shared states

Every data-driven region defines all five:

| State | Presentation |
| :--- | :--- |
| **Loading** | Skeleton rows for lists, a spinner with "Loading…" for panels. Never a blank screen |
| **Empty** | Centred icon, headline, one line of guidance, and the primary next action (e.g. "Create your first ticket") |
| **No results** | Centred headline "No tickets match your filters", supporting line, and a **Clear Filters** tertiary action — visually distinct from Empty (BR-44) |
| **Error** | `--tt-error-bg` callout, `--tt-error` border, plain-language message, a **Try again** action. Never a stack trace or raw status code (FR-33) |
| **Success** | `--tt-success-bg` callout with `--tt-success` text and a check icon; text carries the meaning without the colour |

---

## 7. Application shell

Present on every screen after a Requester is selected.

```
┌──────────────────────────────────────────────────────────────────────┐
│  TokTickIT        My Tickets  |  Create Ticket        Pornchai Thana │  ← --tt-green-primary
│                   ▔▔▔▔▔▔▔▔▔▔                          Change Requester│
└──────────────────────────────────────────────────────────────────────┘
```

* **Identity** — "TokTickIT" wordmark, left, links to My Tickets.
* **Navigation** — My Tickets and Create Ticket. The active page is marked by a
  3 px `#FFFFFF` underline **and** `aria-current="page"`, so the indication is
  not colour-only (FR-08).
* **Requester** — the current Development Requester's name, right, with a
  **Change Requester** tertiary action beneath or beside it (FR-03).
* **Mobile (< 768 px)** — the wordmark stays; navigation collapses into a
  hamburger toggle that opens a stacked menu; the Requester name moves into
  that menu with Change Requester below it. No horizontal page scroll (FR-09).

Header height: 64 px desktop, 56 px mobile.

---

## 8. Screen — Development Requester Selection

Route `/select-requester`. Shown when no Requester is selected (FR-05). This
screen has **no** application shell — it precedes the app.

```
                ┌────────────────────────────────────┐
                │            TokTickIT               │
                │                                    │
                │  Select a Development Requester to │
                │  test requester-specific ticket    │
                │  behavior. This is not a login     │
                │  screen. Authentication and role-  │
                │  based access will be introduced   │
                │  in Lab 3.                         │
                │                                    │
                │  Development Requester *           │
                │  ┌──────────────────────────────┐  │
                │  │ Choose a requester…       ▾  │  │
                │  └──────────────────────────────┘  │
                │                                    │
                │            [   Continue   ]        │
                └────────────────────────────────────┘
```

| Element | Rule |
| :--- | :--- |
| Card | White surface, 440 px max width, centred vertically and horizontally on `--tt-bg-page` |
| Title | "TokTickIT", 28 px, `--tt-green-primary` |
| Explanation | The exact suggested text above, in `--tt-text-muted`, rendered as a `--tt-warning-bg` callout so it reads as a caveat, not a tagline |
| Dropdown | Native `<select>`, labelled, keyboard-operable, options = active Requesters `fullName — department` (BR-09) |
| Continue | Primary, full card width, **disabled until a Requester is chosen** |
| Loading | Skeleton over the dropdown, Continue disabled |
| Empty | Replaces the dropdown with "No active Development Requesters found. Run the database seed and reload." Continue stays disabled (BR-13, AC-06) |
| API failure | Error callout with a safe message and **Try again**; no dropdown is rendered (AC-05) |

After Continue: the selection is stored (BR-10) and the user lands on My
Tickets with the shell showing their name (FR-02, FR-03).

---

## 9. Screen — Create Ticket

Route `/tickets/new`.

```
My Tickets  ▸  Create Ticket

┌─ Ticket information ─────────────────────────────────────────────┐
│  Ticket Number            Ticket Date           Requester        │
│  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐ │
│  │ (generated)  │ read-only│ (on submit)  │ read-only│ Pornchai T. │ read-only
│  └──────────────┘         └──────────────┘      └──────────────┘ │
├─ Classification ─────────────────────────────────────────────────┤
│  Category *               Related System *      Requested Priority *
│  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐ │
│  └──────────────┘         └──────────────┘      └──────────────┘ │
├─ Problem ────────────────────────────────────────────────────────┤
│  Ticket Summary *                                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  └─────────────────────────────────────────────────────────────┘ │
│  Description *                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  0 / 4000                                                        │
├─ Attachments ────────────────────────────────────────────────────┤
│  [ Choose files ]  JPG, PNG, WEBP, PDF · max 5 MB each · up to 5 │
│  • battery-report.pdf   180 KB              ✕                    │
│  • virus.exe            Unsupported file type   (error row)      │
├──────────────────────────────────────────────────────────────────┤
│                                    [ Cancel ]  [ Submit Ticket ] │
└──────────────────────────────────────────────────────────────────┘
```

| Group | Fields | Notes |
| :--- | :--- | :--- |
| Ticket information | Ticket Number, Ticket Date, Requester | All **read-only**, `--tt-readonly-bg`, at the top so the system-owned values are obviously not editable. Ticket Number and Ticket Date read "Generated on submit" before creation (FR-10) |
| Classification | Category, Related System, Requested Priority | Three equal columns on desktop; options loaded from the API, never hard-coded (FR-07). Priority renders its badge colours in the option list |
| Problem | Ticket Summary, Description | Full width. Summary single-line; Description 6 rows with a live `n / 4000` counter that turns `--tt-error` past the limit |
| Attachments | File picker + selected-file list | Each row shows filename, size, and a remove ✕. A rejected file stays in the list as an error row with its reason and is not uploaded (FR-15, AC-13) |
| Actions | Cancel (secondary), Submit Ticket (primary) | Bottom right desktop, stacked full width on mobile |

### 9.1 States

| State | Presentation |
| :--- | :--- |
| Initial | Empty editable fields, read-only placeholders, Submit enabled |
| Loading reference data | Category and Related System show a skeleton and are disabled until loaded |
| Validation failure | Message beneath each offending field, first invalid field focused, form-level summary callout above the actions, **no API call** (AC-09) |
| Submitting | Submit shows the spinner and "Submitting…", disabled; all inputs disabled (FR-16) |
| Success | Full-width success callout: "Ticket **TT-2026-00042** created." plus **View ticket** (primary) and **Create another** (secondary). The form is cleared only in this state (FR-14, BR-31) |
| API failure | Error callout above the actions with a safe message and **Try again**; **every entered value and the attachment list are retained** (FR-17, AC-12) |
| Attachment partial failure | Ticket success callout plus a warning callout listing which files failed and a **Retry on the ticket** link to the detail screen (FR-31, BR-42) |

### 9.2 Responsive

| Viewport | Layout |
| :--- | :--- |
| ≥ 992 px | Three columns for Ticket information and Classification; Summary and Description full width |
| 768–991 px | Two columns for those groups; Summary and Description full width |
| < 768 px | Every field stacked full width; actions stacked full width, primary on top |

---

## 10. Screen — My Tickets

Route `/tickets`.

```
My Tickets                                        [ + Create Ticket ]

┌──────────────────────────────────────────────────────────────────┐
│ 🔍 Search number or summary   Category ▾  System ▾  Priority ▾   │
│ Status ▾   Sort: Newest first ▾               Clear Filters      │
└──────────────────────────────────────────────────────────────────┘

┌───────────────┬──────────────────────┬──────────┬──────────┬─────────┬──────────────┐
│ Ticket Number │ Summary              │ Category │ Priority │ Status  │ Last Updated │
├───────────────┼──────────────────────┼──────────┼──────────┼─────────┼──────────────┤
│ TT-2026-00042 │ Laptop battery dra…  │ Hardware │ [MEDIUM] │ [NEW]   │ 25 Aug 2026  │
└───────────────┴──────────────────────┴──────────┴──────────┴─────────┴──────────────┘

                        ‹ Prev   1  2  3   Next ›     Showing 1–10 of 25
```

### 10.1 Columns

| Column | Why it earns its place |
| :--- | :--- |
| Ticket Number | The official identifier the Requester quotes to IT |
| Summary | The only field that says what the ticket is about; truncated with an ellipsis and a `title` tooltip |
| Category | Cheapest way to scan a mixed list |
| Requested Priority | Badge; how urgent the Requester said it was |
| Current Status | Badge; the answer to "has anything happened yet" |
| Last Updated | Sortable, and the signal that something changed |

Description is deliberately excluded — it can be 4000 characters. Related
System is excluded from the desktop table to keep six columns readable, but it
is available as a filter and appears on the mobile card and the detail screen.

The whole row is a link to the ticket detail, with a visible focus ring and
keyboard activation.

### 10.2 Controls

| Control | Behavior |
| :--- | :--- |
| Search | One text input, placeholder "Search ticket number or summary", debounced 300 ms, resets to page 1 |
| Filters | Category, Related System, Requested Priority, Status — each a labelled select defaulting to "All" |
| Sort | Single select: Newest first (default), Oldest first, Recently updated, Least recently updated |
| Clear Filters | Tertiary, visible only when at least one filter or the search is active |
| Pagination | Prev / numbered pages / Next, plus "Showing *x*–*y* of *n*"; page size select (10 / 20 / 50) beside it |
| Create Ticket | Primary, top right |

### 10.3 States

| State | Presentation |
| :--- | :--- |
| Loading | Five skeleton rows; filters remain interactive |
| Empty | "You have no tickets yet." + "Create your first ticket to get started." + **Create Ticket** primary (BR-44) |
| No results | "No tickets match your filters." + "Try a different search or clear your filters." + **Clear Filters** tertiary (AC-17) |
| Error | Error callout replacing the table, with **Try again** |
| Requester switched | Table returns to loading, then renders the new Requester's data; none of the previous Requester's rows survive the transition (BR-11, AC-04) |

### 10.4 Responsive

| Viewport | Layout |
| :--- | :--- |
| ≥ 992 px | Full six-column table; filter bar on one row |
| 768–991 px | Table keeps Ticket Number, Summary, Priority, Status; Category and Last Updated move under the summary as metadata. Filters wrap to two rows |
| < 768 px | **Cards, not a table.** Each card: Ticket Number and Status on line 1, Summary on line 2, Category · Related System · Priority as metadata on line 3, Last Updated on line 4. Filters collapse behind a "Filters" toggle; pagination becomes Prev / "Page 2 of 3" / Next (AC-28) |

The table never scrolls the page horizontally; below 992 px it degrades as
described instead (AC-26).

---

## 11. Screen — Requester Ticket Detail

Route `/tickets/:id`. Everything about the Ticket is read-only (FR-25).

```
‹ Back to My Tickets

TT-2026-00042                                       [NEW]  [MEDIUM]

┌─ Ticket information ─────────────────────────────────────────────┐
│  Ticket Date      25 Aug 2026, 09:14                             │
│  Requester        Pornchai Thana                                 │
│  Category         Hardware          Related System  Corporate Laptop
│  Requested Priority  [MEDIUM]       Current Status  [NEW]        │
│                                                                  │
│  Summary                                                         │
│  Laptop battery drains within 30 minutes                         │
│                                                                  │
│  Description                                                     │
│  Since Monday the corporate laptop battery falls from 100% …     │
└──────────────────────────────────────────────────────────────────┘

┌─ Attachments (2 of 5 active) ──────────────── [ + Add attachment ]┐
│  📄 battery-report.pdf   180 KB · 25 Aug 09:20    [↓]  [Remove]   │
│  🖼 screenshot.png       393 KB · 25 Aug 09:21    [Removed]       │
│      Removed 25 Aug 10:02 — "Uploaded the wrong screenshot"       │
└──────────────────────────────────────────────────────────────────┘
```

| Region | Rule |
| :--- | :--- |
| Back | Tertiary "‹ Back to My Tickets", top left |
| Header | Ticket Number as the page title with Status and Priority badges beside it |
| Ticket information | Read-only definition-list styling on `--tt-readonly-bg` panels. **No input controls at all** — not disabled inputs, plain text (AC-20) |
| Summary / Description | Full width, preserved line breaks, no truncation |
| Attachments | Its own card, clearly separated from ticket information so read-only data and available actions are never confused |

### 11.1 Attachment rows

| Attachment state | Presentation |
| :--- | :--- |
| **Active** | Type icon, original filename, size, upload time, a download icon button and a **Remove** destructive button. Both icon buttons carry `aria-label` and tooltip |
| **Uploading** | Row with a progress indicator and a disabled Remove |
| **Invalid** (rejected before upload) | Error-styled row naming the file and the reason (unsupported type / over 5 MB); disappears on dismiss; never sent to the API |
| **Removed** | Greyed row, filename struck through, "Removed" badge, a second line "Removed *date* — *reason*", **no download and no remove control** (BR-40, AC-23) |
| **Unavailable** | If a download fails, an inline error beneath that row only; the rest of the screen is untouched |

The card header shows "*n* of 5 active". **Add attachment** is disabled with a
tooltip "Maximum 5 active attachments" once the limit is reached (BR-34).

### 11.2 Removal confirmation

A modal, because soft removal is irreversible through the UI:

* Title "Remove attachment?"
* The filename
* One line: "The file will stay on the ticket as a record but can no longer be
  downloaded."
* **Removal reason \*** — required textarea, 5–200 characters, with its
  own validation message (BR-39)
* Actions: **Cancel** (secondary) and **Remove attachment** (destructive,
  disabled until the reason is valid, busy while the request is in flight)

### 11.3 States

| State | Presentation |
| :--- | :--- |
| Loading | Skeleton for both cards |
| Not found / not owned | Full-page empty state: "Ticket not found." + "It may not exist, or it belongs to a different Requester." + **Back to My Tickets**. The two cases are indistinguishable by design (BR-16, AC-19) |
| Error | Error callout with **Try again** |
| Upload failure | Inline error on the failing row; the ticket and other attachments are unaffected |

### 11.4 Responsive

| Viewport | Layout |
| :--- | :--- |
| ≥ 992 px | Two-column field grid; attachment rows on one line |
| 768–991 px | Two-column grid; attachment metadata wraps under the filename |
| < 768 px | Single column; attachment rows become stacked blocks with full-width action buttons; filenames wrap rather than clip (AC-26) |

---

## 12. Accessibility

* Every control has a programmatically associated label; placeholders are never
  used as labels.
* Focus is visible on every interactive element (2 px `--tt-green-secondary`).
* Tab order follows visual order; the modal traps focus and restores it to the
  triggering button on close.
* `aria-invalid` and `aria-describedby` connect a field to its message.
* Live regions announce submission results and list updates.
* Status, priority, and validation always carry text, never colour alone.
* Icon-only controls carry `aria-label` and a tooltip.
* Touch targets are at least 44 × 44 px below 768 px.
* Body text meets WCAG AA contrast against its background; the token pairs above
  are chosen to satisfy this.

---

## 13. Responsive summary

| Viewport | Required behavior |
| :--- | :--- |
| Desktop ≥ 992 px | Multi-column layouts as specified; content centred at `max-width: 1120px` |
| Tablet 768–991 px | Two columns where practical; Summary and Description keep full width |
| Mobile < 768 px | Fields stack; buttons stay touch-friendly; ticket list becomes cards; no horizontal page scrolling |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, no unreadable attachment names |

---

## 14. Visual inspection checklist

Completed against the screenshots in §15 and recorded in `tests.md` §4.

**Colour and theme**
- [ ] Header uses `--tt-green-primary`; page background uses `--tt-bg-page`
- [ ] Primary buttons are `--tt-green-primary`; active nav uses `--tt-green-secondary`
- [ ] No hard-coded hex outside the token declarations
- [ ] Warning colour appears only on genuine warnings

**Fields**
- [ ] Read-only fields are visibly distinct from editable ones and still readable
- [ ] All inputs share one height; Description is taller and resizes vertically only
- [ ] Disabled controls look inert and cannot be activated
- [ ] Focus ring visible on every control via keyboard

**Validation**
- [ ] Every required field shows a red asterisk
- [ ] Every validation message sits directly beneath its own field
- [ ] The asterisk never stands in for a message

**Buttons and badges**
- [ ] One primary action per screen; every button has visible text
- [ ] Submit shows a busy state and is disabled while submitting
- [ ] Icon-only controls have an accessible label and a tooltip
- [ ] Priority and Status badges look identical in list, cards, and detail

**States**
- [ ] Loading, empty, no-results, error, and success are all reachable and distinct
- [ ] Empty and no-results use different copy and different actions

**Layout at 1280 / 900 / 375 px**
- [ ] No horizontal page scrolling
- [ ] No clipped labels or truncated attachment names without a tooltip
- [ ] No overlapping messages or controls
- [ ] Filters, pagination, and attachment controls remain usable
- [ ] Ticket list is a table ≥ 992 px and cards < 768 px

---

## 15. Screenshot paths

Captured by Playwright at 1280 × 800 (desktop), 900 × 1000 (tablet), and
375 × 812 (mobile) in Issue 9.

```text
artifacts/lab-02/screenshots/
  requester-selection/
    desktop.png  tablet.png  mobile.png
    loading.png  empty.png   api-failure.png
  create-ticket/
    desktop.png  tablet.png  mobile.png
    initial.png  validation-failure.png  submitting.png
    success.png  api-failure.png  invalid-attachment.png
  my-tickets/
    desktop.png  tablet.png  mobile.png
    loading.png  empty.png   no-results.png  error.png
    requester-a.png  requester-b.png
  ticket-detail/
    desktop.png  tablet.png  mobile.png
    attachment-active.png  attachment-removed.png
    removal-confirm.png    not-found.png
```

---

## 16. Traceability

| Section | Acceptance criteria |
| :--- | :--- |
| §7 Shell | AC-03, AC-04 |
| §8 Requester Selection | AC-01, AC-02, AC-05, AC-06 |
| §9 Create Ticket | AC-08, AC-09, AC-11, AC-12, AC-13, AC-27 |
| §10 My Tickets | AC-14, AC-17, AC-28 |
| §11 Ticket Detail | AC-20, AC-23 |
| §13–14 Responsive and checklist | AC-26, AC-27, AC-28 |
