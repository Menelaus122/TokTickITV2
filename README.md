# TokTickIT

An IT Service Desk application, built up over a series of issues across two labs.
Lab 2 delivers the Requester-facing ticketing experience: choose a Development
Requester, create a ticket with attachments, find it again in My Tickets, and
manage its attachments from Ticket Detail.

- **Frontend** — React + TypeScript + Vite, React Router, Bootstrap layout with a Zen Green theme
- **Backend** — Node.js + Express + TypeScript, Multer for uploads
- **Database** — PostgreSQL via Prisma
- **Testing** — Vitest (both apps), Supertest (backend API), Playwright (E2E + responsive)
- **Containers** — Docker Compose for the database and both apps

## Progress

**Lab 1 — foundation**

- [x] **Issue 1** — Project foundation (frontend, backend, database, tests, Docker)
- [x] **Issue 2** — API health check + live backend status on the React page
- [x] **Issue 3** — `Category` model, migration, and idempotent seed
- [x] **Issue 4** — Category list endpoint and UI

**Lab 2 — Requester ticketing MVP**

- [x] **Issue 1** — Sprint specification, test plan, UI spec, and API contract
- [x] **Issue 2** — Data model and idempotent seed
- [x] **Issue 3** — Zen Green UI foundation
- [x] **Issue 4** — Development Requester context and selection screen
- [x] **Issue 5** — Ticket creation
- [x] **Issue 6** — My Tickets list with search, filters, sorting, and pagination
- [x] **Issue 7** — Ticket Detail and the attachment lifecycle
- [x] **Issue 8** — Application shell navigation and routing
- [x] **Issue 9** — E2E and responsive suites with visual artifacts
- [x] **Issue 10** — Create Ticket completion (attachments, success state, Cancel)
- [x] **Issue 11** — Staging integration, documentation, and delivery

> **Note on Lab 2 authentication.** There is none, by design. A Development
> Requester selector stands in for login so requester-specific behaviour can be
> tested. It is not authentication and is labelled as such throughout the app.
> Real authentication arrives in Lab 3.

## Project layout

```
.
├── client/              # React + TS + Vite frontend
│   ├── src/components/  # Zen Green UI foundation (form, buttons, badges, states)
│   ├── src/screens/     # Requester Selection, Create Ticket, My Tickets, Ticket Detail
│   └── tests/lab-02/    # UI component and UI style tests
├── server/              # Express + TS backend, Prisma schema & seed
│   ├── src/             # routes plus pure modules: validation, ticket numbers, attachments
│   └── tests/lab-02/    # unit and API tests
├── e2e/lab-02/          # Playwright end-to-end and responsive suites
├── artifacts/lab-02/    # screenshots for the visual checklist
├── docs/lab-01/         # Lab 1 documentation
├── docs/lab-02/         # Lab 2 specification, tests, UI spec, API spec, reviewer, AI use
├── docker-compose.yml   # db + server + client dev stack
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (built and tested on Node 22/24)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL / the full stack)

---

## Quick start with Docker (recommended)

```bash
docker compose up --build                              # start db + server + client
docker compose exec server npx prisma migrate deploy   # apply migrations
docker compose exec server npm run prisma:seed         # seed reference data and requesters
```

Then open:

- Frontend: <http://localhost:5173>
- Backend health check: <http://localhost:3000/api/health>
- PostgreSQL: `localhost:5432` (user `toktickit`, password `toktickit`, db `toktickit`)

The app opens on the **Development Requester Selection** screen. Pick one of the
four seeded Requesters and press **Continue** to enter the application.

Stop the stack (keeps the database volume):

```bash
docker compose down
```

You can also run **just the database** in Docker and the apps on your host:

```bash
docker compose up -d db
```

---

## API

Every requester-scoped endpoint requires the current Development Requester in an
`X-Requester-Id` header. Identity is never read from a request body or query
string, and a ticket or attachment belonging to another Requester returns `404` —
the same answer as one that does not exist, so the API never discloses it.

| Method | Endpoint | Requester context | Description |
|--------|----------|:--:|-------------|
| GET | `/api/health` | — | Backend health/liveness check |
| GET | `/api/categories` | — | Active ticket categories |
| GET | `/api/related-systems` | — | Active related systems |
| GET | `/api/requesters` | — | Active Development Requesters for the selector |
| POST | `/api/tickets` | ✔ | Create one validated ticket; the server generates the Ticket Number |
| GET | `/api/tickets` | ✔ | The requester's tickets, with search, filters, sorting, and pagination |
| GET | `/api/tickets/:id` | ✔ | One owned ticket, with its attachments |
| POST | `/api/tickets/:id/attachments` | ✔ | Upload one permitted file (JPG/JPEG/PNG/WEBP/PDF, ≤ 5 MB, 5 active max) |
| GET | `/api/tickets/:id/attachments` | ✔ | Attachment metadata, active and removed |
| GET | `/api/attachments/:id/download` | ✔ | Download an active attachment |
| PATCH | `/api/attachments/:id/remove` | ✔ | Soft-remove an attachment, with a required reason |

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"TokTickIT API"}

curl http://localhost:3000/api/requesters
# [{"id":1,"fullName":"Anucha Wongsawat","email":"…","department":"Civil Engineering"}, …]

curl http://localhost:3000/api/tickets -H "X-Requester-Id: 1"
# {"data":[ … ],"meta":{"page":1,"pageSize":10,"totalItems":0,"totalPages":0,…}}
```

The full contract — request and response shapes, query parameters, error codes,
and status codes — is in [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md).

---

## Local development (host)

### 1. Environment files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`.env` files are git-ignored — never commit real secrets.

### 2. Backend

```bash
cd server
npm install
npx prisma generate     # regenerate the Prisma client after a schema change
npm run dev             # http://localhost:3000
```

Requires a reachable PostgreSQL matching `DATABASE_URL` in `server/.env`
(use `docker compose up -d db` for a local one).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the API with hot reload (tsx watch) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the Vitest + Supertest suite |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:seed` | Seed the database |

Uploaded attachment files are written to `server/uploads/`, which is git-ignored.
The metadata that matters lives in PostgreSQL.

### 3. Frontend

```bash
cd client
npm install
npm run dev             # http://localhost:5173
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest component tests |

> `client/tsconfig.json` sets `noEmit`. Vite does the building, so a bare `tsc`
> only type-checks instead of scattering `.js` files beside the sources.

---

## Testing

The suite runs at six levels: unit, API, UI component, UI style, responsive, and
end-to-end. Current totals and the full runner output are recorded in
[`docs/lab-02/tests.md`](docs/lab-02/tests.md).

### Backend — unit and API

Run inside the server container so the tests reach the seeded PostgreSQL over
the compose network (`db:5432`):

```bash
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
docker exec toktickit-server npx vitest run --reporter=verbose
```

The migrate and seed lines are only needed on a fresh database; the seed is
idempotent, so running them again on a seeded one changes nothing.

> Run this via `docker exec`, not a plain `npm test` on the host. A native
> PostgreSQL listening on `localhost:5432` can shadow the Docker database from
> the host and make the backend tests fail authentication.

### Frontend — UI component and UI style

No database needed; the API module is mocked.

```bash
cd client
npx vitest run --reporter=verbose
```

### End-to-end and responsive

These drive a real stack, so the database, API, and client must be running:

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
npx playwright install chromium   # first run only
npx playwright test --reporter=list
```

The suite selects a Requester and picks a Category and Related System from the
dropdowns, so it fails on an unseeded database with nothing to select.
Screenshots are written to `artifacts/lab-02/screenshots/`. Point the suite at a
stack on non-default ports with `E2E_BASE_URL` and `E2E_API_URL`.

The E2E suite creates tickets it cannot delete — Lab 2 exposes no delete
endpoint by design. Reset afterwards with:

```bash
docker exec toktickit-db psql -U toktickit -d toktickit -c 'DELETE FROM "Ticket";'
```

> This deletes **every** ticket, including any you created by hand in the
> running app. The suite prints the ids it created, but that line is printed
> before the responsive spec has finished creating its own, so it is not the
> full list. To keep tickets of your own, delete by id range instead and remove
> the matching files from `/app/uploads` in the server container — the cascade
> clears the `Attachment` rows but not the uploaded files.

### Everything

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
docker exec toktickit-server npx vitest run --reporter=verbose
(cd client && npx vitest run --reporter=verbose)
npx playwright test --reporter=list
```

Test files live under `server/tests/lab-02/`, `client/tests/lab-02/`, and
`e2e/lab-02/`. Lab 1's suites remain under `*/tests/lab-01/` and still pass.

---

## Database (Prisma)

The Prisma schema lives at `server/prisma/schema.prisma` and points at
PostgreSQL via `DATABASE_URL`.

### Models

| Model | Purpose |
|-------|---------|
| `RequesterUser` | The temporary Lab 2 Development Requester. No password, role, or session column — it is a testing identity, not an account. |
| `Category` | Ticket classification (from Lab 1; Lab 2 adds `isActive`) |
| `RelatedSystem` | The service, application, device, or platform a ticket is about |
| `Ticket` | Unique backend-generated `ticketNumber`, `NEW` status, and foreign keys to requester, category, and related system |
| `Attachment` | Upload metadata plus the soft-removal columns |

Soft removal is a single nullable `removedAt` timestamp rather than a boolean
plus a date, so `removedAt IS NULL` *is* the definition of active and the two
facts cannot drift apart. The full data design and its justifications are in
[`docs/lab-02/specification.md`](docs/lab-02/specification.md) §7.

### Seed data

The seed is **idempotent** — every write is an `upsert` on a unique column, so
running it repeatedly never creates duplicates:

- 4 ticket categories — Account and Access, Hardware, Software, Network
- 7 related systems — Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop
- 4 **active** Development Requesters, plus 1 **inactive** one that must never appear in the selector

### Migrate & seed (via Docker)

```bash
docker compose up -d                                  # start the stack
docker compose exec server npx prisma migrate deploy  # apply migrations
docker compose exec server npm run prisma:seed        # seed
```

Host-run equivalents (`cd server` first, with the DB reachable on `localhost`):

```bash
npx prisma generate               # regenerate the client
npx prisma migrate dev --name x   # create & apply a new migration
npm run prisma:seed               # seed data
```

> **Notes**
> - The Alpine-based backend image installs `openssl`, which Prisma's engines require.
> - If you have a **local PostgreSQL** already listening on `localhost:5432`, it
>   can shadow the Docker database from the host. Running Prisma inside the
>   container (as above) avoids the conflict.

---

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/lab-02/specification.md`](docs/lab-02/specification.md) | Sprint goal, scope, FR-01…FR-33, BR-01…BR-46, data design, AC-01…AC-28, Definition of Done |
| [`docs/lab-02/tests.md`](docs/lab-02/tests.md) | Test plan, AC traceability, visual checklist, commands, and final results |
| [`docs/lab-02/ui-spec.md`](docs/lab-02/ui-spec.md) | Zen Green tokens, component states, screen layouts, responsive and accessibility rules |
| [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md) | REST contract, error envelope, status codes |
| [`docs/lab-02/reviewer.md`](docs/lab-02/reviewer.md) | Peer review record — approvals, comments, and responses |
| [`docs/lab-02/ai-use.md`](docs/lab-02/ai-use.md) | AI use, key prompts, and reflection |
