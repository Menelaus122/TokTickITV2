# Lab 3 — Sprint Engineering Specification

**Project:** TokTickIT · **Sprint:** Lab 3 — Users, Roles, IT Staff Ticketing, and Admin Screens
**Status:** Approved before implementation — approved by @WirachatTH in [PR #46](https://github.com/Menelaus122/TokTickITV2/pull/46) on 2026-10-01 and merged into `lab3-staging` as `76b06a0`, before any implementation PR · **Owner:** Menelaus122

> This document is the engineering contract for Sprint 3. Implementation may not
> begin on a feature branch until the section covering it is approved here, and
> the coding agent may report "done" only when the Definition of Done in §10 is
> satisfied.
>
> **Numbering restarts for Lab 3.** `FR-nn`, `BR-nn`, `AC-nn`, and `D-nn` in this
> file belong to Sprint 3 and are unrelated to the identically numbered items in
> `docs/lab-02/specification.md`. A rule carried over from Lab 2 is restated here
> with its Lab 3 number and a pointer to its Lab 2 origin.

---

## 1. Sprint Goal

Replace the temporary Development Requester selector with real authentication, so
that every action in TokTickIT is performed by a known user whose role decides
what the server will do for them. Three roles arrive at once: a Requester keeps
the whole Lab 2 ticketing path but now owns it through login, IT Staff get their
first operational workflow — a shared queue, ticket ownership, IT Priority, a
status lifecycle, Public Comments and private Internal Notes — and an
Administrator gets a deliberately small User Management screen for creating
accounts, assigning one role, and activating or deactivating people. Everything
protected is protected on the server, and every Lab 2 Requester function still
works after the migration.

---

## 2. Stakeholder Request Interpretation

The stakeholder asked for five things, and one of them is a warning rather than a
feature:

1. **Real login instead of the selector.** Email and password, with anyone
   holding an initial password forced to set their own before they can use the
   app.
2. **Roles that mean something.** A Requester, an IT Staff member, and an
   Administrator see different navigation and are permitted different
   operations.
3. **A first real IT workflow.** IT Staff need to find work in a shared queue,
   take ownership of a ticket, re-prioritise it with their own IT Priority, move
   it through a status lifecycle, talk to the Requester in Public Comments, and
   keep operational detail in Internal Notes the Requester can never see.
4. **Minimal user administration.** Enough for an Administrator to run accounts:
   list, search, create, edit, one role each, activate or deactivate, and issue a
   new initial password. Deliberately not an identity-management product.
5. **The warning: hiding a control is not authorization.** Every protected
   operation is enforced server-side. A disabled button is feedback for a human,
   never a security boundary.

Lab 2's closing rule (`docs/lab-02/specification.md` BR-46) promised that
authentication would replace the `X-Requester-Id` header without changing
request shapes, response shapes, or ownership queries. This sprint keeps that
promise: the identity source changes, the Requester contract does not.

---

## 3. Scope

### 3.1 Included

| Area | Included work |
| :--- | :--- |
| Authentication | Login, logout, current-user retrieval, mandatory first-login password change, server-side sessions |
| Authorization | Role matrix, server-side guards on every protected route, ownership checks, safe error separation |
| Data migration | Lab 2 `RequesterUser` evolved into `User` with credentials and roles, existing Tickets and Attachments preserved |
| Requester regression | Lab 2 screens and APIs driven by the authenticated identity, selector removed |
| Collaboration | Public Comments (all roles), Internal Notes (IT Staff and Administrator), Requester "Problem Appears Resolved" |
| IT Staff queue | Shared queue API with search, filters, sorting, pagination, plus its responsive screen |
| IT Staff ticket detail | Ownership claim and reassign, IT Priority, permitted status transitions, attachment continuity |
| Administration | One User Management screen: list, search, optional role filter, create, edit, one-role assignment, activate/deactivate, new initial password |
| Quality | Unit, API, UI component, UI style, responsive, authorization, migration/regression, and E2E tests plus screenshot evidence |

### 3.2 Explicitly excluded

Per labsheet §4.2, the following are **out of scope for Lab 3** and must not be
implemented, not even partially:

* Email invitations, password-reset email, MFA, social login, SSO, and any email
  delivery of initial passwords.
* Self-registration — accounts exist only because an Administrator created them
  or the migration carried them over.
* Actions Taken by IT Staff, deferred to Lab 4. The rule that would block
  resolution until Actions Taken is complete is therefore deferred too.
* SLA calculation, escalation rules, notification services.
* Dashboards and KPI analytics beyond the queue's own counts.
* Multi-tenant organisations, departments, customer administration.
* Multiple roles per user, role history, account audit history.
* User deletion, bulk operations, import/export, account-recovery and unlocking
  workflows, admin-approval flows.
* Pagination, multi-column sorting, and simultaneous multi-filtering on the
  **user list** (the ticket queue does have all three).
* Production deployment or cloud infrastructure changes.

---

## 4. Functional Requirements

### 4.1 Authentication and first login

| ID | Requirement |
| :--- | :--- |
| FR-01 | The Login screen captures email and password, validates both before submission, shows a busy state while the request is in flight, and renders a safe failure message. |
| FR-02 | A successful login establishes an authenticated session and returns the user's permitted identity: id, name, email, role, and whether a password change is required. |
| FR-03 | A user whose account requires a password change is routed to the Change Password screen and cannot reach any other application screen until a valid new password is saved. |
| FR-04 | The Change Password screen captures the new password and its confirmation, states the password rules, validates them client-side, and continues into the application on success. |
| FR-05 | The API exposes the current authenticated user, so a page reload restores the session without asking for credentials again. |
| FR-06 | Logout ends the session server-side; afterwards every protected endpoint and every protected route refuses access. |
| FR-07 | An attempt to open a protected route without a session redirects to Login; an attempt to call a protected endpoint without a session returns an unauthenticated error. |
| FR-49 | Repeated failed sign-ins for one email lock that email out for a period, as BR-67 sets out, and the Login screen says how long to wait. *(Added by Issue 13, which closed a labsheet §4.4 gap found while reviewing Issue 3.)* |

### 4.2 Authorization

| ID | Requirement |
| :--- | :--- |
| FR-08 | Every protected endpoint enforces the §5.3 role matrix on the server, independently of what the client renders. |
| FR-09 | The application shell shows only the destinations the authenticated role may use; a role that types an unauthorized URL directly is refused by both the route guard and the API. |
| FR-10 | Protected endpoints distinguish unauthenticated, authenticated-but-forbidden, invalid input, missing resource, conflict, and unexpected server error, each with its own status and code. |
| FR-11 | Requester-scoped reads and writes resolve ownership from the session only; a client-supplied requester or user id in a body, query string, or header is ignored. |
| FR-12 | A request for another user's Ticket, Attachment, or Internal Note is answered identically to a request for something that does not exist. |

### 4.3 Application shell and role navigation

| ID | Requirement |
| :--- | :--- |
| FR-13 | The shell displays the authenticated user's name and role in place of Lab 2's Development Requester display, with a Logout action and a Change Password action. |
| FR-14 | Navigation is role-specific: a Requester sees My Tickets and Create Ticket; IT Staff see the Ticket Queue; an Administrator sees User Management. |
| FR-15 | The shell keeps Lab 2's active-page indication, Zen Green styling, and mobile behaviour with no horizontal page scroll. |

### 4.4 Requester regression

| ID | Requirement |
| :--- | :--- |
| FR-16 | The Development Requester Selection screen, the Change Requester action, and the persisted `toktickit.devRequesterId` client state are removed entirely. |
| FR-17 | Create Ticket, My Tickets, and Requester Ticket Detail behave exactly as specified in Lab 2, with the Requester taken from the session. |
| FR-18 | The Lab 2 ticket and attachment endpoints no longer accept `X-Requester-Id`; the header is ignored if sent. |
| FR-19 | Requester Ticket Detail gains a Public Comments thread and a **Problem Appears Resolved** action, while keeping every Lab 2 ownership protection on the ticket and its attachments. |

### 4.5 Public Comments and Internal Notes

| ID | Requirement |
| :--- | :--- |
| FR-20 | Any permitted role may post a Public Comment on a ticket they are permitted to see; the comment records its author and a backend-generated timestamp. |
| FR-21 | Public Comments are visible to the owning Requester, IT Staff, and Administrators. |
| FR-22 | IT Staff and Administrators may post and read Internal Notes; a Requester can neither read them nor learn that any exist. |
| FR-23 | Comments and Notes are append-only in Lab 3: no edit, no delete. |
| FR-24 | Empty or whitespace-only content is rejected, and content is rendered as text so markup in a comment cannot execute. |
| FR-25 | **Problem Appears Resolved** records the Requester's opinion on the ticket and posts the accompanying Public Comment; it never changes Current Status. |

### 4.6 IT Staff Ticket Queue

| ID | Requirement |
| :--- | :--- |
| FR-26 | The queue returns tickets from every Requester to IT Staff, with search, filters, sorting, and pagination. |
| FR-27 | The queue screen shows the seven columns in §6 on desktop and a card list below 768 px, with no horizontal page scroll. |
| FR-28 | Each row shows ownership plainly, including an explicit unassigned presentation, plus Status, Requested Priority, and IT Priority badges. |
| FR-29 | Each row opens the IT Staff Ticket Detail screen for that ticket. |
| FR-30 | The queue renders distinct loading, empty, no-results, forbidden, and API-failure states, and offers Clear Filters in the no-results state. |

### 4.7 IT Staff Ticket Detail

| ID | Requirement |
| :--- | :--- |
| FR-31 | The screen groups ticket information, Requester-submitted values, operational fields, attachments, Public Comments, and Internal Notes into distinct regions, and only operational fields the role may change are editable. |
| FR-32 | IT Staff may claim an unassigned ticket, and may reassign an owned ticket to another active IT Staff member or Administrator. |
| FR-33 | IT Staff may change IT Priority; Requested Priority is displayed read-only and can never be edited. |
| FR-34 | IT Staff may move the ticket only along transitions the §5.5 matrix permits, and the screen offers only those transitions. |
| FR-35 | A transition that requires a reason or confirmation collects it before the request is sent. |
| FR-36 | Lab 2 attachments remain listed, downloadable when active, and marked when removed. |
| FR-37 | Every action has validation, busy, success, forbidden, and safe-failure feedback. |

### 4.8 Administrator User Management

| ID | Requirement |
| :--- | :--- |
| FR-38 | The screen lists users with Name, Email, Role, Status, and an Edit action. |
| FR-39 | The list can be searched by name or email, and optionally filtered by one role. |
| FR-40 | An Administrator may create a user with a name, an email, exactly one role, an activation state, and an initial password. |
| FR-41 | An Administrator may edit a user's name, email, role, and activation state. |
| FR-42 | An Administrator may set a new initial password for a user, which forces that user to change it at their next login. |
| FR-43 | The screen reports duplicate emails, invalid roles, and invalid input as field-level validation. |
| FR-44 | The screen and its API refuse to let an Administrator deactivate their own account, and refuse any change that would leave zero active Administrators. |
| FR-45 | Users are never deleted; deactivation is the only removal. |

### 4.9 Cross-cutting

| ID | Requirement |
| :--- | :--- |
| FR-46 | Every screen conforms to `ui-spec.md` at desktop, tablet, and mobile breakpoints and reuses Lab 2's Zen Green components rather than introducing a second visual system. |
| FR-47 | Every error surfaced to a user is safe: no stack traces, SQL, file paths, internal ids, or password material. |
| FR-48 | No credential, session secret, or password hash ever reaches the client or the repository. |

---

## 5. Business Rules

### 5.1 Mandatory rules from the handout

| ID | Rule |
| :--- | :--- |
| BR-01 | Only an active user with valid credentials may authenticate. |
| BR-02 | A user who must change their password cannot enter the normal application until a valid new password is saved. |
| BR-03 | The authenticated identity, never a client-supplied id, decides ownership for Requester operations. |
| BR-04 | Public Comments are visible to the Requester, IT Staff, and Administrators. Internal Notes are visible only to IT Staff and Administrators. |
| BR-05 | A Requester may mark a problem as appearing resolved but may never set a ticket to Resolved or Closed. |

### 5.2 Credentials, sessions, and logout

| ID | Rule |
| :--- | :--- |
| BR-06 | Passwords are stored only as a `bcrypt` hash. No plaintext password is ever written to the database, a log, or a response. |
| BR-07 | A password must be 8–72 characters, at most 72 bytes in UTF-8, and must not equal the user's email. The byte limit is bcrypt's own input limit, made explicit so a silently truncated password is impossible: bcrypt reads 72 **bytes**, and a Thai character takes three, so a 25-character Thai password already exceeds it. Characters are counted as code points, and passwords are never trimmed. |
| BR-08 | Login verifies the password **before** considering activation state, so a wrong password and a disabled account cannot be told apart by someone guessing passwords. Only a caller who proved the password learns that the account is inactive. |
| BR-09 | A session is a server-side row. The browser receives an opaque 32-byte random token in an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `tt_sid`, marked `Secure` outside local development. |
| BR-10 | The database stores only the SHA-256 hash of the session token, so a leaked database cannot be replayed as a live session. |
| BR-11 | A session expires 8 hours after it is created. An expired session is treated exactly as no session at all. |
| BR-12 | Logout deletes the session row. The same cookie can never be used again, which is what makes logout a real invalidation rather than a client-side gesture. |
| BR-13 | Session identity is read from the cookie only. No endpoint accepts a user id, role, or session token in a body, query string, or custom header. |
| BR-14 | While `mustChangePassword` is set, the only endpoints the session may call are current-user, change-password, and logout. The public endpoints — login and the health check — also stay reachable, because they do not act through the session; logging in as someone else simply replaces it. Everything else returns a password-change-required error. |
| BR-15 | Changing a password clears `mustChangePassword` and deletes every **other** session for that user, so a stolen session cannot outlive the password it was created with. |
| BR-16 | Login failures return one generic message for both an unknown email and a wrong password, so the API never reveals which emails exist. |
| BR-65 | Every state-changing request (anything other than `GET`) that carries an `Origin` header must carry the configured client origin, or it is refused. This is the second CSRF control alongside `SameSite=Lax`, and it is needed because the attachment-upload endpoint accepts `multipart/form-data`, which a cross-site HTML form can produce (D-13). |
| BR-66 | A user whose `passwordHash` is null cannot authenticate; login answers exactly as it does for a wrong password. The migration leaves the column null until the seed fills it (BR-61), and this rule makes that intermediate state a locked door rather than an open one. |
| BR-67 | **Login attempts.** Failed sign-ins are counted per email, normalised as BR-45 does, and never per IP address. Five failures for one email within 15 minutes lock that email for 15 minutes from the fifth failure. While it is locked, every sign-in for that email, **the correct password included**, is refused with `429 TOO_MANY_ATTEMPTS` and a `Retry-After` header, and no session is created; letting the correct password through would leave guessing unlimited. An email that matches no account is counted and locked in exactly the same way, so a lock never reveals whether an account exists (BR-16). A successful sign-in clears the email's count. A malformed request (a `400` validation error) and the correct password for an inactive account are not failed guesses and are not counted. The lock expires on its own; there is no unlock action, since account unlocking is excluded from Lab 3 (§3.2). The limit holds for **concurrent** attempts too: an attempt is reserved before its password is checked, and one is refused when the email's failures plus the attempts still being checked reach five, so a burst of simultaneous guesses gets no more tries than five sequential ones. |

### 5.3 Roles and authorization

| ID | Rule |
| :--- | :--- |
| BR-17 | Every user holds exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. |
| BR-18 | The authorization matrix is the contract. Nothing outside it is permitted, and the matrix is enforced in server middleware, not in screen code: |

| Operation | Requester | IT Staff | Administrator |
| :--- | :--- | :--- | :--- |
| Create a ticket | own only | no | no |
| List own tickets, open own ticket detail | own only | no | no |
| Add, download, soft-remove attachments | own ticket only | no | no |
| Post a Public Comment | own ticket only | any ticket | any ticket |
| Read Public Comments | own ticket only | any ticket | any ticket |
| Mark "Problem Appears Resolved" | own ticket only | no | no |
| Read or post Internal Notes | **no** | any ticket | any ticket |
| Read the IT Staff queue | no | yes | **no** |
| Open IT Staff Ticket Detail | no | yes | **no** |
| Claim or reassign ownership | no | yes | **no** |
| Change IT Priority | no | yes | **no** |
| Change Current Status | no | yes | **no** |
| Be assigned as Ticket Owner | no | yes | yes |
| Manage users | no | no | yes |

| ID | Rule |
| :--- | :--- |
| BR-19 | An Administrator does **not** inherit IT Staff ticket operations. The matrix grants an Administrator only user management, comments, and notes; the labsheet permits the separation and §11 records why we chose it. Because an Administrator also has no queue, no ticket list, and no ticket screen, their comment and note permissions are reachable **through the API only** in Lab 3 (D-23). |
| BR-20 | An Administrator may still be set as a Ticket Owner (labsheet §4.5), which is an assignment made by IT Staff, not an operation the Administrator performs. |
| BR-21 | A role check failure returns **403**; a missing session returns **401**. The two are never conflated, because a client must be able to tell "log in" from "you may not". |
| BR-22 | Ownership failures are the exception: a Requester asking for someone else's ticket gets **404**, never 403, so the API never confirms that the ticket exists (carried over from Lab 2 BR-16). |
| BR-23 | A Requester calling an Internal Note endpoint gets **403** with no note content, and the count of notes is absent from every Requester-facing response. |

### 5.4 Ownership, priority, and the Requester's opinion

| ID | Rule |
| :--- | :--- |
| BR-24 | A ticket has at most one Ticket Owner. The proposed owner must be an IT Staff member or Administrator who is active **at the time of assignment**; an owner who is deactivated later stays the owner (BR-26). A ticket may be unassigned, which is how it arrives. |
| BR-25 | Claiming is only permitted on an unassigned ticket, and the claim is rejected with a conflict if another IT Staff member claimed it first. Reassignment is a separate operation on an owned ticket. |
| BR-26 | Deactivating a user does not silently unassign their tickets; the tickets keep the owner and the queue shows the owner as inactive, so work in flight is never lost by an account change. |
| BR-27 | Requested Priority is the Requester's value, set at creation, and immutable for every role. |
| BR-28 | IT Priority is copied from Requested Priority when the ticket is created, and afterwards only IT Staff may change it. The two values are stored separately and both are shown, so re-prioritising never hides what the Requester asked for. |
| BR-29 | **Problem Appears Resolved** stamps `requesterResolvedAt` and requires a Public Comment of 5–2000 characters. It is a signal to IT Staff, not a status change (BR-05). |
| BR-30 | The Requester may clear their own "appears resolved" signal, and any IT Staff status change clears it, so the flag always reflects the current opinion rather than history. |

### 5.5 Status lifecycle

| ID | Rule |
| :--- | :--- |
| BR-31 | Current Status is one of `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. |
| BR-32 | Only IT Staff change Current Status. No Requester transition exists in Lab 3, and an Administrator has none either (BR-19). |
| BR-33 | The permitted transitions are exactly these; everything else is a conflict: |

| From | To | Notes |
| :--- | :--- | :--- |
| `NEW` | `OPEN`, `CANCELLED` | `OPEN` also happens automatically on claim (BR-34) |
| `OPEN` | `IN_PROGRESS`, `CANCELLED` | |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | |
| `RESOLVED` | `CLOSED`, `REOPENED` | |
| `CLOSED` | `REOPENED` | |
| `REOPENED` | `IN_PROGRESS`, `CANCELLED` | |
| `CANCELLED` | — | terminal |

| ID | Rule |
| :--- | :--- |
| BR-34 | Claiming a ticket that is still `NEW` moves it to `OPEN` in the same transaction, because "someone owns it" and "work has started" arriving separately is a state nobody maintains by hand. |
| BR-35 | Acting on a ticket does not require owning it: any IT Staff member may claim an unassigned ticket, reassign an owned one, change IT Priority, or perform a permitted transition (BR-18). Ownership restricts **outcomes**, not actors: `RESOLVED` and `CLOSED` require the ticket to have an owner, so nothing is resolved or closed anonymously. `CANCELLED` deliberately does **not** require an owner, because a ticket that should never have been opened is cancelled straight from `NEW` without anyone claiming it first (BR-33). |
| BR-36 | `CANCELLED` and `RESOLVED` each require a reason of 5–2000 characters, which is stored as a Public Comment posted in the same transaction. The Requester therefore always learns why. |
| BR-37 | `REOPENED` requires a reason too, stored the same way. |
| BR-38 | A transition request naming the status the ticket already has is a conflict, not a silent success, so a double-click cannot look like progress. |

### 5.6 Public Comments and Internal Notes

| ID | Rule |
| :--- | :--- |
| BR-39 | Public Comments and Internal Notes are **separate tables**, not one table with a visibility flag. A forgotten `WHERE` clause can then never leak a note into a Requester's comment thread. |
| BR-40 | Both record their author and a backend-generated creation timestamp. A client-supplied author or timestamp is ignored. |
| BR-41 | Content is 1–2000 characters after trimming. Empty or whitespace-only content is rejected. |
| BR-42 | Both are append-only in Lab 3. There is no edit or delete endpoint, so none can be reached by guessing a URL. |
| BR-43 | Content is stored as text and rendered as text. No response ever carries HTML built from user content. |
| BR-44 | Posting a comment or note updates the ticket's `updatedAt`, so "Last Updated" in the queue reflects conversation as well as field changes. |

### 5.7 Administrator rules

| ID | Rule |
| :--- | :--- |
| BR-45 | Email is unique across all users, compared case-insensitively and stored lowercased. A duplicate is a conflict, reported on the email field. |
| BR-46 | Creating a user requires name, email, exactly one role, an activation state, and an initial password; the account is created with `mustChangePassword` set. |
| BR-47 | Setting a new initial password sets `mustChangePassword` again and deletes that user's sessions, so the old password cannot keep a logged-in tab alive. |
| BR-48 | An Administrator may never deactivate their own account, and may never change their own role. Both are refused with a conflict. |
| BR-49 | The system must always retain at least one active Administrator. Any deactivation or role change that would reduce the count to zero is refused. |
| BR-50 | Deactivation is the only form of removal. There is no delete endpoint. |
| BR-51 | An inactive user cannot log in (BR-01) and their existing sessions are deleted when they are deactivated. |
| BR-52 | A user list response never includes a password hash, a session token, or any password material. |

### 5.8 Queue query behaviour

| ID | Rule |
| :--- | :--- |
| BR-53 | Search matches case-insensitively against Ticket Number and Summary, is trimmed, and is ignored when empty after trimming (carried over from Lab 2 BR-18). |
| BR-54 | Filters are Current Status, IT Priority, Category, and ownership (`any`, `unassigned`, `me`, or a specific owner). Filters combine with AND, and with search using AND. |
| BR-55 | Default queue order is IT Priority descending, then oldest `createdAt` first: the most urgent work, and within one priority the thing that has waited longest. Permitted sort fields are `itPriority`, `createdAt`, and `updatedAt`, ascending or descending. |
| BR-56 | Every sort carries `id` descending as its secondary key, so pagination cannot repeat or skip a row when values tie (carried over from Lab 2 BR-21). |
| BR-57 | Pagination is one-based; the default page size is 10 and the permitted sizes are 10, 20, and 50. |
| BR-58 | An unknown sort field, an unpermitted page size, a non-positive page, or an unknown filter value is a **400**, never silently corrected. |
| BR-59 | A page beyond the last page returns an empty list with correct metadata, not a 404. |

### 5.9 Migration and regression

| ID | Rule |
| :--- | :--- |
| BR-60 | The Lab 2 `RequesterUser` table is **evolved** into `User`, not replaced: the table is renamed and columns are added, so every existing row keeps its id and every `Ticket.requesterId` stays valid. |
| BR-61 | Each migrated Requester becomes a `REQUESTER` user with `mustChangePassword` set and `passwordHash` **null** — SQL cannot compute a bcrypt hash and a hash literal has no business being in a migration file (D-22). Until a password is assigned, those accounts cannot log in (BR-66). That is the state the migration guarantees, and it is the safe state for any real migrated account. The local-development seed then converges the four migrated Requesters to the documented dev state in §7.5: the documented password and the flag **cleared**, so they serve as ordinary Requester test accounts. |
| BR-62 | Existing Tickets keep their Requester, their Ticket Number, their Requested Priority, their `NEW` status, and all attachment rows and files. |
| BR-63 | `Ticket.itPriority` is backfilled from `Ticket.requestedPriority` for every existing row, so no ticket exists without an IT Priority. |
| BR-64 | Every Lab 1 and Lab 2 test keeps passing. Lab 2 Requester tests are updated only where they must log in instead of sending `X-Requester-Id`; their assertions about behaviour do not change. |

---

## 6. UI Specification Summary

The authoritative visual contract is [`ui-spec.md`](./ui-spec.md). Summary:

* **Theme.** Lab 2's Zen Green tokens, typography, spacing, control states,
  buttons, badges, and five shared states are reused unchanged. Lab 3 adds a
  Role badge and an Owner presentation and nothing else to the token set.
* **Shell.** The Development Requester display is replaced by the authenticated
  user's name with a Role badge, a Change Password action, and Logout.
  Navigation is role-specific (FR-14).
* **Login and Change Password.** Single centred card, no shell, exactly as the
  Requester Selection screen had none in Lab 2.
* **IT Staff Ticket Queue.** Seven desktop columns — Ticket Number, Summary,
  Requested Priority, IT Priority, Current Status, Ticket Owner, Last Updated —
  with Created Date and Category available as a filter and on the detail screen
  instead of as columns, because labsheet §8.3 asks for a readable queue rather
  than every available field (D-03). Below 768 px the table becomes a card list.
* **IT Staff Ticket Detail.** Four regions: what the Requester submitted
  (read-only), operational fields (editable by permission), attachments, and the
  two conversation threads. Public Comments and Internal Notes are visually
  distinct — different background, a lock icon, and an "Internal — not visible to
  the Requester" caption — so a note cannot be mistaken for a reply (FR-31).
* **Administrator User Management.** One list with Name, Email, Role, Status, and
  Edit; a search field; a role filter; and a single create/edit panel.
* **Responsive.** Desktop ≥ 992 px, tablet 768–991 px, mobile < 768 px, no
  horizontal page scroll at any width.

---

## 7. Data Changes

### 7.1 Models

| Model | Change | Fields |
| :--- | :--- | :--- |
| `User` | **renamed** from `RequesterUser`, columns added | existing `id`, `fullName`, `email`, `department`, `isActive`, `createdAt`, `updatedAt`; new `passwordHash`, `role`, `mustChangePassword`, `lastLoginAt` |
| `Session` | new | `id`, `tokenHash` (unique), `userId`, `createdAt`, `expiresAt` |
| `Ticket` | columns added | new `ownerId` (nullable), `itPriority`, `requesterResolvedAt` (nullable); `currentStatus` enum widened |
| `PublicComment` | new | `id`, `ticketId`, `authorId`, `body`, `createdAt` |
| `InternalNote` | new | `id`, `ticketId`, `authorId`, `body`, `createdAt` |
| `Category`, `RelatedSystem`, `Attachment` | unchanged | — |

Enums:

| Enum | Change |
| :--- | :--- |
| `Role` | new — `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR` |
| `Priority` | **renamed** from `RequestedPriority`; same four values, now used by both `requestedPriority` and `itPriority` |
| `TicketStatus` | widened from `NEW` to the eight values in BR-31 |

### 7.2 Relationships

* One `User` has many `Ticket` as Requester (the existing relation, renamed).
* One `User` may own many `Ticket` as Ticket Owner; one `Ticket` has zero or one
  owner (BR-24).
* One `User` has many `Session`; deleting a user's sessions is the logout and
  deactivation mechanism.
* One `Ticket` has many `PublicComment` and many `InternalNote`; each has exactly
  one author `User`.
* `Ticket` keeps its existing relations to `Category`, `RelatedSystem`, and
  `Attachment`.

### 7.3 Indexes and constraints

| Index / constraint | Why |
| :--- | :--- |
| `User.email` unique | BR-45, and the login lookup |
| `User.role, User.isActive` | the assignable-owner list and the Administrator's role filter |
| `Session.tokenHash` unique | every authenticated request is one lookup on this column |
| `Session.userId` | deleting a user's sessions on password change and deactivation |
| `Ticket.requesterId, createdAt` | kept from Lab 2 — My Tickets |
| `Ticket.ownerId` | the queue's ownership filter |
| `Ticket.currentStatus, itPriority, createdAt` | the queue's default order and its status filter |
| `PublicComment.ticketId, createdAt` and the same on `InternalNote` | one thread read per ticket, in order |
| `Ticket.ownerId → User.id` restrict | an owner cannot be deleted out from under a ticket; users are deactivated, never deleted (BR-50) |

### 7.4 Justified design decisions

| ID | Decision | Why |
| :--- | :--- | :--- |
| D-01 | Server-side `Session` rows with an opaque cookie token, not a JWT | labsheet §6.1 requires logout invalidation. A session row can be deleted; a signed JWT stays valid until it expires unless a denylist is added, which is a session table with extra steps. |
| D-02 | Store SHA-256 of the session token, keep the raw token only in the cookie | a database dump then contains no usable session (BR-10). |
| D-03 | Seven queue columns, Created Date and Category demoted to filters and detail | labsheet §8.3 explicitly warns against an unreadable mega-grid, and tablet width cannot hold nine columns without compromise. |
| D-04 | `PublicComment` and `InternalNote` as two tables | visibility becomes structural instead of a boolean that one missing `WHERE` clause can defeat (BR-39). |
| D-05 | Rename `RequesterUser` → `User` and `RequestedPriority` → `Priority` instead of creating new models | Lab 2 BR-46 planned for this. A rename keeps every id and foreign key, so no Ticket or Attachment is touched by the migration — provided the SQL really is a rename, which is why D-21 exists. |
| D-06 | `itPriority` stored separately from `requestedPriority` | both must be displayed (labsheet §8.3), and a single mutable column would destroy the Requester's original request. |
| D-07 | Claim moves `NEW` → `OPEN` automatically | otherwise every claim needs a second click that nobody reliably makes, and the queue fills with owned-but-`NEW` tickets. |
| D-08 | `RESOLVED`, `CANCELLED`, and `REOPENED` reasons are stored as Public Comments | the Requester needs the reason, and a separate reason column would duplicate the comment thread. |
| D-09 | Verify the password before reporting an inactive account | the labsheet wants a clear message for inactive accounts; revealing it only after correct credentials keeps that clarity without turning login into an account-enumeration oracle (BR-08). |
| D-10 | `bcryptjs` at cost 10 rather than native `bcrypt` or `argon2` | pure JavaScript, so the suite runs on Windows without a native toolchain; cost 10 keeps the test suite usable and is documented as a local-lab setting. |
| D-11 | Administrator excluded from IT Staff ticket operations | labsheet §4.3 keeps the responsibilities conceptually separate and only grants more if the matrix says so; a narrower matrix is also easier to prove in tests. |
| D-21 | The table and enum renames are written as hand-edited SQL after `prisma migrate dev --create-only`, not left to Prisma | Prisma Migrate has no rename detection; left alone it emits `DROP` + `CREATE`, which would delete every Requester and orphan every Ticket. The generated SQL is read before it is applied, every time. |
| D-22 | `User.passwordHash` is nullable and filled by the seed, not by the migration | SQL cannot compute a bcrypt hash, and embedding a hash literal in a migration puts a credential in version control. The cost is an intermediate state where migrated accounts cannot log in, which BR-66 makes explicit and safe. |

### 7.5 Seed data

Idempotent, safe to run repeatedly (`npm run prisma:seed` in `server/`), and
additive to Lab 2's categories and related systems.

| Group | Count | Notes |
| :--- | :--- | :--- |
| Active Requesters | ≥ 4 | the four migrated Lab 2 Requesters count toward this |
| Inactive Requester | 1 | for the inactive-login test |
| Active IT Staff | ≥ 3 | one is the default assignee in examples |
| Inactive IT Staff | 1 | proves an inactive user cannot be assigned |
| Active Administrator | ≥ 1 | plus a second active Administrator so the last-Administrator rule can be tested from both sides |
| Tickets | realistic spread | across Requesters, all eight statuses, every priority, both assigned and unassigned |
| Public Comments / Internal Notes | several | no sensitive content |

Seeded credentials are **local development only** and are documented in
`README.md`. Every documented account — the four migrated Lab 2 Requesters
included — has the password `Toktickit#2026` and `mustChangePassword` cleared.
Exactly one account, `first.login@toktickit.local`, has the same password with
`mustChangePassword` **set**, so the mandatory-change path can be tested end to
end without disturbing the accounts every other test logs in with.

The seed **converges** rather than only inserting: every run puts each documented
account back into the state above, password and flag included. A demo, a
screenshot session, or E2E-02 that changes `first.login`'s password is therefore
undone by re-running the seed, and the documented password always works after
seeding. Accounts that are not in the documented list — for example users created
through User Management while testing — are left untouched.

No real personal password or production secret is committed.

### 7.6 Migration plan

**Prisma Migrate does not detect renames.** Renaming the model in
`schema.prisma` and running `prisma migrate dev` would emit `DROP TABLE` plus
`CREATE TABLE`, destroying every Requester row and every `Ticket.requesterId`
with it. The rename is therefore performed by hand-edited SQL (D-21):

1. Edit `schema.prisma` (rename the model and the enum, add the new fields), then
   generate the migration with `npx prisma migrate dev --create-only`, **inspect
   the generated SQL**, and replace the drop-and-create statements with:

   ```sql
   ALTER TABLE "RequesterUser" RENAME TO "User";
   ALTER TYPE "RequestedPriority" RENAME TO "Priority";
   ```

   Index and constraint names that Postgres carries along are renamed in the same
   file so later migrations do not drift from Prisma's expectations.
2. Add to `User`: `passwordHash` **nullable** (BR-61, BR-66), `role` with default
   `REQUESTER`, `mustChangePassword` with default `true`, and `lastLoginAt`
   nullable. Every column either is nullable or has a default, because the table
   already holds rows and a `NOT NULL` column without a default would abort the
   migration. In the same step, every migrated email becomes `lower(trim(email))`
   (BR-45): Lab 2 never normalised them and the unique index is case-sensitive.
   Two Lab 2 emails that differ only by case would collide here and abort the
   migration, which is the intended outcome rather than a silent merge.
3. Widen `TicketStatus` with `ALTER TYPE ... ADD VALUE`, then add
   `Ticket.ownerId` nullable, `Ticket.itPriority` nullable for now, and
   `Ticket.requesterResolvedAt` nullable.
4. Backfill inside the same migration: `UPDATE "Ticket" SET "itPriority" =
   "requestedPriority"` (BR-63), then `ALTER COLUMN "itPriority" SET NOT NULL`
   once no row is null. `passwordHash` stays nullable permanently; the seed fills
   it (BR-61).
5. Create `Session`, `PublicComment`, and `InternalNote`.
6. Run `npm run prisma:seed`, which adds the Lab 3 accounts from §7.5 and
   converges every documented account, the four migrated Requesters included, to
   its documented password and `mustChangePassword` value.
7. Verify with the migration/regression tests in `tests.md`: ticket count,
   attachment count, and requester bindings are identical before and after, and
   every ticket has an IT Priority.

Steps 1–5 are one migration, reviewed as SQL before it is applied. Rollback is
the previous migration plus `prisma migrate resolve`; because every statement is
a rename, an addition, or a backfill, no Lab 2 row is destroyed at any point.

### 7.7 New dependencies

| Package | Where | Why |
| :--- | :--- | :--- |
| `bcryptjs` 3.x | server | password hashing (D-10). Version 3 ships its own TypeScript types, so `@types/bcryptjs` is not needed |
| `cookie-parser` (+ `@types/cookie-parser`) | server | reading the `tt_sid` cookie |

`cors` is reconfigured with `credentials: true` and an explicit origin so the
session cookie is accepted in development; no new client dependency is added.

---

## 8. API Contract

The authoritative contract is [`api-spec.md`](./api-spec.md). New and changed
endpoints:

| Method | Path | Role | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | public | authenticate, create a session |
| `POST` | `/api/auth/logout` | any session | delete the session |
| `GET` | `/api/auth/me` | any session | current user |
| `POST` | `/api/auth/password` | any session | change password |
| `GET` | `/api/categories`, `/api/related-systems` | any session | unchanged from Lab 2 |
| `POST` `GET` | `/api/tickets`, `/api/tickets/:id` | Requester | unchanged shapes, identity now from the session |
| `POST` `GET` `PATCH` | `/api/tickets/:id/attachments`, `/api/attachments/:id/...` | Requester | unchanged from Lab 2 |
| `GET` `POST` | `/api/tickets/:id/comments` | per matrix | Public Comments |
| `GET` `POST` | `/api/tickets/:id/notes` | IT Staff, Administrator | Internal Notes |
| `PATCH` | `/api/tickets/:id/appears-resolved` | Requester | set or clear the signal |
| `GET` | `/api/staff/tickets` | IT Staff | the queue |
| `GET` | `/api/staff/tickets/:id` | IT Staff | one ticket for operations |
| `PATCH` | `/api/staff/tickets/:id/owner` | IT Staff | claim, assign, reassign |
| `PATCH` | `/api/staff/tickets/:id/it-priority` | IT Staff | change IT Priority |
| `PATCH` | `/api/staff/tickets/:id/status` | IT Staff | permitted transition |
| `GET` | `/api/staff/assignable-users` | IT Staff | active IT Staff and Administrators |
| `GET` `POST` | `/api/admin/users` | Administrator | list and create |
| `PATCH` | `/api/admin/users/:id` | Administrator | edit name, email, role, activation |
| `POST` | `/api/admin/users/:id/initial-password` | Administrator | issue a new initial password |

`GET /api/requesters` from Lab 2 is **removed** with the selector (FR-16).

---

## 9. Acceptance Criteria

Every criterion is observable and maps to at least one planned test in
[`tests.md`](./tests.md).

### 9.1 Authentication

| ID | Criterion |
| :--- | :--- |
| AC-01 | Given an active user and valid credentials, when they log in, then a session is established and the response carries their id, name, email, and role, and no password material. |
| AC-02 | Given a user who must change their password, when login succeeds, then every normal application screen stays unavailable until a valid new password is saved. |
| AC-03 | Given an inactive account, when the correct password is supplied, then login is refused as inactive and no session is created. |
| AC-04 | Given an unknown email or a wrong password, when login is attempted, then the message is identical in both cases. |
| AC-05 | Given a logged-in session, when the user logs out, then the same cookie is refused by every protected endpoint afterwards. |
| AC-06 | Given a changed password, when the user's other sessions are used, then they are refused. |
| AC-40 | Given five failed sign-ins for one email within 15 minutes, when anyone signs in with that email, then it is refused with `429` for the next 15 minutes even with the correct password, and the answer is identical whether or not the email belongs to an account. |

### 9.2 Authorization

| ID | Criterion |
| :--- | :--- |
| AC-07 | Given an authenticated Requester, when the client supplies another user's id in a body, query, or header, then the server still applies the session identity and returns no other Requester's data. |
| AC-08 | Given a Requester, when an Internal Note endpoint is called, then the operation is refused with 403 and no note content or count is exposed. |
| AC-09 | Given a Requester or Administrator, when an IT Staff queue or ticket-operation endpoint is called directly, then it is refused with 403. |
| AC-10 | Given no session, when a protected endpoint is called, then it is refused with 401, distinctly from the 403 above. |
| AC-11 | Given a ticket owned by another Requester, when its detail, attachments, or comments are requested, then the answer is 404, identical to a ticket that does not exist. |

### 9.3 Requester regression

| ID | Criterion |
| :--- | :--- |
| AC-12 | Given the application, when any screen is opened, then no Development Requester selector or Change Requester action exists anywhere. |
| AC-13 | Given an authenticated Requester, when they create a ticket, list their tickets, open one, and manage its attachments, then every Lab 2 behaviour holds with identity taken from the session. |
| AC-14 | Given a request carrying `X-Requester-Id` for a different user, when a Lab 2 endpoint is called, then the header is ignored and the session identity is used. |
| AC-15 | Given a Requester on their own ticket, when they mark the problem as appearing resolved with a comment, then the signal and the comment are recorded and Current Status is unchanged. |

### 9.4 Comments and notes

| ID | Criterion |
| :--- | :--- |
| AC-16 | Given a ticket, when the owning Requester, an IT Staff member, and an Administrator each read its Public Comments, then all three see the same thread with authors and timestamps. |
| AC-17 | Given an Internal Note posted by IT Staff, when the owning Requester reads the ticket, then no response field reveals the note, its author, or that any note exists. |
| AC-18 | Given empty or whitespace-only content, when a comment or note is posted, then it is rejected with a field-level validation error. |
| AC-19 | Given a posted comment or note, when any edit or delete is attempted, then no endpoint exists to perform it. |

### 9.5 IT Staff queue and detail

| ID | Criterion |
| :--- | :--- |
| AC-20 | Given tickets from several Requesters, when IT Staff open the queue, then tickets from all Requesters appear, ordered by IT Priority descending and oldest first within a priority. |
| AC-21 | Given the queue, when search, a status filter, an IT Priority filter, an ownership filter, a sort, and a page size are applied, then each behaves as `api-spec.md` documents, and an invalid query parameter returns 400. |
| AC-22 | Given an unassigned ticket at `NEW`, when IT Staff claim it, then they become the Ticket Owner and the status becomes `OPEN` in the same operation. |
| AC-23 | Given a ticket already claimed by someone else, when a second IT Staff member claims it, then the attempt is refused as a conflict and the owner is unchanged. |
| AC-24 | Given an owned ticket, when IT Staff change IT Priority, then Requested Priority is unchanged and both values remain visible. |
| AC-25 | Given a ticket in any status, when a transition outside the BR-33 matrix is requested, then it is refused as a conflict and the status is unchanged. |
| AC-26 | Given a transition to `RESOLVED`, `CANCELLED`, or `REOPENED`, when no reason is supplied, then it is rejected; when a reason is supplied, then a Public Comment carrying it is created with the transition. |
| AC-27 | Given a ticket with Lab 2 attachments, when IT Staff open its detail screen, then active attachments download and removed ones stay visible as marked metadata. |

### 9.6 Administrator user management

| ID | Criterion |
| :--- | :--- |
| AC-28 | Given users exist, when an Administrator opens User Management, then each row shows Name, Email, Role, Status, and an Edit action, and no password material appears in any response. |
| AC-29 | Given a search term or a role filter, when the list is queried, then only matching users are returned, matching name or email case-insensitively. |
| AC-30 | Given a new user with one role and an initial password, when it is created, then the account requires a password change at first login, and logging in with that password leads to the Change Password screen. |
| AC-31 | Given an email already in use, when a user is created or edited with it, then the request is refused as a conflict reported on the email field. |
| AC-32 | Given an Administrator, when they attempt to deactivate their own account or change their own role, then the request is refused. |
| AC-33 | Given one active Administrator remains, when a change would leave zero active Administrators, then it is refused and the account stays active. |
| AC-34 | Given a user, when a new initial password is set, then their existing sessions stop working and their next login requires a change. |

### 9.7 Migration, UI, and responsiveness

| ID | Criterion |
| :--- | :--- |
| AC-35 | Given the Lab 2 database, when the Lab 3 migration runs, then every Ticket, Attachment, and Requester binding is preserved, and every ticket has an IT Priority equal to its Requested Priority. |
| AC-36 | Given the migration has run, when the Lab 1 and Lab 2 test suites run, then they pass. |
| AC-37 | Given each new screen, when it is viewed at ≥ 992 px, 768–991 px, and < 768 px, then it matches `ui-spec.md` with no horizontal page scroll and no clipped or overlapping content. |
| AC-38 | Given any new screen, when an API call is in flight, fails, returns nothing, or is forbidden, then the matching visible state from `ui-spec.md` is shown and no raw error detail reaches the user. |
| AC-39 | Given the IT Staff detail screen, when Public Comments and Internal Notes are both present, then they are visually distinct and the Internal Notes region is labelled as not visible to the Requester. |

---

## 10. Definition of Done

### 10.1 Product completion

* [ ] Every FR in §4 is implemented and every AC in §9 is demonstrated by a
      passing automated test.
* [ ] Login, mandatory password change, logout, and role navigation work for all
      three roles.
* [ ] Every protected endpoint enforces the BR-18 matrix server-side, verified by
      direct API calls with the wrong role.
* [ ] Lab 2 Requester functionality works through the authenticated identity with
      the selector gone.
* [ ] The IT Staff queue and ticket detail support search, filters, sorting,
      pagination, ownership, IT Priority, permitted transitions, comments, and
      notes.
* [ ] Administrator User Management covers list, search, role filter, create,
      edit, one-role assignment, activation, new initial password, and both
      safety rules.
* [ ] The migration preserves all Lab 2 data and the Lab 1 and Lab 2 suites pass.

### 10.2 Evidence completion

* [ ] `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are current
      with the code that shipped.
* [ ] `tests.md` records planned tests, AC traceability, real test-file paths, and
      the runner's actual output.
* [ ] Screenshots for all four new screen groups exist at all three breakpoints
      under `artifacts/lab-03/screenshots/`.
* [ ] `reviewer.md` records every PR, its reviewer, comments, responses, and
      approval.
* [ ] `ai-use.md` records the model used, 6–10 key prompts, and the reflection.
* [ ] `README.md` documents setup, seed, seeded credentials, and test commands.
* [ ] Every issue is Done on the board, every feature PR is merged into
      `lab3-staging`, and the release PR into `main` is merged.

---

## 11. Assumptions and Decisions

Design decisions with a separate reason column — D-01 to D-11, D-21, and D-22 —
live in §7.4. This table holds the remaining assumptions and decisions, each
with its reason in the same cell.

| ID | Assumption or decision |
| :--- | :--- |
| D-12 | Session lifetime is 8 hours with no sliding renewal. A lab session is shorter than that, and a fixed window is one fewer moving part to test. |
| D-13 | CSRF rests on `SameSite=Lax`, which keeps the session cookie off cross-site requests, plus the `Origin` check in BR-65. No CSRF token is introduced, and this is recorded as a deliberate scope choice for a local lab. An earlier draft justified this with "the API is JSON-only", which was **wrong**: attachment upload uses `multer` with `multipart/form-data` (`server/src/app.ts`), and a cross-site HTML form can send exactly that. The cookie policy is what protects that endpoint, not the content type. |
| D-14 | Password rules are length-only (8–72) with no composition requirements, because composition rules push people toward predictable substitutions and the labsheet leaves the rules to us. |
| D-15 | The Administrator's own account cannot be edited for role or activation from the list (BR-48); name, email, and password changes still work through the normal screens. |
| D-16 | "Department" stays on `User` as the optional Lab 2 field. It is displayed read-only and is not editable in Lab 3, since extended profile management is excluded. |
| D-17 | Test files live under `server/tests/lab-03/`, `client/tests/lab-03/`, and `e2e/lab-03/`. The labsheet writes `lab03` in §10 and `lab-03` in §12; we follow §12 and Lab 2's existing convention. |
| D-18 | The queue's ownership filter offers `any`, `unassigned`, and `me` plus a specific owner, because "what is nobody holding" and "what am I holding" are the two questions an IT Staff member actually opens the queue to answer. |
| D-19 | Deactivating a user keeps their ticket ownership (BR-26). Reassignment is an explicit IT Staff decision, not a side effect of an account change. |
| D-20 | Lab 4 will add Actions Taken and the rule that blocks resolution until they are complete. `RESOLVED` therefore requires only a reason in Lab 3, and the reason is already a Public Comment so Lab 4 can add its own gate without changing the comment thread. |
| D-23 | BR-04's "Internal Notes are visible to Administrators" is satisfied at the **API level only**; Lab 3 ships no Administrator ticket screen. An Administrator has no queue, no ticket detail screen, and no ticket list (BR-19, ui-spec §2), so there is no route by which they reach a ticket in the UI. The permission exists for Lab 4, when an Administrator may get a read-only ticket view. Tests assert it through the API with a known ticket id, and no UI test looks for a screen that does not exist. |
| D-27 | BR-49 is enforced under a lock on the active Administrators' rows (`SELECT … FOR UPDATE`), taken before counting them. Because the caller of every user-management request is itself an active Administrator, a single request can only reach BR-49 when the caller's own state changed after their request began — two Administrators deactivating or demoting each other at once. Without the lock, both would count each other as remaining and both would succeed, leaving none. The decision itself is a pure function (`userRules.ts`) unit-tested for the zero-left case, and the API suite proves the lock by holding it and showing a change waits. A user's full name is 1–100 characters after trimming; the labsheet sets no limit and 100 fits every seeded name with room. |
| D-24 | BR-67's counter is **in memory, keyed by email, and capped at 10,000 emails.** Per-email rather than per-IP, because behind one campus proxy or NAT every user shares an address and an IP limit would lock out a whole building. In memory rather than in PostgreSQL, because a counter that resets when the server restarts is an acceptable loss for a local lab and saves a table plus a write on every failed sign-in. The costs are accepted and recorded: a restart clears every lock; two server processes would count separately; and anyone who knows an email can lock it for 15 minutes, a deliberate trade against unlimited guessing with no unlock flow in scope. When the cap is reached, the least recently failed **unlocked** email is forgotten first, so flooding the counter with other emails cannot lift a lock early. Only when every tracked email is locked or mid-attempt is the oldest forgotten, so lifting a target's lock this way means first locking 10,000 other emails, about 50,000 failed sign-ins; that cost is accepted. Tests reset the counter before each test. |
