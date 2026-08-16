# Lab 1 — Peer Review Record  (fill this in)

**Author:** <your name> — <student id> — GitHub: @<username>
**Peer reviewer:** <partner name> — <student id> — GitHub: @<username>

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
|  67070501041  | feature/1-project-foundation | Reviewed and tested this locally against Issue 1's acceptance criteria. Looks good to me overall!

What I checked:

Client: reachable, loads without errors
Server: reachable, port:3000 correctly returns the "Not implemented" stub, which is expected.
DB: confirmed reachable — I deliberately triggered an error to trigger a response from DB which succeeded. |
|  67070501041  | feature/2-health-check | Worked well for me! I have confirmed by:
Browsing /api/health and receiving the correct JSON body and status code.
Understanding the messages returned to the front-end when the API both works and fails.
Wirachat 67070501041 |
|  67070501041  | feature/3-category-seed |  |
|  67070501041  | feature/4-category-list |  |

Reviewer comment I received: <...>
How I responded: <...>

## Pull Requests I reviewed for my partner

| Me | Branch | Reviewer verdict |
|----|--------|------------------|
|  67070501035  |  feature/1-project-foundation| I have review your work leaw na. And I have pulled the branch, ran docker compose -p friend-review up --build -d, and went through it end to end. All good on my end:

Frontend comes up clean on :5173, title's correct, renders with no console errors.
Bootstrap (5.3.3) is in client/package.json and imported in main.tsx — styles are applying to the buttons/containers.
Backend starts on :3000, logs the listening message, and /api/health returns JSON as expected (stub's in place for Issue 2).
Postgres + Prisma — db healthcheck passes and Prisma connects fine; confirmed with a prisma db pull. Should be ready for the first migrate dev once the Category model lands in Issue 3.
Tests run in both client/ and server/. Client passes. Server health test fails, but that's expected — it's Issue 2's job.
.env.example committed for both, and .gitignore is covering node_modules/, .env, *.env. No secrets in the repo.
README is there with setup docs (Docker quick-start, local dev, Prisma, testing).|
|  67070501035  | feature/2-health-check | I cloned your branch fresh from GitHub, and ran the full stack with Docker:

toktickit-db — PostgreSQL running
toktickit-server — Express API on http://localhost:3000/
toktickit-client — Vite on http://localhost:5173/

Acceptance Criteria — All Passed

GET /api/health returns HTTP 200 with correct JSON Result: PASS
Supertest test verifies the endpoint Result: PASS
React page shows backend status from a real API call Result: PASS
Useful error message shown when backend is unavailable Result: PASS|
|  67070501035  | feature/3-category-seed |  |
|  67070501035  | feature/4-category-list |  |
My comment: <...>
Partner's response: <...>

