# Lab 4 — AI Use and Reflection

**LLM / agent used:** Claude Sonnet 5.5 through Claude Code (the terminal agent) for the whole sprint, and Claude
Opus 5.5 for one step at the start: decomposing the labsheet into the 11 GitHub Issues (#67 to #77), before I switched
models with `/model` at 2026-10-05 14:25 UTC. Claude Code's session log records the model of every message: the first
36 are Opus 5.5 and every later one is Sonnet 5.5. Three commits (`a8adf5a`,
`042f5cf`, `02bf77d`) end with a `Co-Authored-By` line naming Claude Sonnet 5.5. After prompt 4 below I asked for no
AI attribution in commits or Pull Requests, so no later commit carries a model name, and the commit history cannot be used to
count the AI-assisted work in this sprint; the session log can. <br>
**How it was used:** first as a **spec agent** that drafted the Sprint 4 contract (`specification.md`, `tests.md`,
`ui-spec.md`, `api-spec.md`) for me to review and for my reviewer to approve before any code (Issue 1, PR #78). Then as a
**coding agent** working one Issue at a time against that contract (Issues 2 to 11). I kept ownership of the
specification, the acceptance criteria, the review of every diff, when to commit and push, what is posted on GitHub
under my name, and the decision that something was done.

---

## Selected key prompts

| # | Prompt (as I typed it) | What came of it |
| :--- | :--- | :--- |
| 1 | *(Opus 5.5)* "Please read docs/lab-04/labsheet/Lab_04_labsheet.md and docs/lab-03/MyIssue.md. Run the /to-tickets skill to decompose Lab 4 into GitHub Issues following TokTickIT conventions: 1. Follow Lab 4 Section 11 as the baseline decomposition. 2. Structure the output into `docs/lab-04/MyIssue.md`. 3. For each Issue, include: Issue Number & Title, Branch name … (targeting `lab4-staging`), Execution Order / Blocked By, Detailed Acceptance Criteria mapped to labsheet requirements (FR, BR, AC, and file paths). 4. Ensure Issue 1 is the Sprint 4 Engineering Contract (spec, api-spec, ui-spec, tests) which must be completed and merged first." | Eleven Issues, with the changes from the labsheet's §11 baseline explained instead of made silently: a new Issue 2, because labsheet §4.3 gives Administrators IT Staff behaviour and so reverses Lab 3's BR-19; the Actions Taken foundation split into the data (Issue 3) and the API (Issue 4); the dashboards split in two, because Parts 5 and 8 grade them separately. It also named the labsheet's contradictions before any code, the biggest being that Part 6 grades "assign, complete, cancel, inactive-assignee rejection" while none of those is in the Action Taken field list. It asked whether the granularity and the "blocked by" links were right before creating anything on GitHub; I answered "approve". |
| 2 | "create lab4-staging and start issue 1" | The four contract files, with every acceptance criterion mapped to a planned test and a script that checks every cited ID is defined. It listed the decisions it had made without asking (an Administrator performs IT Staff operations, D-08; the Dashboard is every role's landing page, D-09; any IT Staff member can edit any action, D-13; no action on a resolved ticket, D-14) so that I and my reviewer could overrule them. It asked me two questions only I could answer, and recorded my answers: Action Taken is a record with no assignee or status (D-06), and the resolve gate needs an action whose follow-up is not pending (D-07). |
| 3 | "My friend has review our PR#78" | The agent checked each point of the review against the code before accepting it, then changed the gate to read the most recently *recorded* action instead of the latest *dated* one (BR-17, BR-18, D-07, and a new test, WF-19), dropped the Administrator's account links to User Management lists (D-12), and kept D-06 while writing down the other reading and which Issues it would change. The reply was drafted, and I asked to see it before it was posted ("commit and push, then show me the reply first"). My reviewer approved after the second commit (`042f5cf`). |
| 4 | "I don't want generate with claude code", then "drop that trailer from future commits too?" | The footer was removed from PR #79 and the agent said it would add none to later Pull Requests; for commits, it asked whether to drop the `Co-Authored-By` line too, and my answer ("drop that trailer from future commits too?") was read as a yes. The three commits already made keep it (`a8adf5a` and `042f5cf` were merged, and `02bf77d` was on a branch under review, so rewriting them would have meant a force push). This is why the paragraph above does not rely on the commit history. |
| 5 | "start issue 2 and after finish verify everythings you claim first before you deliver your work to me" (typed in the same words for Issues 2 to 11) | Each Issue came back with its numbers re-run and with the code deliberately broken to see whether the tests noticed. In the fix for the review of PR #88 it broke the application 17 more ways and one survived (Undo of "appears resolved" had no test of a repeated press within one task), so that test was written. In Issue 10 it broke the application 20 ways and all 20 were caught (`tests.md` §8.1). It also cut or corrected sentences in its own Pull Request drafts that it could not back with what it had seen, before anything was posted (#84, #89). |
| 6 | "do we need to link #82 with anything" | Rather than guess, the agent read GitHub: #82 was connected to Issue 1 (#67) by mention and to #81 both ways, no card was needed because Pull Requests are not cards on the board, and the only missing piece was an optional `Closes #67`. No formal link was added, so the Development panel of #82 (and of #84, which has no Issue of its own) is empty, and `reviewer.md` says so. |
| 7 | "separate small PR" | After the review of #83 found that the form's own default Action Date/Time is refused on a ticket created in the current minute, I asked for the fix to go in its own Pull Request rather than grow the big one. It became #84 (one commit, two files): the failure was reproduced first against the merged code with a live script, six deliberate breaks were run against the fix, and the agent corrected a sentence in its own description that said more than it had seen. |
| 8 | "My friend has reviewed our PR#88" | The review showed that the agent's first explanation of the flaky client suites ("the machine is loaded") was wrong. A test whose screen called an api function nobody had mocked sent a real request to `localhost:3000`; the real API answered 401 and the app turned the running test into the Login screen. The agent reproduced it (with the API up, 3 of 5 full client runs failed; with it stopped, 8 of 8 runs of the navigation files passed), added a guard that gives every test an offline `fetch` and fails any test that reaches for it, and fixed the second blocking item, a form pressed three times in one task, with one shared `useSingleFlight` hook (nine of the 16 forms failed the new test before the fix). |
| 9 | "My friend has reviewed our PR#89" | My reviewer ran the branch on a freshly seeded database and found three checks that passed only on my large one. The agent built a second, empty stack so my own database was not touched, reproduced each finding there before changing anything, and found something the review had not: the Docker VM's clock steps back by about 0.7 s every 32.8 s, which made rows made a fraction of a second apart come out of order. It fixed the tests to read the server's own stamps and left the server's ordering alone, because that ordering is the contract. My reviewer then found one hole in that tolerance, which the agent reproduced and closed in the Pull Request of Issue 11 (`tests.md` §8.4). |

---

## My Reflection

Lab 4 ผมใช้ AI สองบทบาทเหมือน Lab 3 บทบาทแรกคือ spec agent ที่ร่าง flow ของ Sprint 4 ทั้งสี่ไฟล์ให้เพื่อนรีวิวก่อนมีโค้ดสักบรรทัด (Issue 1) อีกบทบาทคือ coding agent ที่ทำทีละ issue ตาม flow นั้น (Issue 2-11)

สิ่งที่เปลี่ยนจาก Lab 3 คือผมสั่งทุก issue ด้วยประโยคเดียวกันว่า “verify everythings you claim first before you deliver your work to me” agent เลยต้องส่งงานพร้อมของที่รันจริง ไม่ใช่แค่บอกว่า "ผ่านแล้ว" เช่น ใน Issue 10 จงใจทำโค้ดผิด 20 แบบ test จับได้ครบ แต่ประโยคนี้ก็ไม่ได้กันความผิดพลาดได้หมด

AI ผิดได้ และคนที่จับได้ก่อนคือเพื่อนที่รีวิว ใน PR #88 agent บอกว่า test ฝั่ง client พังเพราะเครื่องโหลดหนัก เพื่อนบอกว่าไม่ใช่ พอพิสูจน์ใหม่ก็พบว่ามี test ที่ลืม mock ไปเรียก API จริงจนได้ 401

ส่วน PR #89 เพื่อนรันบนฐานข้อมูลที่เพิ่ง seed แล้วเจอ test สามตัวที่ผ่านเฉพาะบนฐานข้อมูลใหญ่ของผม ผมกับ agent ไม่เคยเห็นเลยเพราะรันบนเครื่องเดียวกันตลอด agent เลยสร้าง stack ที่สองแบบว่างเปล่ามาทำซ้ำทุกข้อก่อนแก้ และเจอเพิ่มว่านาฬิกาของ Docker VM ถอยหลังราว 0.7 วินาทีทุก 32.8 วินาที ทำให้ลำดับแถวผิดได้

ผมได้เรียนรู้ว่า "ผ่านบนเครื่องผม" ยังไม่ใช่หลักฐาน และการให้เพื่อนรันบนเครื่องที่ต่างออกไปมีค่ากว่าให้ agent รันซ้ำบนเครื่องเดิม

ส่วนที่ผมยังคุมเองคือ git flow กับการตัดสินใจว่าอะไรจะถูกโพสต์ในนามผม agent ไม่ commit และไม่ push จนกว่าผมจะสั่ง ข้อความตอบรีวิวต้องให้ผมอ่านก่อนโพสต์ ผมสั่งไม่ให้ใส่ชื่อ Claude ใน commit หรือ PR ตั้งแต่ Issue 2 (เลยเหลือสาม commit แรกที่ยังมี Co-Authored-By) เพื่อนเป็นคน merge ทุก PR และผมปิด issue เอง

สิ่งที่ผมพลาดคือเห็นรีวิวที่ “approve” แล้วข้ามข้อเล็ก ๆ ที่ผู้รีวิวขอไว้ testTimeout ของ server ที่ขอใน PR #88 ต้องถูกขอซ้ำใน PR #89 และตอนตรวจก่อนส่ง Issue 11 ยังเจออีกสองข้อที่ค้างมา คือบรรทัดใน README เรื่อง seed จาก PR #80 และการรัน client mutation อีก 40 ตัวจาก PR #85 ครั้งหน้าผมจะให้ agent จดข้อเล็ก ๆ ของทุกรีวิวเป็นรายการงานตั้งแต่วันที่รีวิวมาถึง
