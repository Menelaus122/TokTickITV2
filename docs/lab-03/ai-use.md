# Lab 3 — AI Use and Reflection

**LLM / agent used:** Claude Opus 5.5 through Claude Code (the terminal agent) for
the sprint, and Claude Opus 5 for Issue 1's two contract commits (`18d0231`,
`c22d96b`). Every AI-assisted commit names its model in a `Co-Authored-By` line. <br>
**How it was used:** first as a **spec agent** that drafted the Sprint 3 contract
(`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`) for me to review and
approve before any code (Issue 1, PR #46, approved in PR #47). Then as a
**coding agent** working one Issue at a time against that contract. I kept
ownership of the specification, the acceptance criteria, the review of every
diff, when to push, and the decision that something was done.

---

## Selected key prompts

| # | Prompt (as I typed it) | What I did with the result |
| :--- | :--- | :--- |
| 1 | My friend request change in PR#57 | The agent read my reviewer's whole review and fixed the blocking defect at its class rather than its one instance: any id above Int32 was a `500`, so one shared `positiveId` helper now bounds the queue, My Tickets, and every route id. It also fixed the four minor points. I checked that every case my reviewer listed now answered `400` or `200` before telling it to push and reply on the PR. |
| 2 | start issue9 | Before writing code, the agent reported two places where the approved contract could not be built as written. The authorization matrix forbade IT Staff from downloading attachments while AC-27 required it, and AC-23's "second claim is refused" could not be told apart from a reassignment. Both became recorded decisions (D-25, D-26) instead of silent choices, and I asked my reviewer to look at them first. |
| 3 | Is issue10 effect when issue9 got req change | I asked for a dependency answer before starting. The agent said to branch Issue 10 from `lab3-staging`, never from Issue 9's branch, so review fixes on #58 could not leak into it. It listed the shared files that would conflict at merge time, which is exactly what happened later. |
| 4 | will it effect git flow mention in `TokTickIT_GitHub_Workflow_Guide_TH_EN.md` if we start now | The agent read the guide rule by rule against our state, and found that #58 was not linked to its Issue: `Closes #42` does not link a PR into a non-default branch (Part 4). I linked it in the Development panel before starting Issue 10. |
| 5 | can you resolved conflict first becaude PR58 is merged | Merged `lab3-staging` into the Issue 10 branch rather than rebasing, so no force push was needed. Every conflict was two independent additions, and both were kept. I checked that the test totals after the merge were exactly Issue 9's plus Issue 10's (385 and 339), so nothing was lost. |
| 6 | should we go for issue11 | Asked for a recommendation. The agent said Issue 11 could start, but its user-management parts should wait for #59 to merge, because E2E tests that drive an unmerged screen would have to follow its review changes. By the time I said go, #59 had merged, so the whole issue was done in one pass. |
| 7 | start working on issue11 | The visual inspection was done by looking at the 81 screenshots, not only by assertions. It found a real defect, Ticket Numbers breaking across two lines in the tablet queue, and two raw `14px` font sizes. It also found that the users the E2E suite created were breaking the server suites. Each fix came with a test that fails without it. |
| 8 | my friend has review work and Req change | My reviewer showed that the agent's explanation in #60 was wrong: an intermittent Lab 2 failure came from a test fixture that depended on PostgreSQL's physical row order, not from E2E leftovers. The agent reproduced it on purpose before fixing it, then corrected its own PR note. It also reported honestly that the timeout change my reviewer suggested did not fix the client flakiness, and did not keep it. |
| 9 | start working on issue12 ensure everything is correct b4 push in branch and open pr | Then I changed my mind: no push and no PR until I had reviewed the work myself. Checking every claim in `reviewer.md` against GitHub found that #56 had never been linked to Issue 7, which I then had to fix by hand. |

---

## My Reflection

Lab นี้ต่างจาก Lab 2 ตรงที่ผมแยกบทบาทของ AI ออกเป็นสองแบบชัดเจน
แบบแรกคือ **spec agent** ที่ร่างสัญญาของ Sprint 3 ทั้งสี่ไฟล์ให้ผมอ่านและ approve
ก่อนจะมีโค้ดสักบรรทัด อีกแบบคือ **coding agent** ที่ทำงานทีละ issue ตามสัญญานั้น
สิ่งที่ผมได้เรียนรู้คือ spec ที่ผ่านการรีวิวแล้วก็ยังมีจุดขัดกันเองได้ และคนที่เจอก่อนคือ
coding agent ตอนลงมือทำจริง เช่น ตาราง authorization ห้าม IT Staff ดาวน์โหลดไฟล์แนบ
แต่ AC-27 บอกว่าต้องดาวน์โหลดได้ หรือกฎ "ห้ามเหลือ Administrator เป็นศูนย์"
ที่ request เดียวไม่มีทางไปถึงได้เลย สิ่งที่ผมให้ทำทุกครั้งคือห้ามเลือกเงียบ ๆ
ต้องบันทึกเป็น decision (D-25 ถึง D-27) และบอกคนรีวิวให้ดูจุดนั้นก่อน

ส่วนที่ผมยังคุมเองทั้งหมดคือ git flow และการตัดสินใจว่าจะ push เมื่อไหร่
การถามความเห็นก่อนสั่ง เช่น "Issue 10 จะโดนผลกระทบไหมถ้า Issue 9 ถูกขอแก้" หรือ
"เริ่ม Issue 11 เลยดีไหม" ได้คำตอบที่ช่วยให้ไม่ต้องทำงานซ้ำ สรุปคือ AI ทำให้ผมทำงานได้เร็วขึ้นมาก แต่ความถูกต้องของงาน
ยังมาจากการรีวิวของเพื่อนและการที่ผม verify ก่อนจะ push 
