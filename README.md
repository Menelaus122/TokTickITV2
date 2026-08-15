# TokTickIT

A small IT Service Desk application, built up over a series of issues.

- **Frontend** — React + TypeScript + Vite, styled with Bootstrap
- **Backend** — Node.js + Express + TypeScript
- **Database** — PostgreSQL via Prisma
- **Testing** — Vitest (both apps) + Supertest (backend API)
- **Containers** — Docker Compose for the database and both apps

## Progress

- [x] **Issue 1** — Project foundation (frontend, backend, database, tests, Docker)
- [x] **Issue 2** — API health check + live backend status on the React page
- [ ] **Issue 3** — Create and seed IT request categories
- [ ] **Issue 4** — Category list endpoint and UI

> Routes/components for the remaining issues are present as clearly marked
> `TODO(Issue N)` stubs.

## Project layout

```
.
├── client/            # React + TS + Vite frontend
├── server/            # Express + TS backend, Prisma schema & seed
├── docs/              # Lab documentation
├── docker-compose.yml # db + server + client dev stack
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (built and tested on Node 22/24)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL / the full stack)

---

## Quick start with Docker (recommended)

Runs the database, backend, and frontend together with hot reload:

```bash
docker compose up --build
```

Then open:

- Frontend: <http://localhost:5173>
- Backend health check: <http://localhost:3000/api/health>
- PostgreSQL: `localhost:5432` (user `toktickit`, password `toktickit`, db `toktickit`)

Stop the stack (keeps the database volume):

```bash
docker compose down
```

You can also run **just the database** in Docker and the apps on your host:

```bash
docker compose up -d db
```

On the frontend, click **Check System** to call the backend: a green **Online**
badge confirms the API is healthy, and a red **Offline** badge with a helpful
message appears if the backend is unreachable.

---

## API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/health` | Backend health/liveness check | `200 { "status": "ok", "service": "TokTickIT API" }` |

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"TokTickIT API"}
```

> More endpoints (category list) arrive with Issue 4.

---

## Local development (host)

### 1. Environment files

Copy the example env files and adjust if needed:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`.env` files are git-ignored — never commit real secrets.

### 2. Backend

```bash
cd server
npm install
npx prisma generate     # generates the Prisma client (once models exist)
npm run dev             # http://localhost:3000
```

Requires a reachable PostgreSQL matching `DATABASE_URL` in `server/.env`
(use `docker compose up -d db` for a local one).

Useful backend scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the API with hot reload (tsx watch) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the Vitest + Supertest suite |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:seed` | Seed the database |

### 3. Frontend

```bash
cd client
npm install
npm run dev             # http://localhost:5173
```

Useful frontend scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest component tests |

---

## Testing

```bash
# Backend (Vitest + Supertest)
cd server && npm test

# Frontend (Vitest + Testing Library)
cd client && npm test
```

Lab test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

---

## Database (Prisma)

The Prisma schema lives at `server/prisma/schema.prisma` and points at
PostgreSQL via `DATABASE_URL`. Data models and migrations are introduced in a
later issue. Common commands:

```bash
cd server
npx prisma generate               # regenerate the client
npx prisma migrate dev --name x   # create & apply a migration
npm run prisma:seed               # seed data
```
