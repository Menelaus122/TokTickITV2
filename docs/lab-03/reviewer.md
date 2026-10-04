# Lab 3 — Peer Review Record

**Author:** Poomipat Apiwattanaphong — 67070501035 — GitHub: [@Menelaus122](https://github.com/Menelaus122)<br>**Peer reviewer:** Wirachat — 67070501041 — GitHub: [@WirachatTH](https://github.com/WirachatTH)
<br>**Repository:** [Menelaus122/TokTickITV2](https://github.com/Menelaus122/TokTickITV2) · **Integration branch:** `lab3-staging`

Every comment and response below is quoted exactly as it appears on GitHub,
oldest first, so the record can be checked against each Pull Request.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Review rounds | Merged by |
| :--- | :--- | :--- | :--- |
| [#46](https://github.com/Menelaus122/TokTickITV2/pull/46) | `feature/1-sprint-contract` | Changes requested → Approved | @WirachatTH |
| [#47](https://github.com/Menelaus122/TokTickITV2/pull/47) | `docs/lab3-spec-approved` | Approved | @WirachatTH |
| [#48](https://github.com/Menelaus122/TokTickITV2/pull/48) | `feature/2-user-model-and-migration` | Approved | @WirachatTH |
| [#50](https://github.com/Menelaus122/TokTickITV2/pull/50) | `feature/3-authentication-api` | Changes requested → Approved | @WirachatTH |
| [#52](https://github.com/Menelaus122/TokTickITV2/pull/52) | `feature/13-login-throttling` | Changes requested → Approved | @WirachatTH |
| [#53](https://github.com/Menelaus122/TokTickITV2/pull/53) | `feature/4-authorization` | Changes requested → Approved | @WirachatTH |
| [#54](https://github.com/Menelaus122/TokTickITV2/pull/54) | `feature/5-login-and-shell` | Changes requested → Approved | @WirachatTH |
| [#55](https://github.com/Menelaus122/TokTickITV2/pull/55) | `feature/6-requester-regression` | Approved | @WirachatTH |
| [#56](https://github.com/Menelaus122/TokTickITV2/pull/56) | `feature/7-comments-and-notes` | Approved | @WirachatTH |
| [#57](https://github.com/Menelaus122/TokTickITV2/pull/57) | `feature/8-staff-ticket-queue` | Changes requested → Approved | @WirachatTH |
| [#58](https://github.com/Menelaus122/TokTickITV2/pull/58) | `feature/9-staff-ticket-detail` | Approved | @WirachatTH |
| [#59](https://github.com/Menelaus122/TokTickITV2/pull/59) | `feature/10-admin-user-management` | Approved | @WirachatTH |
| [#60](https://github.com/Menelaus122/TokTickITV2/pull/60) | `feature/11-e2e-and-visual-evidence` | Changes requested → Approved | @WirachatTH |
| [#61](https://github.com/Menelaus122/TokTickITV2/pull/61) | `docs/lab3-final-delivery` | Approved | @WirachatTH |

All 14 Pull Requests were approved **and merged** by [@WirachatTH](https://github.com/WirachatTH), never by me,
per the Part 9 agreement in the workflow guide. 7 of them needed at least one round of
**Changes requested** first; each fix was pushed to the same branch, answered on the
thread, and re-reviewed before approval. Each PR is linked to its GitHub Issue through
the Development panel, and every feature branch reached `lab3-staging` through a Pull
Request — nothing was pushed directly to `lab3-staging` or `main`. (PR #33,
`docs/lab3-agent-setup`, was closed without merging when that work was cancelled.)

### [#46](https://github.com/Menelaus122/TokTickITV2/pull/46) — Add the Lab 3 engineering contract (Issue 1)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Changes requested** (2026-10-01, @WirachatTH)

> I checked the numbers in the description against the files, not just the summary, and nearly everything holds up:
>
> However, there are **changes I'd request**
> 1. The migration plan relies on something Prisma won't do (§7.6 step 1, D-05, BR-60). Prisma doesn't detect renames. Renaming RequesterUser → User (and RequestedPriority → Priority) in the schema makes prisma migrate dev generate DROP + CREATE, not ALTER TABLE ... RENAME. So "every id and FK survives" only holds if we make it hold. Two options:
>
> prisma migrate dev --create-only, then hand-edit the SQL to use ALTER TABLE "RequesterUser" RENAME TO "User" and ALTER TYPE "RequestedPriority" RENAME TO "Priority", or
> keep the table name with @@map("RequesterUser") on the User model.
> Two related gaps in the same section:
>
> Step 2 adds passwordHash but step 4 is what fills it, so the column has to start nullable (or have a placeholder) or the migration fails on existing rows.
> Step 4 doesn't say how a bcrypt hash gets into a SQL migration. Either embed a precomputed hash literal or move the backfill into a script/seed step. Just write down which one.
>
> 2. The Administrator's comment and note permissions have nothing to reach them through. BR-18 lets an Administrator read and post Public Comments and Internal Notes on any ticket. But the Admin can't open the queue or staff ticket detail, /api/tickets/:id is Requester-only, and the Admin's nav is User Management only (ui-spec §2). So there's no screen and no endpoint for an Admin to find a ticket in the first place. Either:
>
> give the Administrator a read-only way to reach a ticket, or
> state in §11 that "visible to Administrators" (BR-04) is satisfied at the API level only, with no Admin ticket UI in Lab 3.
> Either is defensible. It just needs to be written down, or someone will try to write a test for it and get stuck.
>
> 3. BR-24 and BR-26 contradict each other. BR-24 says the owner must be an active IT Staff member or Administrator. BR-26 (and D-19) say a deactivated owner keeps their tickets. Suggest changing BR-24 to "must be active at the time of assignment", which is what OWNER_NOT_ASSIGNABLE already implies.
>
> 4. BR-35's first sentence doesn't parse. "A ticket may only be claimed, reassigned, or moved out of NEW/OPEN by an owner or a claimer". Claiming an unassigned ticket "by an owner" isn't possible. It also reads as if only the current owner can reassign, while BR-18 says any IT Staff can claim or reassign. Which one do you mean? Whichever it is, the matrix, BR-25 and BR-35 should agree. The second half (Resolved/Closed/Cancelled need an owner) is fine as is.
>
> **Your three questions**
> 1. CSRF (D-13): I agree no token is needed, but the reason given isn't true. D-13 says no endpoint accepts form encoding, but attachment upload uses multer with multipart/form-data (server/src/app.ts:342), which a cross-site HTML form can send. You're still protected, because SameSite=Lax keeps the cookie off cross-site POSTs. Suggest rewording D-13 to rest on SameSite=Lax alone (optionally plus an Origin check on state-changing routes) and dropping the JSON-only argument.
>
> 2. Two tables (D-04): Agree. Making BR-04 structural is worth the duplication.
>
> 3. Password before inactive check (BR-08 / D-09): Agree. It's a clean way to satisfy both requirements.
>
> **Small fixes to the PR description**
> Just a recommendation.
>
> "26 endpoints": the api-spec summary has 25 rows / 29 method+path pairs.
> "17 error codes": the table has 16.
> "five screens": ui-spec defines six , and the description lists six too.
> "only a Role badge and an Owner presentation are added": ui-spec also adds the extended status badges and the Internal region type.
> BR-35 also blocks cancelling an unowned ticket, not just resolving or closing.
> One last thing: the spec header already says "Status: Approved before implementation" while this PR is still in review. Part 2 grades evidence that the spec was approved before implementation, so I'd mark it as a draft and flip it to approved when this merges.
>
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — all five fixed, plus one more
>
> Pushed in `c22d96b`. I verified each point against the files before changing anything; all five were real. The counts in the original description were wrong too, and the description is now corrected.
>
> ### 1. The rename Prisma would not have performed — fixed
>
> Confirmed: Prisma Migrate has no rename detection, so `prisma migrate dev` would have emitted `DROP TABLE` + `CREATE TABLE` and deleted every Requester, orphaning every `Ticket.requesterId`. D-05's "every id survives" was an assertion with nothing behind it.
>
> §7.6 is rewritten as seven steps: generate with `--create-only`, read the SQL, and replace the drop-and-create with
>
> ```sql
> ALTER TABLE "RequesterUser" RENAME TO "User";
> ALTER TYPE "RequestedPriority" RENAME TO "Priority";
> ```
>
> New **D-21** records that the SQL is hand-edited and read before it is applied. I chose this over `@@map("RequesterUser")` because the table name should match the model; keeping the Lab 2 name forever would be a permanent reminder of a model that no longer exists.
>
> Both smaller gaps in the same section are fixed as well:
>
> * `passwordHash` is **nullable**, so the migration cannot abort on existing rows. Every other new column has a default.
> * The hash comes from the **seed**, not the migration (**D-22**) — SQL cannot compute bcrypt, and a hash literal in a migration is a credential in version control. `itPriority` is still backfilled in SQL and then set `NOT NULL` in the same migration.
> * That leaves a window where a migrated account has no hash, so **BR-66** now says a null `passwordHash` cannot authenticate and answers exactly like a wrong password. Covered by API-67 and MIG-08.
>
> ### 2. The Administrator had no way to reach a ticket — documented
>
> Confirmed: no queue, no ticket list, `/api/tickets/:id` is Requester-only, and the Admin's navigation is User Management alone. I took your second option. **D-23** states that BR-04's "visible to Administrators" is satisfied at the API level only in Lab 3, with no Administrator ticket UI, and that the permission exists for Lab 4. BR-19, api-spec §4.3 and ui-spec §1 all say so now, so nobody writes a UI test for a screen that does not exist.
>
> ### 3. BR-24 vs BR-26 — fixed with your wording
>
> BR-24 now reads "active **at the time of assignment**", which is what `OWNER_NOT_ASSIGNABLE` always meant, and it points at BR-26 for what happens afterwards.
>
> ### 4. BR-35 — rewritten, and it hid a second bug
>
> You were right that it did not parse. The answer to your question is **any IT Staff member**, matching BR-18, not only the current owner. BR-35 now separates the two ideas: ownership restricts *outcomes*, not *actors*.
>
> While rewriting it I found something neither of us flagged: **BR-33 permits `NEW` → `CANCELLED`, but BR-35 required an owner for `CANCELLED`**. A `NEW` ticket is unassigned by definition, so cancelling a ticket that should never have been opened was impossible without claiming it first. Cancelling no longer requires an owner; resolve and close still do. api-spec §5.5 and the `OWNER_REQUIRED` code were updated to match, and API-68 asserts that cancelling an unassigned `NEW` ticket succeeds.
>
> ### 5. D-13's CSRF reasoning was false — fixed
>
> Confirmed at `server/src/app.ts:342`: `multer` with `memoryStorage`, so the API does accept `multipart/form-data` and a cross-site form can send it. D-13 now rests on `SameSite=Lax` and says plainly that the earlier "JSON-only" argument was wrong.
>
> I also took your optional suggestion, because it is about five lines of middleware: **BR-65** refuses any non-`GET` request whose `Origin` header is not the configured client origin, before any handler runs. SEC-11 covers it, including the multipart case and a `GET` that must still pass.
>
> ### Your two agreements
>
> D-04 (two tables) and BR-08/D-09 (password before the inactive check) are unchanged.
>
> ### Description corrections
>
> All five were wrong; thank you for checking against the files rather than the summary.
>
> | Claimed | Actual |
> | :--- | :--- |
> | 26 endpoints | 25 rows, 29 method + path pairs |
> | 17 error codes | 16 |
> | five screens | six — five new plus the extended Requester detail |
> | "only a Role badge and an Owner presentation" | four additions: Role badge, Owner presentation, seven further status badges, internal region |
> | "BR-35 refuses to resolve or close" | it also covered cancel, which was the bug in item 4 |
>
> ### Current numbers
>
> FR-01–48, **BR-01–66** (was 64), AC-01–39, **D-01–23** (was 20), and **145 planned tests** (was 141): 10 unit, 68 API, 11 authorization, 8 migration and regression, 25 UI component, 7 UI style, 6 responsive, 10 E2E. Re-verified after the edit: no duplicate or missing ids, all 39 criteria still traced, every referenced test defined, and no test left without a requirement or rule.
>
> The spec header now reads **Draft — under review in PR #46**. I will flip it to "Approved before implementation" in a final commit on this branch once you approve, so Part 2's evidence shows approval preceding implementation rather than asserting it in advance.
>
> Ready for another look.

**Review — Changes requested** (2026-10-01, @WirachatTH)

> Thanks for the quick turnaround. I diffed v2 against v1 file by file. Only the four `docs/lab-03/*.md` files changed and no code was touched. All five things I asked for are fixed, most of them better than I asked:
>
> - **#1 Migration (§7.6):** fixed properly. The `--create-only` + hand-edited `ALTER TABLE` / `ALTER TYPE ... RENAME` route, nullable-or-defaulted columns, and `itPriority` backfilled before `SET NOT NULL` are exactly right. D-21/D-22 explain the reasons, and making the null-hash state a locked door (BR-66 + API-67 + MIG-08) is a nice touch.
> - **#2 Admin reachability:** fixed with the API-only option (D-23), and the note is carried into BR-19, api-spec §4.3 and ui-spec. Consistent everywhere.
> - **#3 BR-24 vs BR-26:** fixed ("active at the time of assignment").
> - **#4 BR-35:** fixed, and the "ownership restricts outcomes, not actors" framing reads well. Allowing cancel on an unowned ticket is a real behaviour change, but you carried it through everywhere: the `OWNER_REQUIRED` row, the api-spec transition table, API-49 and the new API-68.
> - **D-13 CSRF:** better than what I suggested. Adding the actual `Origin` check (BR-65) with SEC-11 covering the multipart case closes the gap rather than just rewording it.
> - **Header:** now "Draft — under review in PR #46". 👍
>
> I re-ran the integrity checks on v2:
> - 145 planned tests; each new one is assigned to exactly one issue, and every reference points to a test that exists.
> - FR-01–48, BR-01–66, AC-01–39 and D-01–23 all run without gaps.
>
> ### One fix still needed before I approve
>
> **The §11 table loses the reasons for D-21–D-23 when rendered.**
> The §11 table has two columns (`ID | Assumption or decision`), but the three new rows have three cells (`ID | Decision | Why`). GitHub drops any cell beyond the header's column count, so the "Why" text of D-21, D-22 and D-23 doesn't appear on the rendered page at all, and Part 2 is graded on the rendered spec. Two easy fixes:
> - merge each row's last two cells into one, or
> - move the three rows up into the §7.4 table, which already has the `ID | Decision | Why` shape that D-01–D-11 use.
>
> ### One small inconsistency (fine to fix now or in Issue 2)
>
> **§7.5 vs BR-61 / MIG-08.** §7.5 says every seeded account uses `Toktickit#2026` **except** `first.login@toktickit.local`, which is the one with `mustChangePassword` set. But the migration leaves `mustChangePassword = true` on the four migrated Requesters (BR-61, and MIG-08 checks for it). So in practice those four also force a password change on first login, and after one login the documented password stops working for them. That will bite whoever re-runs the demos or screenshots. Either:
> - have §7.5 name the migrated Requesters as must-change accounts too, or
> - have the seed clear the flag for them and leave `first.login` as the only must-change account.
>
> If you'd rather handle it in Issue 2's seed work, just leave a note so it doesn't get lost.
>
> Fix the §11 table and I'm happy to approve. Great work on this round.

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 2 — both fixed in `ef4313b`
>
> Thanks for diffing v2 against v1 file by file. Both points checked out against the files before I changed anything.
>
> ### §11 dropped the reasons for D-21 to D-23 — fixed
>
> Confirmed: three cells under a two-column header, and GitHub discards the extra cell, so the "Why" never rendered. I used a bit of both of your options, because the three decisions are not the same kind of thing:
>
> * **D-21 and D-22 moved up into §7.4.** They are migration decisions, and §7.4 already has the `ID | Decision | Why` shape that D-01 to D-11 use.
> * **D-23 stays in §11** with its reason folded into the single cell, because it is an assumption about Lab 3's scope rather than a design decision.
> * §11 now opens with one sentence saying D-01 to D-11, D-21, and D-22 live in §7.4, so nobody scanning the numbers thinks they are missing.
>
> Since this kind of bug is invisible in the raw file, I also scanned **every table in all four documents** for rows with more cells than their header, splitting on unescaped pipes the way GitHub does. Those three rows were the only ones; all four files now report zero.
>
> ### §7.5 vs BR-61 / MIG-08 — fixed now rather than deferred
>
> You were right that it would bite, and it would have bitten harder than demos. With the flag left set on the four migrated Requesters, BR-14 answers **every** Requester endpoint with `403 PASSWORD_CHANGE_REQUIRED` for them. Every Requester API test (API-15 to API-21, SEC-06, SEC-07) would have had to change a password first, after which the documented password no longer matched. So I took your second option:
>
> * **The seed now converges.** Every run puts each documented account back into its documented state: `Toktickit#2026` with `mustChangePassword` cleared, the four migrated Requesters included. `first.login@toktickit.local` is the **only** account seeded with the flag set. Re-running the seed also undoes E2E-02 or a demo changing `first.login`'s password. Accounts created through User Management while testing are left alone.
> * **BR-61 now separates the two states.** The migration guarantees flag set and a null hash, which is the safe state for any real migrated account. The local-development seed then converges the four to the documented dev state.
> * **§7.6 step 6** describes the converging seed instead of "fills users without a password".
>
> While checking this I found **one more stale line of my own: MIG-03 still said the migrated Requesters have "a usable hash"** right after the migration, which contradicted D-22. It now asserts the real post-migration state: role `REQUESTER`, flag set, `passwordHash` null. MIG-08 now covers both sides (locked before seeding; after seeding, the documented password works with no forced change, and `first.login` alone must change), and the new **MIG-09** covers convergence.
>
> ### Checks re-run on v3
>
> * Tables: 0 overflowing rows in all four files.
> * FR-01–48, BR-01–66, AC-01–39, D-01–23: no gaps, no duplicates.
> * **146 planned tests** (MIG-09 is the only new one): 10 unit, 68 API, 11 authorization, 9 migration and regression, 25 UI component, 7 UI style, 6 responsive, 10 E2E. Every test has a requirement or rule, every AC is traced, and no reference points at a missing test.
> * The PR description is updated: 146 tests, the new line counts, §7.6 as seven steps, and BR-61 no longer described as giving migrated Requesters a forced change.
>
> ### After you approve
>
> As agreed, I will push one last commit that flips the spec header from "Draft — under review in PR #46" to "Approved before implementation", so the approval in the history comes before the change that records it. Then it is yours to merge.

**Review — Approved** (2026-10-01, @WirachatTH)

> Well done for this issue! You may proceed with the next issue right away and let me know when it's done!
>
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> Thx kub

### [#47](https://github.com/Menelaus122/TokTickITV2/pull/47) — Mark the Lab 3 specification as approved

**Verdict:** Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Approved** (2026-10-01, @WirachatTH)

> No problem.

**Author's response** (2026-10-01, @Menelaus122)

> Thx kub

### [#48](https://github.com/Menelaus122/TokTickITV2/pull/48) — Add the Lab 3 user model, migration, and seed (Issue 2)

**Verdict:** Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Approved** (2026-10-01, @WirachatTH)

> I read the migration, schema, seed, the Lab 2 code changes, and the new test file line by line, and nearly every claim in the description holds up:
>
> - **The hand-written migration is right.** It's a real `ALTER TABLE … RENAME` / `ALTER TYPE … RENAME`, with the primary key, unique index, and sequence renamed too. Every new column is nullable or defaulted, `itPriority` is backfilled before `SET NOT NULL`, and no new status value is used in the same migration. Your "what Prisma would have written" section is a great catch: wiping every ticket's Requested Priority through the enum rename is worse than the table drop, and nobody had spotted it.
> - **The schema matches the description:** nullable `passwordHash`, one `Role`, `mustChangePassword`, nullable `ownerId` with a restrict FK, `itPriority`, all 8 statuses, and two separate comment/note tables with database-generated `createdAt`.
> - **The seed numbers are exact:**
>   - accounts: 5 active + 1 inactive Requesters, 3 + 1 IT Staff, 2 Administrators;
>   - tickets: 16, two per status, across the 4 active Requesters and all 4 priorities;
>   - 16 Public Comments and 4 Internal Notes;
>   - the Admin-owned, inactive-owner, and unowned-cancelled tickets are all there.
> - **Password handling:** `bcryptjs` 3.0.3 is installed, and a null hash never verifies.
> - **The Lab 2 code changes are as described.** The requester list and the header lookup filter `role: REQUESTER` (MIG-11), and new tickets copy Requested Priority into IT Priority (MIG-10).
> - **The rest:** test counts match every file you listed (attachment-rules reaches 24 through `it.each`), the §7.7 bcryptjs note is fixed, and the README has the seeded-accounts table and the Docker refresh steps.
>
> I reviewed from the code rather than running your stack, so the real-database fingerprints and the test run output are taken as reported.
>
> ### Three things to fix (none blocks Issue 3)
>
> **1. MIG-06's "ends in the same database" is stronger than what it checks.**
> Every seed run rewrites `updatedAt` on all 16 seeded tickets, because `prisma.ticket.update` bumps `@updatedAt`. It also recomputes the flagged ticket's `requesterResolvedAt` from `Date.now()` (`createdAt` in `convergeTicket` is `Date.now() - daysAgo`), not from the ticket's stored `createdAt`, so that timestamp moves on every run. MIG-06 can't see either change because `snapshot()` compares only `id`, `ticketNumber`, `currentStatus`, `ownerId`, and `itPriority`.
> The seed is idempotent where it matters (no duplicates, stable counts), but it isn't byte-identical. In practice, re-seeding makes every sample ticket look "just updated" in any Last-Updated sort. Suggested fixes:
> - base `requesterResolvedAt` on `existing.createdAt` when the ticket already exists;
> - either widen `snapshot()` to cover `requesterResolvedAt` (and skip the write when nothing changed, so `updatedAt` stays put), or reword the claim to "no duplicates and the same content".
>
> **2. Emails are never lowercased (BR-45).**
> BR-45 says email is "stored lowercased", but neither the migration nor §7.6 lowercases the existing Lab 2 emails, and the unique constraint is case-sensitive. If a migrated row had a capital letter, the seed's `findUnique` by the lowercase email would miss it and create a second account. Your current data is probably all lowercase, so this is a gap rather than a live bug, but the rule is promised and nothing enforces it. A one-liner in the migration closes it:
> ```sql
> UPDATE "User" SET "email" = lower(trim("email"));
> ```
> and a test that inserts a mixed-case Lab 2 email before migrating would protect it.
>
> **3. Your reset warning (note 4) only lives in the PR description.**
> `README.md:286` and `docs/lab-02/tests.md:313` still show `DELETE FROM "Ticket";`, and neither says it now also deletes the 33 migrated tickets and the 16 seeded ones. Someone following the README after this merges won't see your warning. Worth adding it next to both commands, along with the "delete the printed ids instead" advice.
>
> ### Minor
> - **Seed narrative vs. your own rules:** the RESOLVED ticket owned by Administrator `malee` has `malee` posting "Resolved: toner replaced and a test page printed." By BR-32, Administrators make no status changes, and by BR-36 the reason comment is posted by whoever makes the transition, so this reads as an Administrator resolving a ticket. Keep `malee` as the owner (that's the BR-20 point), but have an IT Staff member write the "Resolved:" comment.
>
> Fix #1–#3 and I'm happy to approve. The migration work in this PR is excellent.
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — all four fixed in `b66264c`
>
> Thanks for reading it line by line. GitHub recorded this review as **Approve**, but since the text asks for fixes first, I treated it as changes requested. Each point checked out against the code before I touched anything.
>
> ### 1. MIG-06's "same database" claim — fixed, and it was wider than tickets
>
> You were right on both counts, and the users had the same problem: `user.upsert` rewrote every seeded account on every run, which bumped `User.updatedAt` too. My MIG-06 dropped `updatedAt` from the user comparison, which hid exactly that, and the comment in `convergeAccount` claiming "byte-identical" was false.
>
> * **The seed now writes a row only when it has drifted**, for users and tickets alike. A run with nothing to fix writes nothing.
> * **Every seeded timestamp hangs off the ticket's stored `createdAt`**, including `requesterResolvedAt`, so re-running never moves a timeline.
> * **A new seeded ticket's `updatedAt` is its last seeded activity** (latest comment, note, or "appears resolved" signal), not the moment the seed ran. The sample tickets therefore no longer all look "just updated", even on the very first run.
> * **MIG-06 now compares every column** of users, tickets, comments, notes, and sessions across two runs, timestamps included, and passes. A new MIG-07 case asserts that seeded `updatedAt` values are in the past, follow `createdAt`, and are all distinct.
>
> ### 2. Emails never lowercased (BR-45) — fixed in the migration
>
> Your one-liner is in, right after the renames: `UPDATE "User" SET "email" = lower(trim("email"));`. If two Lab 2 emails differ only by case, it violates `User_email_key` and the whole migration rolls back rather than silently leaving two accounts. §7.6 now says so.
>
> **MIG-12** puts `'  Two.Mixed@Example.TEST '` into the Lab 2 fixture and asserts it comes out as `two.mixed@example.test`, and that every migrated email is lowercase. New rows are the API's job: Issue 3's login lookup and Issue 10's create and edit.
>
> Because this changed a migration I had already applied locally, I **restored the Lab 2 backup and migrated again** with the revised file, rather than leave my database on the old version with a mismatched checksum. You said you reviewed from code and did not run it, so nobody else has the old version applied. The re-run gives the same result as before: all three fingerprints match the original Lab 2 data, 0 emails need normalising, `itPriority` matches on 33 of 33, and `prisma migrate diff` reports no drift.
>
> ### 3. The reset warning lived only in the PR description — fixed in both places
>
> * **`README.md`** no longer recommends `DELETE FROM "Ticket";` at all. It now says to note `max(id)` before the E2E run and delete `WHERE id > <that id>`, which also covers the responsive spec's tickets that the printed id list misses. A callout says never to run the blanket delete since Lab 3, and what it would destroy.
> * **`docs/lab-02/tests.md`** keeps its original Lab 2 command, since that is what Lab 2 actually did, and gains a "Lab 3 note" directly under it with the same warning and a pointer to the README.
>
> I used the new README procedure for this round's E2E run. It removed exactly the 10 tickets the suite created, all with `E2E …` summaries, and nothing else.
>
> ### Minor — the Administrator "resolving" a ticket — fixed
>
> `malee` still owns the ticket (that is the BR-20 point), but **`siriporn` (IT Staff) now writes the "Resolved:" comment**. On the re-seeded database, no status-reason comment anywhere is authored by an Administrator.
>
> ### Re-verified on the restored-and-remigrated database
>
> ```text
> server  npx vitest run      Test Files 12 passed (12)   Tests 176 passed (176)
>                             (lab-03/migration.regression.test.ts is now 15 tests)
> e2e     requester-ticket-flow.spec.ts                   12 passed (12.4s)
> drift   prisma migrate diff                             No difference detected.
> ```
>
> Ready for another look.

**Review — Approved** (2026-10-01, @WirachatTH)

> Thanks for the quick round. I compared `b66264c` with the previous version file by file: seven files changed, all within what your reply describes, and every fix holds up.
>
> - **#1 Seed "same database":** fixed properly. Users and tickets are written only when a field has actually drifted, every seeded timestamp hangs off the stored `createdAt`, and new tickets get their last seeded activity as `updatedAt`. MIG-06 now compares whole rows of users, tickets, comments, notes, and sessions, so this can't hide again. Good catch that `User.updatedAt` had the same problem; I'd missed that.
> - **#2 Email lowercasing:** `lower(trim(email))` runs right after the renames, and a case-only collision rolls the whole migration back instead of merging accounts. MIG-12's fixture really contains `'  Two.Mixed@Example.TEST '`, and the test checks that before asserting the result.
> - **#3 Reset warning:** the README's id-range procedure is a real improvement over the blanket delete, and keeping Lab 2's original command in `docs/lab-02/tests.md` with the Lab 3 note underneath is the right call for the record.
> - **Minor:** `siriporn` now writes the "Resolved:" comment, and `malee` stays the owner.
>
> The counts line up too: the migration test file has 15 tests (176 total), and `tests.md` matches the code (MIG-06/MIG-07 rewritten, MIG-12 added, AC-35 and the Issue 2 row updated).
>
> One small note for the record, nothing to change: the seed never removes existing comments, so a database seeded with the previous version would keep `malee`'s old "Resolved:" comment alongside the new one. You restored and re-migrated, and nobody else ran v1, so no database actually has the duplicate.
>
> Also, sorry about the review status last round. It went in as Approve even though it asked for changes, and you were right to treat it as changes requested. I'll pick the right option from now on.
>
> Approving. Nice work on this one. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> Thx kub

### [#50](https://github.com/Menelaus122/TokTickITV2/pull/50) — Add sign-in, sign-out, current user, and password change (Issue 3)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Changes requested** (2026-10-01, @WirachatTH)

> I read `auth.ts`, `session.ts`, `password.ts`, the `app.ts` wiring, and the three new test files line by line, and every claim in the description holds up:
>
> - **Login:**
>   - The password is checked before the account's state.
>   - An unknown email, a wrong password, and an account with no password yet return the same `401` body (the test compares whole bodies, not just status).
>   - The dummy-hash compare keeps the timing even.
>   - Logging in replaces the previous session.
> - **Sessions:** a 32-byte random token, only its SHA-256 stored, and cookie attributes exactly as your api-spec says. Expired rows are removed on sight, logout deletes the row and clears the cookie, and a password change drops every other session.
> - **The BR-14 gate is an allow-list** running before every route. That's the safe way round: any path it doesn't recognise, including case or trailing-slash variants, is blocked rather than let through.
> - **Bytes vs characters:** a really good catch. `Buffer.byteLength > 72` plus a code-point count closes bcrypt's silent truncation for Thai passwords.
> - **CORS:** names its origins with credentials. The wiring order is cookie-parser → session → gate → routes.
> - **Tests:** the counts add up to your 217 (auth 18, password 16 with `it.each`, session 7, plus the existing 176). All 20 Issue 3 rows in `tests.md` read Pass, each backed by a named test. API-02, API-04, and API-13 assert exactly what you describe, including "no session created" and "the handler ran, not the gate".
>
> I reviewed from the code, so the run output, the mutation results, and the live `curl` checks are taken as reported.
>
> ### One change before I approve
>
> **BR-14 in `specification.md` contradicts your code and api-spec §2.3a.** BR-14 still says a must-change session may call "only" current-user, change-password, and logout. Your code and §2.3a also allow `POST /api/auth/login` and `GET /api/health`. I agree with your reading, but the decision currently lives only in the API spec, and the specification is the contract we're graded on. One sentence in BR-14 fixes it.
>
> ### Worth raising (none blocking)
>
> 1. **The login-attempt gap you flagged (note 6) is real.** Labsheet §4.4 explicitly says to define rules for "login attempts", and the contract has none. It's outside Issue 3's criteria, so it shouldn't hold this PR, but I'd open an issue for it so it isn't forgotten. Even "no throttling in Lab 3, documented as a limitation" counts as a decided rule. If you do add one, from our own two rounds on it:
>    - key by email only (per-IP keying doesn't work behind one proxy, as you pointed out to me);
>    - cap the in-memory store;
>    - reset it in `beforeEach`, so one test's failures can't throttle the next.
> 2. **Minor:** the default `CLIENT_ORIGINS` includes `http://127.0.0.1:5173`. A page served from `127.0.0.1` calling the API on `localhost` is cross-site, so the `SameSite=Lax` cookie won't be sent even though CORS lets the request through. That entry suggests a setup that can't sign in.
> 3. **Nit:** the dummy hash is built on the first unknown-email login, so that one request does two bcrypt operations. Precomputing it at startup makes the timing parity complete.
> 4. **For the record:** the BR-65 `Origin` check isn't in this PR, but SEC-11 puts it in Issue 4, so that's fine. `SameSite=Lax` covers the gap until then.
>
> Fix BR-14's wording and I'm happy to approve. Great work. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — fixed in the latest commit
>
> Thanks — all of these checked out against the code.
>
> ### Required: BR-14 vs §2.3a — fixed
>
> BR-14 in `specification.md` now states the exemption itself: login and the health check stay reachable while a password change is required, because they are public and do not act through the session, and logging in as someone else simply replaces it. The contract, api-spec §2.3a, and the code now say the same thing.
>
> ### 2. `127.0.0.1` in the default origins — removed
>
> You were right: a page on `127.0.0.1` calling the API on `localhost` is cross-site, so the `SameSite=Lax` cookie is never sent and sign-in would fail even though CORS let the request through. The default is now only `http://localhost:5173`. The code comment, README, and `.env.example` all say that the page and the API must share a host name. Confirmed live after a restart: a preflight from `http://localhost:5173` gets `Access-Control-Allow-Origin`, and one from `http://127.0.0.1:5173` does not.
>
> ### 3. Dummy hash built lazily — now started at module load
>
> `password.ts` starts the dummy hash when the module loads, as a promise the login path awaits. The first unknown-email login no longer does two bcrypt operations.
>
> ### 1. Login-attempt rules — taking it on as its own issue
>
> Agreed it should not hold this PR, and we have decided to add the rule rather than document its absence. It will be a new issue, following our Lab 2 precedent for a gap found against the labsheet (Issue 10). It gets its own acceptance criteria, an amendment to the contract, and its own PR once this one merges. Your three points are the starting design:
>
> * the attempt counter is keyed by the normalised email only;
> * the in-memory store has a cap;
> * the store resets in `beforeEach`, so one test's failures cannot throttle the next.
>
> I will add one rule of my own: unknown emails are throttled exactly like real ones, otherwise a `429` against a `401` would reveal which emails exist and undo BR-16.
>
> ### 4. BR-65 `Origin` check
>
> Agreed — it stays with SEC-11 in Issue 4.
>
> ### Re-verified
>
> ```text
> tsc --noEmit             exit 0
> npx vitest run (server)  Test Files 15 passed (15)   Tests 217 passed (217)
> ```
>
> Ready for another look.

**Review — Approved** (2026-10-01, @WirachatTH)

> Approved!
> Thanks for the quick round! I compared `d3dcb82` with v1 file by file: five files changed, all within what your reply describes. This time I also **ran your stack** instead of only reading it. I brought it up beside mine on its own ports and a fresh database, migrated and seeded it as your README says, and tested the API live.
>
> **Your fixes:**
> - **BR-14:** the contract now states the login/health exemption itself, and it matches the code's allow-list exactly (`me`, `password`, `logout`, `login`, `health`) and api-spec §2.3a. Live, a must-change session gets `403 PASSWORD_CHANGE_REQUIRED` on tickets and categories, and `200` on `/me` and health.
> - **`127.0.0.1` origin:** removed. Live, a preflight from `http://localhost:5173` gets `Access-Control-Allow-Origin` and one from `http://127.0.0.1:5173` doesn't. Nice touch correcting the comment from "adds others" to "replaces the default" — that's what the code actually does.
> - **Dummy hash:** started at module load and awaited by the login path. My first timing looked off: the first unknown-email login after a restart took ~0.3s against ~0.13s. But a real account's first login after a restart is just as slow, so that's the database connection opening, not the hash. Once warm, unknown and known emails take the same time.
> - **Login-attempt rule as its own issue:** agreed. Your extra rule, throttling unknown emails exactly like real ones so `429` vs `401` can't reveal which emails exist, is a really good catch.
> - **BR-65:** fine to keep with SEC-11 in Issue 4.
>
> **Also confirmed live:**
> - `npx vitest run`: **217/217**, and `tsc --noEmit` exits 0, exactly as you reported.
> - Login returns `201` with `tt_sid` set `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`, and no hash or token in the body.
> - `/me` → logout → `/me` with the old cookie gives `200` → `204` → `401`.
> - An unknown email and a wrong password return byte-identical `401` bodies.
> - An inactive account gets `403 ACCOUNT_INACTIVE` only with the right password, and the generic `401` otherwise.
>
> Approving. Great work on this one. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> Thx kub

### [#52](https://github.com/Menelaus122/TokTickITV2/pull/52) — Lock an email after five failed sign-ins (Issue 13)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Changes requested** (2026-10-01, @WirachatTH)

> Really nice design, and thanks for running with the email-only idea. The eviction rule (forget unlocked emails first, so flooding other emails can't lift a lock) is a sharp addition I hadn't thought of. I cloned `feature/13-login-throttling` at `5eaf810`, ran it on its own ports and a fresh database, and tested it live as well as reading it.
>
> ### What I verified
> - **Your numbers reproduce:** `npx vitest run` gives **231/231**, and `tsc --noEmit` exits 0.
> - **Sequential behaviour is exactly as specified:** 5 wrong passwords return `401` ×5, then the correct password gets `429` with `Retry-After`. Unknown emails are counted and answered identically, a success clears the count, and malformed requests and an inactive account's correct password aren't counted.
> - **Contract amendments are clean:**
>   - FR-49, BR-67, AC-40, and D-24 are numbered with no gaps or duplicates;
>   - no table renders broken;
>   - AC-40 is traced to API-69/70/71 and UNIT-11/12/13.
>
> ### 🔴 Must fix: concurrent attempts get past the lock
> The lock check and the failure count sit on either side of the bcrypt comparison:
>
> ```
> retryAfterSeconds(email)          ← check: not locked yet
> await verifyPasswordForLogin(...) ← ~70 ms, other requests run here
> recordFailure(email)              ← only now is the attempt counted
> ```
>
> So requests sent at the same time all pass the check before any of them is counted. Live, against the running server (each scenario after a restart, which clears the in-memory store):
>
> ```text
> sequential: 5 wrong, then correct          -> 401 ×5, then 429      ✅ as specified
> 20 wrong passwords at once                 -> 401 ×20               (all 20 evaluated; limit is 5)
> 100 wrong passwords at once                -> 401 ×71, 429 ×29      (71 evaluated in one burst)
> 19 wrong + 1 correct, all at once          -> 201 for the correct one — signed in
> ```
>
> The lock therefore limits *sequential* guessing, but an attacker who sends requests concurrently gets as many guesses as they can fire at once, and the right password inside a burst signs in. That's the "guessing unlimited" case your own note on API-69 rules out. None of the tests catch it because every one sends its requests one at a time.
>
> → Suggestion: **reserve the attempt before the `await`**. Since Node runs that part synchronously, check-and-reserve is atomic. For example:
> - `beginAttempt(email, now)` refuses (`429`) when `failures + inFlight >= 5`, and otherwise increments `inFlight`;
> - `endAttempt(email, outcome)` decrements `inFlight` and then records the failure or clears on success. It also needs to release on the inactive-account and error paths (a `finally` works well).
>
> Then add a test that sends a burst with `Promise.all`, e.g. 20 wrong passwords plus the correct one, and asserts at most 5 `401`s, `429` for the rest, and no session created. It'd be worth a line in BR-67 / D-24 that the limit holds under concurrent attempts too.
>
> ### 🟡 Minor (not blocking)
> - **Eviction when every tracked email is locked:** the code then drops the oldest *lock*. So someone who locks 10,000 other emails can lift a target's lock early. With the concurrency fix in place that costs about 50,000 failed sign-ins, so it's fine for a lab, but worth one sentence in D-24 next to the other accepted costs (restart clears, one process only, targeted lockout).
>
> Fix the concurrency gap and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — the concurrency gap is closed
>
> Thank you for running bursts against it. You were right, and the 19-wrong-plus-the-correct-one case signing in is exactly what BR-67 said could not happen. My tests never caught it because every one of them waited for each response before sending the next request.
>
> ### 🔴 Concurrent attempts — fixed as you suggested
>
> The attempt is now **reserved before the first `await`**:
>
> * `beginAttempt(email, now)` refuses with `429` when the email is locked, **or** when its failures plus the attempts still in flight reach five. Otherwise it increments `inFlight`. There is no `await` between the check and the reservation, so Node runs both before any other request.
> * `endAttempt(email, outcome, now)` runs from a `finally` in the login handler, so every reserved attempt reports exactly one outcome. A `failure` counts, and the fifth locks the email. A `success` clears the count but keeps the other attempts' reservations. A `neutral` outcome — the inactive account's correct password, or a server error — just gives the slot back.
> * A request refused because the slots are full gets the same 15-minute `Retry-After` as a lock, which is where those five in-flight guesses lead if they fail. It also keeps one answer shape for real and unknown emails.
>
> ### Your three bursts, re-run against the live server after the fix
>
> ```text
> 20 wrong at once:             5 × 401   15 × 429
> 100 wrong at once:            5 × 401   95 × 429
> 19 wrong + correct at once:   5 × 401   15 × 429   (the correct one refused; no session)
> ```
>
> ### New tests that send without waiting
>
> * **UNIT-14:**
>   * a sixth reservation is refused while five are in flight;
>   * in-flight attempts add to earlier failures;
>   * failures that come back lock the email;
>   * neutral outcomes give the slot back;
>   * a success keeps the other reservations.
> * **API-73:** your two cases with `Promise.all` — 20 wrong at once, and 19 wrong plus the correct one. Each asserts that at most five passwords are evaluated, the rest get `429`, and a session exists only if the correct one was among the five.
>   * I did **not** assert that the correct password, sent last, is always refused. Arrival order across a burst is not guaranteed, so that assertion would be flaky. What the rule promises is "no more than five guesses", and that is asserted every time.
> * **Proof they guard the fix:** removing the in-flight term from the check makes API-73 (both) and three UNIT-14 cases fail. Restored, everything passes. I ran the throttle suites three times in a row to check for flakiness.
>
> ### 🟡 Eviction when everything is locked — documented
>
> D-24 now records it next to the other accepted costs. Lifting a target's lock that way means locking 10,000 other emails first, about 50,000 failed sign-ins. Entries with attempts in flight are protected from eviction as well.
>
> ### Contract
>
> BR-67 now says the limit holds for concurrent attempts, and explains how. tests.md has UNIT-14 and API-73, AC-40's traceability includes them, and Issue 13's row is updated.
>
> ```text
> tsc --noEmit             exit 0
> npx vitest run (server)  Test Files 17 passed (17)   Tests 238 passed (238)
> ```
>
> Ready for another look.

**Review — Approved** (2026-10-01, @WirachatTH)

> Approved! Thanks for the quick fix! I cloned `feature/13-login-throttling` at `5f18e39`, ran it on its own ports and a fresh database, and re-ran the same bursts as last time against the live server.
>
> **The concurrency gap is closed.** I read the whole `LoginThrottle` class, not just the diff:
> - `beginAttempt` reserves the slot with no `await` between check and reservation, and every reservation is released exactly once from the `finally`.
> - A success clears the count, failures older than the window are dropped before counting, and the five-slot cap means a success can never unlock an email that's already locked.
>
> **Live, each burst after a restart:**
>
> ```text
>                                before              now
> 20 wrong at once               401 ×20             401 ×5   429 ×15
> 100 wrong at once              401 ×71  429 ×29    401 ×5   429 ×95
> 19 wrong + 1 correct (×5 runs) correct signed in   401 ×5   429 ×15 — correct refused, no session, every run
> ```
>
> Sequential behaviour is unchanged: five failures, then `429` even for the right password; and four failures, a success, then four more never locks.
>
> **Also confirmed:**
> - `npx vitest run`: **238/238 on three runs in a row**, so the new burst tests aren't flaky. `tsc --noEmit` exits 0.
> - BR-67 now covers concurrent attempts, and D-24 records the eviction cost. UNIT-14 and API-73 are in `tests.md` and traced from AC-40. There are no numbering gaps and no broken tables.
> - Good call asserting "at most five evaluated" in API-73 rather than "the correct password is always refused". Arrival order within a burst isn't guaranteed, so the stronger assertion would have been flaky, and the weaker one is what BR-67 actually promises.
>
> Approving. Really nice turnaround. 🙌
> Wirachat 67070501041

### [#53](https://github.com/Menelaus122/TokTickITV2/pull/53) — Enforce the role matrix and the Origin check on the server (Issue 4)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Changes requested** (2026-10-01, @WirachatTH)

> This is a clean piece of work. Mounting the role guard on the `/api/staff` and `/api/admin` prefixes, so routes from Issues 8–10 are covered before they exist, is the right call. Writing SEC-06 as "byte-identical to a missing id" is exactly the right bar. I cloned `feature/4-authorization` at `1b50878`, ran it on its own ports against a fresh migrated and seeded database, and tested it live as well as reading it.
>
> ### What I verified
> - **Your numbers reproduce:** `npx vitest run` gives **251/251** (18 files), and `tsc --noEmit` exits 0.
> - **Role matrix, live and in tests:** without a session every guarded family returns `401 AUTH_REQUIRED`. A wrong role gets `403 FORBIDDEN`, and an Administrator is refused on IT Staff routes. The guard also holds for `/API/STAFF/...` in upper case.
> - **Origin check, live:**
>   - A login `POST` from `http://localhost:5173` reaches the handler (`401` for a wrong password).
>   - The same `POST` from `https://evil.example` returns `403`, and so does `Origin: null`.
>   - A cross-origin preflight still answers `204`.
> - **Extra mutations of my own** on top of yours:
>   - Treating `PATCH` as a safe method was caught by SEC-11.
>   - The IT Staff guard admitting Requesters was caught by SEC-02.
>   - Dropping the "non-Requester session" refusal was caught by SEC-07.
> - **Cleanup:** after the full run, no suite tickets, attachments, or users were left behind.
>
> ### 🔴 Must fix: a database error on the header path kills the server
> `resolveRequesterIdentity` is awaited **outside** each handler's `try`. Express 4 does not forward a rejected promise to `safeErrors`, so it becomes an unhandled rejection, and Node 22 exits on that. Live, with the database stopped:
>
> ```text
> GET /api/auth/me      + session cookie   -> 500 INTERNAL_ERROR   ✅ (attachSession calls next(error))
> GET /api/tickets      + session cookie   -> 500 INTERNAL_ERROR   ✅
> GET /api/tickets      + X-Requester-Id   -> no response; process exits:
>     PrismaClientInitializationError P1001 … at resolveRequester (requesterContext.ts:42)
>     Node.js v22.23.3
> GET /api/health       (afterwards)       -> no response (server down until restarted)
> ```
>
> So a single unauthenticated request during a database blip takes the API down for everyone. Under `tsx watch` it stays down until a file changes or someone restarts it. The Lab 2 code had the same shape, but this PR keeps that path open on purpose (note 1) and states that "a last-resort handler turns anything else into a safe `500`". Today that is only true for requests that carry a session.
>
> → Suggestion: route async failures to `next(error)` in one place. For example, wrap each handler in a small `asyncHandler(fn) => (req, res, next) => fn(req, res, next).catch(next)`, or move the `resolveRequesterIdentity` call inside the existing `try`. Then add the forced-500 test you mention is missing: make one Prisma call throw (`vi.spyOn`) and assert `500 INTERNAL_ERROR` with no stack, SQL, or path in the body.
>
> ### 🟠 Needs a decision: the BR-03 box is ticked, but the header still works without a session
> I understand why the fallback stays until Issue 6, and the docs say so. But the PR ticks "identity comes from the session; a client-supplied id is ignored" as met, and with no cookie it isn't:
>
> ```text
> GET /api/tickets  X-Requester-Id: 1  (no cookie)  -> 200, anucha.wong's tickets
> GET /api/tickets  X-Requester-Id: 6  (no cookie)  -> 200 as first.login, who must change their password
> ```
>
> The second line also sidesteps the BR-14 must-change gate: an account that must change its password can still list and create tickets through the header. Either option is fine with me, as long as the PR says which:
> - (a) keep the fallback, and show that AC as **partly met, rest deferred to Issue 6**, naming the must-change gap alongside it; or
> - (b) put the fallback behind an explicit development flag (off unless set), so the session-only rule is the default.
>
> ### 🟡 Minor (not blocking)
> - **Client mistakes reported as server errors.** `safeErrors` only recognises `entity.parse.failed`. Every other body-parser error falls through to `500 INTERNAL_ERROR`. Live:
>   - a 200 KB JSON body (over `express.json()`'s 100 KB limit) → `500`;
>   - `Content-Type: application/json; charset=klingon` → `500`.
>
>   Those should be `413` and `415`, which §6.2 asks you to keep apart from server errors. body-parser already sets `error.status` (and `expose`) on these, so treating any 4xx `status` as the client's error (keeping `VALIDATION_FAILED` for the parse case) covers them all.
> - **Guard order isn't pinned by a test.** api-spec §7 now says the `Origin` check runs first. But moving `rejectForeignOrigin` below `express.json()` and `cookieParser()` still passes all 13 tests (I tried it). One case would lock the order: a foreign `Origin` with malformed JSON must return `403`, not `400`.
> - **`afterAll` signs out more than the suite.** It deletes every session of the four seeded accounts, so a developer signed in as one of them in the browser is logged out whenever the tests run. Deleting only the suite's own sessions (the `tt_sid` values it collected) avoids that.
>
> Fix the crash and settle the BR-03 wording, and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — fixed in `c20cbab`
>
> Thank you for stopping the database to test it — that is a failure I would not have found by reading the code.
>
> ### 🔴 The crash — fixed
>
> Confirmed: the seven `resolveRequesterIdentity` calls were the **only** `await`s outside a `try` block in any route handler. I checked every handler mechanically, not by eye. The resolver now catches a failure on the header path and returns the usual safe `500` context for that request alone, so nothing can reject past the handler.
>
> Your repro, re-run live with the database container stopped:
>
> ```text
> GET /api/tickets + X-Requester-Id   -> 500 INTERNAL_ERROR (no detail)
> GET /api/health                     -> 200   (server still up)
> GET /api/tickets + X-Requester-Id   -> 500 again, still serving
> ... database started again ...      -> 200
> ```
>
> **The forced-500 test you asked for** patches Prisma's `user.findUnique` to reject with an error full of `P1001`, SQL, a host, and a Windows path. It asserts:
>
> * a `500 INTERNAL_ERROR` with none of that in the body;
> * `/api/health` still answering;
> * the next real request succeeding.
>
> Removing the fix makes the run report the unhandled rejection.
>
> One thing I learned on the way: `vi.spyOn` on a Prisma model delegate restores it **broken**. Prisma's delegates are proxies, and later calls fail. The test patches the method by hand and reassigns the original instead, and a comment says why.
>
> ### 🟠 BR-03 — option (a), and the PR now says so
>
> That box is no longer ticked as met. It reads **partly met, rest deferred to Issue 6**: met when a session exists, not met without one. It names the gap you found: **an account that must change its password can still list and create tickets through the header, which sidesteps BR-14.** Issue 6 removes the fallback, which closes both.
>
> ### 🟡 The three minor points — all fixed
>
> * **413 and 415:** any 4xx `status` from body-parser stays a client error. A body over the JSON limit is now `413 REQUEST_TOO_LARGE`, and an unsupported charset is `415 UNSUPPORTED_MEDIA_TYPE`. Both codes are in api-spec §1.4. Verified live with your exact cases.
> * **Guard order pinned:** a foreign `Origin` with malformed JSON must be `403`, not `400`. Moving `rejectForeignOrigin` below `express.json()`, your experiment, now fails that test.
> * **Cleanup scoped:** the suite records every `tt_sid` it creates and deletes only those, so a developer signed in to a seeded account stays signed in.
>
> Undoing each of the three fixes made its new test fail; restored, `254/254` pass.

**Review — Approved** (2026-10-01, @WirachatTH)

> Approved! Thanks for the thorough round! I cloned `feature/4-authorization` at `c20cbab`, ran it on its own ports against a fresh migrated and seeded database, and re-ran last round's cases against the live server, not just the tests.
>
> ### 🔴 The crash is fixed
> Live, with the database stopped, I hit **all seven** header-path routes (last round I only showed `GET /api/tickets`):
>
> ```text
> GET   /api/tickets                       + X-Requester-Id   -> 500 INTERNAL_ERROR (no detail)
> POST  /api/tickets                       + X-Requester-Id   -> 500
> GET   /api/tickets/1                     + X-Requester-Id   -> 500
> GET   /api/tickets/1/attachments         + X-Requester-Id   -> 500
> POST  /api/tickets/1/attachments         + X-Requester-Id   -> 500
> GET   /api/attachments/1/download        + X-Requester-Id   -> 500
> PATCH /api/attachments/1/remove          + X-Requester-Id   -> 500
> GET   /api/health                                           -> 200   (server still up)
> ... database started again ...
> GET   /api/tickets                       + X-Requester-Id   -> 200
> ```
>
> - **Your sweep holds:** I listed every `await` in `app.ts` and `auth.ts`. The seven `resolveRequesterIdentity` calls were the only ones outside a `try`.
> - **The forced-500 test bites:** with the `try/catch` removed, it fails and Vitest reports the unhandled rejection. Good catch on `vi.spyOn` breaking Prisma's proxied delegates.
>
> ### 🟠 BR-03 — settled
> The box is unticked and reads **partly met, rest deferred to Issue 6**. It names the BR-14 gap alongside it. That's exactly option (a). 👍
>
> ### 🟡 The three minor points
> - **413 / 415, live:**
>   - a 200 KB body → `413 REQUEST_TOO_LARGE`;
>   - `charset=klingon` → `415 UNSUPPORTED_MEDIA_TYPE`;
>   - a bad `Content-Encoding` → `415` too.
>
>   Malformed JSON stays `400 VALIDATION_FAILED`.
> - **Guard order:** a foreign `Origin` with malformed JSON → `403`, live. Moving `rejectForeignOrigin` below `express.json()` now fails your new test.
> - **Cleanup:** I gave four seeded accounts a session of their own, then ran the suite. All four survived, and the suite's own sessions were gone afterwards.
>
> ### Your numbers reproduce
> `npx vitest run` gives **254/254** (18 files), and `tsc --noEmit` exits 0.
>
> ### Small notes (not blocking, no need for another round)
> - **The cleanup fix has no test.** You wrote that undoing each of the three fixes made its new test fail. That's true for 413/415 and the guard order. But putting the old `afterAll` back still passes all 16 tests in the file. The fix itself works (checked above), so this is just the wording.
> - **Stale count in the PR body:** the last checkbox still says `authorization.api.test.ts` has **13 tests**. It has **16** now.
> - **A non-body 400 gets the JSON message.** Every 4xx without an entry in `CLIENT_ERROR_CODES` now falls back to "The request body is not valid JSON." That includes Express's own param-decoding error:
>
>   ```text
>   GET /api/tickets/%E0  + X-Requester-Id: 1   -> 400 VALIDATION_FAILED "The request body is not valid JSON."
>   ```
>
>   It's a GET with no body. This is better than the `500` it used to be, but `400 INVALID_QUERY` ("The ticket id is not valid.") would match how these routes already answer a bad id. Fine to pick up in a later issue.
>
> Approving. Great turnaround. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> Thx kub

### [#54](https://github.com/Menelaus122/TokTickITV2/pull/54) — Replace the Development Requester selector with sign-in (Issue 5)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @WirachatTH

**Review — Changes requested** (2026-10-01, @WirachatTH)

> This is a really solid screen set. The guard reads in one clear order (loaded → signed in → no pending change → right role). An unreachable API is told apart from "nobody is signed in", so the user gets **Try again**, not a bounce to Login. Focus moves to the heading on the mandatory redirect. And the 72-*byte* check for Thai passwords mirrors the server exactly. I cloned `feature/5-login-and-shell` at `d9d8aca` and tested it two ways: on its own, and merged with current `lab3-staging` (so with #53's server). Both ran on their own ports against a fresh migrated and seeded database, in a real browser as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - client `npx vitest run` gives **240/240** (13 files);
>   - `tsc --noEmit` exits 0, and `npm run build` succeeds;
>   - the three new files hold exactly **38** tests (8 + 16 + 14), and `Navigation.test.tsx` still has all **26**.
> - **Note 4 holds:** the branch merges cleanly with `lab3-staging`. On the merged tree:
>   - the server suite is **254/254**;
>   - `requester-ticket-flow.spec.ts` is **12/12**, and `responsive.spec.ts` passes too (**21/21** together), all through the real Login screen.
> - **Mandatory change, live:** `first.login` lands on `/change-password` with no shell and no navigation. `/tickets`, `/tickets/new`, `/queue`, `/users`, and an unknown URL all redirect back there.
> - **Role navigation, live:** each role sees only its own menu, with `aria-current` on the active item. Another role's URL lands on the user's own home with the forbidden callout:
>
>   ```text
>   Requester      -> /queue    -> /tickets  + "You do not have access to that page."
>   IT Staff       -> /tickets  -> /queue    + callout
>   Administrator  -> /queue    -> /users    + callout
>   ```
>
> - **Logout, the normal path:** Back after Logout returns to Login, not the cached page.
> - **Responsive, live:** no horizontal overflow at 1440, 820, 390, or 320 px, on Login or in the shell. The Login card is 420 px on desktop and full width minus the gutter on mobile.
>
> ### 🔴 Must fix: a failed Logout looks like it worked, and the session stays alive
> `handleSignOut` (AppShell) has `try/finally` with no `catch`, and `signOut` (AuthContext) clears the user in its own `finally`. So when `POST /api/auth/logout` fails:
> - the screen still goes to Login, with no message;
> - the error escapes the click handler as an unhandled rejection;
> - the session cookie was never deleted on the server.
>
> Live, with the logout request made to fail once:
>
> ```text
> click Logout                     -> /login, no message; page error: "Failed to fetch"
> then open /tickets/new directly  -> the Create Ticket screen, shell shows "Anucha Wongsawat"
> ```
>
> That's exactly what AC 6 rules out ("after logout, a protected URL cannot be opened directly"). On a shared computer, the person walks away believing they signed out. A network blip or an API restart at that moment is enough. The client can't clear an HttpOnly cookie itself, so it can't honestly fake the sign-out.
>
> → Suggestion: when `logout()` fails, keep the user signed in and show an error, e.g. "Could not sign out. Please try again.", with the button enabled again. Navigate to Login only on success. Then add a UI-08 case that makes `api.logout` reject and asserts the shell is still there with the message.
>
> ### 🟡 Minor (not blocking)
> - **The rules text is below the first field, not above the fields.** ui-spec §4 says "Stated above the fields as helper text". `PASSWORD_RULES` is the `help` of New password, and `Field` renders help *after* the input. So the rules sit beneath that box, under Current password, and are hidden whenever that field shows an error. UI-05's "states the rules above the user's input" only checks `getByText`, so it can't catch the position. A line under the callout, before the first field, would match the spec.
> - **A voluntary change stays on the page.** ui-spec §4.1 says Success is "Password updated", then straight to the role's landing page. The voluntary path shows the callout and stays on `/change-password`. Either follow the spec, or reword §4.1 to say the redirect is for the mandatory path only.
> - **The deep link drops its query string.** `state.from` stores `location.pathname` only:
>
>   ```text
>   /tickets?page=2&sortDir=asc  (signed out)  -> Login -> sign in -> /tickets
>   ```
>
>   Storing `pathname + search` keeps it.
> - **The mandatory screen has no way out.** There's no Logout, so someone who signs in to a must-change account they don't mean to finish (wrong account, shared computer) can only close the tab, and the session stays. The spec doesn't ask for one, so this is just a suggestion: a small Logout under the card.
> - **Stale E2E titles.** `"select a Requester, create a Ticket…"`, `"E2E-04 changing Requester"`, and `"capture the selection screen…"` now sign in rather than select. Renaming them keeps the report honest.
>
> ### 📌 For Issue 6, not this PR
> When the session ends while a page is open (I ended it from a second client), the Requester screens keep working. Against the merged server they still send `X-Requester-Id`, so My Tickets loads all 10 rows while `/api/auth/me` says `401`. That's the fallback you already plan to remove, so no change here. But once Issue 6 drops the header, those screens will hit `401` with nothing listening for it. They'd show error states rather than returning to Login, so Issue 6 will want a "`401` → back to Login" path in the client too.
>
> Fix the Logout failure, and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-01, @Menelaus122)

> ## Review round 1 — fixed in `1e7890a`
>
> Thank you for testing the failure path. It mattered most, and I had only tested logouts that succeed.
>
> ### 🔴 A failed Logout — fixed
>
> You were right on all three counts. The user was cleared in a `finally`, the navigation ran in another `finally`, and the error escaped the click handler. Now **only a logout the server confirms signs the user out**: `signOut` throws if the request fails and clears nothing. The shell shows "Could not sign out. Please try again." and keeps Logout enabled, and only a successful logout goes to Login.
>
> Your scenario, live in a real browser (the first logout request aborted with `page.route`):
>
> ```text
> click Logout (request fails)   -> stays on /tickets, shell still "Anucha Wongsawat",
>                                   "Could not sign out. Please try again.", 0 page errors
> open /tickets/new              -> opens — consistent with what the screen says: still signed in
> click Logout again (succeeds)  -> Login
> open /tickets/new              -> asks for sign-in
> ```
>
> **New UI-08 case:** `api.logout` rejects once. The test asserts the shell and the message are there and the button is enabled, and then that the retry signs out. Merged with current `lab3-staging` (so with #53), client and server suites pass and the Lab 2 E2E flow is still 12/12.
>
> ### 🟡 Minor points — all taken
>
> * **Rules text position:** it is now a line above the first field, not the `help` of New password, so a validation message can no longer hide it. UI-05 now asserts DOM order (the rules precede Current password) and that the rules stay visible with every field in error. That assertion would have caught the old position.
> * **Voluntary change:** I kept the page and reworded ui-spec §4.1. On the mandatory path the user goes straight to their landing page. On the voluntary path they stay on the page they chose to open, with "Password updated" — sending them away would hide the confirmation they came for.
> * **Deep link query:** `state.from` is now `pathname + search`. Live: `/tickets?page=2&sortDir=asc` signed out → Login → back on `/tickets?page=2&sortDir=asc`.
> * **A way out of the mandatory screen:** a tertiary Logout under the form. A failed logout there behaves the same as in the shell. There is a UI-06 case for it, and ui-spec §4.1 now lists it.
> * **Stale E2E titles:** renamed to "sign in as a Requester…", "E2E-04 changing the signed-in Requester", "the session survives a page reload", and "capture the states that matter".
>
> ### 📌 Noted for Issue 6
>
> Agreed. Once the header goes, a `401` from any Requester screen has to send the user back to Login rather than to an error state. I will build that into Issue 6.
>
> ```text
> client  npx vitest run      Test Files 13 passed (13)   Tests 242 passed (242)
> client  tsc / build         exit 0 / built
> server  npx vitest run      Test Files 18 passed (18)   Tests 254 passed (254)   (merged tree)
> e2e     requester-ticket-flow.spec.ts                   12 passed
> ```
>
> Ready for another look.

**Review — Approved** (2026-10-01, @WirachatTH)

> Approved! Thanks for taking every point! I cloned `feature/5-login-and-shell` at `1e7890a` and ran it on its own ports against a fresh migrated and seeded database. I replayed last round's failure scenario in a real browser, plus a few more around it.
>
> ### 🔴 The failed Logout is fixed
> Live, with only the first logout request made to fail:
>
> ```text
> Shell, desktop
>   click Logout (request fails)  -> stays on /tickets, "Could not sign out. Please try again.",
>                                    Logout enabled again, /api/auth/me 200, 0 page errors
>   click Logout again            -> /login, /api/auth/me 401
>   open /tickets/new             -> asks for sign-in
> Shell, 390 px menu              -> same message, visible in the viewport, no horizontal overflow
> Mandatory screen
>   click Logout (request fails)  -> stays on /change-password, same message, /me 200
>   click Logout again            -> /login, /me 401; /change-password now asks for sign-in
> ```
>
> **Each fix has a test that bites.** I undid them one at a time:
>
> | Undone | Caught by |
> | :--- | :--- |
> | `signOut` clearing the user in a `finally` again | UI-08 "keeps the user signed in, and says so…" |
> | the shell navigating to Login whatever happened | the same UI-08 case |
> | the rules line removed from above the fields | UI-05's new DOM-order case |
> | the mandatory Logout hidden | UI-06's new case |
>
> ### 🟡 The minor points
> - **Rules text:** now above Current password, and visible while every field shows an error (checked live, and UI-05 now asserts the order).
> - **Voluntary change:** the reworded ui-spec §4.1 makes sense. Staying with "Password updated" on the page they chose is a fair call, and the spec and the screen now agree.
> - **Deep link:** `/tickets?page=2&sortDir=asc`, signed out → Login → back on exactly that URL.
> - **Mandatory Logout:** present, listed in §4.1, and it reports a failure the same way the shell does.
> - **E2E titles:** renamed.
>
> ### Your numbers reproduce
> - client `npx vitest run`: **242/242** (13 files); `tsc --noEmit` exits 0; `npm run build` succeeds;
> - server suite on this branch (with #53 merged in): **254/254**;
> - Playwright: `requester-ticket-flow.spec.ts` **12/12**, and `responsive.spec.ts` passes too (**21/21** together).
>
> ### Tiny notes (not blocking, no need for another round)
> - **The "Could not sign out" message outlives the page it was about.** After a failed logout, clicking Create Ticket still shows it. React keeps the same `AppShell` across the Requester routes, so its state carries over. Clearing `signOutError` when `location.pathname` changes (next to the effect that already closes the menu) would tidy that.
> - **The rules lost their link to the field.** As `help`, the rules were in New password's `aria-describedby`. As a plain `<p>`, they aren't, so a screen reader no longer reads them when that field gets focus. Giving the `<p>` an `id` and adding it to New password's `aria-describedby` restores it.
> - **FYI, not from this PR:** on a phone, the My Tickets search box renders about 240 px tall. It's the same in Lab 2's committed `my-tickets/mobile.png`, so it predates this work. It might be worth a look when Issue 6 touches that screen.
>
> Approving. Great turnaround. 🙌
> Wirachat 67070501041

### [#55](https://github.com/Menelaus122/TokTickITV2/pull/55) — Run the Lab 2 Requester flow on the signed-in session (Issue 6)

**Verdict:** Approved · **merged** 2026-10-02 by @WirachatTH

**Review — Approved** (2026-10-02, @WirachatTH)

> Approved! This is a clean cut-over. `resolveRequesterIdentity` is now synchronous and session-only, so the whole database-on-the-header-path class from #53 is gone, not just patched. The client signatures no longer take a `requesterId`, so there's no argument left that could name someone else. And the "`401` → Login → back to the same page" wiring is small and sits in exactly one place. I cloned `feature/6-requester-regression` at `7efe08a` and ran it on its own ports against a fresh migrated and seeded database. I tested it live with `curl` and in a real browser, as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **258/258** (18 files);
>   - client: **239/239** (13 files);
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - the new files hold exactly **9** (`requester-regression.api.test.ts`) and **10** (`RequesterRegression.test.tsx`) tests;
>   - after the server run, no sessions or attachments were left behind.
> - **Playwright:** `requester-ticket-flow.spec.ts` **12/12**, and `responsive.spec.ts` passes too (**21/21** together).
> - **The header is dead, live.** `X-Requester-Id` naming a real Requester, with no session:
>
>   ```text
>   GET/POST /api/tickets, GET /api/tickets/:id, GET/POST /api/tickets/:id/attachments,
>   GET /api/attachments/:id/download, PATCH /api/attachments/:id/remove,
>   GET /api/categories, GET /api/related-systems            -> 401 AUTH_REQUIRED  (all nine)
>   GET /api/requesters                                      -> 404
>   ```
>
> - **Ownership, live:**
>   - B reading A's ticket gets `404`, with or without a header naming A.
>   - B's list with that header still holds only B's 4 tickets.
>   - An IT Staff session on `/api/tickets` gets `403 FORBIDDEN`.
> - **No client request carries the header.** I watched every request in a full browser journey (create → detail → upload → download) and none sent it. Download works on the cookie alone.
> - **The selector is gone, live:** `/select-requester` leads to Login when signed out and to My Tickets when signed in. `localStorage` is empty.
> - **Session ending under a screen, live:** I ended the session from a second client while a ticket was open.
>   - The next click went to Login, then back to the same page, with 0 page errors.
>   - When a *different* Requester signed in from there, they got "Ticket not found…", with nothing of A's on screen.
> - **Eight statuses, live:**
>   - All eight badges match ui-spec §1.3's tones exactly, with title-case labels, one line each, at 1280 and 390 px, and no overflow.
>   - The filter offers all eight; filtering Reopened returns just the Reopened ticket.
>   - `?currentStatus=BOGUS` and `?currentStatus=reopened` get `400`.
> - **`%E0`:** `/api/tickets/%E0` → `400 INVALID_QUERY` "The ticket id is not valid."; `/api/attachments/%E0/download` → "…attachment id…".
> - **Extra mutations of my own** on top of yours, each caught:
>
> | Broken | Caught by |
> | :--- | :--- |
> | the header fallback, put back | SEC-01, API-16, MIG-11, create-ticket |
> | `requireSession` off `/api/categories` | SEC-01 and the BR-14 no-cookie case |
> | the `URIError` mapping, removed | the malformed-route-id test |
> | the non-Requester `403`, removed | SEC-07, MIG-11 |
> | `CANCELLED` dropped from the statuses | API-17 and the list-query test |
> | the client's `401` signal, removed | UI-09 "sends the user to Login…" |
> | the `401` signal fired on `/api/auth` too | UI-09 "a wrong password on Login…" |
>
> ### 🟡 Minor (not blocking)
> - **A voluntary password change can't recover from an ended session.** `/api/auth/password` sits inside the `/api/auth/` exclusion, so its `401` isn't treated as an ended session. Live, after ending the session on `/change-password`:
>
>   ```text
>   Save password  -> stays on /change-password, "The password could not be changed. Please try again."
>   ```
>
>   Retrying can never succeed, and nothing sends the user to Login. Excluding only the auth calls whose `401` really is an answer (`/api/auth/login` and `/api/auth/me`) would cover it.
> - **A Create Ticket form is lost when the session ends under it.** Live: I filled the whole form, ended the session, and pressed Submit Ticket → Login → back on `/tickets/new` with every field empty. The redirect is right; losing a long description isn't kind. Keeping the draft in `sessionStorage` until the create succeeds (or simply warning before leaving) would soften it. This is fine for a later issue.
> - **The mutation count:** the PR says "I broke the code 10 times", but the list has 9 bullets.
> - **Signed out, a malformed id is checked before the session.** The `URIError` happens before any handler runs, so the two malformed-id cases disagree:
>
>   ```text
>   GET /api/tickets/%E0  (no session)  -> 400 INVALID_QUERY
>   GET /api/tickets/abc  (no session)  -> 401 AUTH_REQUIRED
>   ```
>
>   It's harmless, and it reveals nothing. If you want it consistent, consider returning `401` from the `URIError` branch when `!req.auth`. But you may address this in the next issue.
>
> Approving. Really nice work on a big cut-over. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-02, @Menelaus122)

> Thx kub

### [#56](https://github.com/Menelaus122/TokTickITV2/pull/56) — Add Public Comments, Internal Notes, and Problem Appears Resolved (Issue 7)

**Verdict:** Approved · **merged** 2026-10-02 by @WirachatTH

**Review — Approved** (2026-10-02, @WirachatTH)

> Approved! This is a careful piece of work. Checking the role *before* the ticket lookup on the notes routes is exactly what makes the Requester's 403 identical everywhere. Using two tables means no forgotten `WHERE` can ever leak a note. The appears-resolved stamp and its comment go in one transaction, and the endpoint simply has no status field to abuse. I cloned `feature/7-comments-and-notes` at `edb1bcc` and ran it on its own ports against a fresh migrated and seeded database. I tested it live with `curl` and in a real browser, as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **277/277** (19 files), with **13** in `comments-notes.api.test.ts`;
>   - client: **255/255** (14 files), with **16** in `RequesterComments.test.tsx`;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - Playwright: **21/21** (`requester-ticket-flow` 12 + `responsive` 9);
>   - re-running the Lab 3 suites leaves the comment and note counts unchanged, so nothing leaks.
> - **Visibility, live:**
>
>   ```text
>   comments  A (owner) 200 · B 404 (same body as a missing ticket) · IT Staff 200 · Admin 200
>   notes     A on own ticket 403 · A on ticket 999999 403 (identical body) · IT Staff 200 · no session 401
>   ```
>
>   Then I searched A's `GET /api/tickets/:id`, `/comments`, and `/api/tickets` for "note" or "internal": nothing.
> - **Validation, live:** whitespace-only bodies and `{"body":["x"]}` get `400 fields.body`. `"appearsResolved":"true"` (a string) gets `400`.
> - **Appears resolved, live:**
>   - IT Staff → `403`, B → `404`.
>   - A, with `"currentStatus":"CLOSED"` in the body → `200`, and the status stays `NEW`.
>   - Undo clears `requesterResolvedAt`.
> - **Requester screen, real browser (1280 and 390 px):**
>   - The panel sits below the attachments, and the thread below it.
>   - There's no internal region, no "note" or "internal" text, and no status control.
>   - A `<img onerror>` + `<script>` comment rendered as plain text: no dialog, no `<img>` in the thread, and the draft cleared.
>   - An empty post shows "Comment is required."; a 2-character mark shows the 5–2000 rule.
>   - Marking shows the callout, and the comment joins the thread. A reload keeps the callout with the status still **New**, and Undo brings the form back.
>   - No horizontal overflow at either width, and 0 page errors.
>
> ### 🟠 Worth a decision: two input classes that answer 500 instead of 400
> Neither is new in this PR; both go back to Lab 2 and Issue 3. But the new endpoints inherit them, and each is a one-place fix for every route.
>
> **1. Text Postgres can't store.** A NUL character (`\u0000`) or a lone surrogate (`\ud800`) in any free-text field reaches Prisma, and Postgres refuses it:
>
> ```text
> POST  /api/tickets/1/comments          {"body":"abc\u0000def"}             -> 500 INTERNAL_ERROR
> POST  /api/tickets/1/notes             {"body":"note\u0000x"}  (IT Staff)  -> 500
> POST  /api/tickets/1/comments          {"body":"lone \ud800 surrogate"}    -> 500
> PATCH /api/tickets/1/appears-resolved  comment with \u0000                 -> 500
> --- the same class, already on lab3-staging:
> POST  /api/tickets                     summary with \u0000 or \ud800       -> 500
> GET   /api/tickets?search=a%00b                                            -> 500
> POST  /api/auth/login                  email with \u0000                   -> 500
> ```
>
> Nothing crashes, and no detail leaks. But these are the client's mistakes reported as server errors, like the 413/415 point on #53.
>
> → Suggestion: reject them once, at parse time. For example, give `express.json()` a `verify` step (or a reviver) that refuses any string containing `\u0000` or an unpaired surrogate, with `400 VALIDATION_FAILED`. Have `listQuery` refuse the same in `search`.
>
> **2. Route ids above Int32.** `routeId` has no upper bound, so a big id reaches an `Int` column, and Prisma throws:
>
> ```text
> GET /api/tickets/9999999999/comments  (IT Staff)  -> 500 INTERNAL_ERROR
> GET /api/tickets/9999999999/notes     (IT Staff)  -> 500
> GET /api/tickets/9999999999           (Requester) -> 500 "Failed to load the ticket."  (since Lab 2)
> --- the same class in the My Tickets query (listQuery.ts):
> GET /api/tickets?categoryId=9999999999          -> 500 "Failed to load tickets."
> GET /api/tickets?relatedSystemId=9999999999     -> 500
> GET /api/tickets?page=99999999999999999999      -> 500
> ```
>
> → Suggestion: add `id <= 2147483647` to `routeId`. Since it's now shared in `routeId.ts`, one line covers every route. A malformed id is then `400 INVALID_QUERY`, and an out-of-range one is simply `404`, like any missing ticket. Give `idFilter` and the `page` parse in `listQuery.ts` the same bound, answering `400 INVALID_QUERY` as they already do for a negative number.
>
> You don't have to fix it right here in this issue. As long as it's addressed in the future issues, I'm totally okay with it.
>
> ### 🟡 Minor (not blocking)
> - **Marking twice stacks comments.** A second `appearsResolved: true` while the signal is already set posts another comment and moves the timestamp. The screen hides the form once it's set, so only the API can do this. The spec is silent, so this is just worth a line in api-spec §3.1 either way: re-marking either refreshes the timestamp and adds a comment, or returns `409`.
> - **Lenient id parsing.** `routeId` uses `Number()`, so `/api/tickets/%201/comments` (a leading space) reads ticket 1, and `/api/tickets/1e3/comments` reads ticket 1000. Both are harmless. A `/^\d+$/` check would make malformed ids consistently `400`, and it pairs naturally with the bound above.
>
> Approving. Really nice work. 🙏
> Wirachat 6707050141

**Author's response** (2026-10-02, @Menelaus122)

> Thx kubb

### [#57](https://github.com/Menelaus122/TokTickITV2/pull/57) — Add the IT Staff Ticket Queue (Issue 8)

**Verdict:** Changes requested → Approved · **merged** 2026-10-03 by @WirachatTH

**Review — Changes requested** (2026-10-03, @WirachatTH)

> Request Changes. This is a well-built queue. A pure `queueQuery.ts` parser with unit tests, an explicit `id` tie-break on every sort, the owner filter resolved against the session, and real `<a href="/queue/:id">` links all make it solid. The test suite is the strongest yet: none of the nine mutations I tried got past it. I cloned `feature/8-staff-ticket-queue` at `7c01713` and ran it on its own ports against a fresh migrated and seeded database. I tested it live with `curl` and in a real browser, as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`: **302/302** (21 files), with **15** in `staff-queue.api.test.ts` and **10** in `queue-query.test.ts`;
>   - client: **274/274** (15 files), with **19** in `StaffTicketQueue.test.tsx`. That's with `--no-file-parallelism` **and** with a plain `npx vitest run`; no flakes on my machine;
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - no sessions or test tickets were left behind.
> - **Lab 2 E2E, which the PR didn't re-run:** `requester-ticket-flow` + `responsive` **21/21**.
> - **Mutations of my own,** each caught:
>
> | Broken | Caught by |
> | :--- | :--- |
> | the `id` tie-break dropped | API-35, BR-55/56 ordering units |
> | default direction flipped to `asc` | API-31, API-36, UNIT-09 |
> | `owner=me` ignoring the session | API-34 |
> | search not matching Ticket Number | API-32 |
> | search made case-sensitive | API-32 |
> | inactive users listed as assignable | the assignable-users test |
> | a blank `q` not treated as absent | API-32, BR-53, UNIT-10 |
> | the `403` → forbidden-state mapping removed | UI-14 |
> | a new filter not resetting to page 1 | UI-12 |
>
> - **Roles, live:** no session gives `401`. A Requester and an Administrator both get `403 FORBIDDEN` with no ticket data. `assignable-users` returns only `id`, `fullName`, `role`, and `isActive` (no email).
> - **Query contract, live:**
>   - the default order is IT Priority descending, oldest first within a priority (checked across all 16 seeded tickets);
>   - `status=NEW&status=OPEN` → `400`; `owner=%20me` → `400`;
>   - `categoryId=999999` / `owner=999999` → `200` with an empty list, as §5.1 says.
> - **Screen, live:**
>   - Desktop shows the seven columns; 820 px folds the secondary line; mobile shows the cards behind **Filters** (`aria-expanded` toggles).
>   - No horizontal overflow at 1440, 820, 390, or 320 px.
>   - **Inactive**, **You**, *Unassigned*, and "✓ Requester says resolved" all render.
>   - The row link opens `/queue/13`.
>
> ### 🔴 Must fix: a well-formed id above Int32 is a 500, against your own §5.1 row
> The new `positiveInteger()` in `queueQuery.ts` has no upper bound, so a large id reaches an `Int` column and Prisma throws:
>
> ```text
> GET /api/staff/tickets?categoryId=999999          -> 200, empty list   (as §5.1 says)
> GET /api/staff/tickets?categoryId=9999999999      -> 500 INTERNAL_ERROR
> GET /api/staff/tickets?owner=9999999999           -> 500
> GET /api/staff/tickets?page=99999999999999999999  -> 500
> ```
>
> api-spec §5.1, which this PR wrote, says "`categoryId` or `owner` a well-formed id that matches nothing → `200` with an empty `tickets` array". The issue's own criterion is that invalid query params "never crash the server". This is the same class I raised on #56 (`routeId` and Lab 2's `listQuery` `idFilter` / `page`). That one wasn't tracked, and here it is again in new code.
>
> → Suggestion: put the bound in one shared helper, e.g. `positiveId(text) → 1..2147483647 or null`. Use it in `queueQuery.ts`, `listQuery.ts`, and `routeId.ts`, so the whole class closes at once:
> - an out-of-range `categoryId` or `owner` → `400 INVALID_QUERY` (or `200` empty, whichever you document);
> - a huge `page` → `400`;
> - a huge route id → `404`.
>
> Add the big-number cases to UNIT-09 and API-37.
>
> ### 🟡 Minor (not blocking)
> - **A stale response can show the wrong state.** Changing a filter on page 2 sends two requests: the new filter on page 2, then the `setPage(1)` effect's page 1. Neither is cancelled, so whichever arrives *last* wins. Live, with page-2 responses slowed down:
>
>   ```text
>   on page 2, choose Status = New
>     requests:  ?status=NEW…&page=2   then   ?status=NEW…&page=1
>     shown:     "No tickets match your filters", 0 rows   — while 2 NEW tickets exist
>   ```
>
>   → Two small changes: reset `page` to 1 inside `update()` (in the same state change as the filter, so no page-2 request is ever sent), and ignore any response that isn't for the latest params (a request counter or an `AbortController`). My Tickets has the same pattern from Lab 2, so the fix could be shared.
> - **Mobile filters are pushed to the right.** At 390 and 320 px with Filters open, every field is shrink-wrapped and right-aligned at a different width, instead of spanning the card. The cause: Lab 2's mobile rule sets `.tt-toolbar` to `flex-direction: column; align-items: stretch`. The new `.tt-queue__filters { align-items: flex-end; }` comes later in the file, so it wins, and in a column `flex-end` means "push right". Scoping that rule to `@media (min-width: 768px)` (or adding `align-items: stretch` in your mobile block) fixes it.
> - **`%` and `_` are wildcards in search.** Prisma's `contains` doesn't escape them. No seeded ticket contains either character, yet `?q=%` and `?q=_` each match all 16. Searching for "50%" or "file_name" therefore matches more than it should. Lab 2's My Tickets search does the same (`?search=%` matches all 4). Escaping `\`, `%`, and `_` in one shared helper would fix both.
> - **Still open from #56:** a NUL in the search text is still a `500` (`?q=a%00b`), here and in My Tickets. It's worth closing in the same sweep as the ids. If not, a small tracked issue keeps it from being lost.
> - **Lenient numbers:** `pageSize=10.0`, `page=1.0`, and `categoryId=1e0` are accepted. They're harmless, and a `/^\d+$/` check in the shared helper above would make them `400` too.
>
> Fix the out-of-range ids and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> Thanks for the thorough review! Fixed in `0b06c49` and `587dc91`:
>
> - **Out-of-range ids:** a shared `positiveId` in `queryParams.ts` (used by `queueQuery`, `listQuery`, `routeId`) accepts plain digits 1–2147483647 only. Out-of-range `categoryId`, `owner` and `page` → `400 INVALID_QUERY`. I made out-of-range route ids `400` rather than `404`, to match how a malformed id like `abc` is already handled. The rule is in api-spec §1.5. Big-number cases are added to UNIT-09, API-37, the Lab 2 list tests and the comments route test.
> - **Stale response:** the page resets in the same update as the filter, and only the latest request's answer is shown. Same in My Tickets, with tests for both.
> - **Mobile filters:** `flex-end` now only applies from 768px up.
> - **`%` and `_`:** escaped, so they match literally (queue and My Tickets).
> - **NUL in search and `1.0`/`1e0`:** both `400`.
>
> Server 317/317, client 278/278, Lab 2 E2E 21/21.

**Review — Approved** (2026-10-03, @WirachatTH)

> Approved! Thanks for closing the whole class rather than the one instance! I cloned `feature/8-staff-ticket-queue` at `587dc91` and ran it on its own ports against a fresh migrated and seeded database. I replayed last round's cases live, in the browser as well as with `curl`.
>
> ### 🔴 Out-of-range ids — fixed
> A shared `positiveId` (plain ASCII digits, 1–2147483647) behind `queueQuery`, `listQuery`, and `routeId` is exactly the right shape. Live:
>
> ```text
> queue    ?categoryId=2147483647                 -> 200, empty list   (the largest valid id still works)
> queue    ?categoryId=2147483648                 -> 400 INVALID_QUERY
> queue    ?owner=9999999999                      -> 400
> queue    ?page=99999999999999999999             -> 400
> queue    ?pageSize=10.0 / ?categoryId=1e0 / a full-width "１"   -> 400
> My Tickets ?categoryId=9999999999               -> 400
> GET   /api/tickets/9999999999 (+ /comments, /attachments)      -> 400 "The ticket id is not valid."
> GET   /api/attachments/9999999999/download, PATCH …/remove     -> 400 "The attachment id is not valid."
> GET   /api/tickets/2147483647                   -> 404 (in range, just missing)
> ```
>
> `400` for an out-of-range route id is a fair call, since it matches `abc`, and api-spec §1.5 now says so.
>
> ### 🟡 Last round's minor points — all fixed
> - **The race:** with page-2 responses slowed down exactly as before, choosing Status = New on page 2 now sends **one** request (`page=1`) and shows every New ticket (4 at that point: the 2 seeded ones plus 2 my probes had created). Typing a search on page 2 likewise sends a single `page=1` request.
> - **Mobile filters:** at 390 and 320 px every field spans the full card (left 33 px to the right edge), with no overflow.
> - **Wildcards:** `?q=%` and `?q=_` now match only the ticket that contains them, in the queue and in My Tickets. I also checked backslashes with a summary containing `\\fs01\dept`: `q=\`, `q=fs01\dept`, and `q=\\fs01` all find it on both screens.
> - **NUL in search:** `?q=a%00b` → `400` "q must not contain a NUL character."
>
> ### Your numbers reproduce
> - server `npx vitest run`: **317/317** (22 files); `tsc --noEmit` exits 0 on both packages; `vite build` succeeds;
> - client: **278/278** (but see the flaky test below);
> - Lab 2 E2E: `requester-ticket-flow` + `responsive` **21/21**.
>
> ### Mutations on the fixes
> **Caught (8):**
> - the Int32 bound removed;
> - the `/^\d+$/` check swapped for `Number.isInteger(Number())`;
> - the NUL check removed;
> - the `%`/`_` escaping removed;
> - the stale-response guard removed, in the queue and in My Tickets;
> - the page reset removed from `update()`.
>
> **Survived (4).** No test measures these lines, but each one does something. Here's what each protects, so it can be pinned:
> - **Escaping `\` in `containsText`:** without it, `fs01\dept` becomes the pattern `fs01\dept`, where `\d` means a plain `d`, so a search for a path stops matching. *Test:* search for a term with a backslash and expect the ticket.
> - **`setPage(1)` in `clearFilters`:** on page 2 of a filtered list with more than one page (e.g. `owner=unassigned` with 11+ tickets), Clear would leave the user on page 2 of the unfiltered queue. *Test:* page forward, Clear, and expect a `page=1` request.
> - **`setPage(1)` when the debounced search changes:** without it, typing a search on page 2 asks for page 2 of the matches, which is usually past the end, so the user sees "No tickets match your filters", the round-1 symptom again. *Test:* page forward, type a term, and expect a `page=1` request.
> - **The `appliedSearch` re-check:** typing a character and deleting it within the debounce keeps the current page and sends nothing (confirmed live: page 2 kept, 0 requests). Without the check, it would jump back to page 1. *Test:* type and undo on page 2, and expect no new request.
>
> ### Small notes (not blocking, no need for another round)
> - **One more sibling, which I missed in round 1:** my list named `routeId`, `listQuery`, and `queueQuery`, but `validation.ts` has its own unbounded `positiveInteger()` for the *body* ids on ticket creation:
>
>   ```text
>   POST /api/tickets  {"categoryId": 9999999999, …}         -> 500 "Failed to create the ticket."
>   POST /api/tickets  {"categoryId": "9999999999", …}       -> 500
>   POST /api/tickets  {"relatedSystemId": 9999999999, …}    -> 500
>   ```
>
>   It's a one-line change to use `positiveId` there (for number inputs, check `Number.isInteger(value) && value <= MAX_ID`). It's fine here or in the next PR.
> - **The flaky client test is real, but not from this PR.** `RoleNavigation.test.tsx` (UI-07) sometimes fails right at Testing Library's 1000 ms `findBy` limit, even when that file runs on its own. Run alternately against your round-1 code and this round's, it failed 2/8 vs 1/8, so the fix didn't cause it. Raising the limit once in `tests/setup.ts` (`configure({ asyncUtilTimeout: 3000 })`) should make it stable without changing any test.
> - **Still open from #56:** a NUL character in a free-text *body* (comments, notes, the ticket summary, the login email) is still a `500`. Only `q`/`search` was in scope here. A small tracked issue would keep it from getting lost.
>
> Approving. Really nice turnaround. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> thx kubb

### [#58](https://github.com/Menelaus122/TokTickITV2/pull/58) — Add the IT Staff Ticket Detail operations (Issue 9)

**Verdict:** Approved · **merged** 2026-10-03 by @WirachatTH

**Review — Approved** (2026-10-03, @WirachatTH)

> Approved! This is the hardest issue so far, and it's done properly:
> - Every write takes `SELECT … FOR UPDATE` and then decides from what it read under the lock.
> - The claim is also a conditional update.
> - The BR-33 matrix is one pure table that both the API and `permittedTransitions` read.
> - `expectedOwnerId` closes a gap the spec itself had (D-26).
>
> I cloned `feature/9-staff-ticket-detail` at `df8d412` and ran it on its own ports against a fresh migrated and seeded database. I tested it live with concurrent requests and in a real browser, as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run`, on the host rather than in the container: **355/355** (24 files), with **31** in `staff-ticket-detail.api.test.ts` and **7** in `transitions.test.ts`;
>   - client: **320** tests, with **37** in `StaffTicketDetail.test.tsx` and **5** in `ZenGreenLab3.test.tsx` (but see the flaky test below);
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - Lab 2 E2E **21/21**.
> - **Concurrency, live, with real parallel requests:**
>
>   ```text
>   10 simultaneous claims, from two IT Staff            -> one 200, nine 409; owner set once, status OPEN
>   6 racing moves IN_PROGRESS -> RESOLVED / CANCELLED   -> exactly one 200; exactly one reason comment created
>   12 mixed owner / IT Priority / status writes at once -> no 500, no deadlock (the two 409s were repeat moves, BR-38)
>   ```
>
> - **Roles, live:** on all three PATCHes and the GET, a Requester gets `403`, an Administrator gets `403`, and no session gets `401`.
> - **Rules, live:**
>   - an inactive IT Staff member or a Requester as owner → `409 OWNER_NOT_ASSIGNABLE`;
>   - `ownerId: "7"` or `9999999999` → `400`;
>   - a cancelled ticket refuses an owner change and any move;
>   - `requestedPriority` sneaked into the IT Priority body is ignored (the DB keeps `MEDIUM`);
>   - a `reason` on a non-reason move creates no comment;
>   - RESOLVED → CLOSED clears a Requester's "appears resolved" flag (BR-30).
> - **Staff attachment route, live:**
>   - the detail advertises `/api/staff/attachments/:id/download`, which streams the identical bytes;
>   - IT Staff on the Requester's route → `403`, and a Requester on the staff route → `403`;
>   - after the Requester removes the file → `410 ATTACHMENT_REMOVED`.
> - **Screen, real browser:**
>   - **Claim** asks for confirmation ("…because it is New it will move to Open at the same time").
>   - Two IT Staff on the same ticket: the second, from a stale screen, gets "Someone else claimed this ticket first.", and the screen reloads to show the new owner with no Claim button.
>   - **Move to** lists exactly the permitted moves. **Apply** stays disabled for Resolved until there's a reason, and the reason lands in Public Comments only.
>   - Below 992 px, Operational comes first. There's no overflow at 1440, 820, 390, or 320 px, and 0 page errors.
> - **Mutations of my own,** 12 tried:
>   - Caught (10): the CANCELLED owner guard, the "keep an owner on RESOLVED/CLOSED" guard, the owner requirement for Resolved/Closed, the reason requirement, claim-moves-NEW-to-OPEN, the claim clearing the "appears resolved" flag, accepting an inactive owner, accepting a Requester as owner, the `MAX_ID` bound on `ownerId`, and the `410` for removed attachments.
>   - **Survived (2).** Neither is a bug; here's what each line is for:
>     - `if (from === to)` → the matrix never lists a status as reachable from itself, so the move is refused either way. This line only supplies the clearer "The ticket is already X". A test asserting that message would pin it.
>     - `ownerId: null` in the claim's `WHERE` → with the row lock in place, the owner was already read under the lock, so this only matters if the lock is ever removed. It's good defence in depth; it just can't be tested while the lock is there. A comment saying so would stop a future refactor from "simplifying" it away.
>
> ### 🟡 Minor (not blocking)
> - **IT Priority still changes on a cancelled ticket.** The owner PATCH and the status PATCH both treat `CANCELLED` as closed for good, but `PATCH …/it-priority` on one returns `200`. The spec doesn't say either way, so it's worth deciding. A `409` matching the owner route seems most consistent.
> - **api-spec §5.3 over-claims the lock.** It says "every write in §5.3–§5.5 also locks the ticket's row", but §5.4 (IT Priority) is a plain `updateMany` with no lock. That's harmless, because it's one atomic write with nothing read first, but the sentence should say §5.3 and §5.5.
> - **The assignee's eligibility is read outside the transaction.** The ticket row is locked, but the proposed owner's `isActive` / `role` is read before the transaction starts. Once Issue 10 can deactivate users, a deactivation landing between that read and the commit would assign someone who is no longer active, against BR-24's "active at the time of assignment". Reading the user inside the transaction with `FOR SHARE`, after the ticket lock, closes it without adding any lock-order risk (deactivation never locks tickets, per BR-26). This could be done here or in Issue 10.
> - **"Unassign" is offered where it can't succeed.** On a Resolved or Closed ticket, the owner picker still lists "Unassign (no owner)". The server correctly refuses it with `409 OWNER_REQUIRED`, but the option could be hidden.
> - **Visual order ≠ reading order on small screens.** Below 992 px, Operational is moved first with CSS, but the DOM still has "What the Requester submitted" first. So keyboard and screen-reader users meet the regions in a different order than they see them. Either put Operational first in the DOM and move it with CSS on desktop, or accept it and note it.
> - **The issue text vs the spec on Administrators.** Issue #42 says IT Priority is changeable by "IT Staff and Admin", but BR-19 and BR-28 say IT Staff only, and the PR follows the spec (Admin → `403`). That's the right call. One line in the PR body saying so would save a reader comparing it with the issue from flagging it.
> - **Client flakiness is still there.** Even with `--no-file-parallelism`, 2 of 3 full runs had one navigation test time out right at the 1000 ms `findBy` limit (UI-08 / UI-09). It's not from this PR. `configure({ asyncUtilTimeout: 3000 })` in `tests/setup.ts` would settle it.
> - **Still open from #56 / #57:** a NUL character in a free-text body is still a `500` (now including a transition `reason`), and so is an out-of-range `categoryId` in the `POST /api/tickets` body (`validation.ts`'s own `positiveInteger`). These have carried over three PRs now. Please open a small tracking issue for both so they can't be lost.
>
> Approving. Excellent work on the concurrency. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> Thx kub

### [#59](https://github.com/Menelaus122/TokTickITV2/pull/59) — Add the Administrator User Management (Issue 10)

**Verdict:** Approved · **merged** 2026-10-03 by @WirachatTH

**Review — Approved** (2026-10-03, @WirachatTH)

> Approved! This is a solid finish to the role work.
> - `lockActiveAdministrators` takes the rows `ORDER BY id` before counting, so every transaction locks them in the same order, and the BR-49 lock can't deadlock against itself.
> - Keeping the decision in a pure `changeRefusal()` makes the rule easy to read and to unit-test.
> - You noticed the plain race test passed even without the lock, and added a second test that does fail without it. That's exactly the right instinct.
> - The screen carries #57's stale-response guard over without being asked.
>
> I cloned `feature/10-admin-user-management` at `8337579` and ran it on its own ports against a fresh migrated and seeded database. I tested it live with `curl` and parallel requests, and in a real browser, as well as through the suites.
>
> ### What I verified
> - **Your numbers reproduce:**
>   - server `npx vitest run` (on the host): **385/385** (26 files), with **20** in `users-admin.api.test.ts` and **10** in `user-rules.test.ts`;
>   - client: **339** tests, with **19** in `UserManagement.test.tsx` (one serial run had the usual UI-07 1000 ms timeout; it's not from this PR);
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds;
>   - Lab 2 E2E **21/21**.
> - **Test isolation:** `fileParallelism: false` is set in `server/vitest.config.ts`, so API-63 briefly deactivating the seeded Administrators can't leak into another file.
> - **API, live:**
>
>   ```text
>   two Administrators deactivate each other at the same moment -> one 200, the other 401 (its session was
>                                                                  already deleted by the first); 1 active Administrator left
>   self-deactivation                                           -> 409 SELF_DEACTIVATION
>   create with "MALEE.ADMIN@toktickit.local" (case differs)    -> 409 EMAIL_IN_USE on the email field
>   IT Staff on GET /api/admin/users                            -> 403
>   ```
>
> - **Screen, real browser:**
>   - The list shows Name / Email / Role / Status / Edit, with **You** on your own row and no delete control.
>   - Search `KMUTT.AC` (mixed case) finds the 5 Requesters. A miss shows "No users match this search" with **Clear search**. Role = Administrator shows the 2 Administrators.
>   - On your own row, the Role radios and the Active switch (a proper `role="switch"`) are disabled, with the helper text and no new-password action.
>   - Creating with `ANUCHA.WONG@kmutt.ac.th` shows "Another user already has this email." under the field, linked via `aria-describedby`. A valid create, a deactivation (the row then reads Inactive), and the initial-password confirmation ("…signs the user out everywhere…") all work.
>   - The table shows at 1440 and 820 px and cards at 390 and 320 px. The panel is a 480 px right-hand drawer at 1440 px and full-screen at 390 and 320 px. There's no horizontal overflow anywhere, and 0 page errors.
> - **Mutations of my own,** 16 tried:
>   - Caught (14): the BR-48 self check; the BR-49 last-Administrator check; the `FOR UPDATE`; deleting sessions on deactivation; `mustChangePassword: true` on create; email lowercasing; the 100-character name limit; deleting sessions on a new initial password; refusing your own initial password; the role filter; the LAST_ADMINISTRATOR / SELF_DEACTIVATION callout; offering a new password on your own row; skipping the confirmation; the **You** pill.
>   - **Survived (2).** Neither is a bug; here's what each line is for:
>     - The PATCH's explicit email check → without it, the unique index raises `P2002`, and the outer `catch` gives the same `409 EMAIL_IN_USE`. It's an early, explicit answer backed by the index, and nothing observable changes.
>     - The search debounce (set to 0 ms) → there's no correctness risk, thanks to the stale-response guard. It only saves requests: typing "malee" sends five instead of one. Typing several characters and expecting one `fetchUsers` call would pin it.
>   - One side note from the mutation run: with the "refuse your own initial password" check removed, the suite reset an Administrator's own password, and its cleanup didn't restore it. That left `malee.admin` inactive, and the suite's setup failed with `No User found` until I re-seeded. It's only reachable under a broken build, but restoring the seeded Administrators in an `afterAll` (as API-63 already does in its `finally`) would make the file self-healing.
>
> ### 🟠 Needs a decision: a role change keeps ticket ownership, and the screens then mislabel it
> Demoting an IT Staff member who owns tickets to Requester leaves them as the owner. Live, with the seeded Thanakorn (owner of 3 tickets):
>
> ```text
> PATCH /api/admin/users/9 {"role":"REQUESTER"}   -> 200
> queue ?owner=9                                  -> still 3 tickets, owner shown as an ordinary active owner
> GET /api/staff/assignable-users                 -> Thanakorn no longer listed
> staff detail, owner picker                      -> "Thanakorn Rattana (inactive)"   ← he is active, just not IT Staff
> ```
>
> So a Requester now owns three tickets they can't act on, the queue gives no hint, and #58's owner picker labels anyone missing from the assignable list as "(inactive)", which is wrong here. BR-26 covers deactivation keeping ownership, but not a role change. Either answer is fine, as long as the spec says which:
> - (a) **keep ownership**, as with deactivation. Then the picker should label such an owner by what's actually true (e.g. "(not IT Staff)"), and the queue could flag it the way it flags **Inactive**; or
> - (b) **refuse the demotion** while the user owns any open ticket (`409`, "Reassign their tickets first"), which keeps BR-24's "owners are IT Staff or Administrators" true.
>
> ### 🟡 Minor (not blocking)
> - **A NUL character in a new free-text field is a `500`:** `POST /api/admin/users` with `"fullName": "Bad\u0000Name"` → `500 INTERNAL_ERROR`. This is the same class raised on #56, #57, and #58, now in brand-new input. Rather than another per-field fix, one `verify` step on `express.json()` that refuses `\u0000` (and unpaired surrogates) with `400 VALIDATION_FAILED` would close it for every body at once. Please either do that, or open the tracking issue: it has now been raised four times without one.
> - **The #58 assignee check is now reachable.** Now that deactivation exists, the owner PATCH's eligibility read (outside the ticket transaction) can race a deactivation. The end state, an inactive owner, is one BR-26 already allows, so the impact is low. Moving that read inside the transaction with `FOR SHARE` still keeps BR-24's "active at the time of assignment" exact.
> - **One code covers two refusals.** A self initial-password request returns `SELF_DEACTIVATION`, which reads oddly. Something like `SELF_PASSWORD_RESET` would let a client tell the two apart.
> - **Still open from #57:** an out-of-range `categoryId` in the `POST /api/tickets` body is still a `500` (`validation.ts`'s own `positiveInteger`).
>
> Approving, with the ownership decision to settle as a follow-up PR or in Issue 12's spec pass. Really nice work on the last-Administrator lock. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> thx kub

### [#60](https://github.com/Menelaus122/TokTickITV2/pull/60) — Add the Lab 3 E2E suites and visual inspection evidence (Issue 11)

**Verdict:** Changes requested → Approved · **merged** 2026-10-03 by @WirachatTH

**Review — Changes requested** (2026-10-03, @WirachatTH)

> Request Changes. This is a thorough evidence pass:
> - The focus-ring check fails when Tab reaches nothing, so it can't pass vacuously.
> - The visual inspection found and fixed real things (the tablet Ticket Number wrap, two raw `14px` sizes).
> - The one staged screenshot is disclosed in `tests.md` itself, not just in the PR.
>
> I cloned `feature/11-e2e-and-visual-evidence` at `70ca754` and ran everything on its own ports against a fresh migrated and seeded database.
>
> ### What I verified
> - **E2E, twice in a row on the same database:** **46/46** both times. That's 13 Lab 3 journeys + 12 responsive + 21 Lab 2, so the suites are repeatable on their own leftovers. Every E2E-created account ends inactive, as note 2 says.
> - **Client:** `tsc` 0, `vite build` succeeds, and 350 tests, with **16** in `ZenGreenLab3.test.tsx`.
> - **Screenshots:** all **81** are present, and every folder has the same set at each width (authentication 8×3, staff-queue 5×3, staff-ticket-detail 6×3, user-management 8×3). None is blank or truncated. I looked at a few:
>   - at tablet width, every Ticket Number sits on one line (your note 1 fix);
>   - the staged last-Administrator shot matches the real callout, and `tests.md` §4.1 says how it was produced.
> - **Your STYLE mutations plus mine:** an off-token asterisk colour (STYLE-04), a busy button left enabled (STYLE-06), `aria-describedby` dropped, and the message rendered above its control (STYLE-05) were each caught.
>
> ### 🔴 Must fix: a Lab 2 suite fails intermittently, and the cause isn't the E2E leftovers
> Running the server suite after the E2E runs (note 2's scenario), it failed in **2 of 3 full runs**: 15 tests, all in `tests/lab-02/create-ticket.api.test.ts`:
>
> ```text
> FAIL tests/lab-02/create-ticket.api.test.ts > GET /api/related-systems > returns the active related systems sorted by name
> AssertionError: expected 403 to be 200
> ```
>
> The cause is line 51:
>
> ```ts
> const active = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" } });
> ```
>
> It has no `orderBy` and no `mustChangePassword: false`. PostgreSQL returns rows in physical order, and that order changes every time a row is updated, because an update writes a new row version (each sign-in's `lastLoginAt`, the seed re-runs in MIG-06/MIG-09). On the database the E2E runs left, the first active Requester in physical order was `first.login@toktickit.local`:
>
> ```text
> ctid   id  email                         mustChangePassword
> (0,28)  6  first.login@toktickit.local   t        <- picked
> (0,40)  2  kanya.sris@kmutt.ac.th        f
> (0,46)  1  anucha.wong@kmutt.ac.th       f
> ```
>
> Sign-in as `first.login` succeeds, and then every request is `403 PASSWORD_CHANGE_REQUIRED`. Run alone, the same file passes 19/19, which is why it looks flaky. It isn't caused by this PR: it has been latent since Issue 6, and it's the same `related-systems` failure I saw intermittently while reviewing #56 and #58. But this issue's last criterion is "the Lab 1 and Lab 2 tests all still pass", and note 2 attributes the failures to E2E leftovers, which they aren't.
>
> → The fix is one line: `where: { isActive: true, role: "REQUESTER", mustChangePassword: false }, orderBy: { id: "asc" }`. I swept the other pickers. Every Lab 3 picker that signs in already has `mustChangePassword: false`, and the two that don't (`authorization.api.test.ts:288`, `users-admin.api.test.ts:320`) only use the id as a note author or ticket requester. So this one line closes it. Adding `orderBy: { id: "asc" }` to every `findFirst` picker would make the whole suite independent of physical order.
>
> ### 🟡 Minor (not blocking)
> - **STYLE-02 is circular.** It checks each status badge against `STATUS_LABEL[status]`, the same map it's meant to verify, so a raw label passes it. I put `"WAITING_FOR_REQUESTER"` into the map and STYLE-02 stayed green. (The full suite still catches it, through UI-09's title-case test.) Asserting the literal strings (`"Waiting for Requester"`, …) would make STYLE-02 stand on its own.
> - **`tests.md` §7 (Known limitations) leaves out the items still open from #56–#59:**
>   - a NUL character in a free-text body → `500` (comments, notes, reasons, the ticket summary, a user's name, the login email);
>   - an out-of-range `categoryId` / `relatedSystemId` in the `POST /api/tickets` body → `500`;
>   - the open decision from #59: a role demotion keeps ticket ownership, and the staff owner picker then labels that owner "(inactive)";
>   - the client's UI-07/08/09 tests timing out at the 1000 ms `findBy` limit.
>
>   Since this PR is the one that records every suite's real results, §7 is the place for them. Listing them makes "every row Pass" read honestly. There's still no tracking issue for the first two.
> - **Client flakiness, again.** Note 6 says all 350 pass with `--no-file-parallelism`, but my serial run had 1 failure. This is the fourth PR where a serial run hit it. `configure({ asyncUtilTimeout: 3000 })` in `client/tests/setup.ts` should settle it for Issue 12's final run.
>
> Fix the `create-ticket` fixture (and ideally record the open items in §7), and I'm happy to approve. Everything else here is solid. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> Thanks, you're right about the cause. Note 2 was wrong to put that failure on the E2E leftovers. Fixed in `e138835` and `35686ac`:
>
> - **🔴 `create-ticket` fixture:** the picker now requires `mustChangePassword: false`, and every `findFirst` fixture in `server/tests` orders by `id` (39 of them), so none depends on physical order. I reproduced your case by rewriting `User` with `first.login` physically first (`CLUSTER` on a temporary index, dropped afterwards). The old picker failed with the same `expected 403 to be 200`, and the fix passes 19/19. The full suite passes 385/385 on that order, and twice more after a full E2E run. `tests.md` §6 records it, and I corrected note 2 in the description.
> - **STYLE-02:** now asserts the literal words (`"Waiting for Requester"`, `"IT Staff"`, …) and that no raw enum value is shown. Your `STATUS_LABEL` mutation now fails STYLE-02 on its own.
> - **§7:** added the NUL-in-body `500` (I confirmed it on a comment and on the login email), the out-of-range `categoryId` in the `POST /api/tickets` body (`500`, confirmed), the demoted owner shown as "(inactive)", and the client navigation flakiness. Still no tracking issue for the first two; I'd suggest opening one before Issue 12.
> - **Client timeout:** I tried `asyncUtilTimeout: 3000`. Runs still failed, timing out at 3 s, and one failed in 130 ms, so it isn't only slowness and I didn't keep the change. It's recorded in §7 with that evidence for Issue 12.
>
> E2E 46/46, then server 385/385 (twice) on the database it leaves; client 350/350 in 7 of 8 serial runs.

**Review — Approved** (2026-10-03, @WirachatTH)

> Approved! Thanks for reproducing it rather than just patching it! I cloned `feature/11-e2e-and-visual-evidence` at `35686ac` and checked the fix the same way you did, by forcing the bad order on purpose.
>
> ### 🔴 The `create-ticket` fixture — fixed
> On a fresh database I `CLUSTER`ed `User` on a temporary expression index, so `first.login@toktickit.local` became the first active Requester in physical order:
>
> ```text
> old picker (70ca754's create-ticket.api.test.ts)  -> 15 failed | 4 passed — "expected 403 to be 200", the same failure as before
> new picker (35686ac)                              -> 19/19
> full server suite on that same order              -> 385/385
> ```
>
> Then the scenario where it first showed up, on the database the E2E runs leave behind:
>
> ```text
> E2E (all suites)                -> 46/46
> server suite after it, 3 runs   -> 385/385, 385/385, 385/385   (2 of 3 failed before the fix)
> ```
>
> I also swept for anything still order-dependent. Every user, category, related-system, and ticket `findFirst` fixture is now ordered (the multi-line ones carry `orderBy` on a later line), so the whole suite is independent of physical order, not just this one file.
>
> ### 🟡 Last round's minor points
> - **STYLE-02:** I put `"WAITING_FOR_REQUESTER"` back into `STATUS_LABEL`, and STYLE-02 now fails on its own (`spells out every status…`). The literal words plus the "no raw enum" check are exactly right.
> - **`tests.md` §7:** the four rows (NUL in body text, out-of-range body ids, demoted owners shown as "(inactive)", and the client navigation flake) are accurate and specific. The fixture note in §6 is honest about what went wrong. Thanks for correcting note 2 as well.
> - **Client timeout:** good evidence that `asyncUtilTimeout` isn't the answer: a failure at 130 ms means it isn't just slowness. My runs agree with your §7 row: 350/350 in one serial run, 1 failure in the other.
>
> ### Your numbers reproduce
> - server **385/385**, including on the forced first-login order and three times after E2E;
> - E2E **46/46**;
> - client `tsc` 0, and 350 tests (passing apart from the documented flake);
> - STYLE-02 still has **16** tests in the file.
>
> ### Small notes (not blocking, no need for another round)
> - **One leftover unordered pick:** `my-tickets.api.test.ts:44` takes `findMany({ where: { isActive: true }, take: 2 })` categories with no `orderBy`. It's harmless today, because the test only needs two different active categories, but `orderBy: { id: "asc" }` would make it match the rest of the sweep.
> - **Please open the tracking issue now.** §7 is the right record, but two of its rows (NUL in body text, and out-of-range body ids) are real `500`s in shipped code and have no issue. One small "Close the remaining body-input 500s" issue would let Issue 12 point at it rather than carry them in prose.
>
> Approving. Nice root-causing, and thanks for verifying it so carefully. 🙌
> Wirachat 67070501041

**Author's response** (2026-10-03, @Menelaus122)

> thx kub

### [#61](https://github.com/Menelaus122/TokTickITV2/pull/61) — Lab 3 delivery: peer review record, AI use, README, and audit fixes (Issue 12)

**Verdict:** Approved · **merged** 2026-10-04 by @WirachatTH

**Review — Approved** (2026-10-04, @WirachatTH)

> Approved! This is a careful delivery. The audit runs in both directions (labsheet → evidence, and contract → code). The layout bug it found came with a test that fails without the fix. And the review record promises it can be checked against GitHub, so I checked it. I cloned `docs/lab3-final-delivery` at `2ab9e3e` and ran everything on its own ports against a fresh migrated and seeded database.
>
> ### What I verified
> - **`reviewer.md` against GitHub, mechanically.** I pulled every review, PR comment, and inline comment through the API for all 23 PRs (your 13, and my 10 in WirachatTH/toktickit). Then I checked that each body appears in the file word for word, ignoring only whitespace and the `> ` blockquote markers:
>   - **65 of 67** non-empty bodies match exactly (the two that don't are below);
>   - both summary tables match GitHub: every review sequence, and every merge made by the other partner (yours by @WirachatTH, mine by @Menelaus122);
>   - "7 of them needed at least one round of Changes requested" is correct (#46, #50, #52, #53, #54, #57, #60).
> - **The audit's numbers hold:**
>   - **routes:** 30 method + path pairs in `app.ts` / `auth.ts` / `conversation.ts` / `staff.ts` / `admin.ts`, and 30 in api-spec §7 (four of its rows list `GET` `POST` together). No route is missing on either side;
>   - **`tests.md`:** 159 ID rows, all **Pass** (your "149" is that figure without the 10 E2E rows). Every ID appears in a test file except **MIG-05**, which by design names whole suites;
>   - **AC-01 – AC-40:** every one is traced to at least one row.
> - **The layout fix is guarded.** With your widths, RESP-03 passes 3/3. With `lab3-staging`'s widths put back, it fails at desktop and tablet with "status badges spilling out of their cell". Mobile, which uses cards, still passes.
> - **README and `.gitignore`:**
>   - every `npm run …` the README gives exists in the matching `package.json`;
>   - all **81** Lab 3 screenshots stay tracked, as do Lab 2's;
>   - `test-results/` and `docs/lab-03/*.docx` are ignored.
> - **`ai-use.md`:** names the models, and gives nine prompts quoted as typed (inside the 6–10 the labsheet asks for), each with what came of it, followed by the reflection.
> - **Your numbers reproduce, in your order:**
>   - E2E **46/46**;
>   - then the server suite on the database E2E left: **385/385** (26 files);
>   - client serial **350/350** (18 files);
>   - `tsc --noEmit` exits 0 on both packages, and `vite build` succeeds.
>
> ### 🟡 Minor (not blocking)
> - **Two quotes aren't verbatim.** The record says "Every comment and response below is quoted exactly as it appears on GitHub", but in two of my reviews the text `\u0000` became `\^@`. The escape was turned into a real NUL character somewhere in the copy step, then printed in caret notation:
>   - `reviewer.md:1013` (my #56 review): "A NUL character (`` `\^@` ``) or a lone surrogate…" — on GitHub it's `` `\u0000` ``;
>   - `reviewer.md:1340` (my #59 review): `"fullName": "Bad\^@Name"` — on GitHub it's `"Bad\u0000Name"`.
>
>   Changing those two back makes all 67 exact. (Fittingly, it's the NUL bug, in the record of the NUL bug.)
> - **The unticked criteria are fine as they are.** The release PR, the board, and the PDF depend on this merge, and the first row waits on my Issues 10–12 PRs. That's honest, and it's the right state for a delivery PR.
> - **Still worth doing before the release PR:** the two `500`s recorded in `tests.md` §7 (NUL in body text, and an out-of-range body `categoryId`) still have no tracking issue. One small issue would let the release notes link to it rather than leave the record only in prose.
>
> Approving. Thanks for a delivery that can actually be checked. 🙏
> Wirachat 67070501041

**Author's response** (2026-10-04, @Menelaus122)

> thx kub

## Pull Requests I reviewed for my partner

Partner repository: [WirachatTH/toktickit](https://github.com/WirachatTH/toktickit) · integration branch `lab3-staging`

| PR | Branch | Review rounds | Merged by |
| :--- | :--- | :--- | :--- |
| [#51](https://github.com/WirachatTH/toktickit/pull/51) | `feature/1-sprint3-contract` | Changes requested → Approved | @Menelaus122 |
| [#52](https://github.com/WirachatTH/toktickit/pull/52) | `feature/2-user-model-migration` | Changes requested → Approved | @Menelaus122 |
| [#53](https://github.com/WirachatTH/toktickit/pull/53) | `feature/3-authentication` | Approved | @Menelaus122 |
| [#54](https://github.com/WirachatTH/toktickit/pull/54) | `feature/4-authorization-shell` | Approved | @Menelaus122 |
| [#55](https://github.com/WirachatTH/toktickit/pull/55) | `feature/5-requester-regression` | Changes requested → Approved | @Menelaus122 |
| [#56](https://github.com/WirachatTH/toktickit/pull/56) | `feature/6-comments-notes` | Approved | @Menelaus122 |
| [#57](https://github.com/WirachatTH/toktickit/pull/57) | `feature/7-staff-queue` | Changes requested → Approved | @Menelaus122 |
| [#58](https://github.com/WirachatTH/toktickit/pull/58) | `feature/8-staff-ticket-detail` | Approved | @Menelaus122 |
| [#59](https://github.com/WirachatTH/toktickit/pull/59) | `feature/8-follow-up` | Changes requested → Approved | @Menelaus122 |
| [#60](https://github.com/WirachatTH/toktickit/pull/60) | `feature/9-user-administration` | Approved | @Menelaus122 |
| [#61](https://github.com/WirachatTH/toktickit/pull/61) | `feature/10-responsive-e2e-qa` | Approved | @Menelaus122 |
| [#62](https://github.com/WirachatTH/toktickit/pull/62) | `feature/follow-up-59-60` | Approved | @Menelaus122 |

I merged all 12 after approving, as the author should not merge their own Pull Request.
5 of the 12 needed a round of **Changes requested** first; each was re-reviewed and
approved once the fixes landed on the same branch.

### [#51](https://github.com/WirachatTH/toktickit/pull/51) — Issue 1: Sprint 3 Specification & Test Plan (Spec DD)

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @Menelaus122

**Review — Changes requested** (2026-10-01, @Menelaus122)

> ## Verdict: Request change
> Really solid contract. The role × operation matrix, the status-transition matrix and the AC → test traceability make this easy to build against, and the Review Contract pass already caught real issues (the dead `NEW → OPEN` transition, the last-Administrator race).
>
> I checked the four docs against the current code on `lab3-staging` and found some things that will cause problems once Issue 2+ starts. I'm requesting changes mainly for the first group, because those break tests that pass today or make planned tests impossible to pass.
>
> ## 🔴 Must fix: breaks existing tests or makes planned tests unpassable
>
> **1. E2E can't sign in under D-11** (`specification.md:614`)
> D-11 assumes the client and API are same-site (`localhost:5173` and `localhost:3000`). That holds for local dev, but not for the Docker E2E setup: `client/playwright.config.ts` serves the app at `http://localhost:5174` with `VITE_API_URL=http://server:3000`. That's cross-site, so the browser drops the `SameSite=Strict` cookie. On top of that, `Origin: http://localhost:5174` isn't in the default `CLIENT_ORIGINS`, so login gets `403 FORBIDDEN_ORIGIN`. E2E-01 to E2E-11 and the migrated Lab 2 journey can't authenticate.
> → Suggestion: add a Vite dev proxy for `/api` so the browser only ever talks to one origin (the cookie and the Origin check then both just work), and describe the E2E topology in D-11.
>
> **2. BR-68 carries forward Lab 2 BR-46, which forbids comments** (`specification.md:307`)
> BR-68 keeps Lab 2 BR-01 to BR-46 "except those about the selector", but Lab 2 BR-46 says Ticket Detail never renders a comment box. `client/tests/lab-02/RequesterTicketDetail.test.tsx:79-89` asserts exactly that (`queryByRole("textbox", { name: /comment/i })` must be absent). The Lab 3 Requester detail adds "Add a comment", so this test fails. BR-69 and AC-18 ("Lab 2 tests keep their assertions") can't both hold.
> → Suggestion: list BR-46 as superseded by FR-14/FR-15 in BR-68, and mark that test as rewritten in the REG rows.
>
> **3. D-18 breaks Lab 1** (`specification.md:621`)
> "Nothing in Lab 3 needs them before login" doesn't hold: Lab 1's public System Status page at `/` calls `GET /api/categories` without a session, so "Check System" would show "Offline". Also, `server/tests/lab-01/categories.test.ts:12-13` expects `200`. That breaks the DoD item "All Lab 1 and Lab 2 behaviour tests pass", and REG-08 only covers Lab 2.
> → Suggestion: give the status page a public health endpoint (or keep categories public), and add a REG row plus an owning issue for the Lab 1 changes.
>
> **4. The migration will fail its own drift check (MIG-05)** (`specification.md:423`)
> Step 3 adds `User.updatedAt` with `DEFAULT now()`, but Prisma's `@updatedAt` columns have no DB default (compare Lab 2's `Ticket."updatedAt"`). `prisma migrate diff` will output `ALTER COLUMN "updatedAt" DROP DEFAULT`, and MIG-05 fails.
> → Suggestion: add `DROP DEFAULT` after the backfill, or declare `@default(now()) @updatedAt` in the schema.
>
> **5. Several tests can't pass on the shared dev database** (`tests.md:174`, `tests.md:187`)
> All tests run against one shared Postgres (`server/vitest.config.ts`, with no per-test isolation), but:
> - **API-70:** two seeded active Administrators already exist. When the test's Admins A and B deactivate each other, the active count goes from 4 to 2 and both requests succeed, so the expected single `409 LAST_ADMINISTRATOR` never happens. Forcing it would mean deactivating the seeded Admins, which breaks E2E sign-in (D-19).
> - **MIG-06:** changes a seeded user's password, role and activation. The seed never restores them (BR-78), so the README credentials stop working after one `npm test`.
> - **MIG-01:** can't "apply Lab 2 migrations, insert data, apply Lab 3" on a database that's already migrated.
> - **MIG-07:** the exact count ("2 active Administrators") drifts as API-62 and API-70 leave users behind.
>
> → Suggestion: run the migration/seed tests and API-70 against a throwaway database or schema created per run, and say so in `tests.md`.
>
> **6. API-11 contradicts itself** (`tests.md:61`)
> It calls change-password and logout *before* tickets, categories and the queue. A successful change-password clears `mustChangePassword`, so the later calls return 200. Logout deletes the session, so the later calls return 401. Either way, the expected `403 PASSWORD_CHANGE_REQUIRED` can never be observed.
> → Suggestion: check the blocked routes first, then `/me`, then change-password, then logout.
>
> **7. MIG-03 and MIG-08 are assigned to the wrong issue** (`tests.md:324`)
> Both log in, but the login endpoint isn't built until Issue 3. Under the "tests green before PR" rule, Issue 2 can't merge.
> → Suggestion: move them to Issue 3, or have Issue 2 check the seeded rows directly in the DB.
>
> **8. `.gitignore` ignores files that are already tracked** (`.gitignore:22`)
> `artifacts/lab-02/screenshots/` contains 68 tracked PNGs that `docs/lab-02/ui-spec.md` cites as evidence. Ignoring a folder doesn't untrack what's already in it, so every E2E run dirties the tree, while any *new* screenshot is silently never committed.
> → Suggestion: either drop this rule, or `git rm --cached` the folder and update the Lab 2 doc references. Minor: dropping the root `test.md` / `plan.md` / `issues.md` / `Lab_02_labsheet.md` rules means anyone who still has those at the root will commit them with `git add -A`, so it might be worth keeping them alongside `private/`.
>
> ## 🟠 Should fix: spec gaps that will turn into bugs
>
> **9. The stale-state checks only compare one field** (`specification.md:236`)
> `expectedOwnerId` (BR-31) and `expectedStatus` (BR-43) each guard only the field being changed, so concurrent owner and status changes can break BR-36, BR-37 and BR-42:
> - A claims a `NEW` ticket (`expectedOwnerId=null`) while B cancels it. If the cancel commits first, the claim's owner check still passes and BR-32 sets the status to `OPEN`, so a `CANCELLED` ticket comes back.
> - A unassigns an `OPEN` ticket while B moves it to `IN_PROGRESS`. Each check passes, and the result is an `IN_PROGRESS` ticket with no owner.
>
> → Suggestion: use one version/`updatedAt` check for both operations, or require both `expectedOwnerId` and `expectedStatus` on each.
>
> **10. BR-60 and BR-29 can race** (`specification.md:291`)
> Demoting a user to REQUESTER (BR-60 checks they own no open tickets) and assigning a ticket to them (BR-29 checks their role) run with no lock, unlike BR-58. Both can commit, leaving a REQUESTER who owns an `IN_PROGRESS` ticket. API-71 only tests the sequential case.
> → Suggestion: lock the target user row (`SELECT … FOR UPDATE`) in both paths, as BR-58 does.
>
> **11. The default queue order can't round-trip** (`api-spec.md:289`)
> The default order is `itPriority desc, createdAt asc, id asc`, but `appliedQuery` echoes it as `sort=itPriority&order=desc`, which means `itPriority desc, id desc`. The UI rebuilds the URL from `appliedQuery` (ui-spec §6.1), so page 2 is sorted differently from page 1 and tickets repeat or get skipped (against BR-64). Picking "Priority — default" in the Sort select changes the order too.
> → Suggestion: make `sort=itPriority&order=desc` *define* those tiebreakers, or echo something like `sort=default`.
>
> **12. Administrators can't fill the Owner filter** (`ui-spec.md:203`)
> The queue's Owner filter lists "each assignable user", and Admins get the "identical table". But `GET /api/staff/assignable-users` is IT-Staff-only (BR-20, api-spec §5.3), and SEC-02 requires it to return 403 for Admins.
> → Suggestion: either let Admins read that endpoint, or specify a different source for the Admin view.
>
> **13. The status handler's check order contradicts BR-22** (`api-spec.md:398`)
> The handler checks STALE_STATE, then INVALID_TRANSITION, then OWNER_REQUIRED, then field validation. BR-22 and §0.3 say validation (400) comes before business rules (409). As written, a missing `expectedStatus` returns `409 STALE_STATE` instead of the documented 400, and a 3-character `resolutionSummary` on an invalid transition returns 409 instead of 400.
> → Suggestion: move field validation to the front.
>
> ## 🟡 Worth considering
>
> **14. The login throttle allows targeted lockout** (`specification.md:187`, BR-14 / D-12)
> The throttle is keyed only by email and stored in an unbounded in-memory map. Anyone can send 5 bad passwords for an Admin's email every 15 minutes and keep the real Admin locked out indefinitely, and a flood of random emails grows the map with no eviction. That may be fine for a lab, but it's worth a line in §11. Alternatively, key by email + IP and cap the map size.
>
> ---
>
> Overall the structure is great, and most of these are wording or ordering fixes rather than redesigns. 1–8 are the ones I'd like changed before Issue 2 starts. 🙏

**Author's response** (2026-10-01, @WirachatTH)

> Thanks for the thorough review! All 14 points held up when I checked them against the code, and they're all fixed in `16302a1`.
>
> **🔴 Must fix (1–8)**
> - **E2E sign-in:** the browser now calls same-origin `/api` through a Vite proxy, so the cookie works in local dev and in the Docker E2E setup. Both dev origins are allowed (D-11).
> - **Lab 2 BR-46:** BR-68 now lists every Lab 2 rule Lab 3 supersedes, and BR-69 allows tests of those rules to be rewritten (REG-14 to REG-16).
> - **Lab 1:** health, categories, and systems stay public (D-18).
> - **Migration drift:** the `updatedAt` default is dropped. I also renamed the sequence and dropped the old index, and drift is now checked against a throwaway schema (MIG-05).
> - **Shared database:** the migration/seed tests and API-70 run in a throwaway schema (D-22). API-11 is reordered, and MIG-03/MIG-08 now check stored rows instead of logging in.
> - **`.gitignore`:** the tracked screenshot folder is no longer ignored. I left the old root-level filenames out on purpose.
>
> **🟠 Should fix (9–13)**
> - Ticket changes now require both the expected owner and status, under ticket-row and user-row locks (BR-80, BR-81), with race tests API-74 to API-77.
> - Every sort has one fixed full key, so `appliedQuery` round-trips (API-79).
> - Administrators can read the assignable-owner list.
> - The status route validates before any `409`.
>
> **🟡 Worth considering (14)**
> - The login throttle is now keyed by email + IP, with a per-IP ceiling and a capped store (BR-14, D-12).
>
> **Now:** BR 81, D 22, 182 planned tests, all 44 ACs traced, and no broken tables. The PR description is updated, and issues #41–#48 note where this moved work between issues.
>
> Ready for another look. 🙏

**Review — Changes requested** (2026-10-01, @Menelaus122)

> ## Round 2: re-review of `16302a1` Verdict: Request Change
>
> Thanks for the quick turnaround! I went through the diff since round 1 and checked each fix against the code on `lab3-staging`. Every point is addressed. The Vite proxy (D-11), the fixed sort keys (BR-64), the ticket-row locks (BR-80) and the throwaway-schema isolation (D-22) are all really clean.
>
> Two of the fixes introduced new problems that would make planned tests fail, so one more small round:
>
> ### 🔴 1. BR-58 + BR-81 can deadlock (`specification.md:289`, `:328`)
> BR-81 says a role or activation change locks the **target user's row first**, and BR-58 then locks **all active Administrator rows**. Two such changes running at once take the user-row locks in different orders:
> - Admin A deactivates B: locks B, then wants {A, B}
> - Admin B deactivates A: locks A, then wants {A, B}
>
> Each waits on the other. PostgreSQL aborts one with a deadlock error (`40P01`), and that request returns `500 INTERNAL_ERROR`. So API-70 gets one `200` and one `500` instead of one `200` and one `409 LAST_ADMINISTRATOR`. It isn't only the mutual case: any two concurrent changes to two different Administrators can deadlock the same way. BR-81's "ticket first, then user" covers ticket ↔ user ordering, but not user ↔ user.
>
> → Suggestion: when BR-58 applies, lock the target and all active Administrator rows in **one** statement ordered by id (`SELECT … WHERE id = $target OR (role = 'ADMINISTRATOR' AND "isActive") ORDER BY id FOR UPDATE`). Then add "several user rows are always locked in ascending id order" to BR-81.
>
> ### 🔴 2. The per-IP login ceiling trips its own tests (BR-14 at `specification.md:187`, D-12, `tests.md:60-64`)
> Every Supertest request comes from the same address (`127.0.0.1`), and the in-memory throttle store lives for the whole test file. The planned tests in `auth.api.test.ts` add up:
> - API-03 (2 failures) + API-04 (1) + API-05 (1) + API-06 (10) = 14
> - API-07's "4 failures, a success, 4 more" brings that to 22. A success clears only the email + IP pair, not the IP count, so the 21st failure returns `429` where API-07 expects no throttling.
>
> It's the same outside the tests. As `tests.md` §7 already says, every browser behind the Vite proxy shares one IP, so the 20-per-IP ceiling is effectively **global**: 20 typos from anyone in 15 minutes and nobody can sign in, E2E runs included. Also, with `TRUST_PROXY=loopback`, anything reaching Express from localhost can set its own `X-Forwarded-For`, so rotating that header gets around the per-pair limit entirely. Finally, Vite's proxy only adds `X-Forwarded-For` when `xfwd: true` is set (checked in Vite 6.4's bundled http-proxy), so D-12's "which forwards `X-Forwarded-For`" isn't true by default.
>
> Honestly, my round-1 suggestion to key by email + IP doesn't fit this single-machine setup. Sorry about that!
>
> → Suggestion (simplest): go back to email-only keying and keep the capped store. Drop the per-IP ceiling and `TRUST_PROXY`, and list targeted lockout as a known lab limitation in §11. Either way, give the tests a clean start: a `resetLoginThrottle()` in `beforeEach`, or a unique email per test.
>
> ### Minor
> - **BR-68** now excludes Lab 2 BR-47 and BR-48, but its range still reads "Lab 2 BR-01 to BR-46". It should say BR-01 to BR-48.
> - **API-70 in a throwaway schema** needs the Express app to use that schema. But `getPrisma()` (`server/src/prisma.ts`) is a singleton built from `DATABASE_URL` on first use, and API-70 sits in `users-admin.api.test.ts` next to tests that use the dev database. Giving API-70 its own file that sets `DATABASE_URL` before the first request would work (Vitest isolates modules per file). It's worth a line in the "Test isolation (D-22)" note in `tests.md`.
>
> Everything else looks good to me. Once 1 and 2 are sorted, I'm happy to approve. 🙏

**Author's response** (2026-10-01, @WirachatTH)

> Thanks again! Both findings and both minors checked out, and they're fixed in `fc474f5`.
>
> **🔴 1. BR-58 + BR-81 deadlock:** BR-81 is now one lock order for the whole system. Tickets are always locked before users, and several user rows are only ever locked in **one** statement in ascending `id` order. A change to an active Administrator locks the target and every active Administrator together, as you suggested (`… WHERE id = $target OR (role = 'ADMINISTRATOR' AND "isActive") ORDER BY id FOR UPDATE`). API-70 now expects one `200` and one `409`, never a `500`, and the new API-82 runs concurrent changes to two different Administrators.
>
> **🔴 2. Login throttle:** you were right that email + IP doesn't fit a single machine behind one proxy, and the per-IP ceiling was my own over-extension. It's back to email-only keying with the capped store. The per-IP ceiling, `TRUST_PROXY`, and the `X-Forwarded-For` claim are gone (good catch on `xfwd` — I confirmed it in the installed Vite 6.4.3). Targeted lockout is now a documented lab limitation in D-12. `auth.api.test.ts` resets the throttle in `beforeEach`, and E2E-03 uses per-run accounts so repeated runs can't throttle a shared one.
>
> **Minor:** BR-68 now reads Lab 2 BR-01 to BR-48. API-70 (with API-82) moved to its own `last-administrator.api.test.ts`, which points `DATABASE_URL` at the throwaway schema before the app is imported; D-22 explains why. While there, I also fixed D-22's stale "MIG-01 to MIG-08" to MIG-01 to MIG-09.
>
> The four docs still check out: 183 planned tests, all 44 ACs traced, no gaps in the numbering, and no broken tables. The PR description and issues #42 and #48 are updated to match.
>
> Ready for another look. 🙏

**Review — Approved** (2026-10-01, @Menelaus122)

> ## Round 3: re-review of `fc474f5` Verdict: Approved✅
>
> Checked the round-2 diff. Both findings and both minors are resolved:
>
> - **Deadlock (BR-81):** the single system-wide lock order is sound. Tickets are locked before users. Several user rows are locked in one statement, ordered by the `id`, which never changes. The role-change path only *reads* ticket counts, so it never waits on a ticket lock. In the API-70 race, the second transaction re-reads the Administrator rows after the first commits and gets `409 LAST_ADMINISTRATOR` instead of a deadlock. API-82 covers the case with two different targets.
> - **Login throttle:** email-only keying, the capped store, `resetLoginThrottle()` in `beforeEach`, and per-run accounts for E2E-03 all line up. No references to `TRUST_PROXY`, the per-IP ceiling or `X-Forwarded-For` are left anywhere in the docs. The new D-12 rationale explains the trade-off well.
> - **BR-68** range, the separate `last-administrator.api.test.ts` file, and D-22's MIG range are all fixed.
>
> Optional nits, not blocking:
> - D-22 and the "Test isolation" note list only API-70 as running in the throwaway schema. API-82 does too, since it uses the same file and schema. It's worth naming for completeness.
> - Each API-82 repetition deactivates two Administrators, so every round needs fresh Administrators (or C and D reactivated) to start again from four.
>
> Great work on this contract. Approving. 🚀

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the approval, and for three careful rounds on the contract!

### [#52](https://github.com/WirachatTH/toktickit/pull/52) — Issue 2: User Model, Lab 2 Migration & Seed

**Verdict:** Changes requested → Approved · **merged** 2026-10-01 by @Menelaus122

**Review — Changes requested** (2026-10-01, @Menelaus122)

> ## Verdict: Request changes
>
> Great work on this one. The migration is careful and well documented, and the mutation-testing table is a nice touch. I checked it against Issue #41's acceptance criteria by running the PR in an isolated scratch database (not the dev DB). One required test is missing, so I'm requesting changes. Everything else passes.
>
> ### What I verified
> - **Migration on real Lab 2 data:** applied the Lab 2 migrations, inserted users/tickets/a soft-removed attachment, then applied your migration. Ids, `requesterId` bindings, the attachment, the `itPriority` backfill, and email trimming/lowercasing all came through correctly.
> - **Drift:** `prisma migrate diff --from-url … --to-schema-datamodel … --exit-code` reports "No difference detected".
> - **Seed:** run twice, counts unchanged. 6 active + 1 inactive Requesters, 3 active + 1 inactive IT Staff, 2 Administrators; all 8 statuses and 3 priorities; assigned and unassigned tickets; no sensitive content in comments or notes.
> - **`migrate reset` + seed from empty:** succeeds.
> - **Tests:** `npm test` in the Linux server container gives 164/164 passing, and `tsc --noEmit` is clean.
> - **No plaintext passwords:** 0 hits for the documented password or any non-`scrypt$` hash.
> - **`RequesterUser` retired:** only mentioned in explanatory comments.
>
> ### 🔴 Must fix
> **No test for "duplicate email rejected at DB level"**
> Issue #41 lists this explicitly under "Tests verify". Nothing in `migration-seed.test.ts`, `data-model.test.ts` or the other new tests asserts it. The constraint itself is fine: I inserted a duplicate email and got `duplicate key value violates unique constraint "User_email_key"`. It just isn't covered.
> → Add one test (for example in `data-model.test.ts`) that creates a `User`, then creates a second one with the same email and expects a unique-constraint rejection (Prisma `P2002`). Please also add its row to `docs/lab-03/tests.md`.
>
> ### 🟡 Minor, not blocking
> - On native Windows with Node 24, `MIG-01`..`MIG-05` fail with `spawnSync …\prisma.cmd EINVAL`, because `runPrisma` in `server/tests/lab-03/helpers/throwawaySchema.ts` calls `execFileSync` on a `.cmd` file, which newer Node versions refuse. It works in Docker, which the helper's own error message points to, so this is low priority. `shell: true` on `win32` would fix it.
>
> Once the duplicate-email test is in, I'm happy to approve. 🙏

**Author's response** (2026-10-01, @WirachatTH)

> I will fix it ASAP krub.

**Author's response** (2026-10-01, @WirachatTH)

> I have fixed it according to your requests!

**Review — Approved** (2026-10-01, @Menelaus122)

> ## Verdict: Approved ✅
>
> Re-checked `8453d1a`. The required change is done, and the Windows note is fixed too.
>
> - **MIG-10 (duplicate email):** asserts Prisma `P2002` on `User_email_key` and that exactly one row exists. The test plan has the row and the totals are updated.
> - **MIG-11 (role enum):** a nice extra. Raw SQL with `'SUPERUSER'` is refused by the database enum, and the enum is checked to hold exactly the three roles.
> - **Windows fix:** running the Prisma CLI through `process.execPath` is better than `shell: true`, since URLs never go through cmd.exe parsing.
>
> I ran it on a fresh scratch database (`migrate reset` + seed): 166/166 tests pass natively on Windows, including MIG-01 to MIG-11, and `tsc --noEmit` is clean.
>
> Nice work. 🚀

**Review — Approved** (2026-10-01, @Menelaus122)

> *(no written comment)*

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving, and for testing the migration in a scratch database!

### [#53](https://github.com/WirachatTH/toktickit/pull/53) — Issue 3: Authentication Foundation

**Verdict:** Approved · **merged** 2026-10-01 by @Menelaus122

**Review — Approved** (2026-10-01, @Menelaus122)

> ## Verdict: Approved ✅
>
> Excellent work. The reserve-before-await throttle, the dummy-hash timing protection and the fail-closed must-change gate are all well thought out. I checked this against Issue #42's acceptance criteria by running the branch in an isolated worktree and scratch database (not the dev DB).
>
> ### What I verified
> - **Server tests:** 208/208 pass, and `tsc --noEmit` is clean.
> - **Client tests:** 134/134 pass, and `tsc --noEmit` is clean.
> - **Live probes against the real server:**
>   - Login sets `tt_session` with `HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`, and the response is `Cache-Control: no-store` with no hash in the body.
>   - Wrong password, unknown email and inactive account with a wrong password all give the same `401`, at about 58 ms each. An inactive account with the correct password gives `403 ACCOUNT_INACTIVE`.
>   - The throttle gives `429` with `Retry-After: 900` on the 6th attempt, for real and unknown emails alike. A padded, upper-case email shares the same key.
>   - Must-change gate: `/api/tickets`, `/api/tickets/`, `//tickets`, `%74ickets`, `HEAD /api/auth/me`, `/api/auth/me/`, staff and requester routes all return `403 PASSWORD_CHANGE_REQUIRED`. Only `/me`, change-password and logout work.
>   - Change password: 9 characters, no digit, no letter, 129 characters, same as current and a wrong current password each give the right field error. A Thai password is accepted. After the change, the user's other session returns `401` and the current one stays valid.
>   - Logout: the cookie returns `401` afterwards.
> - **Mutation spot-check:** removing the in-flight reservation in `loginThrottle.ts` makes API-83 and UNIT-06 fail, as the PR claims.
>
> All eight acceptance criteria are met.
>
> ### 🟡 Optional, not blocking
> 1. **Change Password has no rate limit.** Someone holding a stolen or unattended session could guess the current password without limit. A small per-user failure limit (or a short delay on failure) would close that.
> 2. **Malformed JSON returns Express's default HTML error page** (`<!DOCTYPE html>… SyntaxError …`) instead of the JSON error envelope. This was already the case before this PR, but login and change-password now go through it. A small JSON error handler would fix it, either here or in Issue 4.
> 3. **Lab 2's `X-Dev-Requester-Id` still works without a session.** As `first.login` (must-change), `GET /api/tickets` with that header returns `200`. The PR lists this as interim until Issue 5, so please make sure Issue 5 explicitly removes it.
> 4. **Two small client details:**
>    - On a hard refresh, a must-change user can see a route briefly before the redirect, because `PasswordChangeGate` runs while `status` is still `"loading"`.
>    - In `ChangePassword.tsx`, `handleLogOut` doesn't catch `signOut()`. If the logout request fails, `signOut` rethrows and the rejection is unhandled.
>
> Nice work. 🚀
> .md

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the approval and for running it in an isolated work-tree. Glad the throttle and the must-change gate held up!

### [#54](https://github.com/WirachatTH/toktickit/pull/54) — Issue 4: Authorization Layer & Role-Based App Shell

**Verdict:** Approved · **merged** 2026-10-01 by @Menelaus122

**Review — Approved** (2026-10-01, @Menelaus122)

> ## Verdict: Approved ✅ (one note I'd like closed in this PR or in Issue 5)
>
> Strong work. A single policy table, a fail-closed `404` for anything unlisted, and the body parsed only after the role check are exactly the right shape. I checked this against Issue #43's acceptance criteria by running the branch in an isolated worktree and scratch database (not the dev DB).
>
> ### What I verified
> - **Server tests:** 224/224 pass, `tsc --noEmit` clean.
> - **Client tests:** 153/153 pass, `tsc --noEmit` clean.
> - **Completeness:** all 15 routes registered in `app.ts` and `auth.ts` have a policy, and 15 more are pre-guarded for later issues. There is no `app.all`, wildcard or extra router.
> - **Live probes against the real server** (requester, staff and admin sessions):
>   - No session, a forged cookie, or `X-Dev-Requester-Id` alone: `401`. The header combined with a staff cookie does not escalate.
>   - Wrong role gets `403` with the bare envelope on every requester, staff and admin route. Internal notes for a requester give an identical `403` for an own, a foreign and a missing ticket.
>   - A foreign ticket, attachment metadata and attachment upload give `404`, identical to a missing ticket.
>   - `/api/tickets`, `/api/tickets/`, `/API/TICKETS`, `/api/Tickets/1` and `?x=1` stay `403` for staff.
>   - `PUT`/`DELETE` and unknown paths give `404`. `HEAD` without a session gives `401`.
>   - Origin guard: a foreign origin, `Origin: null` and `http://localhost:5173/` (trailing slash) are refused on login, create and logout. `:5174` is allowed and a `GET` is never blocked.
>   - CORS preflight from the allowed origin returns `204` with credentials. An evil origin gets no `Access-Control-Allow-Origin`.
>   - Guard order: a malformed JSON body gives `401` signed out, `403` for the wrong role, and `400 VALIDATION_ERROR` as JSON (no HTML) for an allowed caller. A 200 KB body gives `413`.
> - **Mutation spot-check:** removing the role check fails SEC-02, SEC-04, SEC-07 and SEC-08. Accepting `Origin: null` fails SEC-06. This matches your table.
>
> Every acceptance criterion is met, and the two issues from my Issue 3 review (HTML error page for bad JSON, flash before the redirect) are fixed here. Nice.
>
> ### 🟠 One note: `GET /api/requesters` is still public
> Unauthenticated `curl localhost:3000/api/requesters` returns every active Requester's name and email. The api-spec note calls this interim, but:
> - it contradicts D-18 ("Every other endpoint requires a session") and FR-13;
> - it hands an anonymous caller a list of valid login emails, which weakens the BR-12 non-enumeration work and gives a target list for the per-email lockout (D-12);
> - nothing needs it any more: no routed screen calls it now that the selector is off every path.
>
> → Suggestion: either require a session for it (`roles(R, S, A)`) or delete the route and retire `requesters.api.test.ts` now, since SEC-10 already says `404`. That is a one-line policy change plus one test. If you prefer to leave it for Issue 5, please say so in that issue's checklist so it can't be forgotten.
>
> ### Not covered
> I did not run the Lab 2 Playwright E2E journey (it needs the Docker Playwright setup), so that claim in the description is unverified by me. I also did not stop the database to repeat the "DB down gives 500" check, because the scratch database shares a container with the dev one.
>
> Nice work. 🚀

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving! Your note was closed in Issue 5 as agreed!

### [#55](https://github.com/WirachatTH/toktickit/pull/55) — Issue 5: Requester Regression on Authenticated Identity

**Verdict:** Changes requested → Approved · **merged** 2026-10-02 by @Menelaus122

**Review — Changes requested** (2026-10-02, @Menelaus122)

> Review: changes requested
>
> Thanks for this PR. I found one blocking bug.
>
> 🔴 Session cookie isn't sent on Requester API calls (client/src/api.ts)
>
> This PR removes the X-Dev-Requester-Id header from the Requester calls and relies on the session cookie to identify the user. None of those calls set credentials: "include", so the browser won't attach the cookie.
>
> Affected calls:
> - createTicket (line 171)
> - fetchTickets (line 236)
> - fetchTicket (line 286)
> - addAttachmentToTicket (line 295)
> - removeAttachment (line 311)
> - downloadAttachment (line 326)
>
> Why it breaks:
> - API_URL defaults to http://localhost:3000, which is a different origin from the Vite dev server.
> - Cross-origin fetch omits cookies unless credentials: "include" is set.
> - The server side is already set up for it (cors({ origin: CLIENT_ORIGINS, credentials: true }) in server/src/app.ts:44).
> - The auth calls on lines 366–392 already pass credentials: "include".
>
> Impact: A signed-in Requester gets a 401 on Create Ticket, My Tickets, Ticket Detail and all attachment actions. The unit tests mock api, so they won't catch this.
>
> The new comment in api.ts says the cookie "travels with the same-origin request". That doesn't hold in this configuration, so please update it as well.
>
> Suggested fix: Add credentials: "include" to each of the six calls above, or route them through a shared fetch helper that sets it. A small test that asserts the option is passed would stop this from regressing.
>
> ✅ Looks good
>
> The server-side changes look correct:
> - the ticket row lock
> - the closed-ticket check on attachment add and remove
> - the owner and resolution fields on ticket detail
>
> ---

**Author's response** (2026-10-02, @WirachatTH)

> Thanks for the review, and for checking the lock and the closed-ticket rule. Fixed in `95afd65`.
>
> **On the cause:** in this repo `API_URL` is `""`. Since Issue 3 (D-11), the client only calls relative `/api/...` URLs on its own origin, and the Vite dev server proxies them to the API. `fetch` sends cookies to the same origin by default, so the Requester calls did carry the session. The E2E journey signs in and then creates, lists, opens, downloads and removes through a real Chromium, and it passed 25/25 runs. (`VITE_API_URL` was retired in Issue 3, so a leftover `VITE_API_URL=http://localhost:3000` in a local `.env` isn't read anywhere.)
>
> You're still right about the inconsistency, though. The auth calls set `credentials: "include"` and the Requester calls relied on the default, so they would break silently if the client were ever served from another origin. So I changed it as you suggested:
>
> - **One `apiFetch` helper** in `client/src/api.ts` now handles all 14 calls and always sets `credentials: "include"`. No call uses `fetch` directly any more, and the comment you flagged now says the cookie comes from `apiFetch`.
> - **New `client/tests/lab-03/apiCredentials.test.ts` (14 tests):**
>   - every exported request function must send `credentials: "include"` to a relative `/api/` URL;
>   - the list of functions it covers must match the module's exports, so a call added later can't skip the check.
> - **Mutation-checked:**
>   - bypassing `apiFetch` in `fetchTicket` → 1 test fails;
>   - removing the option from the helper → 13 tests fail.
>
> **Re-run:**
> - client 160/160, `tsc` clean;
> - Lab 2 E2E 5/5 runs, 3 viewports each, no tickets left behind;
> - server unchanged.
>
> The PR description has a "Review round 1" section with the same details. 🙏

**Review — Approved** (2026-10-02, @Menelaus122)

> Re-reviewed 95afd65. Looks good: all calls go through apiFetch with credentials: "include", and the test covers every exported function and guards against new ones bypassing it. Note my earlier concern was overstated, since the relative /api URLs through the Vite proxy already sent the cookie. This is a good hardening change regardless. Only nits: apiFetch could be unexported, and the plain-string paths don't need template literals. Approving.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the re-review and the approval. Routing every call through one helper made the client safer!

### [#56](https://github.com/WirachatTH/toktickit/pull/56) — Issue 6: Public Comments & Internal Notes

**Verdict:** Approved · **merged** 2026-10-02 by @Menelaus122

**Review — Approved** (2026-10-02, @Menelaus122)

> Review: looks good, a few small follow-ups Verdict: Approve
>
> The server side is solid: role guards, Int32 id validation, the FOR UPDATE row lock, and 400-before-409 ordering all check out. The findings below are minor and client-side. None of them blocks merging.
>
> Worth fixing in this PR
>
> 1. Closed-ticket 409 leaves the composer enabled (DiscussionThread.tsx:83). If the ticket was closed in another tab, closed is driven only by the closedNote prop, which stays stale. The user can resubmit into the same 409. Track a local closedByServer flag and treat it like closed.
> 2. Composer is usable before or after a failed load (DiscussionThread.tsx:78, 124). A post when entries is null produces a one-item thread, and after a failed load it shows next to the "Unable to load" alert. Disable the composer until entries !== null.
> 3. Stale comment (RequesterTicketDetail.tsx:12-16). The header still says the screen does not render Public Comments, but this PR adds a Comments card.
>
> Smaller or for later
>
> 4. Focus lost after posting (DiscussionThread.tsx:124). The textarea is disabled while busy and the clicked button is disabled too, so focus drops to <body> after each post. Use readOnly on the textarea while busy, or refocus it after the post.
> 5. DiscussionPanel has no key={ticketId} (DiscussionPanel.tsx:44). Nothing mounts it yet, but the load effect has [] deps. If the ticket changes while it stays mounted, it will show the old ticket's threads. Add key={ticketId} where Issue 8 mounts it, or put the key on the threads inside the panel.
> 6. Optional: support Home/End on the tabs (WAI-ARIA tabs pattern).
>
> ---

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving, and for the follow-ups. They were folded into Issue 7!

### [#57](https://github.com/WirachatTH/toktickit/pull/57) — Issue 7: IT Staff Ticket Queue

**Verdict:** Changes requested → Approved · **merged** 2026-10-03 by @Menelaus122

**Review — Changes requested** (2026-10-02, @Menelaus122)

> Review of PR #57: Issue 7, IT Staff Ticket Queue
>
> Verdict: request changes. There are two small UI bugs to fix, and the rest looks solid.
>
> I checked this out in a separate worktree with a fresh seeded Postgres and ran everything myself.
>
> Verified
>
> - Tests and types: The server suite passes 258/258 in 18 files and the client suite passes 196/196 in 16 files. tsc --noEmit is clean on both. The base branch gives 237 and 179, so the new-test counts (21 server, 17 client) are correct.
> - Docs: tests.md totals 189 planned and 111 Pass, with the 20 Issue 7 rows marked Pass. There are no dependency or migration changes.
> - Mutation table:
>   - I re-ran 21 of the 23 mutations and each fails the tests named in the description.
>   - API-36 not catching the missing id tiebreak is also true.
>   - I did not re-run the other 2 client mutations.
> - Live API on seeded data:
>   - The default view shows 14 active tickets, HIGH first and oldest first.
>   - owner=me gives 4 and appearsResolved gives 1.
>   - An Administrator searching "printer" gets 3.
>   - A Requester gets 403.
>   - Junk query values return 200 with defaults echoed.
>   - Assignable users are the 5 active staff.
> - Real Chromium:
>   - Headers, count and first row match the description.
>   - Back restores the filters.
>   - The Administrator sees the Read-only pill and no "Me" option.
>   - At 375 px the cards show, the table is hidden, and there is 0 px of overflow.
> - Lab 2 E2E: The journey passes on all 3 viewports and cleans up after itself (I ran it once).
>
> Please fix
>
> 1. Clear filters doesn't clear everything when a search is active.
>    - Repro: open /staff/queue?owner=me, type a search with no matches, and click Clear filters (either button).
>    - Expected: the URL is /staff/queue.
>    - Actual: the URL stays ?owner=me. The search box empties, but the owner filter stays. This is a different case from the search-only one in the PR description, which does work.
>    - Likely cause: the debounced-search effect calls update({ search: "" }) with a stale params closure, which puts the old filters back after clearFilters.
>    - Please add a UI-18 case for a non-search filter plus a search, then Clear.
> 2. A page past the end shows the wrong message.
>    - Repro: open /staff/queue?page=99. It says "The queue is clear" and shows no pager. With &owner=me it says "No tickets match", also with no pager.
>    - The server is correct (totalItems: 14, empty page, BR-67).
>    - The empty and no-results branches should use pagination.totalItems === 0. If totalItems > 0 and the page is empty, show the pager or redirect to the last page.
>    - Please add a test for it.
>
> Suggestions (non-blocking)
>
> - Pagination renders one button per page. A window of pages would scale better.
> - The mobile card is a div role="link" and Space doesn't call preventDefault(), so Space scrolls the page. A real <Link> would be better.
> - Keep the previous rows visible (dimmed) while a filter change loads, instead of replacing the table with skeleton rows each time.
> - findMany and count could share a $transaction so totals can't drift from the rows.
> - pageOf and pageSizeOf accept "1e1" and "0x10" via Number(). This is harmless because appliedQuery normalises the value, but /^\d+$/ would match positiveId.
>
> Couldn't verify
>
> - "Tests written first, each confirmed failing before the implementation." The PR is a single commit, so the history can't show it.
> - "Contract audit: output identical to lab3-staging." I found no such script in the repo. Where does it live?
>
> Scope note
>
> The six #56 follow-ups are bundled into this PR. They are correct and tested (I verified each by mutation), but they would have been easier to review as their own PR.
>
> Nice work on the mutation table and on being upfront about the API-36 tiebreak limit.

**Author's response** (2026-10-03, @WirachatTH)

> Thanks for a really thorough review, especially for re-running the mutations and the browser checks yourself. Both bugs were real, and both are fixed now.
>
> **Commits:** the failing tests are on their own in `5da658c`, and the fix is in `09bab51`. So the history now shows the tests red before the fix, which also answers your point that a single commit couldn't show the tests came first. From here on I'll keep the tests and the implementation in separate commits.
>
> **1. Clear filters after a search**
> - **Reproduced** exactly as you described, in Chromium and in jsdom (`expected {} but got { owner: "me" }`).
> - **Cause:** your diagnosis was right. The router applies URL changes as a transition (`v7_startTransition`), so the delayed search ran with a copy of the URL taken before the Clear and wrote `owner=me` back.
> - **Fix:** `update()` now always builds from the latest URL.
> - **New UI-18 case:** a non-search filter plus a search, then each Clear button. It waits out the search delay before checking.
>
> **2. A page past the end**
> - An empty page while `totalItems > 0` now goes to the last page: `?page=99` → `?page=2`, and `?page=99&owner=me` → `?owner=me` (one page, so no `page` in the URL).
> - The empty and no-results messages are decided by `totalItems === 0`, as you suggested.
> - **New UI-19 case** for both URLs.
>
> **Mutation checks**
> - Breaking either fix makes its new test fail.
> - My first version of fix 1 also re-checked the search inside the delayed search. With both changes in place, breaking either one alone failed nothing, so I removed the redundant re-check and every changed line now has a test behind it.
> - With the jump to the last page in place, `totalItems === 0` behaves the same as "no rows on this page". I kept it because it states the rule directly, and a mutation test can't tell the two apart.
>
> **Re-run**
> - client 198/198, server 258/258 (unchanged), `tsc` clean on both;
> - Lab 2 E2E 3/3 runs on all 3 viewports, nothing left behind;
> - your repro steps in Chromium now end with an empty URL and the pager shown.
>
> **Your non-blocking suggestions:** all good points, and none of them is in this PR.
> - **Windowed pagination**, and **keeping the old rows dimmed while a filter reloads**: noted for Issue 10 (responsive and visual QA).
> - **A real link for mobile cards** (Space scrolling), **one transaction for `findMany` and `count`**, and **digits-only page / page size**: small, and I'll do them in an upcoming issue.
>
> **On the contract audit:** it's a small helper script we keep outside the repo on purpose (working tooling, not part of the deliverable). It checks the Lab 3 spec docs for gaps or duplicates in the BR / FR / AC / D numbering, references to IDs that don't exist, and broken table rows, then I diff its output against `lab3-staging`'s. Since you can't run it, I'll stop citing it in PR descriptions as evidence.
>
> **On bundling:** fair point about the #56 follow-ups. I'll keep review follow-ups in their own PR next time.
>
> Thanks again! 🙏

**Review — Changes requested** (2026-10-03, @Menelaus122)

> Re-review of PR #57 at 09bab51
>
> Verdict: request changes, but only for one small fix. Both bugs from round 1 are fixed, and the tests came first this time. Thanks!
>
> Verified
>
> - Tests and types: the client suite passes 198/198 in 16 files, and tsc --noEmit is clean. I checked it out in a separate worktree. I didn't re-run the server tests, E2E or Chromium, because this round only changes the client.
> - Commit order: the failing tests are on their own in 5da658c and the fix is in 09bab51. That covers my "couldn't verify tests came first" point.
> - Fix 1: update() now reads the latest URL, so ?owner=me → search → Clear ends at /staff/queue. The new UI-18 case covers both Clear buttons and waits out the
> - Fix 2: an empty page with totalItems > 0 now jumps to the last page, and the empty and no-results messages use
> totalItems === 0.
>
> Please fix
>
> 1. One Clear filters click adds two history
>    - Repro: open /staff/queue?owner=me, search "zzzz", wait for the results, click Clear filters, then press Ba   - Expected: one Back returns to ?owner=me
>    - Actual: the click adds two PUSH /staff/queue entries, so Back has to be pressed twice. I confirmed it withthrowaway test that logs each location chang
>    - Cause: clearFilters() empties the search box, which starts the debounce timer. The effect only depends on searchInput, so the URL change doesn't cancecalls update({ search: "" }). That now readsthe latest URL (empty), so it no longer brings old filters back, but it still pushes /staff/queue a second time.
>    - Fix: the re-check you removed as redundside the timeout:
>        if (trimmed === (latestParams.current.search ?? "")) return;
>      Cancelling the pending timer in clearFi
>    - Test: after Clear, one Back press returns to the searched URL. That's also the test that keeps the re-check from
> looking redundant, since nothing counted his
>
> Suggestion (non-blocking, fine as a follow-u
>
> 2. The jump to the last page can leave the s
>    - findMany and count run in Promise.all, not in a transaction, so they can disagree. For example, tickets close between the two queries. The reply can then totalItems: 14, data: [] }.
>    - The jump target is then the URL already shown, so setSearchParams changes nothing, the effect doesn't re-run, and
> the state stays "loading". I mocked that repe skeleton still showing after 1.5 s and nopager, message or Retry.
>    - Fix: if the target equals paramsKey, shing. Or put both queries in one $transaction, as suggested in round 1.
>    - It's a rare race, but when it happens t
>
> Nice work on the separate test commit and on= 0 is kept even though a mutation test can't tell it apart.

**Author's response** (2026-10-03, @WirachatTH)

> Thanks, and good catch. You were right that the re-check I removed in round 1 wasn't redundant. I removed it because the mutation pass showed nothing failing without it, but no test counted history entries, so the mutation pass couldn't have seen what it was for. Fixed in `c4c9a58`, with the failing tests committed first in `2c80836` (both fail on `09bab51`).
>
> **1. Two history entries per Clear**
> - **Fix:** the delayed search re-checks the latest URL before sending, exactly as you suggested.
> - **New UI-18 case:** after Clear, a single Back returns to `?owner=me&search=zzzz`.
> - **In Chromium** with your steps: Clear gives `""`, and one Back gives `?owner=me&search=zzzz` with the box and Owner restored.
>
> **2. Skeleton stuck when the rows and the count disagree**
> - Done now, since it was small. If the "last page" is the page already shown, the screen shows "The queue changed while it was loading." with Retry instead of navigating to the same URL.
> - **New UI-19 case:** it mocks that exact reply and then recovers via Retry.
> - **Server half:** putting `findMany` + `count` in one transaction stays with the round-1 suggestions for an upcoming issue. With Prisma's default read committed, each statement still takes its own snapshot, so it will need `isolationLevel: RepeatableRead` to really close the gap.
>
> **One more test**
> - Restoring the re-check hid the round-1 fix (`update()` reading the latest URL) from the mutation pass again. So I added a UI-18 case: change Status while a search is still waiting to be sent, and the change must survive.
> - It fails if `update()` reads a stale copy. It's in the fix commit, not the test commit, because it passes before and after: it guards existing code, not a new bug.
>
> **Mutation checks:** removing the re-check, jumping when already there, removing the notice, judging "nothing matches" by the page, and a stale `update()` each fail their test. That also means my round-1 remark that a test "can't tell `totalItems === 0` apart" no longer holds: the new UI-19 case does.
>
> **Re-run:** client 201/201, `tsc` clean, Lab 2 E2E 2/2 runs on all 3 viewports. The server is unchanged.
>
> The PR description has a "Review round 2" section with the same details. 🙏

**Review — Approved** (2026-10-03, @Menelaus122)

> Re-review of PR #57 at c4c9a58
>
> Verdict: approve. Both round-2 points are fixed and tested, and I found nothing new.
>
> Verified
>
> - Test-first: the new history-entry test and the empty-last-page test both fail on the test commit 2c80836 (2 failed, 12 passed in StaffTicketQueue.test.tsx), and pass after c4c9a58.
> - Tests and types: the client suite passes 201/201 in 16 files, and tsc --noEmit is clean. The server is unchanged, so I didn't re-run it.
> - My probes from last round, re-run on the new head:
>   - One Clear filters click now adds exactly one PUSH /staff/queue, down from two.
>   - The { page: 2, totalPages: 2, totalItems: 14, data: [] } reply now shows "The queue changed while it was loading." with Retry after one fetch, and no skeleton is left.
> - Mutations, each re-run by me:
>   - Removing the re-check in the delayed search fails "adds one history entry per Clear filters click".
>   - Making update() spread the render's params again fails "keeps a filter changed while a search is still waiting to be sent". Good call adding that test, since restoring the re-check had hidden the round-1 fix from the mutation pass.
>   - Always jumping, even when already on the last page, fails "never stays loading when the last page itself comes back empty".
>
> Notes (non-blocking)
>
> - I agree on the server half: a $transaction alone still uses read committed, so it needs isolationLevel: RepeatableRead to actually line up the rows and the count. That's fine for the upcoming issue with the other round-1 suggestions.
>
> Nice work on explaining why the re-check wasn't redundant and adding the test that proves it.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the approval after three rounds, and for spotting the re-check I shouldn't have removed. Lesson learned!

### [#58](https://github.com/WirachatTH/toktickit/pull/58) — Issue 8: Ticket Workflow & IT Staff Ticket Detail

**Verdict:** Approved · **merged** 2026-10-03 by @Menelaus122

**Review — Approved** (2026-10-03, @Menelaus122)

> Review of PR #58: Issue 8, Ticket Workflow & IT Staff Ticket Detail
>
> Verdict: approve. I re-checked every claim in the description and they hold. There are three small notes below and no bugs.
>
> I checked it out in a separate worktree with a fresh seeded Postgres and ran everything myself.              
> Verified                                                                                                     
> - Tests and types: server 292/292 in 20 files, client 232/232 in 17 files, tsc clean on both. The base gives 201, so the new-test counts are right.
> - Test-first: 27 server and 23 client tests fail on 084fa0f, and transitions.test.ts fails to load there (no ticketWorkflow.ts yet). The already-green li sweep, NEW's two badge tests and STYLE-04.The test edits in 00183cc are the two declared corrections plus apiCredentials.
> - Spec: the transition table matches BR-41 es and the 400-before-409 order match api-spec §5.6. All 8 badge colours match ui-spec §1.2, and my contrast calculation agrees with the spec.
> - tests.md: 189 planned, 148 Pass. The 41 no9–10, and every Issue 8 row's test filecontains its ID.                                                                                               - Mutations: I rebuilt and ran all 34. Everytests in 33 cases. Every file was restoredbyte-identical.                                                                                                - Authorization evidence: replayed against m calls return 403 and anonymous returns 401.
> - Real Chromium: all six live steps reproduce: claim → OPEN; High + In Progress with only WFR/Resolved/Cancelleoffered; the stale banner and reload with thesolve disabled until a summary is typed; the reopen reason in the Requester's comments; the pill on both sides; the Administrator's panel with 0 selects, 0 buttons and 0 composers; and 375 px with therflow.
> - No leftovers: row counts are identical after the full suite and after the E2E runs, and no upload files remain.
> - E2E: parallel 3/3 runs passed (about 5 s ef 18 viewport runs, and the one failure wasthe very first run on a cold Vite server. The parallel timeouts didn't reproduce on my machine.
>
> Notes (non-blocking)
>
> 1. authorization-evidence.md doesn't contain the "ticket confirmed unchanged afterwards" check the description
> mentions. It is true (I compared the ticket,d after), but the evidence should show it.Please add a before/after GET at the end.
> 2. The 5 apiCredentials rows were added in 0, so "31 client tests written first" isreally 26 plus 5 added with the implementation.
> 3. Mutation "text checked after the conflictk moved after OWNER_REQUIRED) is caught byAPI-78 only, not API-56 or API-57. How did yours differ?
>
> Nice work. The mutation table and the NUL-character trick for proving the same transaction were both convincing.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving the biggest issue yet, and for re-running everything yourself. Your three notes went into the follow-up PR #59!

### [#59](https://github.com/WirachatTH/toktickit/pull/59) — Issue 8 - Follow-up

**Verdict:** Changes requested → Approved · **merged** 2026-10-03 by @Menelaus122

**Review — Changes requested** (2026-10-03, @Menelaus122)

> Verdict: request changes, for two small fixes to the evidence script. The code changes are correct.
>
> I checked it out in a separate worktree with a fresh seeded Postgres and ran everything myself.
>
> Verified
>
> - Tests and types: server 293/293 and client 233/233, tsc clean on both. The base gives 292 and 232, and exactly the two new tests fail on 95043e4 and pass on 9bf4baf.
> - Digits only: the UNIT-10 case passes, and the live API returns page 1 / pageSize 10 for 1e1, 0x10 and +3, and page 7 for 007.
> - One snapshot: with log_statement=all, Postgres logs BEGIN → SET TRANSACTION ISOLATION LEVEL REPEATABLE READ → the rows query → the count → COMMIT for each queue request.
> - Real link: in Chromium at 375 px each card is an <a href="/staff/tickets/:id"> with no role or tabindex, no nested interactive elements, the card look kept, and 0 px overflow. Enter opens the right ticket.
> - Evidence: the committed file has a real 200 baseline, 16 × 403, a 401 and matching fingerprints. Run against a real seeded IN_PROGRESS ticket, the script reports comments=2 notes=1, which matches the database.
> - E2E (--workers=1) passes 3/3 on a warm run. The database is back to 13 users and 18 tickets after the E2E and the full server suite.
>
> Please fix
>
> 1. The script reports "identical" for a ticket that doesn't exist.
>    - Repro: run it on a fresh seed, where ticket 4029 doesn't exist.
>    - Actual: the baseline is HTTP 404, both fingerprints are just "comments=0 notes=0", and it still prints "Before and after are identical".
>    - Fix: exit with an error if the baseline isn't 200. Better still, look up an IN_PROGRESS ticket through /api/staff/tickets?status=IN_PROGRESS instead of hardcoding T=4029 and owner ids 82/86, so the script works on any seeded database.
> 2. The usage line is broken: "...capture-authorization-evidence.sh #        artifacts/.../authorization-evidence.md". It looks like a "\" line continuation was lost. Copy-pasted, bash treats the output path as a comment and the script stops with "$1: unbound variable".
>
> Note (description only)
>
> - "Space no longer scrolls" isn't accurate. In Chromium, Space on a focused card still scrolls the page (437 px in my run), because that's what browsers do for links; links open with Enter. The change is still right. Please reword the PR text and the code comment to something like "a real link: Enter opens it, and it can be opened in a new tab".
>
> The RepeatableRead explanation and the miscount you caught before committing were good to see.

**Author's response** (2026-10-03, @WirachatTH)

> Thanks, all three points were right. Fixed in `d52c897`.
>
> **1. "Identical" for a ticket that doesn't exist:** confirmed. With a `404`, both fingerprints were the same empty string, so the comparison proved nothing.
> - **Lookups:** the script now takes an owned `IN_PROGRESS` ticket from `GET /api/staff/tickets?status=IN_PROGRESS` (or `TICKET=<id>`), and reads the Requester's and Administrator's ids from `/api/auth/me`. Nothing is hardcoded, so it works on a fresh seed too.
> - **Guards:** it stops with an error and writes no file if a sign-in fails, there's no such ticket, the baseline isn't `200`, or the ticket isn't an owned `IN_PROGRESS` ticket.
> - **Checked:**
>   - `TICKET=999999` → "returned HTTP 404, not 200", exit 1, no file;
>   - `TICKET=4036` (CLOSED) → refused;
>   - no argument → the usage message;
>   - a normal run picks the ticket by itself and records 1 × `200`, 16 × `403`, 1 × `401`, and "identical".
>
> **2. Usage line:** one line again. The lost line continuation made the output path a comment when pasted.
>
> **3. "Space no longer scrolls":** you're right, browsers scroll on Space for links too. The description, the code comment and the test name now say "a real link: Enter opens it, and it can be opened in a new tab". The earlier commit message `9bf4baf` still has the old wording; I'd rather not rewrite pushed history for it, and the PR description says so.
>
> **Re-run:** client 233/233, `tsc` clean. The server is unchanged. 🙏

**Review — Approved** (2026-10-03, @Menelaus122)

> Re-review of PR #59 at d52c897
>
> Verdict: approve. All three points are fixed, and I found nothing new.
>
> Verified
>
> - Tests and types: client 233/233, tsc clean. No server code changed in this commit.
> - On a fresh seed, with no hardcoded ids, the script picked IN_PROGRESS ticket 6 itself and recorded 1 × 200, 16 × 403, 1 × 401 and "identical". The counts (2 atabase. The ids it read from /api/auth/me(Requester 1, Administrator 12) match the database too.
> - Every guard stops with a clear message, ex99 (404), a CLOSED ticket, an unowned NEWticket, a wrong password (401), the stack down (000), and no argument (the usage message).
> - Two more I tried: changing the ticket mid-WARNING line and exits 1. A failed run leaves an existing evidence file untouched, thanks to the draft file.
> - The usage line is one line again, and the ent and the test name no longer claim Spacedoesn't scroll.
>
> Optional nits
>
> - With no argument, bash prints "line 17: 1: usage: …". A small "[ $# -ge 1 ] || fail 'usage: …'" would read cleaner.
> - my_id has no check of its own. If /api/autids come back empty and the JSON bodiesbecome invalid. A one-line "[ -n "$REQUESTER_ID" ] && [ -n "$ADMIN_ID" ] || fail …" would catch that.
>
> Good call writing to a draft so a failed run can't overwrite good evidence.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the approval! Good call on the evidence script reporting "identical" for a missing ticket!

### [#60](https://github.com/WirachatTH/toktickit/pull/60) — Issue 9: Administrator User Management

**Verdict:** Approved · **merged** 2026-10-03 by @Menelaus122

**Review — Approved** (2026-10-03, @Menelaus122)

> Verdict: approve. I checked every claim in the description and they hold. Three optional nits below.
>
> I checked it out in a separate worktree with a fresh seeded Postgres and ran everything myself.
>
> Verified
>
> - Tests and types: server 312/312 in 22 files, client 247/247 in 18 files, tsc clean on both. The base gives 293 and 233.
> - Commits: on 9f5542a, 15 server and 10 client tests fail. The three you list as already green (API-72, SEC-11, the 403 sweep) are exactly the ones that pass. 6bf590e touches no tests, its two client failures are the two setup changes, and 04c30e8 holds exactly the four changes described.
> - Spec: the handlers match BR-53 to BR-60 and api-spec §6.3–6.4, including the BR-81 lock order (target plus every active Administrator in one statement, ascending, re-checked under the locks). The screen matches ui-spec §8.
> - Routes: all 29 routes in the policy table now have a handler, and no handler is missing a policy, so the SEC-12 change is right.
> - tests.md: 189 planned, 170 Pass. The 19 Planned rows are exactly Issue 10's, and all 22 Issue 9 rows are Pass with their IDs in the named test files.
> - Mutations: I rebuilt and ran all 26. Each is caught by the tests you name, and every file was restored byte-identical. The two self-change mutations also fail API-71/API-77, as your note says.
> - Live API: I reproduced every curl check in the description, plus OWNS_OPEN_TICKETS on a ticket owner and GET /api/admin/reports → 404.
> - Chrome, desktop: the list (columns, You pill, status pills, role badges); your own Edit panel (Role and Active disabled with the reason, the Change password link, no password field); Generate fills a 16-character password that meets every rule; the panel is exactly 440 px on the right; EMAIL_TAKEN and OWNS_OPEN_TICKETS show beside their fields with the panel open and the input kept.
> - Chrome, 375 px (the check you couldn't do): cards shown, table hidden, 0 px overflow, and the panel is full screen.
> - E2E (--workers=1): 2/2 runs pass. 13 users and 18 tickets remain after the suites and the E2E.
>
> Nits (optional)
>
> 1. In the Edit panel, typing a new initial password and then clicking "Save changes" silently drops the password, because only "Set initial password" sends it. A hint, or disabling Save while that field has text, would avoid surprises.
> 2. errorsFrom always puts LAST_ADMINISTRATOR under Active, even when a role change caused it. That's only reachable in a race, so it's very minor.
> 3. If the lock plan changes three times in a row, the request ends in a plain 500. A 409 with a "try again" message would be kinder, though it's unlikely to happen.
>
> Really solid work. The deterministic stale-plan test, built because a mutation survived, was especially convincing.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving, and for checking every claim. Your three notes are fixed in #62!

### [#61](https://github.com/WirachatTH/toktickit/pull/61) — Issue 10: Responsive QA, Visual Checklist & E2E

**Verdict:** Approved · **merged** 2026-10-04 by @Menelaus122

**Review — Approved** (2026-10-04, @Menelaus122)

> Review of PR #61: Issue 10, Responsive QA, Visual Checklist & E2E
>
> Verdict: approve. I checked every claim in the description and they hold. Three small notes below.
>
> I checked it out in a separate worktree with a fresh seeded Postgres, its own API and Vite, and ran everything myself.
>
> Verified
>
> - Tests and types: server 312/312 (no server changes), client 284/284 in 19 files, tsc clean on both.
> - Red commit: on 11045f0 the 10 failing client tests are exactly STYLE-06's stylesheet check, the four UI-18 tests and the five RESP-06 tests, and your "already green" list matches. I also ran Playwright at 11045f0: the only failures were E2E-01/02 on mobile ("Email is at least 44px tall") and RESP-06 ("Show password shows a focus indicator"), as described.
> - 7483c00 contains the corrections and additions you list.
> - Playwright --workers=1 at the head: 28 passed, 2 skipped (RESP-06 at tablet/mobile), twice. The teardown cleaned up each time: 13 users, 18 tickets, no upload files. It only deletes the two literal prefixes, so seeded data is safe.
> - Screenshots: all 126 files exist for the 42 states in ui-spec §13, at exactly 1280/834/375 px. I looked at the tablet queue (all seven columns fit), mobile User Management (long emails wrap), tablet Ticket Detail (controls above the information) and the stubbed last-Administrator panel.
> - tests.md: 189/189 Pass, each Issue 10 ID appears in its named file, and every §4 cell is Pass or n/a.
> - STYLE-06: exactly 16 #fff and the #00552F rules moved to tokens with the same values. No hex remains outside :root and the badge/pill rules, or inline in a component.
> - Code: pageWindow (start, middle, end and single-page gaps), the dimmed reload, and Modal (focus return, innermost-only Escape and Tab, onClose through a ref) all look right.
> - Mutations: I rebuilt and ran all 19 (12 Vitest, 7 as Playwright runs). Each is caught by the tests you name, and every file was restored.
>
> Notes (non-blocking)
>
> 1. Every Playwright run rewrites the 18 committed Lab 2 screenshots and all 126 Lab 3 ones, so "artifacts/lab-02/screenshots unchanged" only holds after restoring them by hand. Making capture opt-in (for example CAPTURE_SCREENSHOTS=1) would keep a normal test run from dirtying the tree.
> 2. Some committed screenshots show E2E fixtures: the tablet queue has two "E2E flow ticket" rows, and the mobile user list includes about 20 e2e3. users. That's fine for layout, but a capture on a clean seed would read better as evidence.
> 3. 7483c00 also adds a "Resolve ticket is enabled" check that isn't in the PR's list. Trivial; just for completeness.
>
> Great QA pass. Writing the long-address user because a mutation survived, and checking the screenshots by eye, both found real problems.

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for the approval and the thorough QA check. Your screenshot notes will be handled in the pre-release PR.

### [#62](https://github.com/WirachatTH/toktickit/pull/62) — Follow-up: review notes from #59 and #60

**Verdict:** Approved · **merged** 2026-10-04 by @Menelaus122

**Review — Approved** (2026-10-04, @Menelaus122)

> Review of PR #62: follow-up to #59 and #60
>
> Verdict: approve. Everything I could check holds.
>
> - Tests and types: server 315/315 (23 files), client 287/287, tsc clean. On e66719b exactly the 3 retry tests and 2 of the 3 UI tests fail; the STALE_STATE banner test is already green, as you say.
> - The refactor: git diff -w shows the transaction body unchanged. Only the retry loop moved into retryOnLockPlanChange, and the final 500 became 409 STALE_STATE. api-spec §6.3 and the code table both document it.
> - Mutations: all 6 caught with exactly the failure counts you list (3, 1, 8, 1, 1, 1), run against the full suites.
> - Chromium: Save is disabled while a password is typed, aria-describedby points at the hint, Enter in another field doesn't save, and clearing the field brings Save back and removes the hint.
> - Script: no argument prints the usage message (exit 1); an empty my_id stops with the /api/auth/me message (exit 1, no file); a real run writes 16 × 403, a 401 and "identical" (exit 0).
> - Playwright lab-03/user-administration: 10 passed, 2 skipped, with 13 users and 18 tickets left. Only the three set-initial-password screenshots changed.
>
> One small note: the description cites the contract audit again. On #57 you said you'd stop doing that, since reviewers can't run it.
>
> Reusing STALE_STATE is fine by me. It already means "someone else changed this, try again".

**Author's response** (2026-10-04, @WirachatTH)

> Thanks for approving! And you're right about the audit mention. Sorry about that; it won't appear in our PRs again!
