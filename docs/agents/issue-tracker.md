# Issue tracker: GitHub Issues + Project board

Issues live in GitHub Issues for `Menelaus122/TokTickITV2`. An issue's status lives on the user's Project board, **TokTickIT Individual Sprints**, not in labels. Use the `gh` CLI.

This is a CPE 334 course repo and the workflow is graded. It comes from the course's workflow guide (`docs/lab-02/TokTickIT_GitHub_Workflow_Guide_TH_EN.md`) and the labsheets, which are local reference files that aren't committed, so a fresh clone won't have them. Follow it exactly.

## Branches

- `main`: the default branch. It receives one release PR per lab and nothing else.
- `labN-staging`: the integration branch for lab N. Every feature and docs PR targets the **current lab's** staging branch. The current lab is the highest-numbered `origin/lab*-staging` (`git branch -r --list 'origin/lab*-staging'`). If that disagrees with what the user is working on, ask.
- `feature/<n>-<slug>`: one branch per issue. `<n>` is the lab-local number from the issue title (`Issue 5 — Ticket creation` → `feature/5-ticket-creation`), **not** the GitHub `#number`.
- `docs/lab<N>-<topic>`: docs-only work that no open issue owns, e.g. `docs/lab2-final-delivery`.

Never commit or push directly to `main` or any `labN-staging`, docs included. Everything reaches them through a reviewed PR.

## Issues

- **Title**: `Issue <n> — <Title>` (em dash). `<n>` restarts at 1 every lab: Lab 2's Issue 1 is `#10`.
- **Body**:

  ```markdown
  * Branch: `feature/<n>-<slug>`
  * Acceptance criteria:
  * <criterion>
  * <criterion>
  ```

  Write the criteria in the language the current lab's issues already use (Lab 2 used Thai).
- Every issue is a real issue on the board, starting in **Backlog**. Never a draft item: drafts can't be linked to a PR.
- **Create**: `gh issue create --title "..." --body-file <file> --project "TokTickIT Individual Sprints" --assignee @me`
- **Read**: `gh issue view <#> --comments`
- **List**: `gh issue list --state open --json number,title,body,comments`
- **Comment**: `gh issue comment <#> --body "..."`

## Project board

The `Status` field has six options, in this order:

| Status | Move the card here when |
| :--- | :--- |
| Backlog | The issue exists but hasn't been read and understood yet. |
| Specified | The requirements have been read and understood. |
| Started | The feature branch exists and implementation has begun. Only the issue actively being implemented goes here. |
| PR Review | The PR is open **and linked** to the issue, so the card shows the PR number. |
| Fixing | The reviewer requested changes or tests failed. Fixes go on the same branch. |
| Done | The PR is approved, tests pass, it's merged into staging, and every acceptance criterion is met. |

From PR Review a card goes either to Done or to Fixing. From Fixing it goes back to PR Review once the fixes are pushed.

Moving cards needs the `project` scope on the `gh` token. If `gh` reports it missing, tell the user to run `gh auth refresh -s project`, or ask them to move the card. With the scope:

```sh
gh project list --owner Menelaus122                                   # project number
gh project view <num> --owner Menelaus122 --format json --jq .id      # project node id
gh project field-list <num> --owner Menelaus122 --format json         # Status field id + option ids
gh project item-list <num> --owner Menelaus122 --format json          # the issue's item id
gh project item-edit --project-id <project-node-id> --id <item-id> \
  --field-id <status-field-id> --single-select-option-id <option-id>
```

## Working an issue

1. **Start.** `gh issue develop <#> --name feature/<n>-<slug> --base labN-staging --checkout` creates the branch from staging and links it under the issue's Development panel. Move the card to Started.
2. **Docs for this issue** go on the same branch and in the same PR. Don't open a second branch for them.
3. **Open the PR.** `gh pr create --base labN-staging --title "<Imperative summary> (Issue <n>)" --body-file <file>`, using the body format below. `Closes #<#>` in the body is fine for readability, but on a staging base it only mentions the issue; it does **not** link it.
4. **Link the PR to the issue.** GitHub has no API for this on a non-default base, so ask the user to do it in the PR sidebar: Development → gear icon → pick the issue. Then verify:

   ```sh
   gh pr view <pr> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'
   ```

   The issue number must be in the list. Only then move the card to PR Review.
5. **Review.** The peer reviewer approves and **merges**. Never approve or merge a PR the user authored, even when asked to "just merge it": the lab agreement is that the reviewer merges.
6. **Changes requested.** Move the card to Fixing and push fixes to the same branch; the PR updates itself, so never open a new one. Reply to **every** review comment with what changed or why not (`gh api --method POST repos/Menelaus122/TokTickITV2/pulls/<pr>/comments/<comment-id>/replies -f body="..."`). Resolve a conversation only after replying and actually fixing it. Then move the card back to PR Review.
7. **After the merge.** Merging into staging doesn't close the issue. Move the card to Done, then check `gh issue view <#> --json state`; the board often closes it. If it's still open: `gh issue close <#> --comment "Merged into labN-staging in #<pr>."`

## PR body

Use this format. It takes precedence over the generic `pr` skill's template.

```markdown
I have done Issue <n>: <Title> for Lab <N>. <One paragraph on what it does.>

## 🎯 Acceptance Criteria Verification

- [x] **<criterion, as the issue words it>:** <how it's met, and which test proves it>

## 🧪 Automated Test Evidence

<the command, then the runner's output per suite>

## 📋 Notes for reviewer

<what the reviewer should look at first>
```

- One checkbox per acceptance criterion, in the issue's order. Tick only the ones that are actually met.
- Test counts are what the runner printed. Never round, estimate or restate them from memory.
- Add further `##` sections between the evidence and the notes (screenshots, a notable fix) only when the change needs them.

## Lab release

1. The lab's last issue is the delivery issue: docs and submission evidence, on a `docs/lab<N>-<topic>` branch, into staging.
2. Then the release PR, `labN-staging` → `main`, titled `Lab <N> release — <summary> (labN-staging → main)`. It uses `## 🎯 Definition of Done Verification` in place of acceptance criteria. It targets the default branch, so `Closes #<delivery issue>` does link here; still verify with `closingIssuesReferences`.

## When a skill says "publish to the issue tracker"

Create issues in the format above, on the board in Backlog. The board is graded and the issues are public, so show the user the list of titles and get a yes before creating anything.

When publishing several issues, create the blockers first. Record blocking with GitHub's native issue dependencies, which leaves the body format unchanged: `gh api --method POST repos/Menelaus122/TokTickITV2/issues/<n>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is `gh api repos/Menelaus122/TokTickITV2/issues/<blocker> --jq .id`. Don't use sub-issues.

For how triage roles such as `ready-for-agent` apply here, see `triage-labels.md`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <#> --comments`. GitHub shares one number space across issues and PRs, so a bare `#42` may be a PR: fall back to `gh pr view 42`.

"Issue 5" is a lab-local number. Resolve it with `gh issue list --state all --search '"Issue 5" in:title' --json number,title,createdAt`; the newest match belongs to the current lab. If that's ambiguous, ask.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(`/triage` reads this flag.)_ Every PR here is the user's or their reviewer's, not an outside request.

## Wayfinding operations

Wayfinder maps are planning scratch, not sprint work, and creating them as issues would put them on the graded board. Keep them as local markdown instead:

- **Map**: `.scratch/<effort>/map.md`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`. A `Type:` line records `research`/`prototype`/`grilling`/`task`; a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: the open, unblocked, unclaimed files in `.scratch/<effort>/issues/`; lowest number first.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, then add a gist and link to the map's Decisions-so-far.
