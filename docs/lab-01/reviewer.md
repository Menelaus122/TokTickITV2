# Lab 1 — Peer Review Record  (fill this in)

**Author:** Poomipat Apiwattanaphong — 67070501035 — GitHub: [@Menelaus122](https://github.com/Menelaus122)
<br>**Peer reviewer:** Wirachat — 67070501041 — GitHub: [@WirachatTH](https://github.com/WirachatTH)

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
| :--- | :--- | :--- |
| 67070501041 | feature/1-project-foundation | Approved |
| 67070501041 | feature/2-health-check | Approved |
| 67070501041 | feature/3-category-seed | Approved |
| 67070501041 | feature/4-category-list | Approved |

| Feature | **Reviewer comment I received:** | **How I responded:** |
| :--- | :--- | :--- |
| feature1 | Reviewed and tested this locally against Issue 1's acceptance criteria. Looks good to me overall!<br><br>**What I checked:**<br>• Client: reachable, loads without errors<br>• Server: reachable, port:3000 correctly returns the "Not implemented" stub, which is expected.<br>• DB: confirmed reachable — I deliberately triggered an error to trigger a response from DB which succeeded.<br><br>*Wirachat 67070501041* | Thx for ur comment and merging na kub. I love you na. |
| feature2 | Worked well for me! I have confirmed by:<br>• Browsing `/api/health` and receiving the correct JSON body and status code.<br>• Understanding the messages returned to the front-end when the API both works and fails.<br><br>*Wirachat 67070501041* | Thx for ur comment and merging na kub. I love you na. |
| feature3 | I pulled down the branch and tested the full stack locally using Docker Compose. Everything works perfectly:<br><br>• **Migrations & Seeding:** The DB started up cleanly.<br>• **Categories verified:** The database correctly contains exactly the 4 expected categories (Account and Access, Hardware, Software, Network).<br>• **Documentation:** The updates to the README.md are clear and the Docker instructions work correctly.<br><br>*Wirachat 67070501041* | Thx for ur reviews and merge na kub. I will start on issue4 and will let u know when I done asap. |
| feature4 | I've run the tests for lab-01 in both the client and server directly inside the Docker containers to ensure all dependencies are resolved correctly. Both the API response and the React front-end work exactly as stated by the requirements. Well done!<br><br>*Wirachat 67070501041* | Thx you so much for ur support from start till very end kub. |

## Pull Requests I reviewed for my partner

| Me | Branch | Reviewer verdict |
| :--- | :--- | :--- |
| 67070501035 | feature/1-project-foundation | Approved |
| 67070501035 | feature/2-health-check | Approved |
| 67070501035 | feature/3-category-seed | Approved |
| 67070501035 | feature/4-category-list | Approved |

| Feature | **My comment:** | **Partner's response:** |
| :--- | :--- | :--- |
| feature1 | I have review your work leaw na. And I have pulled the branch, ran `docker compose -p friend-review up --build -d`, and went through it end to end. All good on my end:<br><br>• Frontend comes up clean on `:5173`, title's correct, renders with no console errors.<br>• Bootstrap (5.3.3) is in `client/package.json` and imported in `main.tsx` — styles are applying to the buttons/containers.<br>• Backend starts on `:3000`, logs the listening message, and `/api/health` returns JSON as expected (stub's in place for Issue 2).<br>• Postgres + Prisma — db healthcheck passes and Prisma connects fine; confirmed with a `prisma db pull`. Should be ready for the first migrate dev once the Category model lands in Issue 3.<br>• Tests run in both `client/` and `server/`. Client passes. Server health test fails, but that's expected — it's Issue 2's job.<br>• `.env.example` committed for both, and `.gitignore` is covering `node_modules/`, `.env`, `*.env`. No secrets in the repo.<br>• README is there with setup docs (Docker quick-start, local dev, Prisma, testing).<br><br>*Poomipat Apiwattanaphong 67070501035* | Thanks for your comment and approval! |
| feature2 | I cloned your branch fresh from GitHub, and ran the full stack with Docker:<br>• toktickit-db — PostgreSQL running<br>• toktickit-server — Express API on `http://localhost:3000/`<br>• toktickit-client — Vite on `http://localhost:5173/`<br><br>**Acceptance Criteria — All Passed**<br>• GET `/api/health` returns HTTP 200 with correct JSON Result: **PASS**<br>• Supertest test verifies the endpoint Result: **PASS**<br>• React page shows backend status from a real API call Result: **PASS**<br>• Useful error message shown when backend is unavailable Result: **PASS**<br><br>*Poomipat Apiwattanaphong 67070501035* | Thank you mak mak krub. I will continue to do the next feature ASAP. |
| feature3 | I have pulled and tested `feature/3-category-seed` locally with Docker. All acceptance criteria passed:<br><br>• **Prisma Category Model & Migration:** Verified with `npx prisma migrate status` that the schema and migration applied cleanly to PostgreSQL.<br>• **Seed Data Verification:** Verified via database query that all 4 categories (Account and Access, Hardware, Software, Network) were inserted correctly.<br>• **Seed Idempotency:** Ran `npx prisma db seed` multiple times and confirmed COUNT(*) remained 4 without creating duplicate records.<br>• **Security:** Confirmed real database credentials reside in ignored `.env` files while `.env.example` contains safe placeholders.<br>• **Documentation:** `README.md` includes clear verification commands.<br><br>Looks great! Approved and ready to merge kub.<br><br>*Poomipat Apiwattanaphong 67070501035* | Thank you for your confirmation! |
| feature4 | I have pulled and tested `feature/4-category-list` locally using Docker Compose. All acceptance criteria passed cleanly:<br><br>• **API Endpoint (GET /api/categories):** Returns HTTP 200 with the 4 seeded categories ordered by ID from PostgreSQL.<br>• **Supertest Verification:** Backend test suite passes 2/2 tests.<br>• **Frontend Integration:** React frontend dynamically fetches categories upon clicking [Check System].<br>• **UX / States:** Verified hourglass/loading state as well as graceful error handling ("System Status: Offline") when the server/DB is stopped.<br>• **Vitest UI Tests:** Client test suite passes 3/3 tests in `App.test.tsx`.<br>• **Clean Repository:** No `.env` or `node_modules` committed; `.gitignore` and `README.md` are up to date.<br><br>Approved and ready to merge!<br><br>*Poomipat 67070501035* | Thank you very much for your comment and support across the entire progress! |