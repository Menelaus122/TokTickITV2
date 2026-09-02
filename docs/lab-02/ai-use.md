# Lab 2 — AI Use and Reflection

**LLM / agent used:** Claude Opus 5, through Claude Code (the terminal agent). <br>
**How it was used:** as an implementation assistant working one Issue at a time
against a written contract. I kept ownership of the specification, the
acceptance criteria, the review of every diff, and the decision about when
something was actually done.

---

## Selected key prompts

| # | Prompt (summarised) | What I did with the result |
| :--- | :--- | :--- |
| 1 | Read `Lab_02_labsheet.md` and the GitHub workflow guide carefully, then verify whether `MyIssue.md` covers all the content of this lab or not. | Before writing a single line of code I had the agent audit my own issue plan against the labsheet. It found six gaps — no test-implementation issue, no `reviewer.md` or `ai-use.md`, no README update, no screenshots, missing reference-data endpoints, and no application shell. I added Issues 8, 9, and 10 off the back of it, which is why the sprint plan grew from 7 issues to 10. |
| 2 | Renumber Issue 10 to Issue 8 and shift the others. This is a planning zone, so verify the flow is smooth — that following the issues in order will not make me repeat work or make things hard. | Asked for a dependency review rather than a mechanical renumber. It reported three friction points: the shell would be edited twice, all tests were deferred to one huge catch-up issue, and the delivery issue's criteria were not branch work. I acted on the first two by adding an explicit execution order (`1 → 2 → 3 → 4 → 8 → 5 → 6 → 7 → 9 → 10`) and moving per-feature tests into their own feature issues. |
| 3 | Implement only Issue 1. Also make sure you implement on the correct branch. | Reviewed the four contract documents it produced (`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`) before approving them. I checked that FR/BR/AC numbering was complete and that the decisions in §11 were ones I actually agreed with — particularly `X-Requester-Id` as the identity mechanism and 404-not-403 for ownership failures. |
| 4 | Implement Issue 5 and verify that it passes all acceptance criteria. Caution: don't push anything into the branch yet. | Standard shape I reused for every feature issue: name the issue, demand self-verification, and hold back the push so I could inspect first. Reviewed the three new server modules and confirmed with `curl` myself that a client-supplied `ticketNumber`, `requesterId`, and `currentStatus` were all discarded by the server. |
| 5 | Check the Pull Request message. I checked the backend per-file counts and found that they don't match the code — 11 and 18 should be 10 and 16. Verify whether I am right. | My reviewer caught the agent overstating per-file test counts in a PR description. I had it re-run the two files and confirm. He was right, and the agent had also got the UI count and the new-test total wrong. I had the PR body corrected. **Lesson: numbers an agent writes in prose are not evidence; only runner output is.** |
| 6 | Is this issue 45 changes? | The editor showed 45 changed files when the issue should have been ~16. The agent traced it to `client/tsconfig.json` setting neither `noEmit` nor `outDir`, so a bare `tsc` was emitting a `.js` beside every source file — which could then shadow the real `.ts` in module resolution. Fixed at the root cause and gitignored, in its own commit. |
| 7 | Verify that our web app satisfies every requirement in `Lab_02_labsheet.md`. | A full audit after Issue 9. It found that attaching files on the Create Ticket screen — labsheet §4.4 and §8.2, and my own FR-15 — had never been implemented, because Issue 5 built the form and Issue 7 built attachments against Ticket Detail. This became Issue 10. |
| 8 | Should we put the attachment fix into Issue 9 as well, so Issue 10 is only docs and we are done? | Asked for a recommendation rather than an instruction. It argued for keeping them separate — a feature inside a PR titled "Automated Test Suite" would not match the board, and Part 1 grades exactly that discipline — and flagged the one real cost, that `tests.md` would need editing twice. I took the advice. |
| 9 | Are you sure the attachment is the only feature we missed? Verify one final time. | I did not accept the first audit as complete. The second pass, which checked my own approved `ui-spec.md` and not just the labsheet headings, found three more: the success state was unreachable because the route navigated away from it, there was no Cancel action, and four of the six Part 6 state screenshots could not be captured. All four went into Issue 10. |
| 10 | Start working on Issue 10 and verify all acceptance criteria. Also I think you will have to screenshot the artifacts again, since we added a feature there. | I spotted that the committed screenshots no longer matched the changed Create Ticket screen. The agent re-captured all 21 rather than only the three new ones. |

---

## My Reflection

สิ่งที่ได้ผลดีที่สุดใน Lab นี้คือการใช้ AI ตรวจงานของตัวเองก่อนจะเชื่อผลลัพธ์
ผมสั่งให้มัน audit `MyIssue.md`(ไฟล์นี้อยู่ใน git ignore  ของผม) เทียบกับ labsheet ตั้งแต่ก่อนเริ่มเขียนโค้ด
ซึ่งทำให้เจอว่าแผนเดิม 7 issues ขาดเรื่อง test, reviewer.md, ai-use.md,
README และ screenshot ไปทั้งหมด และพอทำเสร็จแล้วผมก็สั่งให้ audit อีกครั้ง
เทียบกับ labsheet ทั้งฉบับ ครั้งนั้นเจอว่าหน้า Create Ticket ยังไม่มีไฟล์แนบ
ตามที่ 4.4 กำหนดไว้ ผมจึงให้ AI ตรวจซ้ำอีกรอบ
รอบที่สองเจอเพิ่มอีกสามข้อ รวมเป็นสี่ข้อที่กลายมาเป็น Issue 10 ทั้งหมด

โดยผมได้เรียนรู้ว่าเลขที่ AI เขียนบรรยาย**ใช้เป็นหลักฐานไม่ได้** ผมที่รีวิวเองพบว่า
AI เขียนจำนวนเทสต่อไฟล์ใน PR message ผิด (11 กับ 18 ทั้งที่จริงคือ 10 กับ 16)
พอให้ตรวจซ้ำก็พบว่าผิดมากกว่านั้นอีก ตั้งแต่นั้นมาผมเลยบังคับให้ทุกตัวเลขใน PR message
ต้องมาจาก output ของ test runner จริง ๆ และให้บวกเลขตรวจสอบว่าผลรวมตรงกัน
ก่อนเขียนลงไป 

วิธีเขียน prompt ที่ได้ผลกับผมคือ ระบุ issue เดียวต่อครั้ง แนบ acceptance criteria
เป็นข้อ ๆ สั่งให้ verify ตัวเองก่อนจบงาน และห้าม push ไว้ก่อนเพื่อให้ผมตรวจก่อนเสมอ
การถามความเห็น AI แทนการสั่งก็เวิร์คเหมือนกัน เช่น ถามว่าควรรวม fix เข้า Issue 9 ไหม ก็ได้คำตอบที่ดีกว่า
เพราะมันเสนอเหตุผลและข้อเสียมาให้ชั่งเอง สุดท้ายคนที่ตัดสินใจและรับผิดชอบยังเป็นผม
AI ช่วยให้เขียนได้เร็วขึ้นมาก แต่ส่วนที่ตัดสินว่างานเสร็จหรือยัง ยังต้องเป็นคนตรวจเองอยู่ดี
