# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** <Claude Opus 4.8>

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Implement Issue 1 (TokTickIT foundation): setup React/Express/Prisma scaffolding, create Docker containers, verify the stack, and do not push to the branch. | Reviewed the generated `docker-compose.yml`, Dockerfiles, and `README.md`. Confirmed the local stack built and ran successfully, then manually committed and pushed the changes. |
| 2 | I still don't see the Docker containers, so create and run them for me. | Verified that the agent brought the stack back up. Checked Docker Desktop to confirm `toktickit-db`, `toktickit-server`, and `toktickit-client` were running on their respective ports. |
| 3 | Implement Issue 2 (API health check): update `GET /api/health` to return 200, verify with Supertest, connect the React frontend to show real backend status with error handling, and verify without pushing. | Reviewed the backend route logic, frontend API call, and tests. Verified that the React page correctly displayed the "ok" status and tested the error state when the backend was down. Manually committed the changes. but still see that it returned 304 so it lead me to prompt4 |
4 | I still see that the error get api/health is 304 fix it for me. | Reviewed the agent's changes to disable caching (such as adding `Cache-Control` headers to the backend or updating the frontend fetch request) and verified that the endpoint now explicitly returns a `200 OK` status instead of a cached `304`. |
| 5 | *[Add your next prompt here]* | *[Add what you did with the result here]* |
| 6 | *[Add your next prompt here]* | *[Add what you did with the result here]* |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.
