# Lab 4 — Peer Review Record

**Author:** Poomipat Apiwattanaphong — 67070501035 — GitHub: [@Menelaus122](https://github.com/Menelaus122)<br>**Peer reviewer:** Wirachat Thonguthaisri — 67070501041 — GitHub: [@WirachatTH](https://github.com/WirachatTH)
<br>**Repository:** [Menelaus122/TokTickITV2](https://github.com/Menelaus122/TokTickITV2) · **Integration branch:** `lab4-staging`

## Evidence for Part 2: the contract existed before the implementation

`docs/lab-04/specification.md` was approved in [PR #78](https://github.com/Menelaus122/TokTickITV2/pull/78) (Issue 1, [#67](https://github.com/Menelaus122/TokTickITV2/issues/67)),
which @WirachatTH approved at 2026-10-05 16:08:17 UTC and merged into `lab4-staging` at
2026-10-05 16:08:34 UTC as `f14ae15`. The first Pull Request that built anything from it, [#79](https://github.com/Menelaus122/TokTickITV2/pull/79),
was merged 17.3 hours later, at 2026-10-06 09:27:35 UTC. The specification's header names this approval, and the one-line change
that wrote it there is [PR #82](https://github.com/Menelaus122/TokTickITV2/pull/82), merged at 2026-10-06 16:31 UTC. That header edit came after
#79, #80, and #81 had been merged; the approval itself did not.

| Order | PR | What it is | Merged (UTC) |
| ---: | :--- | :--- | :--- |
| 1 | [#78](https://github.com/Menelaus122/TokTickITV2/pull/78) | Add the Lab 4 engineering contract (Issue 1) ← **the contract** | 2026-10-05 16:08 UTC |
| 2 | [#79](https://github.com/Menelaus122/TokTickITV2/pull/79) | Let Administrators work IT Staff tickets (Issue 2) | 2026-10-06 09:27 UTC |
| 3 | [#80](https://github.com/Menelaus122/TokTickITV2/pull/80) | Add the Actions Taken model, migration, and seed (Issue 3) | 2026-10-06 12:55 UTC |
| 4 | [#81](https://github.com/Menelaus122/TokTickITV2/pull/81) | Add the Actions Taken API (Issue 4) | 2026-10-06 16:30 UTC |
| 5 | [#82](https://github.com/Menelaus122/TokTickITV2/pull/82) | Mark the Lab 4 specification as approved | 2026-10-06 16:31 UTC |
| 6 | [#83](https://github.com/Menelaus122/TokTickITV2/pull/83) | Add the Actions Taken UI to Ticket Detail (Issue 5) | 2026-10-07 07:04 UTC |
| 7 | [#84](https://github.com/Menelaus122/TokTickITV2/pull/84) | Start the Action Date/Time on a minute the ticket existed in (follow-up to #83) | 2026-10-07 08:02 UTC |
| 8 | [#85](https://github.com/Menelaus122/TokTickITV2/pull/85) | Add the ticket workflow and resolution gate (Issue 6) | 2026-10-07 15:45 UTC |
| 9 | [#86](https://github.com/Menelaus122/TokTickITV2/pull/86) | Add the Requester Dashboard and URL-driven My Tickets filters (Issue 7) | 2026-10-10 05:17 UTC |
| 10 | [#87](https://github.com/Menelaus122/TokTickITV2/pull/87) | Add the IT Staff and Administrator Dashboard and URL-driven Ticket Queue filters (Issue 8) | 2026-10-10 12:49 UTC |
| 11 | [#88](https://github.com/Menelaus122/TokTickITV2/pull/88) | Harden the whole application and finish the Lab 4 regression (Issue 9) | 2026-10-11 10:08 UTC |
| 12 | [#89](https://github.com/Menelaus122/TokTickITV2/pull/89) | Add the Lab 4 E2E suite and visual evidence (Issue 10) | 2026-10-12 10:27 UTC |

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Review rounds | Merged by |
| :--- | :--- | :--- | :--- |
| [#78](https://github.com/Menelaus122/TokTickITV2/pull/78) | `feature/1-sprint4-contract` | Changes requested → Approved | @WirachatTH |
| [#79](https://github.com/Menelaus122/TokTickITV2/pull/79) | `feature/2-admin-staff-access` | Approved | @WirachatTH |
| [#80](https://github.com/Menelaus122/TokTickITV2/pull/80) | `feature/3-actions-taken-data` | Approved | @WirachatTH |
| [#81](https://github.com/Menelaus122/TokTickITV2/pull/81) | `feature/4-actions-taken-api` | Changes requested → Approved | @WirachatTH |
| [#82](https://github.com/Menelaus122/TokTickITV2/pull/82) | `docs/lab4-spec-approved` | Approved | @WirachatTH |
| [#83](https://github.com/Menelaus122/TokTickITV2/pull/83) | `feature/5-actions-taken-ui` | Approved | @WirachatTH |
| [#84](https://github.com/Menelaus122/TokTickITV2/pull/84) | `feature/5-default-action-time` | Approved | @WirachatTH |
| [#85](https://github.com/Menelaus122/TokTickITV2/pull/85) | `feature/6-ticket-workflow` | Approved | @WirachatTH |
| [#86](https://github.com/Menelaus122/TokTickITV2/pull/86) | `feature/7-requester-dashboard` | Approved | @WirachatTH |
| [#87](https://github.com/Menelaus122/TokTickITV2/pull/87) | `feature/8-staff-dashboard` | Changes requested → Approved | @WirachatTH |
| [#88](https://github.com/Menelaus122/TokTickITV2/pull/88) | `feature/9-final-hardening` | Changes requested → Approved | @WirachatTH |
| [#89](https://github.com/Menelaus122/TokTickITV2/pull/89) | `feature/10-lab4-e2e-and-evidence` | Changes requested → Approved | @WirachatTH |

All 12 Pull Requests were approved **and merged** by [@WirachatTH](https://github.com/WirachatTH), never by me,
per the Part 9 agreement in the workflow guide. 5 of them (#78, #81, #87, #88, #89) needed at least one round of
**Changes requested** first; each fix was pushed to the same branch, answered on the thread, and re-reviewed before
approval. Ten of the twelve are linked to their GitHub Issue ([#67](https://github.com/Menelaus122/TokTickITV2/issues/67) to [#76](https://github.com/Menelaus122/TokTickITV2/issues/76), Issues 1 to 10) through the
Development panel; #82 and #84 are small follow-up Pull Requests with no Issue of their own. Every feature branch reached `lab4-staging` through a
Pull Request: the first-parent history of `lab4-staging` after `main` is these twelve merge commits and nothing else.

The Pull Request for Issue 11 ([#90](https://github.com/Menelaus122/TokTickITV2/pull/90)) and the release Pull Request into `main` are not recorded here: nothing can be committed after the release, so their reviews are in the submission PDF.

### [#78](https://github.com/Menelaus122/TokTickITV2/pull/78) — Add the Lab 4 engineering contract (Issue 1)

**Verdict:** Changes requested → Approved · **merged** 2026-10-05 by @WirachatTH

**Review — Changes requested** (2026-10-05 15:10 UTC, @WirachatTH)

> Request changes. This is a strong contract:
> - The labsheet's tensions are named and settled in §11 instead of left implicit.
> - D-22 triages every Lab 3 known limitation (NUL, body ids, the demoted-owner label, the client flake).
> - BR-29 plus BR-17 make the gate race-free: every Ticket write locks the row first, and the gate is evaluated inside that transaction, so an action added a moment earlier always counts.
> - D-14's invariant ("a resolved Ticket always satisfied the gate at the moment it was resolved") is a nice touch.
>
> I read all four documents at `a8adf5a` against the labsheet, then replayed the stateful rules (the gate, the ordering, versions, drill-down counts, the migration and rollback) rather than only checking the structure.
>
> ### What I verified
> - **Numbering and traceability:** 34 FR, 56 BR, 34 AC, 22 D, with no gaps. Every cited ID is defined (D-23 is Lab 3's own, as you say), and every AC traces to at least one test. **149** tests (146 + REG-01 – REG-03), with the type split you list.
> - **Labsheet coverage:**
>   - every §12 file is a test path;
>   - API-03 and E2E-02 are the labsheet's examples;
>   - Part 5's "current-user Actions Taken" is *My Recent Actions* (BR-36);
>   - §4.2's exclusions are in §3.2;
>   - all 11 §9 sections are in order.
> - **The Lab 3 suites against the new seed:** the assertions that count users use `toBeGreaterThanOrEqual` or count the live table, so the two new seed accounts don't break them.
> - **The concurrency design holds when replayed:** two edits with one `expectedVersion` → the row lock serialises them, and the second gets `STALE_UPDATE`; two creates with one `requestKey` → the unique `(ticketId, performedById, requestKey)` index stops the second, even past an application check.
>
> ### 🔴 Must fix: two places where the contract contradicts itself
>
> **1. The gate reads two different clocks, so a pending follow-up can be hidden.** BR-17 decides *relevance* by `createdAt` ("created after the most recent entry into `REOPENED`"), but *latest* follows BR-08, which orders by the user-entered, editable `actionAt`. Replayed:
>
> ```text
> 10:00  IT Staff A records action #1, actionAt 10:00, Follow-Up = No
> 10:30  IT Staff B records action #2 (a late log of earlier work), actionAt 09:00, Follow-Up = Yes
>        BR-08 order: #2 (09:00), #1 (10:00)  -> "latest" is #1, Follow-Up = No
>        move to RESOLVED -> the gate passes, although the newest entry says follow-up is pending
> ```
>
> The same happens if someone edits an existing action's `actionAt` to an earlier time. And `ui-spec.md` §4.1 says "A card never reorders itself after an edit" and "the last card is the latest action — the one the gate reads". Both can't hold once `actionAt` is edited: the screen would show one "latest" while the gate uses another.
>
> → Pick one clock for the gate, and say it in BR-08, BR-17, and ui-spec §4.1. For example: the gate's "latest" is the most recently **recorded** action (`createdAt`, then `id`), while the list keeps its `actionAt` order for reading. Or keep `actionAt` and refuse an `actionAt` earlier than the latest relevant action's. Then add a WF row for the backdated case, and fix §4.1's "never reorders" sentence to say what happens after a date edit.
>
> **2. The active-user drill-down can't match its card.** BR-40 promises "the list shows exactly the card's number", and gives the inactive count no link *because* "User Management offers only a search and a role filter". But `userCounts.active*` links to `/users?role=<role>`, and that list includes **inactive** users of the role. On the seed, IT Staff has Prasert (inactive) plus the new `idle.it`, so the card reads 4 while the linked list shows 5. The same goes for Requesters (Wichai). AC-21 would fail by construction.
>
> → Either drop the links on the active counts too (as for inactive), or add an `active=true` filter to User Management's URL filters (FR-21), and update api-spec §6 and AC-21 to match.
>
> ### 🟠 Needs a decision before implementation starts
> - **D-06 and Part 6.** Part 6 (10 points) grades "list, create, **assign**, edit, **status transition, complete, cancel**, validation, **inactive-assignee rejection** … Show different Actions Taken on one Ticket". The labsheet's own AC-01 example says "with the authenticated creator **and approved assignee**". D-06 maps those words to Ticket-level behaviour. That's a coherent reading, but a grader working from Part 6's list may look for them on the Action Taken itself. For transparency: my own Lab 4 contract read it the other way (an Action Taken with an assignee and a `PLANNED` → `COMPLETED` / `CANCELLED` status). I'm not saying mine is right. But with 10–15 points riding on one interpretation, a quick confirmation from a TA before Issue 3 would de-risk either choice, and D-06 can then cite it.
> - **MIG-05's "before" needs pinning.** It applies the rollback to "a copy of the migrated database" and expects the Lab 3 rows "exactly as before". But §7.6 runs the Lab 4 seed right after migrating, and the server suites run on a seeded database. The Lab 4 seed adds two `User` rows (and its actions move `Ticket.updatedAt` per BR-11), which the rollback script doesn't remove. → State that MIG-05 snapshots the Lab 3 tables **before** migrating and rolls back **without** the Lab 4 seed in between, or exclude what the seed adds.
>
> ### 🟡 Minor (not blocking)
> - **The appears-resolved flag bumps `version` (BR-25).** So a Requester ticking it makes an IT Staff member's next owner, priority, or status save fail with `STALE_UPDATE`. That's arguably right (the staff screen *should* see the advisory), but worth saying in BR-26 and in the conflict callout's copy, so it doesn't read as a bug.
> - **A retry after the Ticket closed.** For a `requestKey` replay arriving after the Ticket became `RESOLVED`, api-spec §2.2 doesn't say whether the replay (`200`, the original) or `TICKET_NOT_ACTIVE` (`409`) wins. Returning the original is the idempotent answer; say which.
> - **`tests.md` §6 will probably grow:** the Requester Ticket Detail now loads Actions Taken and Status History, so the Lab 2 `RequesterTicketDetail.test.tsx` and Lab 3 `RequesterComments.test.tsx` mocks likely need those calls too. You already flag that the list will grow, so this is just a head start.
> - **The Lab 3 assignee check is still outside the transaction.** BR-29 now locks the Ticket for every write, but the owner PATCH still reads the proposed owner's `isActive` / `role` before it. With Administrators now acting on tickets and deactivating users, reading that user `FOR SHARE` after the Ticket lock keeps BR-24's "active at the time of assignment" exact, with no lock-order risk.
>
> Fix the two contradictions and settle the two decisions, and I'm happy to approve. This is a careful contract, and most of it is ready to build on. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-05 15:34 UTC, @Menelaus122)

>  Thank you for such a careful review. I replayed the stateful rules myself and I'm glad you did, because both contradictions were real. Fixes are in 042f5cf.
> ▎
> ▎ Must fix
> ▎
> ▎ 1. The gate's two clocks. Agreed. I made the gate use recording order: "latest" is the highest createdAt, then id, and "relevant" already used createdAt. Both are set by the server and never edited, so a backdated action or a re-dated one can't hide a pending follow-up. BR-08 now says plainly that actionAt order is for reading only. I changed BR-08, BR-17, BR-18, D-07, AC-03, the §7.3 index note and the seed, and the api-spec and ui-spec.md wording to match. The list keeps its actionAt order, and the card the gate reads carries a Latest recorded tag, so the screen can't say one thing while the gate does another. A date edit that re-sorts a card is now announced, and ui-spec.md §4.1's "never reorders" sentence is replaced. New test WF-19 is your exact scenario, including re-dating #1 earlier and later. One consequence is deliberate: a follow-up is "settled" by a later-recorded action, so editing an older action to Yes after a newer No exists doesn't reopen it (D-07 says this now).
> ▎ 2. Account cards that can't match their lists. Agreed; I checked it against the code. GET /api/admin/users filters on role only, so /users?role=IT_STAFF would show 5 where the card says 4. I dropped the links rather than add an active filter. The labsheet calls the account counts optional and drill-down "where practical", and the filter would add a second control to a Lab 3 screen that Lab 3 kept to search and role. All four userCounts are plain numbers with no href, plus one ordinary "Open User Management" link that claims nothing. BR-40, D-12, api-spec §4.2, §5.2 and §6, ui-spec §3.3 and §7, FR-21, DASH-16, DASH-17, UI-24 and UI-38 are updated.
> ▎
> ▎ Decisions
> ▎
> ▎ - D-06 / Part 6. I'm keeping the record-only reading. Thank you for saying plainly that you read it the other way, because that tells me the risk is real. D-06 now records the alternative reading and exactly what it would change (Issues 3, 4, 5 and the gate), so reopening it later is a bounded change. I may still ask a TA before Issue 3 starts, and if I do, D-06 will cite the answer.
> ▎ - MIG-05. Pinned as you suggested: it snapshots the Lab 3 tables before migrating and rolls back without the Lab 4 seed in between. §7.6 and tests.md §7 now say that a rollback after seeding leaves the seed's two accounts and the moved updatedAt behind, and that the dump is the recovery for that case.
> ▎
> ▎ Minor items: all four adopted.
> ▎
> ▎ - "Appears resolved" bumps version. BR-26 and api-spec §3.2 say it's intended, and the conflict message now names it as a cause.
> ▎ - Replay after the Ticket closed. The original 200 wins. The replay is recognised before validation and the status check (BR-28, api-spec §2.2), and API-13 covers it.
> ▎ - tests.md §6. It now lists RequesterTicketDetail.test.tsx and RequesterComments.test.tsx. I checked that both mock each client call separately, so the two new calls would reach the network.
> ▎ - The owner check outside the transaction. Moved inside, after the Ticket lock, with SELECT … FOR SHARE on the user row (BR-29). Lock order is Ticket then User, and user management locks only user rows. New test WF-20, with a race on the proposed owner's deactivation.
> ▎
> ▎ The plan is now 151 tests. My ID cross-check passes with the same two known false positives (Lab 3's D-23). Could you take another look when you have time? 🙏

**Review — Approved** (2026-10-05 16:08 UTC, @WirachatTH)

> Approved! Thank you for replaying the rules yourself rather than just editing the wording! I re-read `042f5cf` against my previous review and replayed each fix again.
>
> ### 🔴 Both contradictions are fixed
> - **The gate now reads one clock.** "Relevant" and "latest" are both recording order (`createdAt`, then `id`, set by the server and never edited), while BR-08's `actionAt` order is explicitly for reading only. BR-08, BR-17, BR-18, D-07, AC-03, and ui-spec §4.1 all say the same thing now.
>   - Replaying my scenario: #1 recorded first at 10:00 with No, then #2 recorded later but dated 09:00 with Yes → `FOLLOW_UP_PENDING`, and re-dating either action can't change that. **WF-19** is exactly this case.
>   - The screen can't disagree with the gate any more: the gate's entry carries **Latest recorded**, and a date edit that re-sorts a card is announced instead of silent.
>   - The deliberate consequence (editing an *older* action to Yes after a newer No doesn't block) is consistent with "a follow-up is settled by a later-recorded action", and D-07 states it. That's fine.
> - **The account counts no longer promise a list they can't match.** All four `userCounts` are plain numbers (api-spec §6: "none"), with one honest **Open User Management** link that claims nothing. BR-40 and D-12 give the reason. The ui-spec mock's figures (Requesters 6 · IT Staff 4 · Administrators 2 · Inactive 2) match the seed, including the two new accounts.
>
> ### 🟠 The decisions
> - **D-06** now records the alternative reading and what adopting it would touch (Issues 3, 4, 5 and the gate), so the risk is visible and bounded. That's a fair way to carry it. A TA's answer, if you get one, would be the cherry on top.
> - **MIG-05** now snapshots a scratch database in the Lab 3 state, migrates, and rolls back **without** the Lab 4 seed in between. §7.6 and `tests.md` §7 say what a rollback after seeding leaves behind and that the dump covers it.
>
> ### 🟡 All four minor points adopted
> - BR-26 says a Requester's "appears resolved" causing `STALE_UPDATE` is intended, and the conflict copy names it.
> - BR-28: a `requestKey` replay is recognised before the status check, so a retry after resolving returns the original `200`; **API-13** covers it.
> - `tests.md` §6 adds `RequesterTicketDetail.test.tsx` and `RequesterComments.test.tsx`.
> - BR-29: the proposed owner is now read **inside** the transaction with `FOR SHARE` after the Ticket lock. I replayed the lock order: owner writes take the Ticket, then the User; user management only ever locks user rows and never a Ticket, so there's no cycle. **WF-20** races the assignment against the deactivation.
>
> ### Consistency, re-checked
> - 34 FR, 56 BR, 34 AC, 22 D, with no gaps and no undefined citations.
> - Every AC traces to a test, and **151** tests (WF-19 and WF-20 added, both under Issue 6 in §3.1).
>
> Approving. This is a contract that can actually be built against. Remember the small follow-up PR that records this approval and the merge commit in the header (Part 2 evidence). 🙌
> Wirachat 67070501041

**Author's response** (2026-10-07 06:32 UTC, @Menelaus122)

> Thx kub

### [#79](https://github.com/Menelaus122/TokTickITV2/pull/79) — Let Administrators work IT Staff tickets (Issue 2)

**Verdict:** Approved · **merged** 2026-10-06 by @WirachatTH

**Review — Approved** (2026-10-06 09:27 UTC, @WirachatTH)

> Approved! This is a well-scoped first implementation PR:
> - The production change is the one prefix guard, `rolesForPath` with its two route guards, and one navigation entry.
> - Catching the deep-link bug (`roleForPath` returning one role per URL) is exactly the kind of "the guard is open but the user still can't get there" defect that's easy to miss.
> - Finding the sixth Lab 3 test by running the suite, rather than trusting the plan, was the right call.
>
> I cloned `feature/2-admin-staff-access` at `02bf77d` and ran it on its own ports against a fresh migrated and seeded database (a freshly started server, so the stale-`tsx watch` problem in your note 1 can't apply).
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **405/405** (27 files), with **17** in `lab-04/authorization.api.test.ts`;
>   - client: **363/363** (19 files), both in parallel and with `--no-file-parallelism`;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - Lab 2 + Lab 3 Playwright: **46/46**.
> - **No role check left behind.** I searched `server/src` and `client/src` for every `"IT_STAFF"` comparison. Each one now admits `ADMINISTRATOR` too: the `/api/staff` guard, `staffOrAdmin` on notes, the assignable-users query, the owner-eligibility check, `rolesForPath`, and both `RequireAuth` guards. Nothing still excludes an Administrator by accident.
> - **The Lab 3 edits keep the Requester half word for word.** Each combined "Requester and Administrator" loop became a Requester-only case with the same `403` / `FORBIDDEN` / no-data / unchanged-row assertions, plus a separate "is open to an Administrator" case. Nothing was just deleted.
> - **Your mutation table, spot-checked:**
>   - putting the staff guard back to IT Staff only fails **10** server tests. You wrote 5, probably counting only the new file; the edited Lab 3 cases catch it too;
>   - closing both queue routes to Administrators fails exactly the **7** client tests you list.
> - **Real browser, including the two things note 6 left unverified:**
>
>   ```text
>   Administrator navigation at 1440 / 820 / 390 px   -> "Ticket Queue", "User Management" (in the menu on mobile);
>                                                        the queue opens, no forbidden notice, no overflow
>   claim through the screen                          -> "You claimed TT-2026-00002, and it moved to Open."
>   Internal Note through the real composer           -> appears only in Internal Notes, by Malee Sutthiwong with
>                                                        the Administrator badge; not in Public Comments; the API agrees
>   /queue/2 signed out -> Login -> sign in           -> back on /queue/2 (the rolesForPath fix)
>   Requester on /queue and /queue/2                  -> sent home with the forbidden notice; GET /api/staff/tickets -> 403
>   ```
>
> ### 🟠 Worth doing now: record the contract's approval before more implementation lands
> On `lab4-staging`, `specification.md`'s header still reads **"Draft for review"**, and no PR yet records #78's approval and merge commit (`f14ae15`), though the PR said one would follow. This is the first implementation PR, and Part 2 asks for "evidence that the specification existed before the main implementation PRs were completed". A one-line PR updating the header, merged before or alongside this one, makes the timeline self-evident on `main` later.
>
> ### 🟡 Minor (not blocking)
> - **The client flake now reaches the new file.** Run on its own, `client/tests/lab-04/RoleNavigation.test.tsx` failed in **2 of 6** runs, each right at Testing Library's 1000 ms limit (UI-27 "opens a ticket's staff detail screen": `Unable to find [data-testid="detail-ticket-number"]` at 1031 ms; the "/tickets/new forbidden notice" case at 1021 ms). The full serial and parallel runs passed. It's the D-22 limitation you're already investigating, and new route-level tests written the same way inherit it. Worth keeping in mind for Issue 9: the first test in a file seems to pay the cold-start cost.
> - **A heads-up for AC-31 (Issue 9):** the Login page logs two "Failed to load resource: 401" console errors from `GET /api/auth/me`. That's correct behaviour today. But AC-31 says "no console error" on every screen, and the browser counts a failed request as one, so `/me` answering `200 { "user": null }` for "nobody signed in" (or AC-31 excluding network logs) will need deciding.
> - **`tests.md` §3.1 edits an approved document,** as your note 2 says. The Partial / Pass split is honest and the legend explains it. It's fine with me, as long as the issue bodies are synced (note 8) before the issues they now point at start.
>
> Approving. A clean, honest first step. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-07 06:32 UTC, @Menelaus122)

> Thx kub

### [#80](https://github.com/Menelaus122/TokTickITV2/pull/80) — Add the Actions Taken model, migration, and seed (Issue 3)

**Verdict:** Approved · **merged** 2026-10-06 by @WirachatTH

**Review — Approved** (2026-10-06 12:53 UTC, @WirachatTH)

> Approved. This is a careful data PR:
> - The migration is additive, and its one `DROP INDEX` is the superseded owner index.
> - The rollback documents exactly what it can't undo.
> - Running the rollback for real caught the contract's wrong `migrate resolve --rolled-back` (P3012). That's the best kind of finding.
> - The scratch-schema approach (note 3) is a smart answer to the enum-in-transaction problem.
>
> Rather than only re-run the suites, I upgraded a **real Lab 3 database** the way it will happen on `main`, then replayed the seed against the contract's own rules. I cloned `feature/3-actions-taken-data` at `dbad718`.
>
> ### What I verified
> - **Upgrade from a Lab 3 database with real activity.** I built a database from `main` (`243ef5f`) and created data through the Lab 3 API:
>   - three tickets, a Requester comment and an Internal Note;
>   - a claim, `IN_PROGRESS`, then `RESOLVED` with a reason;
>   - an IT Priority change, a Requester's "appears resolved", and an attachment;
>   - a user created and then deactivated.
>
>   Then I snapshotted all 8 Lab 3 tables (every row, every column) and the schema, and ran:
>
>   ```text
>   prisma migrate deploy                     -> all 8 Lab 3 tables identical; all 19 tickets at version 1; 0 actions, 0 history
>   rollback script + delete the history row  -> all 8 tables identical, and the schema identical to before
>                                                (pg_dump differs only in its random \restrict token)
>   prisma migrate status                     -> "not yet been applied: 20261006093537_lab4_…"   (your P3012 fix works)
>   prisma migrate deploy (again)             -> applied; tables still identical
>   seed, then seed again                     -> the second run changes nothing (actions, history, tickets, users);
>                                                my three Lab 3 tickets and my user untouched, with no history or actions added
>   ```
>
> - **The seed, replayed against the contract's rules: 0 violations.**
>   - **Status history:** every one of the 14 chains starts at `NEW`, follows the BR-15 matrix step by step, is in time order, and ends at the Ticket's `currentStatus` (the two `NEW` tickets rightly have none).
>   - **Actions:** every one is within the BR-03 / BR-04 / BR-06 limits (not dated before its Ticket, not in the future, a note exactly when Follow-Up = Yes), and performed by IT Staff or an Administrator.
>   - **D-14:** no action was recorded while its Ticket was `RESOLVED`, `CLOSED`, or `CANCELLED`.
>   - **The gate held at every entry into `RESOLVED`:** at that moment there was a relevant action, and the most recently recorded one had Follow-Up = No.
>   - **Spread:** 0 actions on New and Cancelled, 1 on each Open and Closed, 2–3 on In Progress; a non-owner action and an Administrator action. The reopened pair is right: #13 has no action since its reopen, #14 has one.
> - **Your numbers reproduce, on that upgraded and seeded database:**
>   - server **416/416** (28 files), with **11** in `migration.regression.test.ts`, and no `lab4_scratch_*` schema left behind;
>   - client **363/363**;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages.
> - **Your UI-27 fix:** `client/tests/lab-04/RoleNavigation.test.tsx` on its own now passes **6 of 6** runs (2 of 6 failed in my previous review). Waiting for the call was the right fix.
> - **Spot-checked mutation:** removing the owner-index restore from the rollback fails MIG-05, as your table says.
>
> ### 🟠 Still open from my Issue 2 review: record the contract's approval
> `specification.md`'s header on `lab4-staging` still reads **"Draft for review"**, and no PR records #78's approval and merge commit (`f14ae15`). Two implementation PRs have now been opened since the contract was approved. That header is the Part 2 evidence that "the specification existed before the main implementation PRs were completed", and it gets harder to show the longer it waits. A one-line PR would settle it.
>
> ### 🟡 Minor (not blocking)
> - **Line endings (your note 7).** The migration files are stored with LF in git (I checked the blobs), but a Windows checkout with `core.autocrlf=true`, like mine, writes them as CRLF. Prisma checksums `migration.sql`, so a `migrate dev` from such a checkout can report an applied migration as modified. One `.gitattributes` line, `*.sql text eol=lf` (or `server/prisma/migrations/** text eol=lf`), removes the exposure for Lab 3's migrations too.
> - **The seed's one-time `updatedAt` catch-up (note 4)** is reasonable, and I saw it stay put on the second run. Worth one line in the README's seed section, since it changes "Last Updated" on the sample tickets of an existing database once.
> - **Issue bodies (note 8):** worth syncing #68–#74 before Issue 4 starts, so the next PR's acceptance criteria match `tests.md` §3.1.
>
> Approving. This is a migration that will survive contact with a real Lab 3 database. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-07 06:32 UTC, @Menelaus122)

> Thx kub

### [#81](https://github.com/Menelaus122/TokTickITV2/pull/81) — Add the Actions Taken API (Issue 4)

**Verdict:** Changes requested → Approved · **merged** 2026-10-06 by @WirachatTH

**Review — Changes requested** (2026-10-06 15:50 UTC, @WirachatTH)

> Request Changes. This is very solid work:
> - The `requestKey` replay is looked up **inside** the Ticket's row lock, so simultaneous first submissions can't both miss it.
> - Edits compare the version under the same lock.
> - A no-op edit returns before writing anything.
> - All the BR-03 / BR-04 rules live in one `checkFields` that create and edit share.
> - The 37-break mutation table, with the honest note about the 4-request race that timing alone serialised, is exemplary.
>
> I cloned `feature/4-actions-taken-api` at `8ca1861` and ran it on its own ports against a fresh migrated and seeded database.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **561/561** (30 files), with **31** in `action-taken-rules.test.ts`, **107** in `actions-taken.api.test.ts`, and **24** in `lab-04/authorization.api.test.ts`;
>   - client **363/363**;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages.
> - **Concurrency, live, with my own parallel requests:**
>
>   ```text
>   12 simultaneous creates with one requestKey    -> one 201, eleven 200s; exactly 1 row with that key
>   5 simultaneous edits at expectedVersion 1      -> one 200, four 409 STALE_UPDATE; stored version 2
>   ```
>
> - **Access, live:** the owning Requester reads every action with exactly the 13 api-spec §1.3 fields (no `requestKey`) and gets `403` on create; another Requester gets `404`.
> - **The rules, read line by line:** NUL is refused in every text field, including an ignored note. Lengths are counted with `.length`, which can only be stricter than the database's code-point `VARCHAR`. Edits validate the **merged** record, so sending Yes onto an action with no note fails. And "changed" is decided on normalised values.
>
> ### 🔴 Must fix: an impossible date is silently stored as a different date
> `checkActionAt` checks the *shape* with `ISO_WITH_ZONE`, then trusts `new Date(value)`. But V8 doesn't reject an out-of-range day within 1–31; it **rolls it over**:
>
> ```text
> new Date("2026-02-31T10:00:00Z") -> 2026-03-03      new Date("2026-04-31T10:00:00Z") -> 2026-05-01
> new Date("2026-02-29T10:00:00Z") -> 2026-03-01      new Date("2026-06-31T10:00:00Z") -> 2026-07-01
> ```
>
> Live, on an `IN_PROGRESS` ticket whose `createdAt` I moved to 1 September (to stand in for any ticket opened last month):
>
> ```text
> POST … actionAt "2026-09-31T10:00:00Z"        -> 201, stored actionAt 2026-10-01T10:00:00.000Z
> POST … actionAt "2026-09-31T23:30:00+07:00"   -> 201, stored actionAt 2026-10-01T16:30:00.000Z
> ```
>
> **The API-09 case "an impossible date" passes for a different reason.** It sends `2026-02-31T10:00:00Z` to a ticket created a day before the run. That date becomes 3 March, which is refused by the *before the ticket was created* rule, not because it's impossible. So the test is green without measuring the rule it names. On any ticket older than the rolled-over day, the same input is accepted.
>
> → After parsing, check that the calendar fields round-trip. For example, capture `YYYY-MM-DD` from the regex and require `day <= daysInMonth(year, month)` (leap years included). Or rebuild the date from the parsed instant in the given offset and compare it with the text. Then make API-09's impossible-date case use a ticket created **before** the rolled-over day, plus a unit case like `2026-09-31` with an early `ticketCreatedAt`, so the test fails for the right reason. `24:00` (also accepted today, and rolled to the next day) is legal ISO 8601 for midnight, so either keep it or refuse it, but decide deliberately. `checkFields` is shared, so one fix covers create and edit.
>
> ### 🟠 Third time: record the contract's approval
> `specification.md`'s header on `lab4-staging` still reads **"Draft for review"**, and three implementation PRs (#79, #80, and this one) have now been opened after #78 merged without it. Part 2 asks for "evidence that the specification existed before the main implementation PRs were completed". The merge history still shows #78 first, but the document itself still claims to be a draft. Please land the one-line header PR (approver, #78, `f14ae15`) before this one merges.
>
> ### 🟡 Minor (not blocking)
> - **Check order (your note 2):** validation before staleness for actions, and staleness first for status (BR-24), is fine as each section reads. If you unify them later, stale-first tells the user the more useful thing (reload) when both are wrong.
> - **Issue bodies (note 7):** still worth syncing #68 – #74 before Issue 5 starts.
>
> Fix the date round-trip (with a test that fails for the right reason) and land the header PR, and I'm happy to approve. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-06 16:09 UTC, @Menelaus122)

> Thanks, all three confirmed, and the first was worse than described: I reproduced it on the running server before fixing it (`2026-02-31` stored as 3 March, `24:00` as the next midnight, on create and on edit). My API-09 case passed for the reason you give, and my unit test had the same flaw. Fixed in `446ff62` in the shared field check, with calendar tests (leap years, the last day of every month) and a 24:00 refusal, run on a ticket old enough that nothing else can refuse the date; I broke the check 7 ways and 6 are caught (the seventh is redundant with the parse). On 24:00: refused deliberately, since no form produces it and accepting it changes the date.
>
> The header PR is #82, the follow-up #78 promised and I never opened. It should merge before this one. I also synced issues #68–#74 (checked afterwards: each matches its source) and updated this description with the new counts and the correction.

**Review — Approved** (2026-10-06 16:29 UTC, @WirachatTH)

> Approved! Thanks, and good call reproducing it on the running server first! I re-checked `446ff62` and #82.
>
> ### 🔴 The impossible-date bug is fixed
> - **The check:** `ISO_WITH_ZONE` now bounds every time part (hours 00–23, minutes and seconds 00–59, offset hours 00–23), and `isRealDay` checks the calendar, leap years included, **before** `new Date` can roll anything over. It sits in the shared field check, so create and edit both get it.
> - **My probe against the fixed function:**
>
>   ```text
>   refused   2026-02-31, 2026-02-30, 2026-02-29, 2026-04-31, 2026-09-31T23:30:00+07:00, 2100-02-29,
>             2026-02-28T24:00:00Z, 23:60, +24:00, month 00, day 00
>   accepted  2028-02-29 (leap), 2026-09-30T23:30:00+07:00 -> 16:30Z, 2026-12-31T23:59:59Z, +14:00
>   ```
>
> - **Live, on the same back-dated ticket as last time:** `2026-09-31T10:00:00Z`, its `+07:00` variant, and `2026-10-04T24:00:00Z` now get `400` on `actionAt` with nothing stored; `2026-09-30T10:00:00Z` still records (`201`).
> - **The tests now fail for the right reason:**
>   - with the round's original `actionTakenRules.ts` put back, **7** tests fail, including both API-09 cases, which now run on a ticket old enough that the "before the ticket" rule can't answer for them;
>   - removing only the `isRealDay` call fails **6**.
>
>   Refusing `24:00` deliberately is a fine choice.
>
> ### 🟠 The header: #82 is accurate
> #82 changes one line, and it matches GitHub: approved by @WirachatTH in #78 on 2026-10-05 (after one round of changes requested), merged as `f14ae15`, before any implementation PR (#79 was opened on 10-06). I'll merge #82 before this one, as you suggest.
>
> ### Your numbers reproduce
> - server **570/570** (30 files);
> - `tsc --noEmit` exits 0 on both packages;
> - Lab 2 + Lab 3 Playwright **46/46**;
> - client **363/363** in 2 of 3 serial runs. The other run lost Lab 3's UI-07 at 1015 ms, the known D-22 flake; this PR changes no client file.
>
> Thanks also for syncing #68 – #74.
>
> Approving. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-07 06:33 UTC, @Menelaus122)

> Thx kub

### [#82](https://github.com/Menelaus122/TokTickITV2/pull/82) — Mark the Lab 4 specification as approved

**Verdict:** Approved · **merged** 2026-10-06 by @WirachatTH

**Review — Approved** (2026-10-06 16:31 UTC, @WirachatTH)

> Approved! Thanks for opening this. Every fact in the new line checks out against GitHub and git:
>
> - **Approved by @WirachatTH in #78 on 2026-10-05:** after one round of changes requested (15:10 UTC), approved at 16:08:17 UTC.
> - **Merged into `lab4-staging` as `f14ae15`:** merged at 16:08:34 UTC, and `f14ae15` is "Merge pull request #78 from Menelaus122/feature/1-sprint4-contract".
> - **"Before any implementation PR":** the first implementation PR, #79, was opened on 2026-10-06 at 09:02 UTC, after that merge.
> - **Note 1's history:** `specification.md` on `lab4-staging` has exactly three commits: #78's `a8adf5a` and `042f5cf`, and #80's `dbad718` (the §7.6 rollback-command fix).
>
> ### Verified
> - **The change is one line.** Against its merge base (#80's merge), #82 changes one line of `docs/lab-04/specification.md` and nothing else. GitHub's file view also shows `1+ 1-`.
> - **It merges cleanly** into current `lab4-staging`, with no conflicts, and the merged line reads exactly as in your description.
>
> ### One note
> Note 2 asked for this to merge before #81, but #81 has already merged. The order doesn't change the evidence: the line records when #78 was approved and merged, and the merge history still shows #78 well before #79, #80, and #81. Nothing needs to change in the PR for it.
>
> Approving. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-07 06:33 UTC, @Menelaus122)

> Thx kub

### [#83](https://github.com/Menelaus122/TokTickITV2/pull/83) — Add the Actions Taken UI to Ticket Detail (Issue 5)

**Verdict:** Approved · **merged** 2026-10-07 by @WirachatTH

**Review — Approved** (2026-10-07 07:04 UTC, @WirachatTH)

> ## Review — Lab 4 Issue 5: Actions Taken UI on Ticket Detail — Approve ✅
>
> @Menelaus122 This is a thorough UI PR:
> - The `requestKey` is minted when the form opens and kept for retries.
> - An untouched Action Date/Time goes back exactly as stored.
> - **Latest recorded** follows `createdAt`, not the date.
> - The six tests of the API client's own requests close the gap mocks usually leave.
>
> The honest corrections list is also worth noting: the double-submit guard that no test reached until you added one, and the focus-after-edit bug. I cloned `feature/5-actions-taken-ui` at `f870675` and ran it on its own ports against a fresh migrated and seeded database. Then I aimed my browser checks at the things your note 4 says weren't verified.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - client **457/457** (21 files), with **79** in `ActionsTaken.test.tsx` and **13** in `ZenGreenLab4.test.tsx`. One of two serial runs lost Lab 3's UI-07 and UI-09 at 1015 ms, the known D-22 flake, not in this PR's files;
>   - server **570/570**;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
> - **Time zones (note 4 says "only Chromium, on this machine's time zone").** I recorded an action "2 hours ago" with the browser in three zones:
>
>   ```text
>   Asia/Bangkok          typed 2026-10-07T11:56 -> stored 2026-10-07T04:56:00.000Z  edit input 11:56   card "11:56 AM"
>   America/Los_Angeles   typed 2026-10-06T21:56 -> stored 2026-10-07T04:56:00.000Z  edit input 21:56   card "9:56 PM"
>   Pacific/Kiritimati    typed 2026-10-07T18:56 -> stored 2026-10-07T04:56:00.000Z  edit input 18:56   card "6:56 PM"
>   ```
>
>   It's the same instant everywhere, and it round-trips into the edit form unchanged.
> - **A lost response.** I let the server record the create, then dropped the response (`route.fetch()`, then `abort("connectionreset")`):
>   - the form stayed open with my text and a failure message;
>   - **Save** again re-sent the **same** `requestKey`;
>   - result: **1 stored action, 1 card on screen**.
>
>   That's BR-28 working end to end through the UI.
> - **Two users, real browser:** IT Staff A and B both open Edit on one action; B saves first, then A saves. A sees "Someone else edited this action while you were working on it. Your changes are still in the form. Show latest", with the text kept, and the stored row keeps B's result at version 2.
> - **The Requester:** the region shows with **0 buttons and 0 inputs**, and the Follow-up Note and performer are visible.
> - **A resolved ticket:** Add action and Edit are disabled, with "This ticket is Resolved, so no more actions can be recorded."
> - **Layout:** with the create form open, there's no horizontal overflow at 1440, 820, 390, or 320 px, and 0 page errors throughout.
>
> ### 🟠 Worth fixing: the form's own default is refused on a ticket created this minute
> The form defaults Action Date/Time to *now, truncated to the minute*, while BR-06 compares against the Ticket's exact `createdAt`. On a ticket created at 13:54:39, opening **Add action** at 13:54 and saving the default gives:
>
> ```text
> Action Date/Time cannot be before the ticket was created.      (no request sent; the server would refuse 13:54:00 too)
> ```
>
> So recording work on a ticket within a minute of its creation fails with the value the form chose. That's exactly what a demo ("create a ticket, then show Actions Taken") or Issue 10's E2E journey will do. The person can recover by picking the next minute, but the message blames them for a value they never typed.
>
> → The smallest fix is in the form's default: `max(now, ticketCreatedAt)` rounded **up** to the next minute. That's at most 59 seconds ahead, well inside BR-06's five-minute tolerance, and the server needs no change. A unit case with a ticket created at `:39` seconds, plus "save the default", would pin it.
>
> ### 🟡 Minor (not blocking)
> - **The empty state stays visible while the create form is open.** At 390 px the form is followed by "No actions recorded yet. Record what you do on this ticket…" and a disabled **+ Add action**. Hiding the empty state while the form is open (or only its button) would read cleaner.
> - **Note 4's leftovers** (focusable region heading for "Go to Actions Taken", Status History beside it) are correctly Issue 6's. Thanks for listing them.
>
> Approving. A careful, honest UI increment. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-07 07:50 UTC, @Menelaus122)

> Thanks, and thank you for the fresh-ticket case: none of my tests or my live check had it, because they all used tickets created long before the form was opened. Fixed in #84. I reproduced it first (a ticket created at :39 and a form opened at :50 started at :54, a minute before the ticket), and the same live script fails on the merged code and passes with the fix.
>
> I kept the default at "now, to the minute" wherever that is already allowed and moved it to the next whole minute only on a ticket created in the current minute, so it is never more than 59 seconds ahead and ordinary tickets are unchanged. The max(now, created) form you suggested is a three-line change if you'd rather have it (note 1 in #84). The empty state now steps aside while the form is open, the whole block, since its sentence would contradict the form.

### [#84](https://github.com/Menelaus122/TokTickITV2/pull/84) — Start the Action Date/Time on a minute the ticket existed in (follow-up to #83)

**Verdict:** Approved · **merged** 2026-10-07 by @WirachatTH

**Review — Approved** (2026-10-07 08:01 UTC, @WirachatTH)

> Approved! Your narrower fix is better than my suggestion: it moves the default only when "now, to the minute" would be before the ticket, so every other ticket still opens on the current minute. I checked out `302b4d1`.
>
> ### Verified
> - **The logic:** `defaultActionTime` keeps the truncated current minute when it's on or after `createdAt`, and otherwise rounds `createdAt` **up** to the next whole minute, leaving one exactly on `:00.000` alone. Real UTC offsets are all whole minutes (Nepal's +5:45 included), so the local rounding lands on a real minute boundary in every zone. Your note on `>=` versus `>` is right: both paths return the same minute there.
> - **My original scenario, live.** I set a seeded `OPEN` ticket's `createdAt` to one second into the current minute, opened **Add action** in that same minute, and saved the form's own default:
>
>   ```text
>   Asia/Bangkok     created 07:57:01Z | default 14:58 (local) | no field error | stored 07:58:00Z, recorded 07:57:19
>   Asia/Kathmandu   created 07:57:01Z | default 13:43 (local) | no field error | stored 07:58:00Z, recorded 07:57:25
>   ```
>
>   The default is the next minute after creation, under a minute ahead of the recording time, well inside BR-06's five minutes. And "No actions recorded yet." was absent while the form was open in both.
> - **Red first:** the new tests run against `lab4-staging`'s `ActionsTakenRegion.tsx` fail **3**, the three you list as red before the fix; with the fix the file passes **86/86** (79 + 7).
> - **Your numbers reproduce:** client **464/464** (21 files, serial); `tsc --noEmit` exits 0; Lab 2 + Lab 3 Playwright **46/46**. No server file changed.
>
> Approving. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-07 08:15 UTC, @Menelaus122)

> Thx kub

### [#85](https://github.com/Menelaus122/TokTickITV2/pull/85) — Add the ticket workflow and resolution gate (Issue 6)

**Verdict:** Approved · **merged** 2026-10-07 by @WirachatTH

**Review — Approved** (2026-10-07 15:45 UTC, @WirachatTH)

> Approved. This is a careful piece of work:
> - `resolutionGate` has no Action Date/Time input at all, so the two-clock problem from #78 can't come back.
> - Both `permittedTransitions` and `blockedTransitions` are built by one function, `transitionOptions`, that the PATCH route's own refusal also uses. So the screen's explanation and the API's answer can't drift apart.
> - The Ticket-then-User lock order is stated in `ticketLock.ts`, and the owner PATCH's `FOR SHARE` read follows it.
> - Your client mutation table is honest about the 37 breaks that never ran. Thank you for saying so rather than rounding it up.
>
> I cloned `feature/6-ticket-workflow` at `efa7cd6` and ran it on its own ports against a fresh migrated and seeded database. Beyond re-running your suites, I replayed the stateful rules with real requests.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **674/674** (32 files), with **29** in `resolution-gate.test.ts`, **74** in `ticket-workflow.api.test.ts`, and **25** in `lab-04/authorization.api.test.ts`;
>   - client, serial, twice: **509/509** (22 files), with **39** in `TicketWorkflow.test.tsx` and **19** in `ZenGreenLab4.test.tsx`;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
> - **The gate, replayed through the API:**
>
>   ```text
>   resolve → reopen → in progress → resolve with only the pre-reopen action     -> ACTION_REQUIRED
>   edit that pre-reopen action, then resolve                                    -> still ACTION_REQUIRED (its createdAt doesn't move)
>   new action with follow-up → FOLLOW_UP_PENDING; closing action → 200          -> history rows: 6, one per change
>   ```
>
> - **Races, 8 each, real parallel requests, both locks held:**
>
>   ```text
>   resolve vs. "edit the action to Follow-Up = Yes":   4 × (resolve 200, edit 409)   4 × (edit 200, resolve 409)
>                                                       never both 200; no ticket RESOLVED while its latest action needs follow-up
>   resolve vs. unassign:                               8 × (resolve 200, unassign 409); the ticket ends RESOLVED with its owner
>   ```
>
> - **Versions:** `expectedVersion` of `0`, `-1`, `1.5`, `"1"`, `null`, `2147483648`, and `true` are each `400`. A claim moves the version by 1 (including `NEW` → `OPEN`), and the Requester's mark moves it too. A staff save at the old version is `409 STALE_UPDATE` carrying the current version. A mark repeated moves it; a withdrawal when none is set doesn't. A comment, a note, and an action leave it alone (3 before and after).
> - **History:** the Requester sees each step with name and role only (no email), another Requester gets `404`, and `POST` / `PATCH` / `DELETE` on it answer `404`. An Administrator's moves are recorded under their own name.
> - **Real browser, two users:**
>   - with no action recorded, "Not available now: Resolved — Record at least one action…", and **Go to Actions Taken** focuses the "Actions Taken (0)" heading;
>   - recording an action **with** follow-up leaves Resolved blocked with the follow-up message, and a closing action then makes **Resolved** appear in the select, with no reload; Apply stays disabled until a reason is typed;
>   - a colleague changes IT Priority, and my stale save shows the warning "…It is now In Progress, owned by …", with the typed reason kept; **Show latest** keeps both the reason and the chosen move and shows the new IT Priority, and the next Apply succeeds;
>   - the Requester sees the timeline with 0 controls in it;
>   - no horizontal overflow at 1440, 820, 390, or 320 px on either screen, and 0 console or page errors.
> - **Mutations of my own, 7 tried, on the gate and workflow rules.** Six were caught: `actionAt`-style relevance (2 failures), the `<=` boundary at the reopen instant, a doubled history row (the 15-pair WF-01), the signal not cleared, the owner rule's priority over the gate, and unassign allowed on a resolved ticket.
>
> ### 🟡 One mutation survived: a twice-reopened ticket has no test
> I changed the gate's "latest reopen" query in `gateFor` to the **oldest** (`orderBy: [{ createdAt: "asc" }, { id: "asc" }]`) and all **160** workflow, gate, and Lab 3 detail tests still passed. The code as written is right; no test measures it. Every WF-07 / UNIT-09 case reopens at most **once**, so "most recent" and "oldest" give the same answer.
>
> I replayed the scenario against both versions with real requests:
>
> ```text
> action → resolve → reopen → in progress → action → resolve → reopen → in progress → resolve (no action since the 2nd reopen)
>   correct code:  409 ACTION_REQUIRED
>   oldest-reopen: 200 — the second round's action is wrongly counted, though it predates the second reopen
> ```
>
> → A case in WF-07 for two reopens (and a matching `resolutionGate` unit with the last reopen later than a counted action) would pin it. The line protects exactly the thing D-07 says the gate is for: a ticket can't be re-resolved on work done before it failed again.
>
> ### Small notes (not blocking)
> - **A marked mutation gap you already named:** the 37 client breaks that didn't run, and the three tests added afterwards "not seen failing". Worth running those 40 once on a quieter machine before the final regression (Issue 9).
> - **Note 3(c)** (stale check after `expectedOwnerId`) matches BR-26 as written. Fine.
> - **The flaky client tests didn't appear** in either of my two serial runs this time.
>
> Approving. 🙏
> Wirachat 67070501041

**Review — Approved** (2026-10-10 05:15 UTC, @WirachatTH — submitted after the merge)

> *(approved with no text)*

**Author's response** (2026-10-10 07:17 UTC, @Menelaus122)

> thx kub

### [#86](https://github.com/Menelaus122/TokTickITV2/pull/86) — Add the Requester Dashboard and URL-driven My Tickets filters (Issue 7)

**Verdict:** Approved · **merged** 2026-10-10 by @WirachatTH

**Review — Approved** (2026-10-10 05:17 UTC, @WirachatTH)

> Approved! This is a clean slice:
> - The whole card is one link whose accessible name carries both the number and the destination.
> - The address is the one place My Tickets' filters live, with `replace` so Back leaves the page.
> - The dashboard endpoint reads its own session and nothing else.
> - Finding Lab 2's 240 px phone search box by looking at the screenshots, then fixing it because every card opens that screen, was a good call.
>
> I cloned `feature/7-requester-dashboard` at `596fa0f` and ran it on its own ports against a fresh migrated and seeded database, then checked it from the outside.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **756/756** (34 files), with **26** in `group-filter.test.ts`, **51** in `requester-dashboard.api.test.ts`, and **30** in `lab-04/authorization.api.test.ts`;
>   - client, serial: **618/618** (24 files), with **35** in `RequesterDashboard.test.tsx`, **38** in `DrillDown.test.tsx`, **45** in `ZenGreenLab4.test.tsx`, and **26** in `RoleNavigation.test.tsx`;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
> - **Every number against my own SQL, for all five seeded Requesters, including the zero account:**
>   - the four cards, `needsAttention`, and `recentTickets` (ids and order) equal an independent query;
>   - **every card's `href`**, translated to the list API, returns `totalItems` equal to the card's value;
>   - the answer has exactly `generatedAt`, `metrics`, `needsAttention`, and `recentTickets`, and `Cache-Control: no-store`.
> - **Scope and access:** IT Staff `403`, Administrator `403`, no session `401`. `?requesterId=…&userId=…&me=…&owner=me&group=open&limit=50` together with an `X-Requester-Id` header for another Requester returns the same numbers as the plain call.
> - **The group filter on the list API:**
>
>   ```text
>   group=open                                       -> 200, 3
>   group=open&currentStatus=RESOLVED                -> 200, 0     (empty, not an error)
>   group=OPEN | group=open&group=open | group=closed -> 400 INVALID_QUERY
>   group=                                           -> 200, all 4
>   ```
>
> - **Real browser (Requester):**
>   - lands on `/dashboard` with the navigation "Dashboard · My Tickets · Create Ticket" and Dashboard as the current page;
>   - each card opens My Tickets with the filter in the address, the status control showing it, and "Showing 3 of 3" matching the card;
>   - a reload keeps `?group=open&status=IN_PROGRESS&sortDir=asc`;
>   - the hand-edited `?page=abc&status=BOGUS&group=nope&pageSize=7&categoryId=-4` shows a plain list with no alert;
>   - typing a search writes `?group=open&search=printer` with 0 history entries added, and Back goes to `/dashboard`;
>   - IT Staff and the Administrator land on their own home, `/dashboard` sends them back with the forbidden notice, and they have no Dashboard link;
>   - no horizontal overflow at 1440, 820, 390, or 320 px, with data and with none (card columns 4 / 2 / 1 / 1), and 0 page or console errors.
> - **Code read:** `dashboard.ts` runs the six statements in one `$transaction` at `RepeatableRead`, which is the right setting for a single snapshot in Postgres. The unobservable break you describe in your corrections is honest.
>
> ### 🟠 Needed in this PR: the follow-up from the Issue 6 review isn't here
> The approval of #85 (2026-10-07) recorded one surviving mutation: the gate's "latest reopen" lookup can be switched to the **oldest** reopen and all 160 related tests stay green, because no test reopens a ticket twice. This PR neither adds the test nor mentions it (`git diff` of `ticket-workflow.api.test.ts` and `resolution-gate.test.ts` is empty, and "twice" appears in neither). Under the Lab 4 workflow, approve-with-comments items are fixed in the next issue's PR, in their own section of its description.
>
> → Please add to this PR, with a short "Follow-ups from the Issue 6 review" section:
> - a WF-07 case that resolves, reopens, records and resolves again, reopens a second time, and expects `409 ACTION_REQUIRED` on the next resolve;
> - a matching `resolutionGate` unit where the last reopen is later than an action that would count against the first;
> - the proof that the case fails against the oldest-reopen break.
>
> ### 🟡 Minor (not blocking)
> - **The client flake showed once more.** One of my two serial client runs lost Lab 3's UI-08 at 1024 ms ("shows the user's name and role…"); the other was 618/618. It's still the D-22 limitation, in a Lab 3 file this PR touches only by one line. Worth keeping in mind for Issue 9.
> - **My seeded Requesters have at most 4 tickets,** so the "ties on `updatedAt`" and "list is capped at five" cases are only exercised by your own 12-ticket tests (they pass, and I checked the tie order with 4 equal timestamps). Fine; just noting that the seed alone doesn't show a full list on screen.
>
> Approving. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-10 07:17 UTC, @Menelaus122)

> thx kub

### [#87](https://github.com/Menelaus122/TokTickITV2/pull/87) — Add the IT Staff and Administrator Dashboard and URL-driven Ticket Queue filters (Issue 8)

**Verdict:** Changes requested → Approved · **merged** 2026-10-10 by @WirachatTH

**Review — Changes requested** (2026-10-10 11:29 UTC, @WirachatTH)

> Request Changes. This is a strong increment, and one item in it needs another look before it merges:
> - The `userCounts` key is absent, not empty, for IT Staff, so the screen can't show a region the server withheld.
> - Moving the load / refresh / failure logic into `dashboardParts.tsx` and re-running Issue 7's breaks against it was exactly the right way to share it.
> - `cutDescription` counting characters instead of code units is a detail most people miss.
> - Your corrections list is honest again, including the break that is equivalent and can't be caught.
>
> I cloned `feature/8-staff-dashboard` at `fc1346a` and ran it on its own ports against a fresh migrated and seeded database.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **839/839** (35 files), with **68** in `staff-dashboard.api.test.ts`, **34** in `group-filter.test.ts`, and **37** in `lab-04/authorization.api.test.ts`;
>   - client, serial, twice: **730/730** (25 files), with **53** in `StaffDashboard.test.tsx`, **76** in `DrillDown.test.tsx`, **57** in `ZenGreenLab4.test.tsx`, and **35** in `RoleNavigation.test.tsx`;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
> - **Every figure against my own SQL, for six callers (four IT Staff including the idle member, and both Administrators):**
>   - the four cards, the five status rows, and `myTickets`, `urgentTickets`, and `myRecentActions` (ids and order) equal an independent query;
>   - **every card's and status row's `href`**, followed unchanged against `GET /api/staff/tickets`, returns `totalItems` equal to its value;
>   - "mine" differs by caller (`assignedToMe` 3 / 2 / 2 / 0).
> - **`userCounts`:** present only for the two Administrators, equal to the user table, with no `href` on any of the four; IT Staff and the idle member get no key at all.
> - **Access and scope:** a Requester gets `403`, no session `401`. `?me=…&userId=…&owner=…&requesterId=…&limit=50&group=open` plus an `X-User-Id` header naming a colleague returns the same numbers as the plain call.
> - **The queue's filters:** `group=open&owner=unassigned` → 2, `&owner=me` → 3, `&status=RESOLVED` → 0 (empty, not an error); `group=OPEN`, a repeated group, `owner=0`, and `owner=99999999999` are each `400`.
> - **Recorded order and the cut:** I created an action dated *24 hours ago* after one dated two hours ago, and "Backdated entry recorded last" is the first row of `myRecentActions`. A description with an emoji at character 120 comes back 121 characters long with the emoji whole, then `…`.
> - **Real browser:**
>   - IT Staff land on the Dashboard with "Dashboard · Ticket Queue" and "Welcome back, Nattapong". Every card and status row opens a queue showing exactly its number, with its filter in the address. A Ticket row opens `/queue/5`, and **Open Ticket Queue** opens the whole queue (10 of 16).
>   - The queue's filters live in the address (reload keeps `?group=open&owner=me&itPriority=URGENT&sort=updatedAt&direction=asc`), hand-edited nonsense gives a plain list with no alert, and typing a search adds no history entry; Back returns to `/dashboard`.
>   - The Administrator sees "Dashboard · Ticket Queue · User Management" and the Accounts region with REQUESTERS 6 · IT STAFF 4 · ADMINISTRATORS 2 · INACTIVE 2 as plain numbers and one **Open User Management** link; none of the four counts is a link.
>   - A Requester typing `/queue` is sent to `/dashboard` with the notice.
>   - No horizontal overflow at 1440, 820, 390, or 320 px on the staff, Administrator, and idle dashboards and on the open queue (card columns 4 / 2 / 1 / 1), the "Open tickets" chip is visible at every width, and there are 0 console or page errors.
>
> ### 🟠 Needed in this PR: the twice-reopened test, raised in two reviews, is still not there
> The Issue 6 review (#85) recorded that the gate's "latest reopen" lookup in `gateFor` can be switched to the **oldest** reopen with all 160 related tests still green, because no test reopens a ticket twice. The Issue 7 review (#86) asked for it to be folded into that PR. #86 merged without it, and **this PR doesn't have it either**: `grep` for "twice", "second reopen", and "reopened twice" in `ticket-workflow.api.test.ts` and `resolution-gate.test.ts` on this branch finds nothing, and the description doesn't mention it.
>
> It's small, and it protects the exact thing D-07 says the gate is for (a ticket can't be re-resolved on work done before it failed again):
> - a WF-07 case that does resolve → reopen → record and resolve → reopen a second time → resolve with no new action, and expects `409 ACTION_REQUIRED`;
> - a `resolutionGate` unit where the last reopen is later than an action that counted against the first;
> - and, per the Lab 4 workflow, a short "Follow-ups from earlier reviews" section in the description with the proof that it fails against the oldest-reopen break (switch the `orderBy` in `gateFor` to `asc`).
>
> ### 🟡 Minor (not blocking)
> - **A Requester on `/queue` is now sent to `/dashboard`;** that's right. A bookmark of `/queue` for someone who becomes a Requester is the only odd case, and it works.
> - **The "Waiting for Requester" card counts every owner,** which BR-34 says; the card label doesn't hint at it. A `title` or one line of help ("all owners") would save a question in the demo.
> - **Rows in the 390 px screenshot:** the status badge and priority badge wrap onto a second line under the Summary, as your ui-spec says. It reads well.
>
> Fix the missing test (and mention it in the description), and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Review — Approved** (2026-10-10 12:49 UTC, @WirachatTH)

> Approved! That's the one I wanted! I checked `92e58df` against my previous review.
>
> ### The twice-reopened ticket is now covered
> The commit adds three tests and changes nothing else (3 files: two test files and `tests.md`; no source file):
> - **`ticket-workflow.api.test.ts`:**
>   - resolve → reopen → record and resolve → reopen a second time → resolve with nothing new → `409 ACTION_REQUIRED`, with the status unchanged and the detail's `blockedTransitions` saying the same from the same lookup; a new action then opens it;
>   - the same with a Yes between the reopens: it holds the gate after the first reopen (`FOLLOW_UP_PENDING`), and after the second reopen neither it nor the closing action after it counts.
> - **`resolution-gate.test.ts`:** the same sequence on the pure function, with the gate dated from the second reopen.
>
> **They fail for the right reason.** I switched `gateFor`'s `orderBy` to `createdAt: "asc"` (the oldest reopen), and exactly the two API tests fail, as expected, with everything else green; with the code as written, all 106 gate and workflow tests pass. (The unit test can't see the lookup, since the date is its argument. It pins what the gate does with a later date, and the API tests pin the lookup.)
>
> `tests.md` UNIT-09 and WF-07 say so in their rows.
>
> ### Your numbers reproduce
> - server **842/842** (35 files): the 839 from before plus the three new tests;
> - `tsc --noEmit` exits 0;
> - the client, E2E, and every other file are unchanged since `fc1346a` (the diff has no `client/`, `e2e/`, or `server/src` file), so the 730/730 and 46/46 I reproduced last round still apply.
>
> ### One small thing (not blocking)
> The workflow expects this to be called out in the PR description under its own "Follow-ups from earlier reviews" heading, with the break that proves it. The commit message and `tests.md` say it, but the description doesn't yet. A short section in the description would keep the PR's record complete.
>
> Approving. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-10 12:50 UTC, @Menelaus122)

> Thx kub

### [#88](https://github.com/Menelaus122/TokTickITV2/pull/88) — Harden the whole application and finish the Lab 4 regression (Issue 9)

**Verdict:** Changes requested → Approved · **merged** 2026-10-11 by @WirachatTH

**Review — Changes requested** (2026-10-10 17:53 UTC, @WirachatTH)

> Request changes. This is a big PR, and the server half of it is excellent:
> - `findNul` is iterative with a `seen` set, so a hostile body can't blow the stack.
> - The sign-in NUL check runs before the attempt is reserved, so a NUL password isn't counted as a wrong guess.
> - A test enumerates every write route the server registers and fails if one isn't guarded.
> - The two dialogs share one `useModal` hook and I couldn't make either leak focus.
> - Your "what the new tests found in merged code" table is the most useful thing in the PR.
>
> I cloned `feature/9-final-hardening` at `fff6a74` and ran it on its own ports against a fresh migrated and seeded database. Two of its claims didn't hold for me, so I'm requesting changes on those two; both are small.
>
> ### What I verified
> - **Your numbers reproduce, and the server side is clean:**
>   - server `npx vitest run`: **1069/1069** (38 files), with **21** in `body-guards.test.ts`, **189** in `hardening.api.test.ts`, and **5** in `performance.smoke.test.ts`;
>   - client: **1001** tests in 26 files (see the first request below), with **236** in `FinalRegression.test.tsx`;
>   - Lab 2 + Lab 3 Playwright **46/46**;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
> - **The body guards, hit over HTTP on every write route I could name:**
>
>   ```text
>   NUL in a ticket summary, a comment, a note, appears-resolved, a status reason, an action description,
>   a user's name, an initial password, a stray field, a nested array element, and an object KEY
>                                   -> 400 on that field; nothing stored
>   8 sign-ins with a NUL password  -> 8 × 400, then the real sign-in is 201 (no lock counted)
>   5 wrong passwords, then right   -> 429 (the lock still works)
>   20 000-deep nested array        -> 400, no stack error       200 KB body -> 413
>   categoryId 2147483648, 0, -1, 1.5, null, true, 10^20          -> 400
>   unknown route / malformed JSON  -> the Lab 3 envelope
>   upload with filename*=UTF-8''bad%00name.png                   -> 400 on `file`; the plain name still uploads
>   ```
>
> - **Performance smoke, through the real network stack:** 20 requests each, max **37 ms**, **53 ms**, and **26 ms** (Requester dashboard, staff dashboard, queue filter).
> - **Real browser:**
>   - The removal dialog takes focus on open, and 12 Tab and Shift+Tab presses never leave it.
>   - Escape closes it and focus returns to **Remove**.
>   - A refused removal keeps the dialog open with the reason kept ("Uploaded the wrong file by mistake") and the message inside it; the next removal succeeds.
>   - The user panel takes focus, and Escape closes it and returns focus to **+ Create user**.
>   - A role-changed owner reads "No longer IT Staff" (never "Inactive"), and a deactivated one reads "Inactive".
>   - Across the Requester's, IT Staff's, and the Administrator's screens at 1440, 390, and 320 px: **0 console errors or warnings, 0 page errors, no horizontal overflow**.
>
> ### 🔴 Must fix 1: the intermittent client failures are not cured, and they don't need a loaded machine
> You report the navigation flake "reproduced and explained" (load, widened timeouts), with eight loaded runs at 993/993. On my machine, with the same `vite.config.ts` / `setup.ts` settings, the full client suite failed **3 of 5 full runs, one test each time**, and the failures are at the **new** 5 s limit:
>
> ```text
> run 1:  UI-09 "the old selector URL is gone: a signed-in Requester lands on the Dashboard"  5033 ms
> run 2:  the same test                                                                          5032 ms
> run 3:  RoleNavigation UI-27 "opens the Ticket Queue…"   Unable to find role "navigation" — body is `<div />`
> ```
>
> Alone, `RequesterRegression.test.tsx` passed **10 of 10** and `lab-04/RoleNavigation.test.tsx` **6 of 6**. Running that file next to three other vitest processes reproduced run 3 (1 in 6). Both failing tests are the **first test of their file**, which renders the whole app. So it looks like a cold-start cost (jsdom parsing the stylesheet with `css: true`, module load) that exceeds even 5 s when several workers compete, rather than something a longer `findBy` fixes. This is Part 3 of the final submission ("complete … passing test output from main"), so a full run that fails more than one time in three is a real risk to that evidence.
>
> → Options, cheapest first: (a) a `beforeAll` that renders and unmounts the app once per file that mounts it, so the first test doesn't pay the cold start; (b) cap workers (`poolOptions.threads.maxThreads: 4`, or `--pool=forks`) in `vite.config.ts` so the suite doesn't oversubscribe the machine; (c) if neither is acceptable, record in `tests.md` §7 that a full run can fail one first-render test under load, with the run counts above, instead of "explained". Please also change "reproduced and explained" in the description, since "fixed" isn't established.
>
> ### 🔴 Must fix 2: three presses in one task still create three tickets, and the claim is stronger than the test
> UI-30 and the description say each form "sends one request" when "submitted repeatedly without the button", and the live check says "Create Ticket pressed three times sends one request and makes one ticket". I pressed **Submit Ticket** three times in a single JavaScript task (`b.click(); b.click(); b.click();` inside one `evaluate`), the same shape as your Issue 5 "two submit events in the same tick":
>
> ```text
> Create Ticket       3 presses, same tick -> 3 tickets
> Post comment        3 presses, same tick -> 3 comments
> Record action       3 presses, same tick -> 1 action          (ref guard + requestKey)
> ```
>
> `CreateTicket.handleSubmit` guards with `if (submitting) return;`, which reads **state**. React doesn't flush that state until a microtask, so a second event dispatched before it still sees `submitting === false`. A human double-click arrives as separate tasks and is safe, which is why your sequential live check and the `fireEvent.submit` pair in UI-30 (each `fireEvent` is its own `act`, so state flushes between them) both pass. But the claim reads as "any repeated submission", and §8.5's criterion is "prevented or safely handled", and the server has no key to dedupe a ticket or a comment.
>
> → Use the same `useRef` in-flight guard Actions Taken already has (a tiny shared hook would cover every form), and change UI-30's "without the button" step to dispatch both submits inside one `act()` so it measures what it claims:
>
> ```ts
> act(() => { form.requestSubmit(); form.requestSubmit(); });
> ```
>
> I'd expect that to be red for Create Ticket and the comment forms before the fix and green after.
>
> ### 🟡 Minor (not blocking)
> - **The description still lacks "Follow-ups from earlier reviews"** (asked at #87): the twice-reopened test landed in that PR, so the section can just point at it.
> - **A present but invalid category reads "Category is required."** (`categoryId: 2147483648`, `1.5`, `0`): the message is true for `null` only. "Choose a valid category." would be kinder, and Lab 2's own wording elsewhere is nearer.
> - **`categoryId: "1"` (a digit string) still creates a ticket,** while the new `bodyId` helper refuses strings. It's harmless, and Lab 2 documented it, but the two helpers now disagree; one line in `validation.ts` says which is intended.
>
> Fix the two, and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-11 07:00 UTC, @Menelaus122)

> Thank you. Both were right, and my first answer to the first one was wrong.
>
> **Must fix 1: the flaky client suites.** You were right that they are not cured, and right that load was not the cause. I reproduced them on the host (3 of 5 full runs failed), and every failure's page dump is the **Login screen**: a test whose screen calls an api function nobody mocked sends a real request to `localhost:3000`; where the real API is running it answers `401`, the client takes that for a session that ended, and the running test becomes the Login screen. That is why my container runs were always green (the API is unreachable there). With the API stopped, 8 of 8 runs of the three navigation files passed; with it up, 2 of 6 failed. One failure took 85 ms, which is very probably Lab 3's 130 ms one.
>
> The fix is not a warm-up or a worker cap (your options a and b), because the cold start was never the cost:
> - every test now starts with an **offline `fetch`**, and a test that reaches for it fails, naming the call (`tests/setup.ts`);
> - hooks run in definition order (`sequence.hooks: "list"`), so the previous screen is unmounted before `vi.restoreAllMocks`; without it the guard itself failed 2 of 3 runs on late calls;
> - the two real calls it found are mocked.
>
> On the host with the API running: **6 of 6 full client runs** and **10 of 10 runs of the navigation files**. The description's "reproduced and explained" is replaced with this account, and `tests.md` §7 says the same. The load finding stays as a separate, real cause (the widened budgets took 37 of 7 800 timeouts to 0 of 7 944).
>
> **Must fix 2: three presses in one task.** Right again, and UI-30's claim was stronger than its test. The new same-task test presses each of the 16 forms three times inside one `act()`: **9 failed before the fix** (Create Ticket, comments, notes, appears resolved, user create, user edit, new initial password, sign-in, Change Password), and 16 of 16 pass after. All nine now use one shared `useSingleFlight`, which takes a ref the instant the handler is called. The other seven already had a ref guard. In the real browser, three presses inside one task now send **one** request each for Create Ticket, Post comment, and Sign in (34 of 34 live checks).
>
> While fixing it I found another defect: **Enter in the "New initial password" field saved the user panel's other edits** and never set the password, because the field sits inside the panel's form. Enter there now does nothing, and a test says so.
>
> **Minor.** "Choose a valid category." (and the related system) for an id that is there and wrong; "Category is required." only when it is missing. `validation.ts` has a comment saying why Lab 2's digit text is accepted while `bodyId` refuses text, and HARD-02 tests both. The description now has "Follow-ups from earlier reviews", pointing at #87's twice-reopened test.
>
> Also: server 1092, client 1019, Playwright 46/46, and 17 more deliberate breaks of the new code (one survived, Undo of "appears resolved" had no same-task test; it does now).

**Review — Approved** (2026-10-11 10:08 UTC, @WirachatTH)

> Approved! Thank you, and well found on the cause! A running API answering `401` to an unmocked call is exactly the kind of thing I'd never have guessed from "first test of the file". I checked `e105f28` against both of my points.
>
> ### 🔴 The client flake — cured, and your diagnosis checks out
> I set up the condition you describe: a real API listening on `localhost:3000`, so any call a test forgot to mock gets a genuine `401`.
>
> ```text
> fff6a74 client (the version I reviewed), full suite, API up   -> 3 of 3 runs failed (2–3 tests each:
>                                                                  UI-09, UI-27 …)
> e105f28 client, full suite, API up                            -> 4 of 4 runs: 1019/1019
> e105f28, the four navigation files, API up                    -> 6 of 6 runs: 85/85
> ```
>
> So the cause was the running API, not load, and the offline `fetch` in `tests/setup.ts` (which fails naming the call) plus `sequence.hooks: "list"` fixes it. A test that reaches the network now fails loudly instead of turning into the Login screen. That's also why your container runs were always green and mine weren't. The server and client suites no longer depend on what's listening on 3000.
>
> (My own earlier "5 s still not enough" read was wrong: nothing slow was happening. The page was the Login screen.)
>
> ### 🔴 Three presses in one task — fixed
> I repeated my probe against `e105f28`'s client, with the real API:
>
> ```text
> Sign in            3 presses, one task -> 1 login request
> Create Ticket      3 presses, one task -> 1 ticket
> Post comment       3 presses, one task -> 1 comment
> ```
>
> `useSingleFlight` takes its ref before the first await, which is the right shape. With `submitTicket` called directly instead of through `once`, three tests fail (UI-30 Create Ticket, "exactly one request when Submit is clicked twice", and the busy-state test). Your UI-30 same-task step now measures what the description claims.
>
> **The Enter-key defect you found:** I typed a new initial password in the user panel with another field edited and pressed Enter. The name wasn't saved, and the password wasn't changed either. It does nothing, as you describe.
>
> ### 🟡 The minor points
> - "Choose a valid category." and the `validation.ts` comment on text versus numeric ids are in, and the description now has the follow-ups section.
>
> ### Your numbers reproduce
> - client **1019/1019** (26 files), four full runs in a row with the API up; `tsc` 0; Lab 2 + Lab 3 Playwright **46/46**;
> - server **1092** tests (38 files), with **212** in `hardening.api.test.ts` (the 189 plus your 23 new): **1091 passed**, and one failure that isn't from this PR (below).
>
> ### One small thing (not blocking, but the same theme)
> **Lab 3's MIG-06 ("the seed runs twice…") is now a 5-second test that takes 4.2–4.8 s on my machine,** and it failed in 3 of my last 5 server runs at 5.0 s (alone, and in the full suite). The seed and the test are unchanged by this PR; the seed has simply grown across Labs 3 and 4 and the server's `vitest.config.ts` has no `testTimeout`, so it sits on vitest's 5 s default. The client got `testTimeout: 30_000` in this PR. Giving the server's config the same would close it before the final regression run that goes in the PDF.
>
> Approving. This one took real diagnosis work and it shows. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-11 10:41 UTC, @Menelaus122)

> Thx kub

### [#89](https://github.com/Menelaus122/TokTickITV2/pull/89) — Add the Lab 4 E2E suite and visual evidence (Issue 10)

**Verdict:** Changes requested → Approved · **merged** 2026-10-12 by @WirachatTH

**Review — Changes requested** (2026-10-12 03:16 UTC, @WirachatTH)

> Request changes. This is the most careful E2E increment so far, and three of its checks only fail on a clean database, which is exactly where the final run has to pass:
> - The app change is tiny and honest: 34 lines of CSS and a class on two cells, and nothing else in `client/src` or `server/src`.
> - The layout check in `helpers.ts` reads geometry and computed style instead of pixels, so it is as true on a phone as on a desktop, and it has its own "finds what it claims to" test.
> - Tagging every created account with the run and deactivating them in `afterAll` (BR-50) is the right way to leave a shared database.
> - 111 screenshots, as the description says, and the ones I opened (the IT Staff dashboard at 820 px, the Administrator's at 390 px) look as the checklist describes.
>
> I cloned `feature/10-lab4-e2e-and-evidence` at `f75bacb` (still the head when I wrote this, no comments yet) and ran it on its own ports against a fresh migrated and seeded database, then ran each failure alone.
>
> ### What I verified
> - **The diff is what you say it is:** on the current `lab4-staging`; `zen-green.css` +34 lines (header no-wrap, tablet header wrap, `.tt-table__nowrap`, the 150 px Ticket Owner column, the attachment badge) and a class on two cells in `MyTickets.tsx`. No server file.
> - **Client:** `npx vitest run` **1019/1019** (26 files), with the real API listening on `localhost:3000` the whole time; `tsc --noEmit` exits 0.
> - **Lab 2 + Lab 3 Playwright: 46/46.**
> - **`e2e/lab-04` on a fresh seed:** **37 passed, 2 failed** on the first run and **38 passed, 1 failed** on the second (5.8 min). The failures are below; every other test in the folder passes.
> - **Server:** `npx vitest run` **1091 passed, 1 failed** of 1092 (38 files); the one failure is in the third point below, and it is not in anything this PR changes.
> - **Not repeated:** I did not re-run your 20 breaks one by one; I read the helper and the assertions they depend on, and the three failures below are the ones that mattered.
>
> ### 🔴 Must fix 1: RESP-02 on the tablet only passes on a database as big as yours
> `responsive.spec.ts:214` "RESP-02 the IT Staff and Administrator Dashboard (tablet)", at 820×1180:
>
> ```text
> expect(counts.rows, "By status wraps").toBeGreaterThanOrEqual(2)
> Expected: >= 2        Received: 1
> ```
>
> The five By-status pills only wrap when the counts are wide. In your screenshot they are `658 · 207 · 247 · 83 · 82`, three digits, so "Waiting for Requester" pushes "Reopened" to a second line. On a database straight from the seed the counts are one or two digits, the five pills fit on one row, and the test fails.
>
> ```text
> fresh seed, RESP-02 alone, 1 run             -> tablet fails (desktop and phone pass)
> fresh seed, whole e2e/lab-04, 2 runs         -> the same failure both times
> the same test on a DB after many runs        -> passes, 2 of 2
> ```
>
> So it fails every time on a clean database, and it depends on how many tickets exist. Your note says the layout holds "at any size", and the layout does; the assertion doesn't. One row on a fresh seed is correct behaviour, not a defect.
>
> → Make the case the test describes, not the data it happens to find. Either:
> - **(recommended)** route the staff dashboard response through `page.route` with four-digit counts before the page loads (you already do this for the failure case with `answerWith`), so the wide case is always the one measured; or
> - compare the pills' total width with the card's inner width and expect `rows >= 2` only when it exceeds it, and in both cases that no pill sticks out of the card.
>
> The "By status wraps to two lines" assertion right below it has the same dependency.
>
> ### 🔴 Must fix 2: E2E-08 reads the status control before it refreshes
> `ticket-resolution.spec.ts:244`, after the second `recordActionOnScreen`:
>
> ```text
> expect(await moveOptions(page)).toContain("Resolved")
> Received array: ["Waiting for Requester", "Cancelled"]
> ```
>
> `"Action recorded."` appears in `saveNew` first, and `onChanged` → `refreshTicket()` fetches the gate afterwards, so the control is still the old one for a moment. `moveOptions` is a point-in-time read with no wait. E2E-02 handles this at line 93 by waiting for the "Not available now" list to disappear before reading, and E2E-08 doesn't.
>
> ```text
> E2E-08 alone, unchanged          -> 1 failure in 4 runs
> E2E-08 alone, with the wait added  -> 8 of 8 passed
> ```
>
> → Add the same line before reading the options:
>
> ```ts
> await expect(operational.getByRole("list", { name: "Not available now" })).toHaveCount(0);
> expect(await moveOptions(page)).toContain("Resolved");
> ```
>
> Lines 229 and 233 read the control too, but they pass either way (`not.toContain("Resolved")` is true before the refresh as well), so they only need the same wait if you want them to mean something.
>
> ### 🔴 Must fix 3: after this PR's E2E runs, the server suite fails on the same database
> This is the order Part 3 will use: run E2E, then run the server tests on the same database.
>
> ```text
> fresh seed -> e2e/lab-04 (38 passed) -> server npx vitest run
>    FAIL tests/lab-04/requester-dashboard.api.test.ts
>         DASH-09 > bounds both lists at five, even for the Requester with the most Tickets
>    Error: Signing in as e2e.responsive.mv4nk6xg@example.test answered 401; is the database seeded?
> ```
>
> `responsive.spec.ts` creates a Requester that ends with 24 tickets, which is more than any seeded Requester had in my database (the heaviest, `anucha.wong`, had 23), and `afterAll(deactivateCreatedUsers)` then deactivates it. DASH-09 (merged in Issue 7) picks "the Requester with the most Tickets" with a `groupBy` over all Requesters, active or not, and cannot sign in as a deactivated one. On your database the seeded Requesters carry far more tickets, so the e2e account never wins and you never see it. It reproduces alone the same way (`vitest run tests/lab-04/requester-dashboard.api.test.ts`).
>
> It is the same shape as the first point, and it breaks the very evidence this issue exists to produce.
>
> → Under the Lab 4 workflow it belongs in this PR, in its own section of the description: restrict the heaviest-Requester lookup to active accounts, e.g. `prisma.ticket.groupBy({ where: { requester: { isActive: true } }, … })`. Leave the new E2E accounts as they are.
>
> ### 🟠 Needed in this PR: the server's `testTimeout` (raised at #88, still open)
> `server/vitest.config.ts` still has only `fileParallelism: false`. In my run just now Lab 3's MIG-06 took **4.2 s** and Lab 4's MIG-06 **4.7 s** against vitest's 5 s default; earlier, MIG-06 failed 3 of my 5 server runs at 5.0 s. Nothing in this PR changes a server file, and the description doesn't mention it. The client got `testTimeout: 30_000` in #88; the server's config wants the same one line, with a "Follow-ups from earlier reviews" section in the description.
>
> ### 🟡 Minor (not blocking)
> - **Screenshots come from your big database,** so a fresh checkout that re-runs the suite will regenerate 111 files that differ (the dashboard counts, the wrapped pills). Say so in `tests.md` §8, or commit the images from one clean run, so a reader doesn't take a diff for a regression.
> - **`tests.md` §8's "full 85 passed"** was true on your database. After the three points above, please re-run on a fresh seed and put those numbers there.
>
> Fix the three and add the timeout, and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-12 05:18 UTC, @Menelaus122)

> Thank you. This was the review that mattered most for the final run, and all three must-fixes were right. I reproduced each on a fresh seed before changing anything. I built a second, empty stack (its own PostgreSQL, API on 3100, client on 5174) so my development database was never touched, and ran everything there in your order: every Playwright suite, then the server tests on the same database.
>
> ### Must fix 1: RESP-02 on a tablet
> Reproduced exactly: on a fresh seed RESP-02 alone fails on the tablet only (`By status wraps`, expected ≥ 2, received 1). I measured it: at 820 px five one-digit pills fit on one line, and two digits or more wrap to two, so one row is correct behaviour, as you said. I went with your recommended option. The real figures are now held to what the layout must do with *any* figures (one pill to a row on a phone; from 768 px one line exactly when the five fit, and a wrap when they do not), and the test makes the wide case (four-digit counts, two rows at 820 px) and the narrow case (one-digit counts, one row) itself by answering `/api/staff/dashboard` with the real response and those counts, with nothing sticking out of the card. A break that stops By status wrapping and one that makes each pill 300 px wide both fail it now. `ui-spec.md` §3.6 said "wraps to two lines", which was only true for wide counts; it now says what the layout does.
>
> ### Must fix 2: E2E-08
> Added the wait you suggested (the same line E2E-02 has). Your failure never happened on my machine in 62 runs, so I made it deterministic: with the Ticket read made to take 1.5 s, the old test fails with your message (`Resolved` missing from the options) and the fixed one passes. 20 of 20 on a fresh seed.
>
> ### Must fix 3: DASH-09 after the E2E run
> Reproduced exactly (`Signing in as e2e.responsive.… answered 401`; on the database the Lab 4 folder leaves, that Requester has 29 Tickets and Anucha 20). One deviation from your suggestion, and the reason: I restricted the lookup to the **four seeded Requesters** (`SEEDED_REQUESTER_EMAILS`, already in the file) instead of `isActive: true`. `signInAs` signs in with the seed password, so it can only sign in as a seeded account, and an e2e account that is still active with a changed password (a killed run, or a run in progress) defeats `isActive` too. I checked both on the same database with that account made active again: the `isActive` version fails with the same 401, the seeded-only version passes (51 of 51). The e2e accounts are left as they are. The change is listed in `tests.md` §6.
>
> ### The server's `testTimeout`
> Done: `testTimeout` and `hookTimeout` 30 s in `server/vitest.config.ts`. And I owe you an apology here: your approving review of #88 asked for this and I missed it, so you had to ask again. The description now has a "Follow-ups from earlier reviews" section.
>
> ### Minor items
> Both done. The committed screenshots are from the fresh-seed run, `tests.md` §5.1 and §8.2 say a re-run elsewhere will differ and that this is not a regression, and §8 has the fresh-seed numbers instead of the old 85.
>
> ### One more thing I found while reproducing, which was not in your review
> E2E-08 also failed 2 times in 62 on my machine with a different error: two history rows 0.25 s apart came back swapped. The cause is my Docker VM's clock: a probe measured it **stepping back by about 0.7 s every 32.8 s** (13 steps in 7 minutes), so two rows made on either side of a step are stored with the later one stamped earlier, and the API orders by `createdAt` then `id` (BR-22), correctly. The first fresh run of the folder also failed E2E-05 for the same reason (two Tickets 0.4 s apart). I did not touch the server's ordering, since it is the contract. The tests now read the server's own stamps: `settledTimeline` accepts a swapped history only when the API's rows prove it (taken in the order they were made they are exactly the expected moves, their stamps run backwards, and the screen shows what the API sorted), and four order checks no longer use the order the test made the rows in. A real ordering fault still fails (I returned the history newest first and the test failed), and a run that was stepped over says so in its report. You may never see this on your machine, but it will happen on mine.
>
> ### Results, all on a fresh seed
> - **Playwright, every suite: 85 passed** (21 + 25 + 39), then the **server suite 38 files, 1092 passed** on the same database; **client 1019 passed** (no client file changed); `tsc` and the build clean.
> - The Lab 4 folder on two more fresh seeds: **39/39** each. On the large development database: **39/39**.
> - The 20 deliberate breaks of the application are still all caught: I re-ran the six that the changed tests catch (E03, E04, E07, E09, E11, E15), and added 9 checks for this round's fixes (each red on the old code, green on the new; `tests.md` §8.3).
>
> If anything in the reasoning above looks wrong to you, please say so. The one thing I would most like your eyes on is the `settledTimeline` tolerance in `e2e/lab-04/helpers.ts`, because it is the only place where a test now accepts something it used to refuse.

**Review — Approved** (2026-10-12 10:26 UTC, @WirachatTH)

> Approved! Thank you for the careful write-up, and for the clock-step probe: stepping back 0.7 s every 32.8 s explains a failure I'd have called "my machine". I checked `4faaf17` against each of my points, and then went looking for what you asked me to look at: the `settledTimeline` tolerance. I have one small thing there (below), but the rest is solid.
>
> ### What I verified
> - **The diff is only what the commit says:** 8 files besides the screenshots (`helpers.ts`, `responsive.spec.ts`, `dashboards.spec.ts`, `ticket-resolution.spec.ts`, the DASH-09 test, `vitest.config.ts`, `tests.md`, `ui-spec.md`); no `client/src` or `server/src` file.
> - **Your numbers, on a fresh migrated and seeded database, in your order** (every Playwright suite, then the server suite on the same database):
>
>   ```text
>   Lab 2 + Lab 3 Playwright     46 passed (2.2 min)
>   e2e/lab-04                   39 passed (5.6 min)      (39 passed again in a second full run, 5.7 min)
>   server npx vitest run        38 files, 1092 passed    (the two MIG-06 tests at 4.4 s and 4.0 s)
>   ```
>
>   The client suite is the 1019/1019 I ran last round; no client file has changed since.
> - **The three findings and the timeout, each against the old and the new test:**
>   - **RESP-02:** the same test, on the fresh seed, at all three widths.
>   - **E2E-08 (I reproduced it the way you did, a slow read):** I made `GET /api/staff/tickets/:id` take 1.5 s on my API. The test without the new line fails with my original message (`Resolved` missing from `["Waiting for Requester", "Cancelled"]`); with your line it passes.
>   - **DASH-09 after the E2E run:** 1092/1092 in the order above. Your reason for the seeded-only lookup over `isActive` is right; I hadn't thought of a killed run leaving an account active with a changed password.
>   - **`testTimeout`/`hookTimeout`:** in `vitest.config.ts`, 30 s.
> - **My own breaks of the application:**
>   - `flex-wrap: nowrap` on `.tt-dash__status-row`: RESP-02 fails on the tablet ("they do not fit, so they wrap", expected ≥ 2, received 1) and passes on desktop and phone.
>   - The phone's `flex-direction: column` removed: RESP-02 fails on the phone ("stacked, one to a row", expected 5, received 4).
>   - Both files restored byte for byte.
> - **The `settledTimeline` tolerance, with a real ordering fault:** I made `statusHistory.ts` order newest first. E2E-02 and E2E-08 both fail, as they should. (The loophole is below.)
> - **Docs:** the description has "Follow-ups from earlier reviews"; `ui-spec.md` §3.6 now says what the layout does; `tests.md` §5.1 and §8 say the screenshots come from the fresh seed and that a re-run elsewhere will differ.
>
> One note on my side so it isn't mistaken for yours: my first server run after the E2E ran on a Debian `postgres:16` image, and Lab 3's "orders by name" failed there (the test sorts by code point, and glibc's `en_US` collation puts `E2E deactivated…` before `E2E First…`). Your `docker-compose.yml` uses `postgres:16-alpine`, which orders by bytes. I re-ran on the Alpine image and the whole suite is green. No action needed, but the two environments order differently, so it's worth knowing.
>
> ### 🟠 The one hole in the tolerance (small, and what you asked me to look at)
> `swappedByAClockStep` checks that the rows, taken in `id` order, are exactly the expected moves; that the stamps run backwards somewhere; and that the screen shows what the API returned. It never checks that **the API's order is the order BR-22 asks for**. So if the server's order is wrong *and* any two stamps of that Ticket run backwards, the screen and the API agree with each other and the test passes.
>
> I made it happen: `statusHistory.ts` ordering `createdAt desc, id desc`, plus a trigger that pulls each history row's `createdAt` back by up to 2 s (a clock that steps):
>
> ```text
> newest-first server, no jitter        -> E2E-02 fails                 (your R05; it works)
> newest-first server, with jitter      -> E2E-02 passed in 3 of 4 runs  (the fault is accepted)
> ```
>
> It needs a real ordering fault *and* a step in the same Ticket's history, so it's unlikely, but it's the one place the test now accepts something it used to refuse, and the fix is three lines. After the stamps are read, require that the rows are in `(createdAt, id)` order:
>
> ```ts
> const bySpec = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
> const apiSorted = sameList(rows.map((row) => row.id), bySpec.map((row) => row.id));
> const explained = apiSorted && stampedBackwards && sameList(["Ticket created", ...inOrderMade.map(words)], expected) && sameList(shown, ["Ticket created", ...rows.map(words)]);
> ```
>
> I tried exactly that:
>
> ```text
> correct server, jitter   -> E2E-02 passes   (3 of 3: the clock step is still accepted)
> newest-first server, jitter -> E2E-02 fails (3 of 3)
> ```
>
> Per the Lab 4 workflow I'm not asking for a separate PR: add it here if you push anything else, or fold it into Issue 11's (#77) PR in its own "Follow-ups from earlier reviews" section.
>
> ### 🟡 Minor (not blocking)
> - **E2E-05's "Recently updated" no longer pins the order the Tickets were made in;** it compares against the server's own `updatedAt` order. That's the right call given the clock, and the annotation says when a run was stepped over. Just be aware the check is now "the dashboard equals the API's sort", not "equals what the test made".
>
> Approving. This took real diagnosis work, and it shows. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-12 10:31 UTC, @Menelaus122)

> Thx kub

## Pull Requests I reviewed for my partner

Partner repository: [WirachatTH/toktickit](https://github.com/WirachatTH/toktickit) · integration branch `lab4-staging` (the last Pull Request, #85, is the release from `lab4-staging` into `main`)

| PR | Branch | Review rounds | Merged by |
| :--- | :--- | :--- | :--- |
| [#74](https://github.com/WirachatTH/toktickit/pull/74) | `feature/1-sprint4-contract` | Changes requested → Approved | @Menelaus122 |
| [#75](https://github.com/WirachatTH/toktickit/pull/75) | `feature/2-actions-taken-api` | Changes requested → Approved | @Menelaus122 |
| [#76](https://github.com/WirachatTH/toktickit/pull/76) | `feature/3-actions-taken-ui` | Changes requested → Approved | @Menelaus122 |
| [#77](https://github.com/WirachatTH/toktickit/pull/77) | `feature/4-workflow-resolution-gate` | Approved | @Menelaus122 |
| [#78](https://github.com/WirachatTH/toktickit/pull/78) | `feature/5-dashboard-api` | Approved | @Menelaus122 |
| [#79](https://github.com/WirachatTH/toktickit/pull/79) | `feature/6-dashboard-ui` | Approved | @Menelaus122 |
| [#80](https://github.com/WirachatTH/toktickit/pull/80) | `feature/7-final-hardening` | Changes requested → Approved | @Menelaus122 |
| [#81](https://github.com/WirachatTH/toktickit/pull/81) | `feature/8-lab4-responsive-e2e` | Approved | @Menelaus122 |
| [#82](https://github.com/WirachatTH/toktickit/pull/82) | `feature/pre-release-lab4` | Approved | @Menelaus122 |
| [#83](https://github.com/WirachatTH/toktickit/pull/83) | `feature/pre-release-followup` | Approved | @Menelaus122 |
| [#84](https://github.com/WirachatTH/toktickit/pull/84) | `feature/pre-release-followup-2` | Approved | @Menelaus122 |
| [#85](https://github.com/WirachatTH/toktickit/pull/85) | `lab4-staging` | Approved | @Menelaus122 |

I merged all 12 after approving, as the author should not merge their own Pull Request.
4 of the 12 (#74, #75, #76, #80) needed a round of **Changes requested** first; each was re-reviewed and
approved once the fixes landed on the same branch.

### [#74](https://github.com/WirachatTH/toktickit/pull/74) — Issue 1: Sprint 4 Specification & Test Plan (Spec DD)

**Verdict:** Changes requested → Approved · **merged** 2026-10-05 by @Menelaus122

**Review — Changes requested** (2026-10-05 14:35 UTC, @Menelaus122)

> Comment 1: request changes
>
> Anchor: docs/lab-04/specification.md:276 (BR-41), with a pointer to api-spec.md:362 (§4.3)
>
> ▎ The "Active …" user drill-downs don't list what they count.
> ▎
> ▎ BR-41 gives each active-by-role count the href /admin/users?role=<ROLE>, and §3 says "every drill-down lands on a matching list". But GET /api/admin/users only filters by search and role (server/src/adminUsers.ts:109-122), and it returns inactive users too. api-spec §4.3 also says the endpoint is "Unchanged".
> ▎
> ▎ On the seed data:
> ▎ - "Active IT Staff: 3" opens a list of 4 (Suda Kaewmanee is inactive).
> ▎ - "Active Requesters: 6" opens a list of 7 (Ananya Ruangrit is inactive).
> ▎
> ▎ This contradicts three things:
> ▎ - BR-38, which names only two superset cases (the "today" metrics and the inactive count).
> ▎ - AC-23, which says the view lists exactly the counted items.
> ▎ - The D-13 claim that two additive filters are all the drill-down needs.
> ▎
> ▎ No planned test would catch it. DASH-11 only follows ticket metrics, and UI-21 only checks that ?role= is wired up.
> ▎
> ▎ Suggested fix, either:
> ▎ 1. Add an additive isActive (or status=active|inactive) filter to GET /api/admin/users, default unchanged, in the same spirit as D-13. Point the three hrefs at it, and update §4.3, BR-45(4), D-13, ui-spec §7 and UI-21. Also give the inactive card an exact href, which removes the second superset case.
> ▎ 2. Keep the API as is and mark the three role metrics as supersets in BR-38. Add helper text like the one on "Created today", and extend DASH-11 to cover the user links.
> ▎
> ▎ I'd prefer option 1, since it keeps AC-23's "exactly the counted items" true.
>
> ---
>
> Comment 2: should fix before merge
>
> Anchor: docs/lab-04/specification.md:289 (BR-46), also relevant to :510 (AC-33)
>
> ▎ BR-46's list of tests that must change is incomplete.
> ▎
> ▎ BR-46 names the home-route/navigation tests and the Lab 3 tests that resolve a ticket without a completed action. AC-33 then says suites pass "changed only where BR-46 allows". At least two more existing tests must change, and neither is named:
> ▎
> ▎ - server/tests/lab-03/staff-ticket-detail.api.test.ts:145 (API-42) does a strict toEqual on the Administrator's capabilities, with exactly 5 keys, all false. api-spec §2.2 and BR-17 give Administrators canWriteActions: true, so it will fail. The test title ("no capabilities (BR-21)") describes the rule D-07 changes. The toMatchObject assertions at lines 132 and 167 tolerate the extra key.
> ▎ - client/tests/lab-02/RequesterTicketDetail.test.tsx:89 (REG-14) asserts that Actions Taken never appears on the Requester Ticket Detail. FR-06 and ui-spec §6 now add it. The new heading ("Work on your request") may dodge the exact regex, but the test's stated intent is the opposite of Lab 4.
> ▎
> ▎ Both fall under BR-45(3), so the principle in BR-46 covers them, but the enumerated list reads as exhaustive. Please add these two to the list (or reword it as "including, at least"). That also avoids a surprise when someone reviews the Issue 2 and 3 PRs against AC-33.
> ▎
> ▎ Related, and not blocking: Issue #71 asks for "regression rows for each earlier feature". REG-01 and REG-02 are suite-wide, whereas Lab 3 had 17 feature-specific REG rows. Worth deciding now whether Issue 7 adds them.
>
> ---
>
> Comment 3: nit
>
> Anchor: docs/lab-04/specification.md:237 (BR-38), also :247, :492 (AC-23) and tests.md:118 (DASH-11)
>
> ▎ "Sorted so the counted items come first" can't be guaranteed for two of the superset links.
> ▎
> ▎ - Created today: sort=createdAt&order=desc does put today's tickets first, so that one holds.
> ▎ - Resolved today: sort=updatedAt&order=desc doesn't. A ticket that was only commented on at 11:00 sorts above one resolved at 10:00, so counted items can be interleaved with others.
> ▎ - Inactive-user count: /admin/users is ordered by name then id, so inactive users aren't first either.
> ▎
> ▎ AC-23's "shows them first" and DASH-11's "first" are therefore stronger than the design can deliver. I'd soften both to "includes every counted item, and the page sorts by recency". The "Created today / Resolved today" helper text in ui-spec §3.2 already hedges this way. If DASH-11 gets written to the stronger wording, it will fail on the first realistic data set.
>
> ---

**Author's response** (2026-10-05 14:39 UTC, @WirachatTH)

> Thanks for the careful review! All three comments are fixed in cabce58, and so is the non-blocking point.
>
> Comment 1 (user drill-downs): I went with your option 1. GET /api/admin/users gets an optional status=active|inactive filter, combined with role and search using AND. Without it, the endpoint behaves exactly as in Lab 3. The four user hrefs now use it: /admin/users?role=<ROLE>&status=active and /admin/users?status=inactive. Each one lists exactly what its card counts, so the two "today" metrics are now the only supersets (BR-38, BR-41). On screen, the filter is a removable "Active only" / "Inactive only" chip rather than a second toolbar control, so User Management keeps Lab 3's one-filter toolbar. Updated: BR-45 (4), D-13, api-spec §4.3 and the §3.3 example, ui-spec §7, and the spec's §8 route table. DASH-11 now follows the user links too. UI-21, REG-03, and REG-04 cover the new filter, including its unchanged default.
>
> Comment 2 (BR-46): it now reads "including, at least", and it names both tests. For Lab 3 API-42, the Administrator capabilities check gains canWriteActions: true, and the title drops "no capabilities". Lab 2 REG-14 is rewritten so Actions Taken appear read-only, while Internal Notes, IT Priority, and status controls stay absent. On the side note: Issue 7 now has one regression row per earlier feature (REG-08 to REG-18), covering Lab 1 health/categories, the Lab 2 Requester features, each Lab 3 area, and the browser journeys.
>
> Comment 3 (superset wording): BR-38, AC-23, and DASH-11 now say the view "includes every counted item, sorted by recency". The "Resolved today" row says "most recently updated first", which is what the queue actually does.
>
> The totals are now 124 planned tests. Every AC is still traced, and every rule a test cites exists in the spec.

**Review — Approved** (2026-10-05 14:45 UTC, @Menelaus122)

> ▎ Thanks for the quick turnaround. I re-checked cabce58 and the three fixes land as described:
> ▎ - The user drill-downs are exact (BR-38, BR-41, §4.3, the §3.3 example, ui-spec §7).
> ▎ - BR-46 now names API-42 and REG-14.
> ▎ - The superset wording is softened in BR-38, AC-23 and DASH-11.
> ▎
> ▎ The totals also hold up: 124 tests, REG 18, Issue 7 = 15, every AC traced, no undefined rule IDs, 78 tables with
> ▎ matching columns, and all 11 files cited b
> ▎
> ▎ A few small things are left. None change tpprove once 1–3 are done.
> ▎
> ▎ 1. The PR description is stale. It still s7 regression/hardening". It also says "Twoadditive drill-down filters (D-13)", and its changed-routes list omits the user list. After cabce58 these shread:
> ▎ - 124 tests, with 18 regression/hardening (one per earlier feature);                                        - three filters, adding status=active|inac
> ▎ - "My Tickets, queue and user-list filters" in the changed routes.                                          
> ▎ 2. api-spec.md:3-4 says Lab 2–3 routes stay authoritative "except the changes in §4". The status-change and staff-ticket-detail changes are in §2, so 5 already says it correctly.
> ▎
> ▎ 3. "Lab 2 REG-14" is a mislabel (specificaEG-11 row at tests.md:159). Lab 2's test plan has no REG-14. The ID comes from Lab 3's plan (docs/lab-03/tests.md:118) for a test that lives in client/tests/lab-02/RequesterTicketDetail.wn REG-14 (tests.md:162), so the reference is ambiguous. Naming the file and test instead, e.g. "the Lab 3 REG-14 test in
> ▎ client/tests/lab-02/RequesterTicketDetail.
> ▎
> ▎ 4. Three REG rows cite a file that doesn't(tests.md). The column holds a single path,so these need a second path or a split.
> ▎ - REG-14 (line 162) includes "appears reso.test.ts has no mention of it. Those testsare in requester-regression.api.test.ts, which has 17 mentions.
> ▎ - REG-11 (line 159) names Requester Ticket.api.test.ts. The Requester detail API testis server/tests/lab-02/ticket-detail.api.test.ts, which no Lab 4 row cites.
> ▎ - REG-08 names the Categories list, but onategories.test.ts is in the same folder.
> ▎                                                                                                                      5. Nits.
> ▎ - SEC-01 and SEC-05 (tests.md:23, :125, :129) say "all 37 routes (api-spec §5)", but §5 lists only the 8 new routes. The other 29 are in Lab 3 api-spec §7. Som§7 plus Lab 4 §5)" would fix it. SEC-05's"has a row in api-spec §5 and the reverse" can't hold as written.
> ▎ - Priority order: specification.md:249 (BR, but api-spec.md:313 says HIGH, MEDIUM, LOW. api-spec §3 says metrics follow the BR-39 order, so the two should agree.
> ▎ - Mockup date: ui-spec.md:82 says "Mon 6 O Tuesday (the 5th is the Monday). "Tue" would match the API example's 2026-10-06.
>
> ---

**Author's response** (2026-10-05 15:28 UTC, @WirachatTH)

> Thanks for the approval and the quick re-check! Catching the user drill-downs that counted inactive accounts kept AC-23 honest before any code was written.

### [#75](https://github.com/WirachatTH/toktickit/pull/75) — Issue 2: Actions Taken Model, Migration, Seed & API

**Verdict:** Changes requested → Approved · **merged** 2026-10-06 by @Menelaus122

**Review — Changes requested** (2026-10-05 16:17 UTC, @Menelaus122)

> **Verdict: ❌ Request changes.** Two small fixes are needed before merge, plus a spec write-back. The production code looks right, and I'll approve once items 1 and 2 are done.
>
> ### What I verified
> I re-ran this PR on a fresh Postgres 15. Almost everything you claim holds up:
>
> | Claim | Result |
> |---|---|
> | Server tests | ✅ 367/367, 28 files (315 existing + 52 new) |
> | `tsc` | ✅ clean |
> | Client tests | ✅ 287/287 |
> | Playwright (Lab 2 + 3) | ✅ 36/36 at desktop, tablet and mobile |
> | Migration applies from scratch | ✅ no schema drift |
> | Migration on real Lab 3 seed data | ✅ `resolvedAt` backfilled for exactly the 4 resolved/closed tickets; no other column changed, including `updatedAt` |
> | Rollback | ✅ schema identical to a DB built from only the Lab 3 migrations |
> | Seed | ✅ 15 actions, then 0 on re-run |
> | Lab 3 test edits | ✅ +10/−4 across 3 files, 2 assertions |
> | `prisma format` change is whitespace-only | ✅ |
>
> I also sent about 100 requests of my own at the API: bad dates, spoofed fields, odd IDs, 20 identical creates at once, a 10-way completion race, and a mixed load with an assignee being deactivated. I found no incorrect behaviour and no 5xx.
>
> ### Required before merge
>
> **1. The mutation claim isn't fully true** (`server/tests/lab-04/actions-taken.api.test.ts:482`, API-20)
>
> The PR says all 35 mutations were caught, including "follow-up of any status". I re-ran that one. Removing `target.status !== "COMPLETED" ||` at `server/src/actionsTaken.ts:176` leaves the whole suite green.
>
> It isn't an equivalent mutant. A planned action can carry the follow-up flag, and then the real code and the mutated code disagree:
> - Real code: linking a follow-up to a still-planned, flagged action returns **400**.
> - Mutated code: the same request returns **201**.
>
> The cause is line 482: `const open = … planned()` leaves `followUpRequired` as `false`. The `!target.followUpRequired` half of the condition rejects it, so the status half is never tested on its own.
>
> **Fix:** give the planned target the flag, so only the status check can reject it:
> ```ts
> const open = (await create(t, "staff", planned({ followUpRequired: true, followUpNote: "Planned, but flagged." }))).body;
> ```
> With the status check removed, that test should then fail. Please re-run that mutation so "all 35 caught" is true.
>
> **2. The README restore command fails as written** (`README.md:305`)
>
> `pg_restore --clean -d toktickit pre-lab4.dump` inside the database container fails with `role "root" does not exist`. `docker exec` runs as root, and there is no `-U`. The README also doesn't say how the dump, which the backup step writes on the host, gets into the container. This is the command someone runs when something has already gone wrong.
>
> A version I tested that restores everything (18 tickets and 48 actions in my run):
> ```bash
> docker exec -i toktickit-db pg_restore -U toktickit --clean --if-exists -d toktickit < pre-lab4.dump
> ```
>
> ### Spec write-back (same commit is fine)
>
> **3. Two deviations aren't written back.** The DoD asks for deviations to go into the docs.
>
> - **`followUpOfId` is `NO ACTION`** (`server/prisma/schema.prisma:270-273`), but spec §7.1 (`docs/lab-04/specification.md:348`) says `restrict`. Your schema comment explains why, and it's a good reason: a ticket's cascade can delete a whole follow-up chain in one statement. Please say that in §7.1 too.
> - **The seed has 15 actions**, but spec §7.6 (`specification.md:420`) says "about 25". The §7.6 coverage list is fully met, so either change the text to 15 or note that 15 is enough.
>
> ### Notes (no action needed)
> - Lab 3's SEC-13 was loosened from equality to `arrayContaining`. Lab 4's SEC-05 does check full equality against a hand-written matrix, so nothing is lost.
> - Description length is counted in UTF-16 units, so 1,500 emoji are rejected. Every existing validator in the repo does the same, so this is not a regression.
>
> Thanks again, the tests are strong and the migration/rollback work is solid.

**Author's response** (2026-10-05 16:36 UTC, @WirachatTH)

> Thanks for the thorough re-run, and for checking the mutation claim instead of taking it on trust. You were right, and the mislabel was mine. My "follow-up of any status" mutation removed the status and flag checks together, so only the flag check was ever tested. All three items are fixed in e5b429c:
>
> 1. API-20: the planned target now carries the follow-up flag, so only the status check can refuse it. Your exact mutation (removing target.status !== "COMPLETED") now fails the suite. I also corrected the mutation section of the PR description.
>
> 2. README: the restore command is now yours: docker exec -i toktickit-db pg_restore -U toktickit --clean --if-exists -d toktickit < pre-lab4.dump. I checked it by restoring a fresh dump into a scratch database: 18 tickets and 15 actions, the same as the source.
>
> 3. Spec: §7.1 now says followUpOfId is NO ACTION, with the reason. §7.6 says 15 actions, which is enough for every listed case.
>
> Your finding was one example of a wider gap, so I swept for the rest: I broke each half of every compound condition, and each check, against the tests as they were. Four more survived, and each now has a test:
> - the seed's "still in its seeded status" rule (MIG-06);
> - a clientRequestId reused on another ticket (API-19), which must be refused, not answered with that ticket's action;
> - re-sending an unchanged, since-deactivated assignee in an edit (API-08), which must not be refused;
> - 31 February, which parseActionAt accepted as 3 March. That was a real bug: it now checks that the calendar date exists, and UNIT-02 covers it, including a leap day.
>
> The server suite is 367/367, and tsc is clean.

**Review — Approved** (2026-10-06 08:59 UTC, @Menelaus122)

> ## Re-review of PR #75 (head `e5b429c`)
>
> **Verdict: ✅ Approve.** All three items from my first review are fixed, and I re-verified each one.
>
> - **API-20 / mutation claim:** the planned target now carries the flag. Removing `target.status !== "COMPLETED"` alone now fails API-20, as does removing the flag check alone. I re-ran 30 mutations (24 of mine plus your 6 new ones) and all were caught.
> - **README restore:** the new command works. A backup of a freshly seeded DB restored into a scratch DB with 18 tickets, 15 actions and 16 events, matching the source. It also works restoring in place.
> - **Spec write-back:** §7.1 (`NO ACTION`, with the reason) and §7.6 (15 actions) are correct.
>
> Re-ran on the new head: server 367/367, `tsc` clean, client 287/287, Playwright 36/36. Migration, rollback and seed are byte-identical to the version I verified before.
>
> Good catch on 31 February. Against the old validator, `2026-11-31` returned 201 and stored 1 December. The new one returns 400, valid dates (including leap days) still pass, and I found no regressions.
>
> One optional nit: the 400 message for an impossible date says "Enter the date and time with its time zone", which is misleading for 31 November. A message like "That date doesn't exist" would be clearer. This doesn't block merge.

**Author's response** (2026-10-06 09:02 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for re-running every mutation instead of taking my list on trust! Good point on the impossible-date message, too: I'll give it a clearer "that date doesn't exist" wording in a small follow-up.

### [#76](https://github.com/WirachatTH/toktickit/pull/76) — Issue 3: Actions Taken UI

**Verdict:** Changes requested → Approved · **merged** 2026-10-06 by @Menelaus122

**Review — Changes requested** (2026-10-06 14:26 UTC, @Menelaus122)

> ## Review of PR #76: Actions Taken UI
>
> **Verdict: ❌ Request changes.** One fix is needed before merge (item 1, because it silently changes stored data). Items 2 and 3 are non-blocking. The implementation is otherwise solid, and I'll approve once item 1 is done.
>
> ### What I verified
> I ran this PR on a fresh Postgres 15 with a real browser, and almost everything you claim holds up:
>
> | Claim | Result |
> |---|---|
> | Client tests | ✅ 314/314, 22 files (287 existing + 27 new: 19 + 3 + 5) |
> | `tsc` | ✅ clean |
> | Playwright (Lab 2 + 3) | ✅ 36/36 at desktop, tablet and mobile; no screenshots or other tracked files changed |  | Server suite (unchanged by this PR) | ✅ 36
> | 5 existing test files changed, +34/−7 | ✅ exact, and no assertions weakened |                                    | Badge/pill contrast, lowest 5.40:1 | ✅ recall five pairs match (lowest 5.403) |
> | 14 test-plan rows marked Pass | ✅ exactly Issue 3's assignment |                                                 | Mutation list | ✅ re-ran 30 mutations fromt, including the four that survived at first |
> | Complete dialog no longer proposes a future date | ✅ starts at now, or the planned date if earlier; completion neno manual edit |
> | Side-panel footer fix | ✅ 24px gap with the old rule, 0px with the fix, on the Add action panel and Lab 3's User Management panel |
>
> I also ran about 100 checks in a real browsernd Requester. They covered the card contents,section order and caption, the create/edit/complete/cancel flows, validation, double-click producing one request, network
> failure keeping the input, and a retry reusin They also covered server field errorsappearing under the right field, the stale-edit banner with the "Your unsaved text" box, "completed by someone else",
> resolved/closed/cancelled tickets, the Adminihistory showing names and Bangkok times, thefocus trap and Escape, and no horizontal scroll. All passed except the three items below.
>
> ### Required before merge
>
> **1. Edit → Save with nothing changed silently changes the action** (`client/src/components/ActionsTaken.tsx:281-303`)
>
> ui-spec §4.4 says a save with nothing changed closes the panel with "No changes to save." In practice, `toBangkokInput` (line 57) drops the seconds, and the edit bra` (line 294). For any action whose stored timehas non-zero seconds, the server sees a change.
>
> On a seeded action I saw:
> - `actionAt` went from `2026-10-07T13:46:19.7000Z`;
> - the version went from 1 to 2;
> - a spurious "Edited" history event was writt
> - the toast was "Action updated", not "No changes to save."
>
> This affects all seeded actions and any API-created ones. UI-created actions are fine, since they always have `:00` seconds. The tests didn't catch it because evs (`ActionsTaken.test.tsx:54`, `:79`, `:92`),and the string "No changes to save" appears in no test. I confirmed it survives mutation: removing that toast, or making
> the edit send a different date, keeps the sui
>
> **Fix:** only send `actionAt` when the user ce `form.actionAt` with `toBangkokInput(newDate(editor.action.actionAt))` and omit it otherwise. The edit endpoint accepts any subset of fields (api-spec §1.4).
>
> **Test:** please add one with a non-zero-seconds fixture that asserts the body has no `actionAt` and that "No changes to
> save." appears.
>
> ### Please consider (non-blocking)
>
> **2. A stale conflict in the Complete or Cancd** (`ActionsTaken.tsx:244`, `:501`, `:670`,`:676`)
>
> The Edit panel handles this correctly. In the dialogs, `handleFailure` swaps in the refreshed action, and the dialog's
> `key` includes the version (line 501). The diits inputs reset, so the typed cancellationreason or completion result is gone. BR-44 says a form keeps everything the user typed.
>
> In my run: a reason typed in the Cancel dialog, a colleague edited the action, the user clicked Cancel action, and the
> reason field came back empty.
>
> **Suggestion:** keep `reason`/`result` in staor drop `version` from the key and update fromprops), or show them in an "Your unsaved text" box as the Edit panel does.
>
> **3. After Create, focus stays on "Add action" instead of moving to the new card** (`ActionsTaken.tsx:174-178`, `:310`)
>
> ui-spec §4.6 and the PR description say focus moves to the changed card. I measured the focused element after each kind
> of save:
> - Edit, Complete, Cancel: the changed card, as promised.
> - **Create:** the "Add action" button.
>
> The cause: the effect at lines 176-177 calls d(null)` regardless of whether the card exists, and for a create the card isn't in the list until `load()` finishes. So the request is consumed too early.
>
> **Suggestion (not tested):** only clear `focusId` once the element is found, e.g.
>
> ```ts
> const el = document.getElementById(`action-${
> if (el) { el.focus(); setFocusId(null); }
> ```
>
> No test covers focus after a save. The only fe (`ActionsTaken.test.tsx:265`), so please addone.
>
> ### Note
> "All 32 mutations caught" is true for the rul3 are behaviours outside that list, which iswhy the mutation pass didn't flag them.
>
> Thanks, this is a thorough PR. The component is well structured, and the red-then-green commits made it easy to follow.
>
> About the verdict: I chose Request changes because item 1 is a spec'd behaviour that silently alters stored data. If you'd rather not block on it, switch to Approne to "✅ Approve with comments" and theopening sentence to "None of these block merge." I'd keep item 1 either way. 

**Author's response** (2026-10-06 16:07 UTC, @WirachatTH)

> Thanks for the browser run, and especially for catching the silent date rewrite. All three items are fixed in 00e0c99:
>
> 1. Unchanged edit: the edit now sends actionAt only when the date was actually changed, so an untouched save shows "No changes to save." and writes nothing. The same bug was in the Complete dialog: it always sent its minute-rounded date, so completing a seeded past-dated action rewrote its stored seconds. It now sends a date only when the user changed it, or when planned work dated ahead has to be completed as of now. Tests use a fixture with seconds (19.700Z), as you suggested. Your two survivors (removing the toast, and the edit sending a different date) are now caught.
>
> 2. Stale conflict in the dialogs: the dialog no longer remounts when the action reloads, so a typed reason or result survives. The retry goes out with the new version, and a test covers it.
>
> 3. Focus after create: the focus request now waits for the new card. My test passed with the bug because the mocked reload answered instantly, so it now delays the reload the way a real network does, and fails on the old code.
>
> I mutation-checked each fix, then re-ran the full UI set: all 38 caught. Client is 319/319 and tsc is clean.

**Review — Approved** (2026-10-06 19:53 UTC, @Menelaus122)

> ## Re-review of PR #76 (head `00e0c99`)
>
> **Verdict: ✅ Approve with comments.** All three items from my first review are fixed and verified, with one new edge case below that I'd like addressed in a follow-up.
>
> - **Unchanged edit:** an untouched Save now shows "No changes to save." and writes nothing. The date is sent only when changed, including when changed away and back. The same fix in the Complete dialog is a good catch: completing a past-dated action now keeps its stored seconds, and a user-changed date is still sent.
> - **Stale dialog:** the Cancel dialog keeps the typed reason, shows the banner, and the retry goes out with the new version.
> - **Focus after Create:** focus now moves to the new card.
>
> Re-ran on the new head: client 319/319, `tsc` clean, Playwright 36/36, and about 100 real-browser checks all passing. I also re-ran about 40 mutations and 39 were caught, including every mutation for these three fixes.
>
> **One new edge case (non-blocking):** since the dialog no longer remounts, its pre-filled fields stay stale after a conflict. Repro:
> 1. Open Complete on a planned action.
> 2. While it is open, a colleague edits the same action and ticks "Follow-up required" (or changes the Result).
> 3. Click "Mark as completed". The conflict banner appears, but the box still shows the old unchecked value.
> 4. Click again. Completing now **erases the colleague's follow-up requirement** (and overwrites their Result).
>
> Before this change the dialog refreshed the values, but lost the typed text. Suggestion: after a reload, refresh the fields the user hasn't touched and keep the ones they typed (or reuse the "Your unsaved text" box from the Edit panel).
>
> One tiny test gap: nothing asserts that a date the user changes in the Complete dialog is sent. The real code does send it; I checked in the browser.

**Author's response** (2026-10-07 06:34 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for the real-browser run! The stale Complete dialog quietly erasing a colleague's follow-up is a great find. I'll fix it in a follow-up, along with the missing test for a changed completion date.

### [#77](https://github.com/WirachatTH/toktickit/pull/77) — Issue 4: Ticket Workflow & Resolution Gate

**Verdict:** Approved · **merged** 2026-10-07 by @Menelaus122

**Review — Approved** (2026-10-07 08:14 UTC, @Menelaus122)

> ## Review of PR #77: Ticket workflow & resolution gate
>
> **Verdict: ✅ Approve with comments.** The gate is correct and well tested, and everything you claim reproduced. I have one small inaccuracy to fix (item 1) and two test gaps to close, none blocking.
>
> ### What I verified
> I ran this PR on a fresh Postgres 15 and in a real browser. Everything below held up:
>
> | Claim | Result |
> |---|---|
> | Server tests | ✅ 383/383, 30 files (367 + 16 new: UNIT-05 ×4, WF ×11, UNIT-02 +1) |
> | Client tests | ✅ 329/329, 23 files, in three separate full runs |
> | `tsc` (server and client) | ✅ clean |
> | Playwright (Lab 2 + 3, incl. E2E-06) | ✅ 36/36; no tracked files changed |
> | 3 Lab 3 test files changed, +24/−1 | ✅ exact |
> | 15 test-plan rows marked Pass | ✅ exactly Issue 4's assignment |
> | No schema or migration changes | ✅ |
>
> I also wrote my own checks from the spec rather than from your tests:
>
> - **Gate over the real status route:** each of the three conditions is refused with the right counts and message and then allowed. A cancelled action counts for nothing; a planned or cancelled follow-up does not handle one; a completed one does, but its own flag then needs handling; another ticket's work never satisfies the gate.
> - **Check order:** stale state, invalid transition and owner required all beat the gate, and validation (a short summary) beats everything.
> - **`resolvedAt`:** set on Resolved, cleared on Reopened, kept on Closed, and the earlier work still counts after a reopen.
> - **All 64 status pairs:** exactly the 17 BR-27 pairs succeed.
> - **Detail payloads:** the gate report is correct for IT Staff and Administrators, Resolved is hidden while the gate fails, and the raw actions list is never leaked.
> - **Races:** 20 runs each of "complete the last planned action vs resolve" and "add planned work vs resolve". A ticket was never Resolved with planned work and there was never a 5xx. In the second race both orders occurred (add wins / resolve wins).
> - **UI, 36 checks in a browser:**
>   - The gate notice shows exactly each seeded ticket's own condition (planned work / open follow-up / ready / reopened), with no icon glyph, and fits at desktop and 375px.
>   - It is absent on New, Closed and Resolved tickets and for Administrators.
>   - Completing the last planned action refreshes the notice and choices with no page reload.
>   - Resolving through the UI works end to end, and the Requester sees "Resolved on" in Bangkok time.
>   - A server-side `RESOLUTION_BLOCKED` closes the dialog, shows the reason under the select, and reloads the ticket and actions.
>
> I also confirmed the stale Complete dialog problem from the PR #76 review is fixed. The colleague's follow-up requirement survives, untouched fields (result, flag, note, date) refresh to the colleague's values, and typed results and dates are kept. The Cancel dialog still keeps its reason.
>
> ### Please fix (small)
>
> **1. "That date doesn't exist." is also shown for a bad *time* or offset** (`server/src/actionRules.ts:72-73`)
>
> `actionAtMessage` picks the message by whether the string matches the ISO *pattern*. So `2026-10-05T25:61:00Z` and `2026-10-05T10:00:00+99:99` get "That date doesn't exist.", although the date exists and only the time or offset is invalid. The PR description (and api-spec §1.3) says only a date that isn't on the calendar gets that message and everything else asks for the date and time with its time zone.
>
> The calendar cases all work (31 Nov, 29 Feb 2027, month 13, day 0), so this is just about the wording on invalid times.
>
> **Suggestion (not run):** decide by validating the date part on its own, e.g.
>
> ```ts
> const day = raw.slice(0, 10);
> const cal = new Date(`${day}T00:00:00Z`);
> const missing = Number.isNaN(cal.getTime()) || cal.toISOString().slice(0, 10) !== day;
> return ISO_WITH_OFFSET.test(raw) && missing ? MISSING_DATE_MESSAGE : FORMAT_MESSAGE;
> ```
>
> Please also add the two cases above to UNIT-02, expecting the time-zone message.
>
> ### Test gaps (non-blocking)
>
> I re-ran 44 mutations (19 server and 25 client, including a few of my own). 41 were caught, usually by exactly the tests you name, which is a good result. These 3 survived, and in all three the production code is correct (I checked each in the browser or over HTTP). They are missing assertions.
>
> **2. The wording of the `RESOLUTION_BLOCKED` message for planned work and open follow-ups isn't asserted** (`server/src/resolutionGate.ts:41-42`)
>
> Removing either `reasons.push(...)` line keeps all 383 tests green. Only the details counts are asserted. WF-03 and WF-04 could also assert `error.message`, e.g. that it contains "1 planned action is still open" and "1 follow-up is not handled".
>
> **3. Nothing pins that a *typed* date survives a stale conflict in the Complete dialog** (`client/src/components/ActionsTaken.tsx:754`)
>
> Removing `touch("at")` from the date input's `onChange` keeps the UI-07 tests green. The real code keeps the typed date, which I confirmed in the browser. Please add a case to the "refreshes what the user left alone" UI-07 block: type a date, have a colleague change the date, hit the conflict, and assert the field still shows the typed date and that the retry sends it.
>
> ### Note on the flaky test
> You mention one unexplained UI-01 failure. I saw one spurious UI-02 failure in about 85 runs of those test files. I could not reproduce it in 25 targeted runs (12 of them run concurrently under load), and the same mutation failed only UI-14 on three re-runs. So it looks like the same rare timing issue. It may be worth a look if it recurs.
>
> Thanks, this is a thorough PR. The gate is a clean pure function, the lock and check order are right, and the browser behaviour matches the spec.

**Author's response** (2026-10-07 08:16 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for writing your own checks from the spec instead of reusing mine! Good catch on the time-vs-date message. I'll fix it and add the three missing assertions in a follow-up.

### [#78](https://github.com/WirachatTH/toktickit/pull/78) — Issue 5: Dashboard APIs

**Verdict:** Approved · **merged** 2026-10-07 by @Menelaus122

**Review — Approved** (2026-10-07 15:47 UTC, @Menelaus122)

> ## Review of PR #78: Dashboard APIs & drill-down filters
>
> **Verdict: ✅ Approve with comments.** The dashboards are correct, and everything you claim reproduced. I have three small test gaps to close; none needs to block the merge.
>
> ### What I verified
> I ran this PR on a fresh Postgres 15 and checked the numbers independently:
>
> | Claim | Result |
> |---|---|
> | Server tests | ✅ 412/412, 34 files (383 + 29 new, split exactly as described) |
> | Client tests | ✅ 330/330 in four consecutive full runs |
> | `tsc` (server and client) | ✅ clean |
> | Playwright (Lab 2 + 3) | ✅ 36/36; no tracked files changed |
> | 19 test-plan rows marked Pass | ✅ exactly Issue 5's assignment |
> | No Lab 1–3 test changed, no schema or migration changes | ✅ |
> | Fixes from the PR #77 review | ✅ all three done; the new tests are the ones I'd asked for |
> | Flaky-test fix | ✅ a longer async wait in two files, no assertion changed; no failures in four full runs |
>
> **Are the numbers right?** I wrote my own SQL oracle from BR-33 to BR-41, computing Bangkok days with Postgres's own time-zone database rather than the fixed-offset arithmetic in the code, and filled the database with boundary fixtures. Result: **69/69 checks, 0 differences.**
>
> - **Metrics and lists:** every metric and every list of the three dashboards matched the SQL, including order, the max-5 limit and `id` tie-breaks.
> - **Day boundaries:** tickets created and resolved one second either side of Bangkok midnight, and the 7-day window edge, were all counted correctly. A ticket with `resolvedAt` today but still in progress was correctly not counted.
> - **Isolation:** another Requester's tickets never leaked in, and `?requesterId=` is ignored.
> - **Drill-downs:** I followed every `href` through the real list APIs. Exact metrics list exactly the counted number, the two "today" metrics list a superset that contains every counted ticket, and the "unassigned" link returns exactly the counted ids.
> - **Access and empty state:** wrong role is 403, no session is 401, unlisted methods are 404; a brand-new Requester gets all zeros and `[]`.
> - **No leaks:** no sensitive JSON key in any dashboard, and no `itPriority` in the Requester's payload.
>
> **Query count and speed:** each dashboard runs a fixed set of queries (8 SQL calls for the Requester, 18 for staff and admin, including session lookup and the transaction's BEGIN/COMMIT). After I added 3,000 tickets and 3,000 actions, the counts were unchanged and the p95 stayed at 15–35 ms against the 500 ms budget.
>
> **Mutation checks:** I re-ran 37 mutations. **34 were caught**, including every one on your list (also the six that survived at first), usually by exactly the tests you name. That includes the date message and the three 409-message mutations from the last round. These 3 survived, and in all three the production code is correct. They are missing assertions.
>
> ### Test gaps (non-blocking)
>
> **1. Nothing checks that the staff "recently updated" list is active tickets only** (`server/src/dashboard.ts:117`)
>
> BR-39 says this list holds *active* tickets. Replacing `where: active` with `where: {}` keeps all 412 tests green. In DASH-06 (`staff-dashboard.api.test.ts:221-230`) the CLOSED and CANCELLED fixtures (lines 145 and 148) keep their default old `updatedAt`, so they never compete for the five newest and the filter is never exercised. The real code is right: I created a CLOSED and a CANCELLED ticket with the newest `updatedAt` and both were correctly excluded.
>
> **Suggestion:** give those two tickets an `updatedAt` newer than everything in `recent` and assert they are absent from `recentlyUpdated`.
>
> **2. The *end* of today's interval isn't tested** (`dashboard.ts:101-102`, `lt: today.end`)
>
> DASH-08 only tests the start boundary (a ticket one second before and one second after the midnight that started today). Changing `lt` to `lte` on `createdToday` keeps the suite green. Please add a ticket created (and one resolved) exactly at `today.end`, i.e. the next Bangkok midnight, and assert it is excluded from both metrics.
>
> **3. The `id` tie-break on the Requester lists isn't tested** (`dashboard.ts:54`)
>
> Removing `{ id: "desc" }` from the `newest` order keeps the suite green. DASH-03 has no tickets with equal `updatedAt`. Adding two tickets with the same `updatedAt` and asserting the higher id comes first would pin it. (The staff dashboard's tie-breaks are covered.)
>
> ### Note
> The Bangkok offset is pinned by UNIT-06 alone. Mutating the offset to UTC+6 failed only UNIT-06, because the integration tests take their day interval from the API's own `today`. That is fine, since UNIT-06 pins exact instants, but it means the dashboard-level tests wouldn't notice a wrong offset by themselves.
>
> Thanks, this is a thorough PR. The queries are fixed in number and fast, the lists and hrefs match the spec, and the oracle-style tests are exactly the right evidence for the "counts match the database" requirement.

**Author's response** (2026-10-07 15:53 UTC, @WirachatTH)

> Thanks for the approval and the merge! An independent SQL oracle using Postgres's own time zones is about the strongest check those numbers could get. I'll close the three test gaps you found in a follow-up.

### [#79](https://github.com/WirachatTH/toktickit/pull/79) — Issue 6: Dashboard UI & Navigation

**Verdict:** Approved · **merged** 2026-10-08 by @Menelaus122

**Review — Approved** (2026-10-08 10:10 UTC, @Menelaus122)

> ## Review of PR #79: Issue 6 Dashboard UI & Navigation
>
> **Verdict: Approve with comments.** Nothing blocks the merge. Comments 1 and 2 are small defects I'd like fixed here or in Issue 7, and comment 3 is test coverage.
>
> I reviewed head `3a9a8c0` in an isolated environment (throwaway PostgreSQL, separate API and Vite ports). I ran every suite, wrote my own browser probes from the spec rather than from your tests, and ran my own mutations.
>
> ### Verified (your claims that hold)
>
> | Claim | Result |
> |---|---|
> | Server tests 412/412, no server source or schema change | ✅ |
> | `tsc --noEmit` clean (client) | ✅ |
> | Playwright Lab 2 + 3, 36/36, no screenshotiles changed |
> | 35 new client tests (9+5+9+7+2+3) | ✅ Counts match. The six Lab 4 UI files pass 43/43 on a clean run. |       | Follow-ups from the #78 review (DASH-03/06 that survived in #78 are now caught 3/3 |
> | Every dashboard value comes from the API, for each role | ✅ 84 of 86 browser checks passed. Card values, link names, hrefs, strips, lists and View all linor IT Staff, Administrator and Requester. |
> | Every card and strip link lands on a list matching its count | ✅ Checked live for 3 staff cards, 8 status and 3 priority strips, 4 admin user-count links an today" and "Resolved today" open a superset, as the helper text says. |
> | Dashboard is every role's home and first nink and forbidden callout all land on`/dashboard`. `aria-current` is set. |
> | Loading, refresh, failure, empty states |  Refresh keeps values and announces. A failed refresh clears both values and the old time. Retry works. Brand-new Requester sees the invitation and per-list empty
> sentences. |
> | "Needs your reply" in words, no IT Priority for Requesters | ✅ |
> | Responsive: 4, 2 and 1 columns, card links1280, 834 and 375px: no horizontal scroll,count-strip links at least 44px tall |
> | Docs rows UI-15–21, STYLE-02, REG-02 now P
> | Favicon 404 remains | ✅ Confirmed, and disclosed by you |
>
> ### Comments
>
> **1. The "My planned actions" View link does not jump to the list (spec deviation)**
>
> `ui-spec.md` §3.2 and `specification.md` (the `myPlannedActions` row) say the link "jumps to the list below". Today it only appends `#my-planned-actions` to the URll.
>
> - Repro (viewport 1280×480, IT Staff): open  My planned actions (N)**. The list's `top`stays at 653 and `scrollY` stays 0. Keyboard Enter and a direct load of `/dashboard#my-planned-actions` behave the
> same.
> - It matters most on mobile, where that list sits well below the cards.
> - `Dashboard.tsx` has no hash handling, becaoll to an in-page hash by itself.
> - Suggested fix: after the data loads, if `location.hash` matches a list id, call `scrollIntoView()` on it. Also make
> the test assert the scroll, not just that thtest.tsx:73`).
>
> **2. My Tickets: the sort select goes stale side**
>
> `sortValue` is initialised from the URL onceed live from `searchParams`.
>
> - Repro: open `/tickets?status=RESOLVED&sortclick the **My Tickets** nav link. The URLbecomes `/tickets` and Status becomes "All". The sort select still says `updatedAt:desc`, and the API call still sends `sort=updatedAt&order=desc`.
> - The URL, the select and the list disagree. A copied or reloaded link shows a different order. This contradicts "status and sort are read from the URL".
> - Opening the screen fresh from the dashboard behaves correctly.
> - Suggested fix: derive `sortValue` from `sestatusFilter` and drop the local state. Add a test that clicks the nav link while filtered and checks the select and the API call.
>
> **3. Mutation claim "all 33 caught" only partly reproduces**
>
> The 33 rules aren't listed in the PR, so I ran 59 of my own over the same categories. 49 were caught and 10 survived.
> Four survivors fall inside categories you sa
>
> | Mutation | Why it survives |
> |---|---|
> | Rename the `urgent-tickets` list id | Onlyis asserted, so "list ids" is broader thanwhat is tested |
> | My Tickets: sort not written to the URL |  but not sort write-back |
> | My Tickets: "Clear filters" leaves the URL untouched | Not asserted anywhere |
> | Users: an unknown `status` in the URL accewn-value fallback for My Tickets only |
>
> The real code is correct in all four cases (). The tests just don't pin it. Six unclaimed extras also survived: the requester ticket-row time ignoring `resolvedAt`, the brand-new check ignoring the lists, the My Tickets active-filter flag, the Usersuch target and the 4-column breakpoint.Please add a test for each of the four above, and say in the PR which rules the 33 were.                              
> **4. The client suite is load-sensitive (not blocking)**                                                              
> - It passed 365/365 on clean runs.                                                                                    - Under CPU load I saw 5 s timeouts. The sam commit (for example ChangePassword,CreateTicket, StaffTicketQueue), so this is not new in this PR.                                                       - One PR-added test, UI-21 "queue" (`DrillDo3 of 3 in one loaded configuration, thenpassed in every later run. I couldn't prove the cause. One suspect: the mock returns `appliedQuery.itPriority: null`  while the request carries `HIGH`.
> - Please make that mock consistent with the request and consider a longer timeout for the slow screens. If it's flaky in CI, that's why.
>
> **5. Minor**
>
> - `README.md` changed (status line "Issues 1ption doesn't mention it. The change isaccurate.
> - The loading skeleton always shows 4 cards,.
>
> ### Not verified
> - The labsheet citations (BR/FR/AC references) against the labsheet itself.
> - Your exact 33 mutation rules (not publishe
> - Real devices or screen readers. I tested three viewport widths in headless Chrome.
>
> Good work overall. The values match the API exactly, the states are well handled, and the #78 follow-ups are done. The four items above are small.

**Author's response** (2026-10-08 13:33 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for running 59 mutations of your own instead of trusting my count! Good catches on the planned-actions link that never scrolls and the stale sort select. I'll fix both in Issue 7, add the four missing tests, and list my mutation rules in the PR.

### [#80](https://github.com/WirachatTH/toktickit/pull/80) — Issue 7: Final Hardening & Full Regression

**Verdict:** Changes requested → Approved · **merged** 2026-10-10 by @Menelaus122

**Review — Changes requested** (2026-10-10 08:33 UTC, @Menelaus122)

> ## Review of PR #80: Issue 7 Final Hardening & Full Regression
>
> **Verdict: Request changes.** Nearly everything you claim holds, and the work is good. Two small items need fixing before merge: comment 1 is a crash introduced by the new hash handling, and comment 2 is a new test that fails the default `npm test` on my machine. Both fixes are a few lines. Comments 3–5 are not blocking.
>
> I reviewed head `46e3686` in an isolated environment (throwaway PostgreSQL, separate API and Vite ports). I ran every suite, wrote my own browser and API probes from the spec rather than from your tests, and ran my own mutations.
>
> **Environment note:** Docker wasn't running, so I used a throwaway PostgreSQL **18.3** (the project targets 15). My first server run showed 416/417, because that instance inherited my machine's `Asia/Bangkok` timezone. The existing DASH-08 test only passes with a UTC database, as in your Docker setup, and this PR didn't touch it. With the database in UTC the server suite is 417/417.
>
> ### Verified (your claims that hold)
>
> | Claim | Result |
> |---|---|
> | 25 files, +741/−49; the red commit `e451d60` is tests only | ✅ Exact |
> | Server tests 417/417 across 35 files | ✅ (with the UTC database) |
> | Client baseline 365 on base, then +41 to 406 across 28 files | ✅ Per file: Hardening 30, DrillDown +4, Staff +2, Requester +3, Zen +2. Reliability under default parallelism is in comment 2. |
> | `tsc --noEmit` clean for server and client | ✅ |
> | Playwright Lab 2 + 3, 36/36, no screenshots rewritten | ✅ No tracked file changed |
> | No Lab 1–3 test file changed | ✅ |
> | `/api/auth/session`: 200 `user: null` for no, garbage, expired, logged-out and deactivated sessions, with `no-store` | ✅ Checked directly against the API, including odd cookies |
> | `/session` returns exactly the `/me` user (must-change included); `/me` still answers 401; 38 distinct routes | ✅ |
> | Sweep: no console error, failed request, blank page or leftover text | ✅ My own 84-visit sweep as a visitor and each role was clean. My detector does catch an injected 401 and 404, so the result is meaningful. |
> | Favicon linked, served as SVG, resolves in the browser | ✅ |
> | "Page not found" inside the shell for all three roles, link to the Dashboard; visitor sent to Login | ✅ 5 bad paths per role. A must-change user still goes to Change password. |
> | Create Ticket: a server error says "Something went wrong", only a no-answer says "Cannot reach"; input kept | ✅ JSON 500, empty 500, 502 HTML, network abort and 400 |
> | One request per burst on Create Ticket, comments, notes and Create user; drafts kept after failure | ✅ 1 POST each (events dispatched as separate tasks) |
> | Retry on IT Staff Ticket Detail shows loading, not the failure | ✅ |
> | Every list and detail screen shows the shared failure state, and Retry recovers | ✅ My Tickets, both detail screens, queue, User Management, both dashboards |
> | #79 follow-ups: the jump scrolls and focuses | ✅ At 1280×480 the list top went 653 → 0; at 375px 1408 → 0; also on direct load |
> | #79 follow-ups: sort follows the URL; chip 44px on mobile; placeholders | ✅ My earlier repro now resets URL, select and API call together. Chip is 44px up to 767px, 32px from 768px. Placeholders are 4 for Requesters and 6 for staff and admin. |
> | README demo steps match the seed | ✅ 16/16 API checks (VPN actions, gate states, Requester read-only, Administrator 403s) |
> | Docs: 126 rows, 114 Pass, only the 12 Issue 8 rows Planned; the 17 Issue 7 rows Pass | ✅ |
> | Mutation claim: all 37 rules caught | ⚠️ Server 10/10 caught. Client 35 of 38 caught; the 3 survivors are in comment 4. |
>
> ### Comments
>
> **1. A malformed percent-escape in the dashboard hash blanks the whole page (regression, please fix)**
>
> The new scroll effect in `Dashboard.tsx` calls `decodeURIComponent(hash.slice(1))` unguarded. A hash with a bad escape throws `URIError: URI malformed` inside `useEffect`, and with no error boundary the app unmounts.
>
> - Repro, any role: open `/dashboard#%` (also `#100%`, `#%zz`, `#%E0%A4%A`). The page ends up with no header and no text (`body` text length 0, `#root` empty). Typing `#%` into the address bar of a working dashboard does the same.
> - Hashes like `#nope`, `#%00`, `#%E2%82%AC` and a trailing-space hash are fine.
> - Base had no hash handling, so this is new, and it is a blank page in a PR whose goal is to remove them.
> - Suggested fix: the list ids contain nothing that needs decoding, so use `document.getElementById(hash.slice(1))`, or wrap the decode in `try/catch`. Add a test that renders `/dashboard#%` and expects the dashboard.
>
> **2. The new `REG-06 … Create Ticket` test times out under default parallelism**
>
> `Hardening.test.tsx`, "Create Ticket: Submit, clicked twice and pressed again with Enter, creates one ticket".
>
> - With `npm test` on a 22-core machine it took about 5.2 s against vitest's 5 s per-test default in 4 of 5 full-suite runs (the first run passed). The base suite passed 3 of 3.
> - Run alone it takes about 2.3 s (30/30 for the file), and with `--pool=forks --poolOptions.forks.maxForks=4` the full suite is 406/406. So the logic is fine and the test has no margin.
> - It is the first test in the file. It cold-renders the whole app and types about 100 characters with `userEvent`.
> - Anyone running `npm test` on a many-core machine, or CI under load, will see it fail. Suggested fix: give that test or file an explicit timeout (for example 15 s), or set `testTimeout` for the lab-04 client suite.
>
> **3. Refresh re-jumps while the URL still has `#my-planned-actions` (minor)**
>
> The effect depends on `state`, so it re-runs every time the data reloads. With the hash in the URL, pressing Refresh moved the page from `scrollY` 978 to 653 and kept focus on the list. Without the hash nothing moves, and no test pins the behavior. Run the jump once per navigation (`hash` and `key`), not on every reload.
>
> **4. Mutation claim: two of my #79 extras are still unpinned, and I couldn't reproduce one rule as listed**
>
> Your list isn't published, so I ran 38 client rules and 10 server rules of my own over the same categories. Server: 10/10 caught. Client: 35 caught, 3 survived.
>
> | Survivor | Note |
> |---|---|
> | Users `filtered` ignores the activation filter (`Boolean(search \|\| role \|\| activation)`) | This is the sixth you asked about. It drives the "No users match" empty state and its Clear button. The code is right; no test fails if it breaks. |
> | Count-strip links lose their 44px touch target | This is the one I meant by "the 44px touch target". The chip you fixed was a different rule. The code is right but unpinned. |
> | "Hash handled before the data arrives" (`if (!hash) return;`) | Equivalent mutant on my version: the target doesn't exist yet, so the early return changes nothing. The meaningful variant (effect not re-running when data arrives) **is** caught by UI-15, so that claim stands. |
>
> Please pin the first two with a test each, and list the mutated rules in the PR description.
>
> **5. Smaller notes (no action needed unless you agree)**
>
> - With the API really down, the dev proxy answers `500 text/plain`. Create Ticket now says "Something went wrong" (input is kept, so Lab 2 AC-05 holds), and "Cannot reach the TokTickIT API" appears only when no reply arrives at all. The wording change is intended, but the common outage case now reads like a server error.
> - The discussion thread's load failure says "Please reload the page" with no Retry. It's a sub-panel, so your claim about screens still holds.
> - Clicking My Tickets while filtered resets the status but keeps the page number. I reproduced it with 16 tickets: it stays on page 2 of the unfiltered list. It's the same class of bug as the sort fix.
> - A visitor who signs in from a bogus address lands on "Page not found" rather than the Dashboard.
> - The burst guards are state-based. A strictly synchronous five-event script burst on Create Ticket (no yield between events) got 5 POSTs. A user can't produce that: bursts with a yield between events got 1 POST, so I discounted it.
>
> ### Not verified
> - The labsheet citations (BR/FR/AC references) against the labsheet itself.
> - Your exact 37 mutation rules (not published).
> - PostgreSQL 15 specifically (I used 18.3 with the timezone set to UTC).
> - The README's `docker-compose exec …` commands, since Docker wasn't running. I checked their test targets and the demo data instead.
> - Real devices or screen readers.
>
> Overall this is solid work. The session route, the hardening sweep and the follow-ups are all done as described. Please fix comments 1 and 2 and I'll re-verify straight away.

**Author's response** (2026-10-10 11:28 UTC, @WirachatTH)

> Thanks for the thorough run, and for catching the blank page: a crash in a PR about removing dead ends is exactly what I needed someone to find. Both blocking items are fixed in 1c24928, and I fixed most of the smaller ones in the same push. The details are at the top of the PR description, under "Changes after the review".
>
> 1. Malformed hash: the scroll effect no longer decodes the hash, because the list ids need no decoding. New tests render /dashboard#%, #100%, #%zz, #%E0%A4%A and #nope and expect the dashboard. I also checked those in a browser, including typing #% into a working dashboard. It was the only decodeURIComponent in the client.
>
> 2. The slow test: the client's testTimeout is now 15 s. No assertion waits that long, so a missing element still fails at its own 1 to 5 s wait. Three full client runs in a row passed 419/419 here.
>
> 3. Refresh re-jump: the jump now happens once per navigation. A test jumps, refreshes and expects no second scroll. In a browser: scrolled to 978, Refresh, still 978.
>
> 4. Your two survivors are pinned, each confirmed by breaking it: the activation filter counting as a filter on User Management, and the count-strip links' 44px touch target. Sorry for misreading which touch target you meant last time. The chip was under 44px too, so that fix stays.
>
> 5. From your smaller notes, I fixed three:
>    - My Tickets returns to page 1 when the URL changes its status or sort, with no request for the stale page.
>    - Signing in from an unknown address opens the Dashboard.
>    - A 5xx whose body is not the API's JSON (the dev proxy's 500 text/plain, a gateway's HTML 502) says "Cannot reach the TokTickIT API" again. An error from the API itself still says "Something went wrong". I stopped the API to confirm what the proxy answers.
>
> 6. Left as they are:
>    - The thread's "Please reload the page": a Lab 3 test pins that text, and BR-46 does not let me change it here.
>    - The strictly synchronous script burst: the guards are state-based and a user cannot produce it, as you found.
>    - DASH-08 on a non-UTC database: good find. The test's SQL check depends on the database session's time zone; the application code does not. I will make the check zone-independent in Issue 8.
>
> On the mutation list: it was in the PR description from the start, in the "Mutation-tested" block, so it may have been easy to miss under the long text. For "hash handled before the data arrives", my rule removed `state` from the effect's dependencies, which is the variant you found caught. Nine more rules for these fixes are listed in the new section, and all nine were caught.
>
> After the fixes: client 419/419 (13 new), server 417/417, tsc clean, Playwright 36/36. One earlier Playwright run was 35/36: a mobile test timed out while closing its browser context, after its assertions had passed. That spec then passed 12/12 alone and the next full run was clean.

**Review — Approved** (2026-10-10 12:47 UTC, @Menelaus122)

> ## Re-review of PR #80: Issue 7 Final Hardening & Full Regression (fix commit `1c24928`)
>
> **Verdict: Approve.** Both blocking items from my earlier review are fixed and verified in a real browser, and I found no new defects in the fix commit. One optional comment is at the end.
>
> I re-checked head `1c24928` in an isolated environment (throwaway PostgreSQL 18.3 in UTC, separate API and Vite ports). I re-ran every suite, re-ran my own probes against the new head, and re-ran the mutations. Only the commit after my review changed: 13 files, no server code.
>
> ### Blocking items from my review
>
> | My finding | Result |
> |---|---|
> | 1. A malformed hash blanks the page | ✅ Fixed. `decodeURIComponent` is gone from `client/src`. Twelve odd hashes (`#%`, `#100%`, `#%zz`, `#%E0%A4%A`, `#%25`, `#`, …) render the dashboard for IT Staff, Requester and Administrator, each on a fresh page with no page error. Typing `#%` then `#%zz` into a working dashboard keeps it on screen. |
> | 2. `REG-06 … Create Ticket` times out under default parallelism | ✅ Fixed. `testTimeout: 15000` is in `client/vite.config.ts`. Three default full-suite runs on my 22-core machine were 419/419 each (it failed 4 of 5 runs before). In one of those runs that test took 6.1 s, which would have failed under the old 5 s limit, so the change was needed. |
>
> ### Non-blocking items
>
> | Item | Result |
> |---|---|
> | 3. Refresh re-jumps | ✅ Fixed. With the hash in the URL and the page scrolled to 978, pressing Refresh twice (a programmatic click, so nothing scrolls the page) leaves it at 978 with focus unchanged. Using the card link again jumps again (the location key changes on each click). Back to the hash URL jumps again, with or without a Refresh in between. Click and direct-load jumps still work at 1280×480 and 375px. |
> | 4. Two unpinned rules | ✅ Both pinned. Breaking the Users `filtered` flag fails UI-21, and breaking the count-strip 44px target fails STYLE-02. |
> | 5. My Tickets page after a URL change | ✅ Verified with 17 tickets. After the My Tickets nav link from page 2, no request for page 2 is made. Changing sort or status on page 2 goes to page 1, and Next/Previous still work. |
> | 6. Sign-in from an unknown address | ✅ Lands on the Dashboard. Eight real routes (My Tickets, ticket detail, Create Ticket, a filtered queue with its query string, staff ticket detail, filtered User Management, the Dashboard itself) are still returned to. A screen the role may not open still goes to its home. |
> | 7. Outage wording | ✅ A proxy's text/plain 500, an empty 500, an HTML 502, an HTML 503, a body-less 504 and a refused connection all say "Cannot reach the TokTickIT API". The API's own JSON 500 says "Something went wrong". A non-JSON 4xx (413, 404) and a `{}` JSON 502 also say "Something went wrong". Input is kept in every case. |
>
> I also checked that the 5xx change breaks nothing else. My Tickets, Ticket Queue, Dashboard and User Management still show the shared failure state with Retry under a proxy-style 500, and Retry recovers. The page-load session check under a proxy 500 ends on Login without a crash. A comment draft still survives a proxy 500 and says "Something went wrong. Please try again."
>
> ### Suites
>
> | Check | Result |
> |---|---|
> | Client tests | ✅ 419/419 in three consecutive default runs, 28 files. Per-file changes match your 13 new tests (DrillDown +2, Hardening +4, StaffDashboard +6, Zen +1). |
> | Server tests | ✅ 417/417, 35 files (UTC database) |
> | `tsc --noEmit` (server and client) | ✅ clean |
> | Playwright Lab 2 + 3 | ✅ 36/36 on the first run, no tracked file changed |
> | My earlier regression probes on the new head | ✅ session route, sweep and not-found 54/54; README demo steps 16/16; burst, Retry and failure-state probe all pass |
>
> ### Mutations
>
> All **nine of your new rules are caught**: hash decoded again, jumps on every reload, never jumps again for the same hash, page outlives its view, Login returns to an unknown address, a proxy's 5xx read as an API error, every ApiError a server error, activation not a filter, and the count-strip link losing its 44px. Four of my extra rules were caught too.
>
> Four of my extra rules survive. None were in your list, and the real code is correct in each case:
> - The page isn't keyed by sort, so a sort-only URL change isn't pinned.
> - Login never returning to the wanted screen isn't pinned by the client unit tests I ran. I confirmed it in the browser, and the Lab 2 journey needs it.
> - A non-JSON 4xx being read as an outage, in two variants, isn't tested. Real behavior is right: 413 and 404 stay "Something went wrong".
>
> ### One optional comment (no action needed)
>
> The ui-spec says that when the URL changes status or sort, the list "starts again at page 1". That holds for the nav-link case. In an A → B → A round trip it doesn't. From page 2 of Open requests, click My Tickets, then press Back, and the app requests `page=2&status=UNRESOLVED` again, because the page state is remembered per view. Restoring where you were is arguably fine. If you want the sentence to be literally true, reset the page whenever the view key changes and note it in the ui-spec.
>
> ### Not verified
> - The labsheet citations (BR/FR/AC references) against the labsheet itself.
> - PostgreSQL 15 specifically (I used 18.3 in UTC).
> - The README's `docker-compose exec …` commands, since I didn't use Docker.
> - Real devices or screen readers.
>
> Thanks for the quick turnaround. Everything I asked for is fixed, and the new tests pin each fix. Your DASH-08 oracle plan for Issue 8 sounds right.

**Author's response** (2026-10-10 12:52 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for the quick re-check! Catching the blank page on a malformed hash saved the hardening PR from shipping its own dead end. I'll look at the Back-button page case and your three unpinned rules in Issue 8.

### [#81](https://github.com/WirachatTH/toktickit/pull/81) — Issue 8: Responsive & Accessibility QA, Visual Checklist & E2E

**Verdict:** Approved · **merged** 2026-10-11 by @Menelaus122

**Review — Approved** (2026-10-11 07:02 UTC, @Menelaus122)

> ## Review of PR #81: Issue 8 Responsive & Accessibility QA, Visual Checklist & E2E
>
> **Verdict: Approve with comments.** Everything I could test holds up, and I found no defects in the product changes. The comments below are test-coverage gaps, one doc mix-up, and two accessibility issues that predate this PR. None of them blocks the merge.
>
> I checked head `c2cda4b` (red commit `8063dba`, then green `c2cda4b`) in a clean worktree. I wrote my own probes from the spec rather than reusing the PR's tests, and I re-ran mutations to check the "all caught" claims.
>
> **Environment:** I used a disposable PostgreSQL 18.3 in UTC, not Docker. The project targets 15. For the time-zone claim I set the database zone explicitly. I used system Chrome on Windows, not Linux Chromium.
>
> ### Verified claims
>
> | Claim | Result |
> |---|---|
> | 101 files = 26 + 75 screenshots; +1516/−56; red commit is tests only | ✅ |
> | Server tests 418/418 (35 files) | ✅ |
> | Client tests 431/431 (28 files), three default runs | ✅ Per-file counts match the description. |
> | `tsc --noEmit` clean (server and client) | ✅ |
> | Playwright `lab-02..04`, 66/66 (22 per width, 30 of them Lab 4) | ✅ Twice in a row (7.8 and 6.3 min). Each run left the database exactly as it found it (18 tickets, 13 users, 15 actions). No tracked file changed. |
> | DASH-08 no longer depends on the database time zone | ✅ Lab 4 server suite 103/103 in `Asia/Bangkok`, `America/Los_Angeles`, UTC and `Pacific/Kiritimati`. |
> | Exactly the 25 states of ui-spec §12 × 3 widths | ✅ Names match; 21 + 12 + 42 = 75. |
> | README recapture command (`CAPTURE_SCREENSHOTS=1 npx playwright test lab-04/`) | ✅ 30/30 passed. It rewrote exactly the 75 files and nothing outside `artifacts/lab-04`. 59 of 75 came out the same size; the other 16 differ in height, which fits my different browser and OS. |
> | Red-first TDD | ✅ Against the old source, the red commit's new tests fail: UNIT-02, UI-02 and three UI-21 mobile-filter tests. |
> | Mutation list | ✅ All 16 rules are caught by their named tests, and nothing is left modified afterwards. |
> | 1. Action in the ticket's creation minute | ✅ API: the creation minute's start is accepted and 1 ms before is refused, for planned and completed actions. The edit path follows the same rule. UI: Add action with the default date on a ticket created seconds earlier saves. |
> | 2. `#action-<id>` honoured once | ✅ Focus lands on the anchored card on load. After two saves it moves to each new card and stays there. |
> | 3. Mobile drill-down shows its filter | ✅ At 375px the Filters panel is open for status, sort, queue filters and owner. It stays closed for plain `/tickets`, plain `/staff/queue`, `?search=` and `?page=2`. Tablet and desktop show the filters inline. |
> | 4. Next sign-in after Log out | ✅ Desktop and mobile. The next Administrator, and the same person again, land on the Dashboard. An expired session still returns to its saved screen, and a visitor's deep link is still returned to. |
> | 5. Checkboxes and radios themed | ✅ Unfocused and checked: `rgb(0,107,60)` (`--zg-primary`) with the tick. Keyboard-focused: 2px `--zg-secondary` ring. No Bootstrap blue. |
> | 6. Date field keeps its focus ring | ✅ All 7 keyboard stops (month, day, year, hour, minute, AM/PM, calendar button) show the ring. |
> | #80 follow-ups (Back starts at page 1, pinned rules) | ✅ Each of the three pinned rules is caught when broken. |
> | E2E-08 console and request watch really fails journeys | ✅ In a different journey (E2E-06), an injected `console.error`, a same-origin 404 and an uncaught error each fail it. |
> | End-to-end evidence | ✅ Breaking "Log out leaves nothing to return to" fails RESP-01 on desktop. Closing the mobile Filters panel fails RESP-01 on mobile. Re-honouring the anchor fails RESP-03. |
> | Lab 3 RESP-06 change is minimal | ✅ One line plus a comment, assertion unchanged, recorded in BR-45 (5) and BR-46. |
> | Docs: 126 rows all Pass, per-issue counts sum to 126, §6 numbers | ✅ |
>
> I also ran an independent axe-core 4.14 audit (WCAG 2.0–2.2 A/AA) over 58 screen states: 3 widths × 3 roles, with panels and dialogs open. It found **no horizontal overflow and no colour-contrast failures**.
>
> ### Comments (non-blocking)
>
> 1. **The Filters toggle is no longer opened by keyboard in any end-to-end test.** The Lab 3 RESP-06 mobile step used to press Enter to open the queue's Filters panel. It now presses Enter only if the panel is closed, and that URL opens it already, so the step no longer exercises the toggle. The toggle itself works: Enter and Space both flip it in my check, on the plain and the filtered queue. A small fix is to start from a URL without filters, open the panel with Enter, then continue.
>
> 2. **Three extra mutations survived** (my additions, not in your list):
>    - "Log out still remembers the last screen" and "`signedOut` never set": only RESP-01 (e2e) catches these. You say as much in the PR, so this is just confirming it.
>    - "Queue: a search alone opens the mobile filters": nothing pins it. The code is right.
>    - A fourth extra, "minute rule rounds instead of floors", was caught by UNIT-02.
>
> 3. **`ui-spec.md` §8 doc mix-up.** The new "What the end-to-end and responsive pass changed (Issue 8)" heading was inserted above the Issue 7 bullets "Console" and "Touch target", so they now read as Issue 8 changes. Please move them above the new heading.
>
> 4. **"Each with a test that failed first" holds only partly.** The red commit has tests for the minute rule, the anchor, mobile filters and the e2e journeys. The tests for the checkbox and date-ring styling and the Log out unit test arrived in the green commit, so the history can't show them failing first. My mutations show the styling tests do fail when the fix is removed. Consider softening the wording.
>
> 5. **`desktop-create-completed.png`.** The Follow-up note you just filled is hidden behind the sticky footer, and only its focus ring peeks out. The mobile image shows it properly. It's a capture artifact, not a product bug.
>
> 6. **README timing.** "About 20 minutes" for the full run. I measured 6–8 minutes on my machine, so the number may be stale.
>
> 7. **Two accessibility issues my axe audit found. Neither was introduced here, but they show "accessibility is checked through roles, names and focus order" isn't exhaustive.**
>    - **WCAG 2.5.3 Label in Name (15 dashboard rows, from #79):** a row's `aria-label` is `"TCK-005286: summary"`, but the visible text also has the status badge and time. The accessible name doesn't contain what's on screen. Either drop the `aria-label` or include the full text.
>    - **WCAG 2.5.8 Target Size (older Lab 2/3 code):** the numbered pager buttons ("2", "3") on My Tickets and the Ticket Queue are about 8.6 px wide × 38 px at desktop and tablet. Mobile shows Prev/Next only.
>
>    I'm happy to see these as follow-up issues rather than blockers here.
>
> 8. **PERF timing tests (from #78).** PERF-01 (p95 under 500 ms) and one 5 s timeout failed in a couple of runs on my machine when I also forced the Node process zone, while the data assertions passed in every zone. They pass alone and in most other runs, so I read it as load flake, not time-zone dependence.
>
> 9. **Minor quirk.** `?status=ACTIVE` on the queue (the default value, but present in the URL) opens the mobile Filters panel. That's arguably fine.
>
> ### Not verified
> - The labsheet citations (BR/FR/AC references) against the labsheet itself.
> - All 75 screenshots by eye (I looked at a sample).
> - PostgreSQL 15 specifically (I used 18.3).
> - Real devices or screen readers (the PR also says it didn't use them).
> - Your Docker setup and the README's `docker-compose exec` commands.
>
> Nice work: the fix-per-defect structure, the E2E-08 watch that fails on unused allowances, and the recapture command that reproduces exactly the committed screenshots made this easy to check.

**Author's response** (2026-10-11 10:54 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for the axe-core audit across 58 screen states: that is a check I had not run at all. Good catches on the Filters toggle losing its keyboard test and the ui-spec heading that swallowed two Issue 7 bullets. I'll fix those, the two accessibility findings, and the wording you flagged before the release.

### [#82](https://github.com/WirachatTH/toktickit/pull/82) — Pre-release check: PR #81 review notes, peer review record, AI use

**Verdict:** Approved · **merged** 2026-10-11 by @Menelaus122

**Review — Approved** (2026-10-11 20:02 UTC, @Menelaus122)

> ## Review of PR #82: pre-release check
>
> **Verdict: Approve with comments.** I checked out `f5aafab` (base `c1a20aa`), rebuilt it from scratch and ran everything. The claims I could test hold up, and the comments below are small follow-ups.
>
> **Environment:** I used a throwaway PostgreSQL 18.3 (UTC) instead of Docker, and Windows Chrome instead of Linux Chromium. The project targets PostgreSQL 15.
>
> ### What I ran
>
> | Check | Result |
> |---|---|
> | Server tests | 418/418 (35 files), run twice |
> | Client tests | 436/436 (28 files), run three times. DrillDownFilters 19→23, ZenGreenLab4 9→10 |
> | `tsc --noEmit` (server, client, e2e) | Clean |
> | Playwright `lab-02..04` | 66/66, run twice (10.9 and 9.5 min). The database and tracked files were unchanged afterwards |
> | Screenshot recapture (`CAPTURE_SCREENSHOTS=1 npx playwright test lab-04/`) | 30/30 passed. It rewrote exactly the 75 files under `artifacts/lab-04` and nothing else |
> | Diff shape | 66 files, +141/−33: 17 source/test/doc files plus 49 PNGs. No Lab 2–3 screenshot was touched |
>
> ### Your claims, checked
>
> - **API-01 broke with the calendar.** The base version of the test fails today (11 Oct), and the PR version passes. With the clock set back a day, the base version passes, so the test setup itself is sound.
> - **"No other fixed date is compared with the clock."**
>   - I re-ran the Lab 4 client tests with the clock at +0, +45 and +400 days, and all 149 passed.
>   - The Lab 4 server tests passed at +45 and +400 days except one check that compares the database's real clock with my shifted clock (API-18). That is my harness, not your code.
>   - A text search of the Lab 4 tests found no other pattern.
> - **PERF timeout.** The 500 ms budgets are unchanged. With a forced 50 ms CLI timeout, your file still passes. Without the `vi.setConfig` line, all 3 tests time out.
> - **The Log out race is real.** I held the dashboard request for 2 s and clicked Log out. The Lab 4 `logOut` wrapper passes. The plain Lab 3 `logOut` fails with `401 GET /api/dashboard/staff`, which E2E-08 reports.
> - **Review note 1, the Filters toggle by keyboard.** At 375 px, Enter and Space both close and reopen the panel, and focus stays on the button. Three RESP-06 mutations (opens-only, closes-only, does nothing) all fail the test.
> - **Review note 2, the unpinned rule.**
>   - At 375 px, a search alone or a page number alone keeps the queue's panel closed.
>   - A sort alone, or any filter named in the URL, opens it.
> - **Review note 7a, WCAG 2.5.8 for the pager.**
>   - I created 120 extra tickets (13 pages). Every pager button is at least 40 px wide at desktop and tablet.
>   - Mobile shows Prev/Next only, at 56×44 px.
>   - Nothing overflows, because the pager wraps.
>   - axe `target-size` reports 0 violations.
> - **Review note 7b, WCAG 2.5.3 for ticket rows.** The Administrator dashboard (10 rows) and the Requester dashboard (5 rows) have no `aria-label`, and each name equals the row's visible text. See comment 1 for the one row type that still fails.
> - **Mutation test.** All 6 listed rules are caught, with an unmutated baseline of 67/67 first. My 7 extra mutations were caught too. See comment 2 for one wrong attribution.
> - **Accessibility audit.** I ran axe-core 4.14 (WCAG 2.0–2.2 A/AA) over 64 screen states and found no horizontal overflow and no `target-size` failures. As a control, I reverted your two accessibility fixes and re-ran it. It reported `target-size` ×12 on My Tickets and ×3 on the queue, and `label-content-name-mismatch` ×5 on the Requester dashboard and ×11 on the staff one. So the audit detects what you fixed.
> - **`reviewer.md` quotes.** I compared 96 quoted fragments across the 19 rows with the actual GitHub review and comment texts, and found 0 mismatches. A doctored copy was flagged, so the check works. Titles, branches and verdict sequences also match, except #88 (comment 3).
> - **`ai-use.md`.** Every Lab 4 commit carries "Claude Opus 5.5", and the 9-issue backlog is #65–#73.
> - **`tests.md`.** The new §4 row is a checklist row, not a test, so "126 Pass" stays correct. The 418 / 436 / 66 totals match what I ran.
> - **README.** "Roughly 7 to 17 minutes" is consistent with my 9.5–10.9 min for the full run and 8.6 min for Lab 4 alone.
>
> ### Comments (none blocking)
>
> 1. **WCAG 2.5.3 is not fully fixed.**
>    - One element still fails axe's `label-content-name-mismatch` on the IT Staff Dashboard at all three widths: the **"My planned actions"** row. `PlannedRow` in `Dashboard.tsx` keeps `aria-label={`${when}: ${action.description} (${action.ticket.ticketNumber})`}`.
>    - The visible text is the time, description and ticket number in separate spans.
>    - Dropping the `aria-label`, as you did for ticket rows, should fix it. UI-15's `toHaveAccessibleName(stringContaining("Replace the laptop battery."))` would still pass.
>    - Until then, the `tests.md` line "a dashboard row's accessible name is its visible text" is not true for this row.
>
> 2. **One mutation is credited to a test that doesn't catch it.**
>    - "Status badge removed from the row → UI-15, UI-18": only UI-18 fails.
>    - UI-15's pattern `…\s*\S.*\d{2}:\d{2}$` still matches without the status, because `\S.*` takes the time text.
>    - Either add the status badge text to the UI-15 pattern, or change the list to "UI-18". The other five mutations are caught exactly as listed.
>
> 3. **`reviewer.md` is stale for partner PR #88.**
>    - The record says "Changes requested … (still open when this record was written)", and the PR description repeats it.
>    - On GitHub, #88 was approved at 10:08:45Z and merged at 10:08:54Z, about 21 minutes before this PR's last commit (10:29:59Z).
>    - It has two reviews (Changes requested, then Approved with an `e105f28` re-check), so the record should add "Round 2, Approved".
>
> 4. **The `ui-spec.md` §8 sentence is true of the queue only.**
>    - "A filter named in the URL opens it even at its default value" holds for `/staff/queue`: `?status=ACTIVE` and `?status=ALL` both open the panel at 375 px.
>    - My Tickets compares values against its defaults, so `/tickets?status=ALL` and `/tickets?sort=createdAt&order=desc` stay closed.
>    - Please say "on the queue", or align the two screens.
>
> 5. **Screenshots, minor.**
>    - In the `create-completed` captures (all three widths) the title, status and date fields are scrolled out of view. On mobile, everything above "Assigned to" is hidden. A taller capture viewport would show the whole form.
>    - Most of the 49 binary diffs are re-renders with new ticket numbers and times, not intended changes. A reviewer can't tell them apart from the real ones (the pagers and the create-completed images).
>
> ### Not verified
> - The "28 / 30" run on your slower machine. I reproduced the race that causes it, not that run.
> - The labsheet's requirements for the two deliverable documents.
> - The prompts in `ai-use.md` word for word, and the reflection.
> - The "Lab04 project" board.
> - All 75 screenshots by eye. I viewed 5 of them.
> - Docker, PostgreSQL 15, and real devices or screen readers.
>
> Thanks for the thorough write-up. The pager, the Log out wait and the calendar fix all check out, so I'm happy to approve once you've seen the comments.

**Author's response** (2026-10-12 02:25 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for reverting my two accessibility fixes to prove your audit detects them! You're right that the planned-action row still had its aria-label, and that #88's record was stale by the time I pushed. I'll fix both, with the UI-15 pattern and the ui-spec sentence, in one small PR before the release.

### [#83](https://github.com/WirachatTH/toktickit/pull/83) — Pre-release follow-up: PR #82 review notes and the peer review record

**Verdict:** Approved · **merged** 2026-10-12 by @Menelaus122

**Review — Approved** (2026-10-12 08:36 UTC, @Menelaus122)

> ## Review of PR #83: pre-release follow-up
>
> **Verdict: Approve with comments.** I checked out `c3a09f7` (base `3dabaae`, the merge of #82), rebuilt it from scratch and ran everything. The claims I could test hold up, and the comments below are small follow-ups.
>
> **Environment:** I used a throwaway PostgreSQL 18.3 (UTC) instead of Docker, and Windows Chrome instead of Linux Chromium. The project targets PostgreSQL 15.
>
> ### What I ran
>
> | Check | Result |
> |---|---|
> | Diff shape | 8 files, +73/−12, on one commit. No server change, no Lab 1–3 test, no screenshot |
> | Server tests | 418/418 (35 files). I ran them once, since there is no server change |
> | Client tests | 436/436 (28 files), run three times, plus once more as the unmutated baseline of my mutation run |
> | `tsc --noEmit` (server, client, e2e) | Clean |
> | Playwright `lab-02..04` | 69/69, run twice (5.3 and 4.8 min). I counted 1+4+2+5+4+5+2 = 23 tests per width. The database was identical after each run (18 tickets, 13 users, 15 actions) and no tracked file changed |
>
> ### Your claims, checked
>
> - **1. The planned-action row has no `aria-label`, and its name is what it shows.**
>   - I checked 75 dashboard rows (IT Staff, Administrator and Requester, at 3 widths). None has an `aria-label`, and Chrome's computed name equals the visible text in every one.
>   - axe-core 4.14 (WCAG 2.0–2.2 A/AA) found 0 violations and no horizontal overflow.
>   - As a control, I put the old label back. axe then reports `label-content-name-mismatch` on that row at all three widths, so the audit does cover it.
> - **UI-15 "failed before the fix".** With the base `Dashboard.tsx` and your tests, UI-15 fails at `not.toHaveAttribute("aria-label")`.
> - **2. UI-15 now catches a missing status badge by itself.**
>   - The old test file with the badge removed passes 17/17, which is the #82 gap.
>   - The new file with the badge removed fails UI-15 on its own, run without UI-18.
> - **Mutation test.**
>   - The unmutated tests passed 436/436 first. Your 3 rules are all caught.
>   - I added 11 mutations of my own: the planned row's description, time, order and `aria-hidden`, and the ticket row's badge, time, number and summary. All were caught, so 14/14 in total.
> - **3. `reviewer.md` is current.**
>   - I compared 103 quoted fragments across the 21 rows with the review and comment texts on GitHub, and found 0 mismatches. Titles, branches and links match.
>   - The verdict rounds match GitHub for every row, including #88 (Changes requested, then Approved), #89 (Changes requested) and #82 (Approved).
>   - A doctored copy (an altered quote and a flipped round) was flagged, so the check can fail.
> - **4. `ui-spec.md` §8.**
>   - I tested 25 URLs at 375 px, with 0 differences.
>   - On the queue, any of `status`, `itPriority`, `categoryId`, `owner`, `appearsResolved` or `sort` opens the panel, even at a default value (`?status=ACTIVE`). Search, page, `pageSize` or `order` alone do not.
>   - On My Tickets, only a non-default status or sort opens it, so `/tickets?status=ALL` stays closed. Category, system and priority params are ignored in its URL, so no filter ends up hidden.
> - **5. No screenshot changed.** None is in the diff, and the two full runs (no capture) left tracked files unchanged.
> - **Log out really waits now.**
>   - I held the Dashboard request for 2 s and for 5 s, moved there inside the app, and logged out at once.
>   - With no wait, the request is answered `401` in 6 of 6 runs. With `settle`, it is answered `200` in 12 of 12 runs, and the wait lasts as long as the hold (2.3 s and 5.3 s).
>   - Your new test passes 30/30 with `--repeat-each=10` (10 at each width).
> - **The `domcontentloaded` reset is needed.** With that line removed, a Lab 4 journey times out in `settle`. So a request cut off by a full page load really never reports back.
> - **README and `tests.md` say 69.** The README range "roughly 7 to 17 minutes" is above my 4.8 and 5.3 min on a quiet 22-processor machine. That is machine-dependent, so I don't count it as a problem.
>
> ### Comments (none blocking)
>
> 1. **The new test can't tell #82's wait from this PR's wait.**
>    - You say this yourself, and I can explain why. The test moves inside the app straight after the queue page loads, before that page's own "network idle" has fired. So `waitForLoadState("networkidle")` waits for the next idle, which comes only after the held request is answered.
>    - I put #82's wait back in `logOut`, and the test still passes (that mutation survives).
>    - The same wait fails 6 of 6 times with a `401` once the queue page's network has settled, whether the request is held 2 s or 5 s.
>    - Fix: add one line in `e2e/lab-04/dashboards.spec.ts`, just before `page.route(...)`:
>      ```ts
>      await page.waitForLoadState("networkidle");
>      ```
>      I tested it three ways. With the real `settle()` the test still passes. With #82's wait, or with no wait, it fails with a `401`.
>    - Other `settle()` mutations: "counts nothing" and "waits at most 100 ms" are caught. A "quiet once, not twice" change survives every Lab 4 journey, so that refinement is unpinned. Removing any one of the three "request done" listeners survives, because the other two cover it.
>
> 2. **Issue #73 is already closed.**
>    - The PR says "It does not close #73: the release PR into `main` does that." But #73 ("Issue 9: Integration & Release to Main") was closed by hand at 09:31Z on 11 Oct, before the #82 commits. No PR into `main` exists yet.
>    - Please reopen it until the release, or change that sentence.
>
> 3. **`tests.md` doesn't list the new test.** The E2E-08 row still says "one test provokes each to prove the watch reports them". The new test also carries the E2E-08 label, but nothing mentions it. One clause in that row would cover it. The "126" count stays right.
>
> 4. **The #89 row in `reviewer.md` has an empty Response cell.** It was correct when you wrote it (03:20Z), but the partner replied at 05:18:47Z. Since this record is a deliverable, you may want to add the reply before the merge. The "still open when written" note can stay.
>
> 5. **Wording nits.**
>    - "Two tests tightened": it is one test (the third `it` in UI-15) with two groups of assertions.
>    - "All 3 caught by UI-15 alone": mutation 3 also fails UI-18, because `TicketRow` is shared. UI-15 does fail by itself when its file runs alone (I checked), so the claim holds in the way that matters.
>    - The `ui-spec.md` heading "What the pre-release check changed (from the PR #81 review)" now also holds the planned-row change, which came from the #82 review.
>
> ### Not verified
> - The earlier 29/30 Lab 4 run on your machine. I reproduced the mechanism (the race, deterministically), not that run, and I did not load-test the machine.
> - Docker, PostgreSQL 15, Linux Chromium, real devices and screen readers.
> - The review text itself. I checked only that the quotes match GitHub.
> - The "Lab04 project" board and the labsheet's wording.
>
> Good fix on the Log out race, and thanks for being open that the new test doesn't separate the two waits. Everything else checks out, so I'm happy to approve once you've seen the comments.

**Author's response** (2026-10-12 10:23 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for working out why my new test couldn't tell the two waits apart: the one-line fix makes it a real check. Good catch on #73 being closed already, too. I'll sort that out before the release PR.

### [#84](https://github.com/WirachatTH/toktickit/pull/84) — Pre-release follow-up 2: PR #83 review notes

**Verdict:** Approved · **merged** 2026-10-12 by @Menelaus122

**Review — Approved** (2026-10-12 13:09 UTC, @Menelaus122)

> ## Review of PR #84: pre-release follow-up 2
>
> **Verdict: Approve with comments.** I checked out `b6849c3` (base `a8f65ac`, the current `lab4-staging`), rebuilt it from scratch and ran everything. The claims I could test hold up. The comments below are one optional test, one process note, and two corrections to my own PR #83 review.
>
> **Environment:** I used a throwaway PostgreSQL 18.3 (UTC) instead of Docker, and Windows Chrome instead of Linux Chromium. The project targets PostgreSQL 15. The usual ports were busy on my machine, so I ran the stack on other ports and changed only the port numbers in my local copy.
>
> ### What I ran
>
> | Check | Result |
> |---|---|
> | Diff shape | 4 files, +9/−3: three docs and `dashboards.spec.ts`. No application code, no screenshot, no Lab 1–3 test. `git diff --check` is clean |
> | Server tests | 418/418 (35 files) |
> | Client tests | 436/436 (28 files), run three times, plus once more while the machine was busy |
> | `tsc --noEmit` (server, client, e2e) | Clean |
> | Playwright `lab-02..04` | 69/69, run twice (5.2 and 4.8 min). The database was identical after each run (18 tickets, 13 users, 15 actions) |
> | Skipped or disabled tests | None. A grep found none, and the runs report none |
>
> ### Your claims, checked
>
> - **1. The Log out test now tells the waits apart.**
>   - I reproduced your three-way run on desktop, and it matches your numbers:
>
>     | Variant | Result |
>     |---|---|
>     | Real `settle()` | 5/5 pass |
>     | PR #82's wait put back | 3/3 fail with `401 GET /api/dashboard/staff` |
>     | No wait | 3/3 fail with `401 GET /api/dashboard/staff` |
>
>   - Tablet and mobile give the same result (3 runs per variant).
>   - I also removed your new `networkidle` line. With the real wait the test still passes, and with PR #82's wait put back it passes too. That was the #83 state. So that one line is what makes the test discriminate.
>   - Other `settle()` mutations are the same as in #83. "Counts nothing" and "waits at most 100 ms" are caught. "Quiet once" and removing any one of the three "request done" listeners survive, because the other two cover it.
> - **"Quiet twice, not once" is not pinned.** True for this test and for every Lab 4 journey on desktop (see comment 1).
> - **2. Issue #73.**
>   - You were right and I was wrong (see correction 1 below).
>   - It was reopened at 11:20:32Z today and is still open. Its Lab 4 card is at "Started".
>   - I cannot check the `Closes #73` part, because no release PR exists yet.
> - **3. `tests.md`.** The E2E-08 row now names the log-out test and its expected result. That matches the test: a request still out at Log out is answered `200`. The "126" count is unchanged and still right, since no test is added.
> - **4. `reviewer.md`.**
>   - I compared 108 quoted fragments across the 22 rows with the review and comment texts on GitHub, and found 0 mismatches. Titles, branches, links and verdict rounds all match.
>   - For #89, Round 1 comes from the changes-requested review (03:16Z) and Round 2 from the approval (10:26Z). The reply is the comment at 05:18Z, and "Thx kub" came at 10:31Z.
>   - The #83 row quotes my approval (08:36Z) and your reply (10:23Z).
>   - No row says "still open" any more.
>   - A doctored copy (an altered quote and a flipped round) was flagged, so the check can fail.
> - **5. Wording.** The `ui-spec.md` §8 heading now reads "from the PR #81 and PR #82 reviews". That fits, because the ticket-row change came from the first and the planned-row change from the second. Nothing else refers to the old heading.
> - **"No screenshot, no application code, and no Lab 1–3 test changed."** True.
>
> ### Comments (none blocking)
>
> 1. **"Quiet twice" can be pinned, if you want it to be.**
>    - You say there is no deterministic way to provoke a request that a render is about to send. I found one that worked every time for the real code on my machine. A request is answered after 100 ms, and 125 ms later the page sends a second one. `settle()` polls every 150 ms, so its second poll lands in the gap between them.
>    - Results:
>      - The real `settle()` passed 40/40, at desktop, tablet and mobile, and with the CPU busy.
>      - "Quiet once" failed 39 of 40 with `401 GET /api/auth/me?probe=b`. The one pass was under load, which moved the timing window.
>      - No wait, and PR #82's wait, both failed.
>    - The probe, for `dashboards.spec.ts`:
>      ```ts
>      const named = (name: string) => (url: URL) =>
>        url.pathname === "/api/auth/me" && url.searchParams.get("probe") === name;
>
>      test("E2E-08 a request that a finished request leads to is waited for too", async ({ page }) => {
>        await signIn(page, ACCOUNTS.staff.email);
>        await expect(page).toHaveURL(/\/dashboard$/);
>        await expect(page.locator(".zg-metric-card").first()).toBeVisible();
>        await page.waitForLoadState("networkidle");
>        await page.route(named("a"), async (route) => {
>          await new Promise((resolve) => setTimeout(resolve, 100));
>          await route.continue();
>        });
>        await page.route(named("b"), async (route) => {
>          await new Promise((resolve) => setTimeout(resolve, 1500));
>          await route.continue();
>        });
>        const answeredB = page.waitForResponse((response) => named("b")(new URL(response.url())));
>        await page.evaluate(() => {
>          void fetch("/api/auth/me?probe=a").then(() => setTimeout(() => void fetch("/api/auth/me?probe=b"), 125));
>        });
>        await logOut(page);
>        await expect(page).toHaveURL(/\/login$/);
>        expect((await answeredB).status()).toBe(200);
>      });
>      ```
>    - Two cautions:
>      - The endpoint must need a session. `/api/categories` is public, so my first version of the probe passed even with no wait at all.
>      - It is timing-based, and it would add 3 test executions (one per width). So 69 would change to 72 in `tests.md`, the README and the PR text.
>    - Leaving it as a documented gap is also fine, as you did.
> 2. **PR #84 can't have its own row in `reviewer.md` yet.** The PR says "so that nothing is left open at the release", but each follow-up PR adds the previous one's row. That means this PR's row will be missing until another PR adds it, and so on. It might help to say where the chain stops. For example, the release PR adds the #84 row, and the record then stays as it is.
> 3. **#73 after the reopen.** I cannot see the project workflow's trigger setting. So I can't say whether a later card move (for example to PR Review or Done) could close #73 again before the release PR. It is worth a glance after the next move.
> 4. **Nits.**
>    - #83's description still says "two tests tightened". It was last edited at 06:49Z, before my review. The bullet in #84 acknowledges the point, but it does not change that text. That is fine for a merged PR.
>    - The commit prefix is `docs:`, although a test file changed.
>
> ### Two corrections to my own PR #83 review
>
> 1. **Issue #73 was not closed by hand.** I wrote that it was. GitHub records the closer as the project (`ProjectV2`) for issues #65 to #73. Each was closed a few minutes after the previous card went to "Done" and 5 to 60 minutes before its branch's first commit. That fits your explanation exactly. Sorry for the wrong claim.
> 2. **The `domcontentloaded` reset is real but only occasionally pinned.** In #83 I said that without that line a Lab 4 journey times out in `settle`. I have now repeated that mutation. It is caught in only 6 of about 165 executions (the E2E-05 and Actions Taken journeys), and one run of 11 caught nothing. So the reset is still right, but no test reliably fails without it.
>
> ### Not verified
> - Docker, PostgreSQL 15, Linux Chromium, real devices and screen readers.
> - The truth of the review text itself. I checked only that the quotes match GitHub.
> - Your own run on `a8f65ac`. I ran only this PR's head, although the diff is tests and docs only.
> - The project workflow's trigger setting, and the future release PR with `Closes #73`.
>
> Thanks for taking the `networkidle` suggestion as it was written, and for checking in public who closed #73. I'm happy to approve this one.

**Author's response** (2026-10-12 13:16 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for coming back to correct your own #83 notes: that takes more care than most reviews get. Your "quiet twice" probe is a neat find, especially the catch that the endpoint has to need a session. The release PR is next, and it says where the review record stops.

### [#85](https://github.com/WirachatTH/toktickit/pull/85) — Issue 9: Integration & Release to Main

**Verdict:** Approved · **merged** 2026-10-12 by @Menelaus122

**Review — Approved** (2026-10-12 14:00 UTC, @Menelaus122)

> ## Review of PR #85: Lab 4 release (`lab4-staging` → `main`)
>
> **Verdict: Approve with comments.** I checked out `8e3ca97`, rebuilt it from scratch and ran everything. Every claim I could test holds up. The one thing I'd fix is a rollback route in the README that fails (comment 1). The rest are nits.
>
> **Environment:** I used a throwaway **PostgreSQL 15.18** (the `postgres:15-alpine` image your `docker-compose.yml` uses) and Windows Chrome instead of Linux Chromium. The usual ports were busy on my machine, so I ran the stack on other ports and changed only the port numbers in my local copy.
>
> ### What I ran
>
> | Check | Result |
> |---|---|
> | Diff shape | 34 commits, 163 files, +11,492/−112. `main` has no commit that `lab4-staging` lacks, so merging is a pure carry |
> | Server tests | 418/418 (35 files) on Postg
> | Client tests | 436/436 (28 files), run three times |
> | `tsc --noEmit` (server, client, e2e) | Cle
> | Playwright `lab-02..04` | 69/69, run twice (4.3 and 5.0 min). The database was 18 tickets, 13 users, 15 actions after each run |
> | Skipped or disabled tests | None. A grep found none, and the runs report none |                               
> ### Your claims, checked                                                                                        
> - **The tested tree is the tree that merges.** `8e3ca97` is the merge of #84, and its tree is byte-identical to `b6849c3`, the head you ran in full. All 34 ed PRs (#74–#84), with no direct push. EachPR was merged at exactly the commit I approved, so no unreviewed commit is included.                               - **No new dependency.** The three `package. the Dockerfiles and `docker-compose.yml` are identical to `main`.                                                                                               - **The migration, on a real Lab 3 database.
>   - I built a database from `main`'s three migrations and seed (18 tickets, with 2 Resolved and 2 Closed), then    upgraded it as the README says.
>   - Only `20261005145753_lab4_actions_taken_dashboards` was applied. The seed printed `Actions Taken created: 15`, then `0`.
>   - All 7 Lab 1–3 tables kept identical rows (same count and hash, apart from the new `resolvedAt`).
>   - `resolvedAt` was filled from `updatedAt`losed tickets, and left null for the other14.
>   - The upgraded schema is identical to a frpg_dump -s`), and `prisma migrate diff`reports no drift. A control (Lab 3 schema against Lab 4 schema, 282 differing lines) shows the comparison can fail.
>   - **The reviewed down-script.** After it, e Lab 3 schema from before the upgrade, thedata is unchanged, and `migrate deploy` plus the seed re-apply cleanly.
> - **The full-journey smoke test.** I wrote mng yours: my own steps, and SQL written fromBR-39, BR-40 and BR-41. It passed 24/24 in a real browser, with no page error, and removed what it created (back to
> 18, 13, 15):
>   - The Administrator created a Requester with an initial password. The first sign-in went straight to Set a new
> password. Until then `GET /api/tickets` answUIRED`. Afterwards the Dashboard showed every card at 0.
>   - The Requester created a ticket and then aff claimed it, started it, planned an action and completed it with a result.
>   - With no action, Resolved was not offered409 RESOLUTION_BLOCKED`. With a plannedaction, the notice read "no action is still planned (1 planned)" and the API still refused. After completion, Resolved was offered and the ticket was resolved in t
>   - The IT Staff and Administrator Dashboards equal SQL: the 6 metrics, the 8 statuses, the 3 priorities and the 4 user counts (7/3/2/2). The My tickets card dunt (4).
>   - Wrong-role calls all answered `403`: the Requester on the queue, user list, both staff dashboards and creating anAction Taken; IT Staff on the user list and Administrator on a status change.
>   - After Log out the API answered `401` and the ticket's URL showed Login.                                          - **`tests.md`.**
>   - It has 126 unique rows, all Pass, and the per-category counts match the totals line. Every file it names exists.   - The 15 earlier-lab test files that changfall within what BR-46 names: Dashboard ashome, setup-only fixtures, REG-14, API-42 and the Administrator note.                                                - **Screenshots.**
>   - There are 75 valid PNGs: 25 states at 1280, 834 and 375 px, and every state listed in `ui-spec.md` exists at all three widths.
>   - Only `artifacts/lab-04` was added, so no Lab 2–3 screenshot was rewritten.                                           - They were last committed in `f5aafab`, tr fix. The only later visual-source change(`c3a09f7`) removed an `aria-label`, so they match the final UI.                                                       - **`reviewer.md`.** It is the same tree I cgments across 22 rows match GitHub.
> - **No secret committed or sent to the client.** I found none in the diff, in the 34-commit history, or in the         production client bundle.
> - **Issue #73 and the board.** #73 is open and was not re-closed. Its card moved to "PR Review" at 13:15:11Z, about 30 seconds after this PR opened. Cards #65–#72
>                                                                                                                        ### Comments (none blocking the code)
>                                                                                                                        1. **The README's "restore the backup" rollbed.**
>    - The "Rolling back the Lab 4 migration" section (from #75) offers two routes. The down-script works, as above. The first, `pg_restore -U toktickit --clean --ifb4.dump`, does not.
>    - I ran it as documented on the upgraded database. `pg_restore` exited 1 with 118 error lines, because `--clean`    cannot drop `User_pkey` and `Ticket_pkey` wheign keys depend on them. The `ActionTaken`tables and `Ticket.resolvedAt` stayed, so the schema was still Lab 4. It also overwrote `_prisma_migrations` back to 3 rows.
>    - The next `prisma migrate deploy` then stops with `P3018: type "ActionTakenStatus" already exists`.                   - I approved #75 and did not try this rouhe down-script, so the suite can't catch iteither.                                                                                                                   - **A route that works:** stop the serverase, then restore without `--clean`:
>      ```bash                                                                                                                docker-compose stop server
>      docker exec toktickit-db psql -U toktickit -d postgres -c 'DROP DATABASE toktickit' -c 'CREATE DATABASE           toktickit'
>      docker exec -i toktickit-db pg_restore -U toktickit -d toktickit < pre-lab4.dump                                       ```
>      In my test (a database named `upg` in my own container) this exited 0 with no errors. The schema was identical to Lab 3, the data was identical to before the  plus the seed re-applied cleanly. I did not run the compose-named commands above through your compose stack. The server must be stopped first, because `DROP DATABASE` fails while it is connected.
>    - Dropping the first route and documenting only the down-script would also be fine.
>    - Because this PR's head is `lab4-staginguld carry the fix here.
> 2. **The Definition of Done boxes are all still unticked in the release.** That is 16 in `specification.md` and 10 in the `ui-spec.md` §11 checklist. Lab 2 and La with the results recorded in `tests.md`, sothis is not a regression. A reader may still take "[ ] Every dashboard count matches an independent database query" as
> not done. Ticking them (or a line saying `teneed another commit, so it is your call.
> 3. **Nits.**
>    - `gate-blocked` and `list-several` are bBoth are full-page captures showing the gatenotice and the four actions, so it is redundant evidence, not wrong.
>    - The Definition of Done says `reviewer.mand this PR are not in it. You say so in thedescription, so I only note it.
>
> ### Not verified
> - The full Docker Compose fresh-clone flow,  Rendering also differs from your Dockercaptures, so I could not compare screenshots pixel-for-pixel.
> - Real devices and screen readers.
> - The truth of the review text itself. I checked only that the quotes match GitHub.
> - Your note that moving #73's card from Start it open. I only saw it still openafterwards, and I can't see the auto-close workflow's settings.
> - The unticked box "Full suite re-run on `ma
> - Your run on the `a8f65ac` tip. I ran only this PR's head.
>
> Thanks for a clean, well-documented release, and for stating plainly what the report still owes. Fix the README's first rollback route if you can, and I'm hap

**Author's response** (2026-10-12 14:04 UTC, @WirachatTH)

> Thanks for the approval and the merge, and for upgrading a real Lab 3 database on PostgreSQL 15 to check the migration both ways! You're right about the README's pg_restore route, and I should have run it instead of only the down-script. Nothing can follow the release PR, so I'll record it in the report with your working route. Thanks for a whole sprint of reviews that actually ran the code.
