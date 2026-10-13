# TokTickIT

An IT Service Desk application, built up over a series of issues across four labs.
Lab 2 delivered the Requester-facing ticketing experience: create a ticket with
attachments, find it again in My Tickets, and manage its attachments from Ticket
Detail. Lab 3 added real users and roles: sign-in with a forced first password
change, Public Comments and Internal Notes, an IT Staff queue and ticket detail
for claiming, prioritising, and resolving tickets, and Administrator user
management. Lab 4 finishes the service-desk loop: IT Staff and Administrators
record **Actions Taken** under a ticket, a ticket cannot be Resolved until that
work is recorded and no follow-up is left pending, every status change is kept
in an append-only **Status History**, stale and double writes are handled, and
each role opens on a **Dashboard** computed by the backend, whose cards lead to
the filtered lists.

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

**Lab 3 — users, roles, IT Staff ticketing, and administration**

- [x] **Issue 1** — Sprint 3 engineering contract (specification, tests, UI spec, API spec)
- [x] **Issue 2** — User model, Lab 2 migration, and seed
- [x] **Issue 3** — Authentication API (sign-in, sign-out, current user, password change)
- [x] **Issue 13** — Login attempt throttling
- [x] **Issue 4** — Authorization and safe errors
- [x] **Issue 5** — Login, mandatory password change, and app shell
- [x] **Issue 6** — Requester regression on the authenticated identity
- [x] **Issue 7** — Public Comments and Internal Notes
- [x] **Issue 8** — IT Staff Ticket Queue
- [x] **Issue 9** — IT Staff Ticket Detail operations
- [x] **Issue 10** — Administrator User Management
- [x] **Issue 11** — E2E suite and visual inspection evidence
- [x] **Issue 12** — Staging integration, documentation, and delivery

**Lab 4 — Actions Taken, Ticket workflow, Dashboards, and final regression**

- [x] **Issue 1** — Sprint 4 engineering contract (specification, tests, UI spec, API spec)
- [x] **Issue 2** — Administrator access to IT Staff ticket operations
- [x] **Issue 3** — Actions Taken data model, migration, and seed
- [x] **Issue 4** — Actions Taken API
- [x] **Issue 5** — Actions Taken UI on Ticket Detail
- [x] **Issue 6** — Ticket workflow and resolution gate
- [x] **Issue 7** — Requester Dashboard
- [x] **Issue 8** — IT Staff and Administrator Dashboard
- [x] **Issue 9** — Final hardening and full regression
- [x] **Issue 10** — Lab 4 E2E suite and visual evidence
- [x] **Issue 11** — Staging integration, documentation, and delivery

> **Note on Lab 2 authentication.** Lab 2 had none, by design: a Development
> Requester selector stood in for login. Lab 3 replaced it with real sign-in;
> since Lab 3 Issue 6 the selector, its `X-Requester-Id` header, and
> `GET /api/requesters` are gone, and the Lab 2 screens act as the signed-in
> Requester.

## Project layout

```
.
├── client/              # React + TS + Vite frontend
│   ├── src/components/  # Zen Green UI foundation (form, buttons, badges, states, shell, threads),
│   │                    # Actions Taken, Status History, metric cards
│   ├── src/screens/     # Login, Change Password, the Requester screens, the two Dashboards,
│   │                    # Ticket Queue, IT Staff Ticket Detail, User Management
│   └── tests/lab-0{1,2,3,4}/  # UI component and UI style tests, per lab
├── server/              # Express + TS backend, Prisma schema, migrations & seed
│   ├── src/             # routes plus pure modules: validation, query parsing, transitions,
│   │                    # the resolution gate, user rules
│   ├── prisma/rollback/ # the SQL that undoes the Lab 4 migration
│   └── tests/lab-0{1,2,3,4}/  # unit, API, authorization, workflow, dashboard, migration, and
│                              # hardening tests, per lab
├── e2e/lab-0{2,3,4}/    # Playwright end-to-end and responsive suites
├── artifacts/lab-0{2,3,4}/  # screenshots for each lab's visual checklist
├── docs/lab-01/         # Lab 1 documentation
├── docs/lab-02/         # Lab 2 specification, tests, UI spec, API spec, reviewer, AI use
├── docs/lab-03/         # Lab 3 specification, tests, UI spec, API spec, reviewer, AI use
├── docs/lab-04/         # Lab 4 specification, tests, UI spec, API spec, reviewer, AI use
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
docker compose exec server npm run prisma:seed         # seed reference data, accounts, and sample tickets
```

Then open:

- Frontend: <http://localhost:5173>
- Backend health check: <http://localhost:3000/api/health>
- PostgreSQL: `localhost:5432` (user `toktickit`, password `toktickit`, db `toktickit`)

The app opens on the **Login** screen. Sign in with any seeded account below;
each role lands on its own home page and sees only its own navigation.

Stop the stack (keeps the database volume):

```bash
docker compose down
```

You can also run **just the database** in Docker and the apps on your host:

```bash
docker compose up -d db
```

### Seeded accounts (local development only)

Lab 3 adds real accounts. **Every seeded account uses the password
`Toktickit#2026`.** These are local-development credentials, documented here on
purpose; they are not anyone's real password and must never be reused outside a
local database.

| Role | Accounts | Notes |
| :--- | :--- | :--- |
| Requester | `anucha.wong@kmutt.ac.th`, `kanya.sris@kmutt.ac.th`, `pornchai.than@kmutt.ac.th`, `suchada.mees@kmutt.ac.th` | The four Lab 2 Development Requesters, carried over by the migration |
| Requester, inactive | `wichai.boon@kmutt.ac.th` | Cannot sign in |
| Requester, must change password | `first.login@toktickit.local` | The only account that is forced to set a new password at first sign-in |
| IT Staff | `nattapong.it@toktickit.local`, `siriporn.it@toktickit.local`, `thanakorn.it@toktickit.local` | |
| IT Staff, inactive | `prasert.it@toktickit.local` | Still owns a ticket, which shows that ownership survives deactivation |
| Administrator | `malee.admin@toktickit.local`, `kittisak.admin@toktickit.local` | Two, so the last-Administrator rule can be tested |
| Requester with no tickets | `no.tickets@toktickit.local` | Lab 4: signs in to a dashboard where every number is `0`, so the empty state can be seen |
| IT Staff with no work | `idle.it@toktickit.local` | Lab 4: owns no ticket and has recorded no action, so the "mine" figures are `0` |

The seed also creates 16 sample tickets — two in each of the eight statuses —
with Public Comments and Internal Notes. **Lab 4 adds 18 Actions Taken and 37
status changes** to them: none on the New and Cancelled tickets, one on most Open
and Closed ones, several on the In Progress ones (one by an IT Staff member who
is not the Owner), one recorded by an Administrator, a follow-up still pending on
the Waiting tickets, and two Reopened tickets, one with no action since the
reopen and one with a fresh one. The two accounts above own and perform none of it.

**The seed converges.** Every run puts each account above back to this password
and its documented must-change setting, and resets the sample tickets' status,
owner, and priorities. Running it after a demo or an E2E run therefore restores
the documented state. Accounts you create yourself and tickets you raise through
the app are never touched.

A sample ticket's **Last Updated** is the time of its newest seeded activity (a
comment, a note, an action, or a status change), not the moment the seed ran. A
sample ticket whose Last Updated is older than that is brought up to it, because
an action is never newer than the ticket that holds it (Lab 4 BR-11). So the
first Lab 4 seed on a database that already holds the Lab 3 sample tickets
changes "Last Updated" on them once; the second run finds nothing behind and
changes nothing.

> **Upgrading a Lab 2 database:** `prisma migrate deploy` renames
> `RequesterUser` to `User` in place, so existing tickets and attachments keep
> their Requesters. Migrated accounts have **no password** until the seed runs —
> run `npm run prisma:seed` straight after migrating.
>
> The server container keeps `node_modules` in its own volume, so after pulling
> Lab 3 it still has the Lab 2 Prisma client and answers `500`. Refresh it once:
>
> ```bash
> docker compose exec server npm install
> docker compose exec server npx prisma generate
> docker compose exec server npx prisma migrate deploy
> docker compose exec server npm run prisma:seed
> docker compose restart server
> ```

> **Upgrading a Lab 3 database to Lab 4.** The migration is additive: two new
> tables (`ActionTaken`, `TicketStatusChange`), one new `Ticket.version` column
> that every existing ticket gets as `1`, and an index swap. No existing row is
> rewritten.
>
> 1. **Take a dump first**, because the rollback below does not undo the seed:
>    `docker exec toktickit-db pg_dump -U toktickit toktickit > backup-pre-lab4.sql`
> 2. Apply and refresh. **Restart the server container afterwards, always.** On
>    Windows the bind-mounted `server/` does not tell the container about edits, so
>    the running API keeps serving old code and an old Prisma client until it is
>    restarted:
>
>    ```bash
>    docker compose exec server npx prisma migrate deploy
>    docker compose exec server npx prisma generate
>    docker compose exec server npm run prisma:seed
>    docker compose restart server
>    ```
>
> 3. **To roll back** (this loses every Action Taken and status-history row, which
>    is why the dump comes first), run `server/prisma/rollback/lab4_rollback.sql`
>    and then remove the migration from Prisma's history, so that
>    `prisma migrate status` lists it as pending and `migrate deploy` can apply it
>    again:
>
>    ```bash
>    docker exec -i toktickit-server npx prisma db execute --file prisma/rollback/lab4_rollback.sql --schema prisma/schema.prisma
>    docker exec toktickit-db psql -U toktickit -d toktickit -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20261006093537_lab4_actions_taken_and_workflow'"
>    ```
>
>    (`prisma migrate resolve --rolled-back` does **not** work here: Prisma only
>    accepts it for a migration that failed.) The script undoes the migration and
>    nothing else. A database that was seeded after migrating keeps the seed's two
>    accounts, so for that case restore the dump instead.
>
> The client container's Vite server does not always see file changes made on a
> Windows host, so after pulling, restart it as well (`docker compose restart
> client`) or the browser keeps getting the previous screens.

## Demonstration path (Lab 4)

A walk through the finished Lab 4 in eleven steps, on a database that has just
been migrated and seeded, with the stack up (Quick start, above). Every account's
password is `Toktickit#2026`. Each step says what you should see. A sign-in
returns you to the page you were sent from when your role may open it, so after
switching accounts in the same tab, choose **Dashboard**, the first item in the
navigation.

1. **A Requester's Dashboard.** Sign in as `anucha.wong@kmutt.ac.th`. A first
   sign-in lands on **Dashboard**: four cards (**Open Tickets**, **Waiting for
   You**, **Resolved**, **Closed**), **Needs your attention**, **Recently
   updated**, and **Quick actions**. Click **Open Tickets**: My Tickets opens
   already filtered to open tickets, and its total is the card's number. Go back
   to **Dashboard** and note the **Resolved** figure.
2. **A Requester with nothing yet.** **Logout**, sign in as
   `no.tickets@toktickit.local`, and open **Dashboard**: every card reads 0, and
   the lists say "Nothing is waiting on you." and "You have no tickets yet."
3. **Raise a ticket to follow.** **Logout**, sign in as Anucha again, choose
   **Create Ticket**, fill in the form, press **Submit Ticket**, then **View
   ticket**. Its status is New.
4. **The IT Staff Dashboard.** **Logout**, sign in as
   `nattapong.it@toktickit.local`, and open **Dashboard**: the cards
   **Unassigned**, **Assigned to Me**, **Waiting for Requester**, and **Urgent**;
   **By status**, with five counts; **My Tickets**, **Urgent Tickets**, and **My
   Recent Actions**; and **Quick actions**. There is no **Accounts** region and no
   User Management item. Click **Unassigned**: the Ticket Queue opens filtered to
   unassigned open tickets, and its total is the card's number. Open the new
   ticket and press **Claim**, then **Confirm claim**: you become its Ticket
   Owner, and because it was New it moves to Open.
5. **The resolution gate.** In **Operational**, set **Move to** In Progress and
   press **Apply**. Resolved is not offered, and under **Not available now** it
   reads "Resolved — Record at least one action before resolving this ticket."
6. **Actions Taken.** In **Actions Taken (0)** press **+ Add action**. Performed
   by is you and cannot be typed. Fill in Action Description and Result, answer
   **Follow-Up Required?** Yes, write the Follow-up Note, and press **Save
   action**: the card shows **Follow-up needed** and **Latest recorded**. Resolved
   is still held back, now because the most recently recorded action still needs
   follow-up.
7. **A colleague.** **Logout**, sign in as `siriporn.it@toktickit.local`, open
   **Ticket Queue**, search for the ticket, and open it. Press **+ Add action**
   and record a second action, leaving Follow-Up Required? at No: it says
   Performed by Siriporn, it is now the **Latest recorded**, and **Resolved**
   appears in **Move to**. Then **Edit** the first action and change its Result: it
   stays Performed by Nattapong and now says "Edited by Siriporn Kaewmanee". (Any
   IT Staff member or Administrator can record on or edit any action; none can be
   deleted.)
8. **Resolve it.** Choose Resolved, type a reason (it is posted to the Requester
   as a Public Comment), and press **Apply**. **Status History**, the last region
   of the page, lists four lines: Ticket created, then New → Open and Open → In
   Progress by Nattapong, and In Progress → Resolved by Siriporn, each with its
   time.
9. **What the Requester sees.** **Logout**, sign in as Anucha, and open
   **Dashboard**: the **Resolved** card is one higher than in step 1. Open the
   ticket: **Actions Taken (2)** and the Status History are there, read-only, with
   no **+ Add action** and no **Edit**.
10. **The Administrator.** **Logout**, sign in as `malee.admin@toktickit.local`,
    and open **Dashboard**: the IT Staff Dashboard plus **Accounts** (Requesters,
    IT Staff, Administrators, Inactive) and **Open User Management**. The
    navigation is Dashboard, Ticket Queue, and User Management. An Administrator
    can open the Ticket Queue and the ticket's IT Staff screen, where the same
    controls act under the Administrator's own name (Lab 4 BR-45); User Management
    stays theirs alone.
11. **The server decides.** Try the `curl` in the API section on a ticket that has
    no action: the gate answers `409 ACTION_REQUIRED` whatever the screen shows.

---

## API

Every endpoint except login, logout, and health requires a signed-in session
(the `tt_sid` cookie below); without one it answers `401 AUTH_REQUIRED`. The
Requester endpoints act for the session's user only. Identity is never read from
a request body, query string, or header — Lab 2's `X-Requester-Id` is ignored —
and a ticket or attachment belonging to another Requester returns `404`, the same
answer as one that does not exist, so the API never discloses it. IT Staff and
Administrators get `403` from the Requester endpoints: they have no tickets of
their own.

### Authentication (Lab 3)

Signing in sets an `HttpOnly`, `SameSite=Lax` cookie named `tt_sid` that lasts 8
hours. The server keeps only a SHA-256 of it, so logging out deletes the session
for real. There is no signing secret to configure. The full contract is in
[`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md) §2.

| Method | Endpoint | Session | Description |
|--------|----------|:--:|-------------|
| POST | `/api/auth/login` | — | Sign in with email and password; sets the session cookie |
| POST | `/api/auth/logout` | optional | End the session; harmless without one |
| GET | `/api/auth/me` | ✔ | The signed-in user |
| POST | `/api/auth/password` | ✔ | Change the password (8–72 characters, at most 72 bytes) |

While an account must change its password, its session can reach only these
four endpoints and `/api/health`; everything else answers
`403 PASSWORD_CHANGE_REQUIRED`.

Five failed sign-ins for one email within 15 minutes lock that email for 15
minutes: every attempt, the correct password included, answers
`429 TOO_MANY_ATTEMPTS` with a `Retry-After` header. Emails with no account are
locked the same way, so a lock reveals nothing. The counter lives in the server's
memory, so **restarting the server clears every lock**, which is also the quickest
way out if you lock yourself out while testing.

The browser client runs on another port, so the API names the allowed origins
instead of answering `*`; a cookie is never sent to a wildcard. The default is
Vite's `http://localhost:5173`. Set `CLIENT_ORIGINS` (comma-separated) in
`server/.env` to replace it, for example for an E2E stack on different ports.
Open the app on the same host name the API uses — `localhost` for both, or
`127.0.0.1` for both. Across the two, the browser treats the request as
cross-site and never sends the session cookie, so sign-in fails.

### Lab 2 endpoints

| Method | Endpoint | Session | Description |
|--------|----------|:--:|-------------|
| GET | `/api/health` | — | Backend health/liveness check |
| GET | `/api/categories` | any role | Active ticket categories |
| GET | `/api/related-systems` | any role | Active related systems |
| POST | `/api/tickets` | Requester | Create one validated ticket; the server generates the Ticket Number |
| GET | `/api/tickets` | Requester | The signed-in Requester's tickets, with search, filters (any of the eight statuses), sorting, and pagination |
| GET | `/api/tickets/:id` | Requester | One owned ticket, with its attachments |
| POST | `/api/tickets/:id/attachments` | Requester | Upload one permitted file (JPG/JPEG/PNG/WEBP/PDF, ≤ 5 MB, 5 active max) |
| GET | `/api/tickets/:id/attachments` | Requester | Attachment metadata, active and removed |
| GET | `/api/attachments/:id/download` | Requester | Download an active attachment |
| PATCH | `/api/attachments/:id/remove` | Requester | Soft-remove an attachment, with a required reason |
| GET, POST | `/api/tickets/:id/comments` | Requester (own), IT Staff, Administrator | Public Comments — read the thread, or post 1–2000 characters (Lab 3) |
| GET, POST | `/api/tickets/:id/notes` | IT Staff, Administrator | Internal Notes; a Requester gets `403` and learns nothing about them (Lab 3) |
| PATCH | `/api/tickets/:id/appears-resolved` | Requester (own) | Set the "Problem Appears Resolved" signal with a 5–2000 character comment, or clear it; never changes the status (Lab 3) |

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"TokTickIT API"}

# Sign in once, keeping the session cookie in a jar, then use it.
curl -c jar.txt -H "Content-Type: application/json" \
  -d '{"email":"anucha.wong@kmutt.ac.th","password":"Toktickit#2026"}' \
  http://localhost:3000/api/auth/login
curl -b jar.txt http://localhost:3000/api/tickets
# {"data":[ … ],"meta":{"page":1,"pageSize":10,"totalItems":…,"totalPages":…,…}}

curl http://localhost:3000/api/tickets
# {"error":{"code":"AUTH_REQUIRED","message":"Sign in to continue."}}
```

### IT Staff endpoints (Lab 3, open to Administrators since Lab 4)

IT Staff and Administrators; a Requester gets `403 FORBIDDEN`. An Administrator
acts under their own name: they are the author of a comment or note, the person
who changed a status, and the Performed by of an action (Lab 4 BR-45).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/tickets` | The shared queue of every Requester's tickets: search, filters (status, IT Priority, category, owner), sorting, pagination |
| GET | `/api/staff/tickets/:id` | One ticket, with its attachments and the status moves the BR-33 matrix permits from here |
| PATCH | `/api/staff/tickets/:id/owner` | Claim, reassign, or unassign; claiming a `NEW` ticket also moves it to `OPEN` |
| PATCH | `/api/staff/tickets/:id/it-priority` | Change IT Priority; Requested Priority is never touched |
| PATCH | `/api/staff/tickets/:id/status` | A permitted status move; Resolved, Cancelled, and Reopened need a reason, posted as a Public Comment; a move to Resolved is held by the resolution gate (Lab 4, below) |
| GET | `/api/staff/attachments/:id/download` | Download an active attachment of any ticket |
| GET | `/api/staff/assignable-users` | Active IT Staff and Administrators, for the owner filter and picker |

### Administrator endpoints (Lab 3)

Administrator only; everyone else gets `403 FORBIDDEN`. There is no delete:
deactivation is the only removal (BR-50).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Every user, searched by name or email and filtered by one role |
| POST | `/api/admin/users` | Create a user with one role and an initial password, to be changed at first sign-in |
| PATCH | `/api/admin/users/:id` | Edit name, email, role, or activation; never your own role or activation, never the last active Administrator |
| POST | `/api/admin/users/:id/initial-password` | Issue a new initial password; signs the user out everywhere |

### Actions Taken, Status History, and Dashboards (Lab 4)

| Method | Endpoint | Who | Description |
|--------|----------|-----|-------------|
| GET | `/api/tickets/:id/actions-taken` | the Requester who owns the ticket, IT Staff, Administrator | The ticket's Actions Taken |
| POST | `/api/staff/tickets/:id/actions-taken` | IT Staff, Administrator | Record an action: `actionAt`, `description`, `result`, `followUpRequired`, `followUpNote` (when follow-up is needed), `attachmentNotes`, and a `requestKey`, so that sending the same submission twice answers `200` with the same action instead of recording it twice. `201` when created. Performed by is always the signed-in user |
| PATCH | `/api/staff/tickets/:id/actions-taken/:actionId` | IT Staff, Administrator | Edit an action; takes `expectedVersion`. Any IT Staff member or Administrator may edit any action; none can be deleted |
| GET | `/api/tickets/:id/status-history` | the Requester who owns the ticket, IT Staff, Administrator | The ticket's append-only Status History, oldest first |
| GET | `/api/dashboard/requester` | Requester | Four counts and two short lists, all about the Requester's own tickets |
| GET | `/api/staff/dashboard` | IT Staff, Administrator | Four counts, a count for each of five statuses, and three short lists; an Administrator also gets account counts |

A Requester who asks for another Requester's ticket, its actions, or its history
gets `404`, the same answer as for a ticket that does not exist. `GET /api/tickets`
and `GET /api/staff/tickets` also take `group=open` (the five open statuses), which
is what the dashboard cards link to; it combines with `status` by AND.

What Lab 4 adds to the rules:

- **Resolution gate.** A move to Resolved needs at least one relevant Action Taken,
  and the most recently recorded one must not need follow-up. Otherwise it is
  `409 ACTION_REQUIRED` or `409 FOLLOW_UP_PENDING`, whatever the screen shows. An
  action recorded before the latest reopen does not count.
- **Stale updates.** `PATCH .../owner`, `.../it-priority`, and `.../status` take the
  `expectedVersion` the screen was showing. If the ticket has changed since, the
  answer is `409 STALE_UPDATE` with the ticket as it is now in `error.current`.
- **Actions only on an active ticket.** An action cannot be recorded or edited on a
  Resolved, Closed, or Cancelled ticket: `409 TICKET_NOT_ACTIVE`. Reopen it first.
- **Bad bodies are `400`, never `500`.** A NUL character in any string of a request
  body, or an id in a body outside `1`–`2147483647`, is `400 VALIDATION_FAILED`.

```bash
# Dashboards use the same cookie jar as above.
curl -b jar.txt http://localhost:3000/api/dashboard/requester
# {"generatedAt":"…","metrics":{"openTickets":{"value":3,"href":"/tickets?group=open"},…},"needsAttention":[…],"recentTickets":[…]}

# The gate is enforced by the API. Sign in as IT Staff into staff.txt (nattapong.it@toktickit.local),
# then try to resolve a ticket that has no action. ID and VERSION come from GET /api/staff/tickets/ID.
curl -b staff.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"currentStatus":"RESOLVED","reason":"Trying to resolve.","expectedVersion":VERSION}' \
  http://localhost:3000/api/staff/tickets/ID/status
# {"error":{"code":"ACTION_REQUIRED","message":"Record at least one action before resolving this ticket."}}
```

The full contract — request and response shapes, query parameters, error codes,
and status codes — is in [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md),
with the Lab 3 changes and additions in [`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md)
and Lab 4's in [`docs/lab-04/api-spec.md`](docs/lab-04/api-spec.md) (§9 lists every
endpoint and whether Lab 4 changed it).

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

The suite runs at every level the labsheets name: unit, API, authorization,
workflow, dashboard calculation, migration and rollback, performance smoke, UI
component, UI style, responsive, and end-to-end, and every lab's tests are kept
and still pass. The test plan, the traceability from each acceptance criterion to
its tests, the visual checklist, the known limitations, and the runner's output
are in [`docs/lab-04/tests.md`](docs/lab-04/tests.md). Lab 3's are in
[`docs/lab-03/tests.md`](docs/lab-03/tests.md) and Lab 2's in
[`docs/lab-02/tests.md`](docs/lab-02/tests.md). The Lab 2 and Lab 3 tests that Lab 4
had to change, each with its reason, are listed in `tests.md` §6. On a freshly
seeded database the last full run reads: every Playwright suite 85 passed (21 of
Lab 2, 25 of Lab 3, 39 of Lab 4); the server suite 38 files and 1092 tests; the
client suite 26 files and 1028 tests; both type checks and the production build
clean (`tests.md` §8.6).

### Backend — unit, API, workflow, dashboards, migration

Run inside the server container so the tests reach the seeded PostgreSQL over
the compose network (`db:5432`):

```bash
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
docker exec toktickit-server npx vitest run --reporter=verbose
```

The migrate and seed lines are only needed on a fresh database; the seed is
idempotent, so running them again on a seeded one changes nothing. The files run
one at a time, because they share one database, and each test may take 30
seconds: two of them run the whole seed twice.

> Run this via `docker exec`, not a plain `npm test` on the host. A native
> PostgreSQL listening on `localhost:5432` can shadow the Docker database from
> the host and make the backend tests fail authentication.
>
> The suites are written for `postgres:16-alpine`, which `docker-compose.yml`
> names. The Debian-based `postgres:16` orders text by language rules, not by
> bytes, so a Lab 3 test that sorts names can fail on it (`tests.md` §7).

### Frontend — UI component and UI style

No database needed; the API module is mocked, and every test starts with a
`fetch` that is offline and fails the test if it is called, so no test can reach a
real API.

```bash
cd client
npx vitest run --reporter=verbose
```

### Type checks and the production build

```bash
docker exec toktickit-server npx tsc --noEmit
docker exec toktickit-client npx tsc --noEmit
docker exec toktickit-client npx vite build
```

### End-to-end and responsive

These drive a real stack, so the database, API, and client must be running:

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
npx playwright install chromium   # first run only
npx playwright test --reporter=list                # Labs 2, 3, and 4
npx playwright test e2e/lab-04 --reporter=list     # Lab 4 only
```

The suites sign in as the seeded accounts and pick a Category and Related System
from the database, so they fail on an unseeded one. Lab 2's screenshots are
written to `artifacts/lab-02/screenshots/`, Lab 3's to
`artifacts/lab-03/screenshots/<area>/<shot>-<desktop|tablet|mobile>.png`, and
Lab 4's (111 files in five folders) to `artifacts/lab-04/screenshots/<area>/` the
same way, at 1440, 820, and 390 px. All three sets are committed evidence, so
restore them with `git checkout -- artifacts` after a run you do not mean to keep.
A run on another database draws different numbers into them, and that is not a
regression (`tests.md` §5.1). Point the suites at a stack on non-default ports
with `E2E_BASE_URL` and `E2E_API_URL`; that API then needs `CLIENT_ORIGINS` set to
its client's origin (`server/.env.example`), and the server tests, which send the
default origin, are run against it with `-e CLIENT_ORIGINS=http://localhost:5173`.

> If the stack was already running when you switched branches, restart it first
> (`docker compose restart server client`): on a Windows host the containers do
> not always see file changes, and a stale screen fails the E2E suites.

The Lab 3 and Lab 4 suites also create user accounts, under `e2e.*@example.test`.
Users cannot be deleted (BR-50), so each spec **deactivates** the accounts it
created when it ends, even after a failure. Deactivated, they are never picked as
fixtures by the API suites. To start again from a clean database instead, run
`docker exec toktickit-server npx prisma migrate reset --force`, which recreates
it from the migrations and the seed.

The E2E suite creates tickets it cannot delete — the API exposes no delete
endpoint by design. A run of every suite adds about 108 tickets and 18 accounts
(`tests.md` §8.2). Note the highest ticket id **before** the run, then delete
only what came after it:

```bash
docker exec toktickit-db psql -U toktickit -d toktickit -c 'SELECT max(id) FROM "Ticket";'   # before the run, e.g. 2351
# ... run the E2E suite ...
docker exec toktickit-db psql -U toktickit -d toktickit -c 'DELETE FROM "Ticket" WHERE id > 2351;'
```

> **Since Lab 3, never run `DELETE FROM "Ticket";`.** Lab 2's instructions used
> it when the suite's tickets were the only ones in the database. The database
> now also holds the tickets migrated from Lab 2 and the 16 sample tickets the
> seed creates, and a blanket delete removes all of them. Re-running the seed
> brings the sample tickets back; only a backup brings back the migrated ones.
>
> The suite prints the ids it created, but that line is printed before the
> responsive spec has finished creating its own, so it is not the full list,
> which is why the reset uses the id noted before the run. The cascade clears the
> `Attachment` rows but not the uploaded files; remove those from `/app/uploads`
> in the server container.

### Everything

In the order the final run uses: every Playwright suite first, then the server
tests on the database it left, then the client tests.

```bash
docker compose up -d
docker exec toktickit-server npx prisma migrate deploy
docker exec toktickit-server npm run prisma:seed
npx playwright test --reporter=list
docker exec toktickit-server npx vitest run --reporter=verbose
(cd client && npx vitest run --reporter=verbose)
```

Test files live under `server/tests/lab-0{1,2,3,4}/`, `client/tests/lab-0{1,2,3,4}/`,
and `e2e/lab-0{2,3,4}/`. Every earlier lab's suites still pass.

---

## Database (Prisma)

The Prisma schema lives at `server/prisma/schema.prisma` and points at
PostgreSQL via `DATABASE_URL`.

### Models

| Model | Purpose |
|-------|---------|
| `User` | Every account — Requester, IT Staff, or Administrator — with a bcrypt password hash and a role. Lab 2's `RequesterUser`, renamed in place by the Lab 3 migration. |
| `Session` | A signed-in session: only the SHA-256 of the cookie token is stored, with its expiry (Lab 3) |
| `Category` | Ticket classification (from Lab 1; Lab 2 adds `isActive`) |
| `RelatedSystem` | The service, application, device, or platform a ticket is about |
| `Ticket` | Unique backend-generated `ticketNumber`; one of eight statuses; Requested Priority and a separate IT Priority; an optional owner (Lab 3); a `version` that every guarded change raises, so a stale save is refused (Lab 4); foreign keys to requester, category, and related system |
| `Attachment` | Upload metadata plus the soft-removal columns |
| `PublicComment` | The conversation the Requester and IT Staff share (Lab 3) |
| `InternalNote` | IT Staff and Administrator notes, in their own table so no Requester query can reach them (Lab 3) |
| `ActionTaken` | One piece of work recorded under a ticket: when it happened, what was done, the result, who performed it (the signed-in user, never typed), whether follow-up is needed and its note, and where to look for attached files. Edited in place, never deleted (Lab 4) |
| `TicketStatusChange` | The append-only Status History: one row for each status change that succeeded (Lab 4) |

Soft removal is a single nullable `removedAt` timestamp rather than a boolean
plus a date, so `removedAt IS NULL` *is* the definition of active and the two
facts cannot drift apart. The full data design and its justifications are in
[`docs/lab-02/specification.md`](docs/lab-02/specification.md) §7.

### Seed data

The seed is **idempotent** — every write is an `upsert` on a unique column, so
running it repeatedly never creates duplicates:

- 4 ticket categories — Account and Access, Hardware, Software, Network
- 7 related systems — Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop
- the seeded accounts listed above (14), including 1 **inactive** Requester that cannot sign in
- 16 sample tickets with Public Comments and Internal Notes, **18 Actions Taken and 37 status changes** (Lab 4), and the two Lab 4 accounts that give the dashboards a zero case

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
| [`docs/lab-03/specification.md`](docs/lab-03/specification.md) | Lab 3 scope, FR/BR, the authorization matrix and status lifecycle, data and migration design, AC-01…AC-40, decisions D-01…D-27 |
| [`docs/lab-03/tests.md`](docs/lab-03/tests.md) | Lab 3 test plan, AC traceability, visual checklist, commands, final results, and known limitations |
| [`docs/lab-03/ui-spec.md`](docs/lab-03/ui-spec.md) | The Lab 3 screens, role navigation, badges, the internal region, and screenshot paths |
| [`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md) | Lab 3 contract: sessions, roles, error codes, the staff and admin endpoints |
| [`docs/lab-03/reviewer.md`](docs/lab-03/reviewer.md) | Lab 3 peer review record, both directions, quoted from GitHub |
| [`docs/lab-03/ai-use.md`](docs/lab-03/ai-use.md) | Lab 3 AI use, key prompts, and reflection |
| [`docs/lab-04/specification.md`](docs/lab-04/specification.md) | Lab 4 scope, FR-01…FR-34, BR-01…BR-56, the Actions Taken and transition rules, the dashboard calculations, data and migration design, AC-01…AC-34, decisions D-01…D-22, and the Definition of Done |
| [`docs/lab-04/tests.md`](docs/lab-04/tests.md) | Lab 4 test plan, AC traceability, visual and accessibility checklist, commands, changes to Lab 1–3 tests, known limitations, and final results |
| [`docs/lab-04/ui-spec.md`](docs/lab-04/ui-spec.md) | The two Dashboards, Actions Taken, the status control and Status History, responsive and accessibility rules, and screenshot paths |
| [`docs/lab-04/api-spec.md`](docs/lab-04/api-spec.md) | Lab 4 contract: Actions Taken, the workflow and its conflicts, the dashboards, the drill-down filters, and an endpoint summary |
| [`docs/lab-04/reviewer.md`](docs/lab-04/reviewer.md) | Lab 4 peer review record, both directions, quoted from GitHub, with the evidence that the contract came first |
| [`docs/lab-04/ai-use.md`](docs/lab-04/ai-use.md) | Lab 4 AI use, key prompts, and reflection |
