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
- [x] **Issue 3** — `Category` model, migration, and idempotent seed
- [x] **Issue 4** — Category list endpoint and UI

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
| GET | `/api/categories` | Supported request categories from PostgreSQL, in id order | `200 [ { "id": 1, "name": "Account and Access" }, … ]` |

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"TokTickIT API"}

curl http://localhost:3000/api/categories
# [{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},{"id":3,"name":"Software"},{"id":4,"name":"Network"}]
```

`/api/categories` reads from PostgreSQL via Prisma, so the database must be
migrated and seeded first (see [Database (Prisma)](#database-prisma)). On the
frontend, clicking **Check System** shows the **Online** badge followed by the
numbered list of categories returned by this endpoint.

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
PostgreSQL via `DATABASE_URL`.

### Model

```prisma
model Category {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())
}
```

The seed inserts four IT request categories — **Account and Access, Hardware,
Software, Network** — and is **idempotent** (uses `upsert`, so running it more
than once never creates duplicates).

### Migrate & seed (via Docker)

Run Prisma inside the backend container so it reaches the database over the
compose network (`db:5432`) and matches the container's environment:

```bash
docker compose up -d                                  # start the stack
docker compose exec server npx prisma migrate deploy  # apply migrations
docker compose exec server npx prisma db seed         # seed the categories
```

Common commands (host-run: `cd server` first, with the DB reachable on `localhost`):

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
