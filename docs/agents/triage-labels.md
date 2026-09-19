# Triage Labels

The skills speak in terms of five canonical triage roles. This repo doesn't use labels for them. An issue's state is its column on the **TokTickIT Individual Sprints** Project board, so each role maps to a board action.

| Role in mattpocock/skills | What it means in this repo | Meaning |
| --- | --- | --- |
| `needs-triage` | The card is in **Backlog** | The issue hasn't been read and understood yet |
| `needs-info` | The card stays in **Backlog**, with a `## Triage Notes` comment listing the open questions | Waiting on more information |
| `ready-for-agent` | Move the card to **Specified** | Fully specified and ready to implement |
| `ready-for-human` | Move the card to **Specified**; the brief says why it can't be delegated | Requires human implementation |
| `wontfix` | Close the issue with `gh issue close <#> --reason "not planned" --comment "..."` | Will not be actioned |

When a skill says "apply the `ready-for-agent` label" (for example `/to-spec` or `/to-tickets`), move the card to Specified instead of adding a label. Moving cards needs the `project` scope on the `gh` token; see `issue-tracker.md` for the commands.

- **No labels at all.** Don't create or apply state labels, and don't apply the `bug` / `enhancement` category labels that `/triage` asks for. State the category in the triage comment instead.
- **"What needs attention"** in `/triage` means the cards in Backlog, oldest first.
- **Only one issue in Started.** Triage never moves a card past Specified; Started and later columns follow the work itself (see `issue-tracker.md`).
