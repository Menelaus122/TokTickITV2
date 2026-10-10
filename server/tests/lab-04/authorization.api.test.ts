import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request, { type Test } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle } from "../../src/loginThrottle.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issues 2 and 4 — Administrator access to IT Staff ticket operations,
// and the same guards on the Actions Taken routes (SEC-01 to SEC-04, SEC-06 to
// SEC-09 in docs/lab-04/tests.md §2.3; specification.md BR-42 to BR-45, D-08). Needs the migrated and seeded
// database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the
// real database. Nothing here reaches into the guard to test it.
//
// The status-history route (SEC-01) and the `changedBy` of SEC-08 arrived with Issue 6; the
// Requester dashboard's SEC-01, SEC-05, and SEC-07 with Issue 7; and the staff dashboard's,
// with its route in the staff table below, with Issue 8. See tests.md §3.1.

const prisma = getPrisma();
const ALLOWED_ORIGIN = "http://localhost:5173";
const FOREIGN_ORIGIN = "https://evil.example";

type Method = "GET" | "POST" | "PATCH";
type Who = "requester" | "staff" | "admin" | "otherRequester";
type Row = [Method, string];

// Every route under the two guarded prefixes. Later issues append theirs here.
const STAFF_ROUTES: Row[] = [
  ["GET", "/api/staff/tickets"],
  ["GET", "/api/staff/tickets/1"],
  ["PATCH", "/api/staff/tickets/1/owner"],
  ["PATCH", "/api/staff/tickets/1/it-priority"],
  ["PATCH", "/api/staff/tickets/1/status"],
  ["GET", "/api/staff/assignable-users"],
  ["GET", "/api/staff/attachments/1/download"],
  ["POST", "/api/staff/tickets/1/actions-taken"],
  ["PATCH", "/api/staff/tickets/1/actions-taken/1"],
  // Lab 4, Issue 8: the staff dashboard, behind the same prefix guard.
  ["GET", "/api/staff/dashboard"],
];
// Routes that any signed-in role reaches, with ownership deciding what a Requester sees.
const SHARED_ROUTES: Row[] = [
  ["GET", "/api/tickets/1/actions-taken"],
  ["GET", "/api/tickets/1/status-history"],
];
// The dashboards. The Requester's is outside /api/staff, so it answers its own guard (Issue 7);
// the staff one is under /api/staff and arrives with Issue 8.
const DASHBOARD_ROUTES: Row[] = [["GET", "/api/dashboard/requester"]];
// A path nobody has written and nobody will: the prefix guard answers for it.
const UNWRITTEN_STAFF_ROUTE: Row = ["GET", "/api/staff/this-route-does-not-exist"];
const ADMIN_ROUTES: Row[] = [
  ["GET", "/api/admin/users"],
  ["POST", "/api/admin/users"],
  ["PATCH", "/api/admin/users/1"],
  ["POST", "/api/admin/users/1/initial-password"],
];

const cookies = {} as Record<Who, string>;
const ids = {} as Record<Who, number>;
const ticketIds: number[] = [];
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;
let sequence = 0;
const numberBase = Date.now() % 80000;

function call(method: Method, path: string, cookie?: string, headers: Record<string, string> = {}): Test {
  const agent = request(app);
  const req = method === "GET" ? agent.get(path) : method === "POST" ? agent.post(path) : agent.patch(path);
  if (cookie) req.set("Cookie", cookie);
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return method === "GET" ? req : req.send({});
}

async function makeTicket(): Promise<number> {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9993-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 authorization suite ticket",
      description: "Created by the Lab 4 authorization suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      // A day old, so an action dated earlier today falls after it (BR-06).
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

const row = (id: number) => prisma.ticket.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  const pick = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", skip = 0) =>
    prisma.user.findFirstOrThrow({
      where: { role, isActive: true, mustChangePassword: false },
      orderBy: { id: "asc" },
      select: { id: true },
      skip,
    });
  ids.requester = (await pick("REQUESTER")).id;
  ids.otherRequester = (await pick("REQUESTER", 1)).id;
  ids.staff = (await pick("IT_STAFF")).id;
  ids.admin = (await pick("ADMINISTRATOR")).id;
  for (const who of ["requester", "otherRequester", "staff", "admin"] as const) cookies[who] = await signInAs(ids[who]);

  requesterId = ids.requester;
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  // Comments and notes cascade with their ticket.
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("SEC-01 without a session every protected route answers 401, never 403 (BR-44)", () => {
  it("covers the staff routes, the admin routes, the shared routes, the dashboard, and a staff route that does not exist", async () => {
    for (const [method, path] of [...STAFF_ROUTES, ...ADMIN_ROUTES, ...SHARED_ROUTES, ...DASHBOARD_ROUTES, UNWRITTEN_STAFF_ROUTE]) {
      const res = await call(method, path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body.error.code, `${method} ${path}`).toBe("AUTH_REQUIRED");
    }
  });
});

describe("SEC-02 a Requester is refused every /api/staff route, with nothing in the body (BR-43)", () => {
  it("answers 403 FORBIDDEN on every staff route, including one that is not written", async () => {
    for (const [method, path] of [...STAFF_ROUTES, UNWRITTEN_STAFF_ROUTE]) {
      const res = await call(method, path, cookies.requester);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code, `${method} ${path}`).toBe("FORBIDDEN");
      // The body is the bare error envelope: no ticket, list, or count rides along.
      expect(Object.keys(res.body), `${method} ${path}`).toEqual(["error"]);
    }
  });

  it("does not let a Requester read a real ticket through the staff route", async () => {
    const id = await makeTicket();
    const res = await call("GET", `/api/staff/tickets/${id}`, cookies.requester);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("Lab 4 authorization suite ticket");
  });
});

describe("SEC-03 IT Staff and an Administrator both pass the /api/staff guard (BR-42, BR-43, D-08)", () => {
  it.each([
    ["IT Staff", "staff"],
    ["an Administrator", "admin"],
  ] as [string, Who][])("lets %s past the guard on every staff route, and on one that is not written", async (_label, who) => {
    for (const [method, path] of STAFF_ROUTES) {
      const res = await call(method, path, cookies[who]);
      // 200, 400, or 404 are all fine here: the route itself answered. Only a
      // refusal by the guard (401 or 403) would be wrong.
      expect([401, 403], `${method} ${path}`).not.toContain(res.status);
    }
    const [method, path] = UNWRITTEN_STAFF_ROUTE;
    const res = await call(method, path, cookies[who]);
    // Past the guard, it reaches the API's unknown-route answer.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["IT Staff", "staff"],
    ["an Administrator", "admin"],
  ] as [string, Who][])("lets %s do the whole job on a ticket: read, claim, re-prioritise, move on, hand over", async (_label, who) => {
    const id = await makeTicket();
    const as = (method: Method, path: string, body?: object) => {
      const agent = request(app);
      const req = method === "GET" ? agent.get(path) : method === "POST" ? agent.post(path) : agent.patch(path);
      req.set("Cookie", cookies[who]);
      return method === "GET" ? req : req.send(body ?? {});
    };

    // The first page of ten is crowded by seeded tickets, so find this one the
    // way a person would: by searching the queue for its number.
    const { ticketNumber } = await row(id);
    const queue = await as("GET", `/api/staff/tickets?q=${ticketNumber}`);
    expect(queue.status).toBe(200);
    expect(queue.body.tickets.map((t: { id: number }) => t.id)).toEqual([id]);

    expect((await as("GET", `/api/staff/tickets/${id}`)).status).toBe(200);

    const assignable = await as("GET", "/api/staff/assignable-users");
    expect(assignable.status).toBe(200);
    expect(assignable.body.users.some((u: { id: number }) => u.id === ids[who])).toBe(true);

    const claim = await as("PATCH", `/api/staff/tickets/${id}/owner`, { ownerId: ids[who], expectedOwnerId: null });
    expect(claim.status).toBe(200);
    expect(claim.body.ticket.owner.id).toBe(ids[who]);
    expect(claim.body.ticket.currentStatus).toBe("OPEN");

    const priority = await as("PATCH", `/api/staff/tickets/${id}/it-priority`, { itPriority: "URGENT" });
    expect(priority.status).toBe(200);

    const status = await as("PATCH", `/api/staff/tickets/${id}/status`, { currentStatus: "IN_PROGRESS" });
    expect(status.status).toBe(200);

    // Record what was done, and read it back (Lab 4, Issue 4).
    const recorded = await as("POST", `/api/staff/tickets/${id}/actions-taken`, {
      actionAt: new Date(Date.now() - 60 * 1000).toISOString(),
      description: "Checked the cabling at the desk.",
      result: "The cable was loose and is now seated.",
      followUpRequired: false,
    });
    expect(recorded.status).toBe(201);
    expect(recorded.body.action.performedBy.id).toBe(ids[who]);
    const edited = await as("PATCH", `/api/staff/tickets/${id}/actions-taken/${recorded.body.action.id}`, {
      expectedVersion: 1,
      result: "The cable was loose and is now seated; link light is green.",
    });
    expect(edited.status).toBe(200);
    const listed = await as("GET", `/api/tickets/${id}/actions-taken`);
    expect(listed.body.actions.map((a: { id: number }) => a.id)).toEqual([recorded.body.action.id]);

    const stored = await row(id);
    expect(stored).toMatchObject({ ownerId: ids[who], itPriority: "URGENT", currentStatus: "IN_PROGRESS", requestedPriority: "MEDIUM" });

    // Hand the ticket to the other role's account, naming the owner the screen
    // was showing (Lab 3 D-26). Same endpoint and guard as the claim, with an
    // owner already in place.
    const other = who === "admin" ? ids.staff : ids.admin;
    const reassign = await as("PATCH", `/api/staff/tickets/${id}/owner`, { ownerId: other, expectedOwnerId: ids[who] });
    expect(reassign.status).toBe(200);
    expect((await row(id)).ownerId).toBe(other);
  });
});

describe("SEC-04 /api/admin stays Administrator-only (BR-43)", () => {
  it("refuses IT Staff and a Requester on every admin route", async () => {
    for (const who of ["staff", "requester"] as const) {
      for (const [method, path] of ADMIN_ROUTES) {
        const res = await call(method, path, cookies[who]);
        expect(res.status, `${who} ${method} ${path}`).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
    }
  });

  it("still lets an Administrator in", async () => {
    expect((await call("GET", "/api/admin/users", cookies.admin)).status).toBe(200);
  });
});

describe("SEC-06 guard order: 401 before 403 before 404 (BR-44)", () => {
  it("tells a Requester 'you may not' before anything about a ticket that does not exist", async () => {
    const missing = 2147483647;
    const res = await call("PATCH", `/api/staff/tickets/${missing}/owner`, cookies.requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("tells a caller with no session to sign in, whatever the route and role would have said", async () => {
    const res = await call("PATCH", "/api/staff/tickets/2147483647/owner");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("lets an Administrator through to the 404 for a ticket that does not exist", async () => {
    const res = await call("GET", "/api/staff/tickets/2147483647", cookies.admin);
    expect(res.status).toBe(404);
  });
});

describe("SEC-08 an Administrator acts as themself (BR-45)", () => {
  it("is the author of the Public Comment and the Internal Note they post", async () => {
    const id = await makeTicket();
    const comment = await request(app).post(`/api/tickets/${id}/comments`).set("Cookie", cookies.admin).send({ body: "Looking at this now." });
    const note = await request(app).post(`/api/tickets/${id}/notes`).set("Cookie", cookies.admin).send({ body: "Check the switch first." });
    expect(comment.status).toBe(201);
    expect(note.status).toBe(201);

    const comments = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookies.admin);
    const notes = await request(app).get(`/api/tickets/${id}/notes`).set("Cookie", cookies.admin);
    expect(comments.body.comments[0].author).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });
    expect(notes.body.notes[0].author).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });
  });

  it("is the changedBy of a status change they make, and of the NEW to OPEN a claim causes (Issue 6, BR-21, BR-45)", async () => {
    const moved = await makeTicket();
    const claim = await request(app).patch(`/api/staff/tickets/${moved}/owner`).set("Cookie", cookies.admin).send({ ownerId: ids.admin, expectedOwnerId: null });
    expect(claim.status).toBe(200);
    const progress = await request(app).patch(`/api/staff/tickets/${moved}/status`).set("Cookie", cookies.admin).send({ currentStatus: "IN_PROGRESS" });
    expect(progress.status).toBe(200);

    const rows = (await request(app).get(`/api/tickets/${moved}/status-history`).set("Cookie", cookies.admin)).body.history as Array<{
      fromStatus: string;
      toStatus: string;
      changedBy: { id: number; role: string };
    }>;
    expect(rows.map((r) => `${r.fromStatus}>${r.toStatus}`)).toEqual(["NEW>OPEN", "OPEN>IN_PROGRESS"]);
    for (const entry of rows) expect(entry.changedBy).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });
  });

  it("becomes the Ticket Owner of a ticket they claim, and only that", async () => {
    const id = await makeTicket();
    const res = await request(app)
      .patch(`/api/staff/tickets/${id}/owner`)
      .set("Cookie", cookies.admin)
      .send({ ownerId: ids.admin, expectedOwnerId: null });
    expect(res.status).toBe(200);
    expect((await row(id)).ownerId).toBe(ids.admin);
    // The Requester of the ticket is untouched: the Administrator gained no
    // other identity or privilege on it.
    expect((await row(id)).requesterId).toBe(requesterId);
  });

  it("still cannot do what only a Requester may, such as mark a ticket as appearing resolved", async () => {
    const id = await makeTicket();
    const res = await request(app)
      .patch(`/api/tickets/${id}/appears-resolved`)
      .set("Cookie", cookies.admin)
      .send({ appearsResolved: true, comment: "Please close this." });
    expect(res.status).toBe(403);
  });
});

describe("SEC-09 the Origin check still applies to an Administrator's writes (Lab 3 BR-65)", () => {
  it("refuses a write that names a foreign Origin, and changes nothing", async () => {
    const id = await makeTicket();
    const res = await request(app)
      .patch(`/api/staff/tickets/${id}/it-priority`)
      .set("Cookie", cookies.admin)
      .set("Origin", FOREIGN_ORIGIN)
      .send({ itPriority: "URGENT" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect((await row(id)).itPriority).toBe("MEDIUM");
  });

  it("accepts the same write from the configured origin, and a foreign-origin read", async () => {
    const id = await makeTicket();
    const write = await request(app)
      .patch(`/api/staff/tickets/${id}/it-priority`)
      .set("Cookie", cookies.admin)
      .set("Origin", ALLOWED_ORIGIN)
      .send({ itPriority: "HIGH" });
    expect(write.status).toBe(200);
    expect((await row(id)).itPriority).toBe("HIGH");

    const read = await request(app).get("/api/staff/tickets").set("Cookie", cookies.admin).set("Origin", FOREIGN_ORIGIN);
    expect(read.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Lab 4, Issue 4 — the Actions Taken routes under SEC-07, SEC-08, and SEC-09
// ---------------------------------------------------------------------------

const validAction = (overrides: Record<string, unknown> = {}) => ({
  actionAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  description: "Swapped the network cable at the desk.",
  result: "The link light came back.",
  followUpRequired: false,
  ...overrides,
});

describe("SEC-07 a caller cannot name someone else in the Actions Taken endpoints (BR-37)", () => {
  it("ignores requesterId, userId, me, and performedBy in the query, the body, and the headers when recording", async () => {
    const id = await makeTicket();
    const res = await request(app)
      .post(`/api/staff/tickets/${id}/actions-taken?requesterId=${ids.otherRequester}&userId=${ids.admin}&me=${ids.admin}&performedBy=${ids.admin}`)
      .set("Cookie", cookies.staff)
      .set("X-Requester-Id", String(ids.otherRequester))
      .set("X-User-Id", String(ids.admin))
      .send(validAction({ requesterId: ids.otherRequester, userId: ids.admin, me: ids.admin, performedBy: { id: ids.admin }, performedById: ids.admin }));
    expect(res.status).toBe(201);
    expect(res.body.action.performedBy.id).toBe(ids.staff);
  });

  it("ignores them when editing: updatedBy is the session user and performedBy does not move", async () => {
    const id = await makeTicket();
    const created = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.staff).send(validAction());
    const res = await request(app)
      .patch(`/api/staff/tickets/${id}/actions-taken/${created.body.action.id}?userId=${ids.admin}&me=${ids.admin}`)
      .set("Cookie", cookies.admin)
      .set("X-User-Id", String(ids.staff))
      .send({ expectedVersion: 1, result: "Edited by the administrator.", updatedBy: { id: ids.staff }, updatedById: ids.staff, userId: ids.staff });
    expect(res.status).toBe(200);
    expect(res.body.action.updatedBy.id).toBe(ids.admin);
    expect(res.body.action.performedBy.id).toBe(ids.staff);
  });

  it("shows a Requester only their own Ticket whatever requesterId, userId, or me they send when reading", async () => {
    const mine = await makeTicket();
    const theirs = await prisma.ticket.create({
      data: {
        ticketNumber: `TT-9993-${String(numberBase + sequence++).padStart(5, "0")}`,
        requesterId: ids.otherRequester,
        categoryId,
        relatedSystemId,
        summary: "Another requester's ticket",
        description: "Not the first requester's to see.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
      },
    });
    ticketIds.push(theirs.id);
    await request(app).post(`/api/staff/tickets/${theirs.id}/actions-taken`).set("Cookie", cookies.staff).send(validAction());

    const claim = `requesterId=${ids.otherRequester}&userId=${ids.otherRequester}&me=${ids.otherRequester}`;
    const blocked = await request(app)
      .get(`/api/tickets/${theirs.id}/actions-taken?${claim}`)
      .set("Cookie", cookies.requester)
      .set("X-Requester-Id", String(ids.otherRequester))
      .set("X-User-Id", String(ids.otherRequester));
    const missing = await request(app).get(`/api/tickets/2147483647/actions-taken?${claim}`).set("Cookie", cookies.requester);
    expect(blocked.status).toBe(404);
    expect(blocked.body).toEqual(missing.body);

    const own = await request(app).get(`/api/tickets/${mine}/actions-taken?${claim}`).set("Cookie", cookies.requester);
    expect(own.status).toBe(200);
  });
});

describe("SEC-08 an Administrator is the performer of the actions they record (BR-45)", () => {
  it("is performedBy of the action they record, and updatedBy of one they edit that someone else performed", async () => {
    const id = await makeTicket();
    const byStaff = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.staff).send(validAction());
    const byAdmin = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.admin).send(validAction({ description: "The administrator's own action." }));
    expect(byAdmin.status).toBe(201);
    expect(byAdmin.body.action.performedBy).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });

    const edited = await request(app)
      .patch(`/api/staff/tickets/${id}/actions-taken/${byStaff.body.action.id}`)
      .set("Cookie", cookies.admin)
      .send({ expectedVersion: 1, result: "Confirmed by the administrator." });
    expect(edited.status).toBe(200);
    expect(edited.body.action.performedBy.id).toBe(ids.staff);
    expect(edited.body.action.updatedBy).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });
    // Recording gave the Administrator no ownership of the Ticket.
    expect((await row(id)).ownerId).toBeNull();
  });
});

describe("SEC-09 the Origin check applies to the Actions Taken writes (Lab 3 BR-65)", () => {
  it("refuses a create and an edit that name a foreign Origin, before the handler runs, and changes nothing", async () => {
    const id = await makeTicket();
    const created = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.admin).send(validAction());
    expect(created.status).toBe(201);

    const create = await request(app)
      .post(`/api/staff/tickets/${id}/actions-taken`)
      .set("Cookie", cookies.admin)
      .set("Origin", FOREIGN_ORIGIN)
      .send(validAction({ description: "A forged request." }));
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("FORBIDDEN");

    const edit = await request(app)
      .patch(`/api/staff/tickets/${id}/actions-taken/${created.body.action.id}`)
      .set("Cookie", cookies.admin)
      .set("Origin", FOREIGN_ORIGIN)
      .send({ expectedVersion: 1, result: "A forged edit." });
    expect(edit.status).toBe(403);

    const after = await request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookies.admin);
    expect(after.body.actions).toEqual([created.body.action]);
  });

  it("accepts the same writes from the configured origin, and a foreign-origin read", async () => {
    const id = await makeTicket();
    const create = await request(app)
      .post(`/api/staff/tickets/${id}/actions-taken`)
      .set("Cookie", cookies.admin)
      .set("Origin", ALLOWED_ORIGIN)
      .send(validAction());
    expect(create.status).toBe(201);
    const edit = await request(app)
      .patch(`/api/staff/tickets/${id}/actions-taken/${create.body.action.id}`)
      .set("Cookie", cookies.admin)
      .set("Origin", ALLOWED_ORIGIN)
      .send({ expectedVersion: 1, result: "Edited from the real client." });
    expect(edit.status).toBe(200);

    const read = await request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookies.admin).set("Origin", FOREIGN_ORIGIN);
    expect(read.status).toBe(200);
    expect(read.body.actions).toHaveLength(1);
  });
});

describe("The Actions Taken routes stop a session that must change its password first (Lab 3 BR-14)", () => {
  it("answers 403 PASSWORD_CHANGE_REQUIRED on the list, the create, and the edit, and writes nothing", async () => {
    const email = `lab4.mustchange.${Date.now().toString(36)}@example.test`;
    const password = "Correct-horse-1";
    const user = await prisma.user.create({
      data: { fullName: "Lab 4 must-change", email, role: "IT_STAFF", mustChangePassword: true, passwordHash: await hashPassword(password) },
    });
    try {
      const login = await request(app).post("/api/auth/login").send({ email, password });
      expect(login.status).toBe(201);
      const cookie = (login.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("tt_sid="))!.split(";")[0];

      const id = await makeTicket();
      const recorded = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.staff).send(validAction());
      expect(recorded.status).toBe(201);

      const attempts = [
        await request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookie),
        await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookie).send(validAction({ description: "Written before changing the password." })),
        await request(app)
          .patch(`/api/staff/tickets/${id}/actions-taken/${recorded.body.action.id}`)
          .set("Cookie", cookie)
          .send({ expectedVersion: 1, result: "Edited before changing the password." }),
      ];
      for (const res of attempts) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
      }
      const after = await request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookies.staff);
      expect(after.body.actions).toEqual([recorded.body.action]);
    } finally {
      // The user's sessions go with it.
      await prisma.user.delete({ where: { id: user.id } });
      resetLoginThrottle();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Lab 4, Issue 7 — the Requester dashboard under SEC-05 and SEC-07
// ---------------------------------------------------------------------------------------------

describe("SEC-05 the Requester dashboard answers a Requester, and refuses IT Staff and an Administrator (AC-20, BR-42, BR-43)", () => {
  it("is 200 for a Requester, who is the only role it is for", async () => {
    const res = await call("GET", "/api/dashboard/requester", cookies.requester);
    expect(res.status).toBe(200);
  });

  it.each(["staff", "admin"] as const)("is 403 FORBIDDEN for %s, with the bare error envelope and nothing of any Requester's in it", async (who) => {
    const res = await call("GET", "/api/dashboard/requester", cookies[who]);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("keeps the guard order: 401 for no session before 403 for the wrong role (BR-44)", async () => {
    expect((await call("GET", "/api/dashboard/requester")).status).toBe(401);
    expect((await call("GET", "/api/dashboard/requester", cookies.staff)).status).toBe(403);
  });
});

describe("SEC-07 a caller cannot name someone else in the Requester dashboard (BR-37)", () => {
  it("shows a Requester only their own figures and Tickets whatever requesterId, userId, or me they send, in the query or the headers", async () => {
    const theirs = await prisma.ticket.create({
      data: {
        ticketNumber: `TT-9993-${String(numberBase + sequence++).padStart(5, "0")}`,
        requesterId: ids.otherRequester,
        categoryId,
        relatedSystemId,
        summary: "Another requester's waiting ticket",
        description: "Not the first requester's to see.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "WAITING_FOR_REQUESTER",
        // Newest of everyone's, so a leak would put it first in both lists.
        updatedAt: new Date(Date.now() + 60 * 1000),
      },
    });
    ticketIds.push(theirs.id);

    const claim = `requesterId=${ids.otherRequester}&userId=${ids.otherRequester}&me=${ids.otherRequester}&owner=me`;
    const res = await call("GET", `/api/dashboard/requester?${claim}`, cookies.requester, {
      "X-Requester-Id": String(ids.otherRequester),
      "X-User-Id": String(ids.otherRequester),
    });
    expect(res.status).toBe(200);
    const shown = [...res.body.needsAttention, ...res.body.recentTickets] as Array<{ id: number }>;
    expect(shown.map((t) => t.id)).not.toContain(theirs.id);
    const mine = await prisma.ticket.count({ where: { requesterId: ids.requester, currentStatus: "RESOLVED" } });
    expect(res.body.metrics.resolved.value).toBe(mine);

    // And the other Requester, asking plainly, does see it: it is theirs.
    const own = await call("GET", "/api/dashboard/requester", cookies.otherRequester);
    expect((own.body.recentTickets as Array<{ id: number }>)[0].id).toBe(theirs.id);
  });
});

// ---------------------------------------------------------------------------------------------
// Lab 4, Issue 8 — the staff dashboard under SEC-05 and SEC-07
// ---------------------------------------------------------------------------------------------

describe("SEC-05 the staff dashboard answers IT Staff and an Administrator, and refuses a Requester (AC-20, BR-42, BR-43)", () => {
  it.each(["staff", "admin"] as const)("is 200 for %s", async (who) => {
    const res = await call("GET", "/api/staff/dashboard", cookies[who]);
    expect(res.status).toBe(200);
  });

  it("is 403 FORBIDDEN for a Requester, with the bare error envelope and no figure in it", async () => {
    const res = await call("GET", "/api/staff/dashboard", cookies.requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("keeps the guard order: 401 for no session before 403 for the wrong role (BR-44)", async () => {
    expect((await call("GET", "/api/staff/dashboard")).status).toBe(401);
    expect((await call("GET", "/api/staff/dashboard", cookies.requester)).status).toBe(403);
  });

  it("gives the account counts to the Administrator and to nobody else", async () => {
    expect((await call("GET", "/api/staff/dashboard", cookies.admin)).body.userCounts).toBeDefined();
    expect("userCounts" in (await call("GET", "/api/staff/dashboard", cookies.staff)).body).toBe(false);
  });
});

describe("SEC-07 a caller cannot name someone else in the staff dashboard (BR-37)", () => {
  it("shows IT Staff only their own 'mine' whatever me, userId, owner, or requesterId they send, in the query or the headers", async () => {
    const mine = await prisma.ticket.count({
      where: { ownerId: ids.staff, currentStatus: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } },
    });
    const claim = `me=${ids.admin}&userId=${ids.admin}&owner=${ids.admin}&requesterId=${ids.otherRequester}`;
    const res = await call("GET", `/api/staff/dashboard?${claim}`, cookies.staff, {
      "X-User-Id": String(ids.admin),
      "X-Requester-Id": String(ids.otherRequester),
    });
    expect(res.status).toBe(200);
    expect(res.body.metrics.assignedToMe.value).toBe(mine);
    for (const t of res.body.myTickets as Array<{ owner: { id: number } | null }>) expect(t.owner?.id).toBe(ids.staff);
    const plain = await call("GET", "/api/staff/dashboard", cookies.staff);
    const { generatedAt: _a, ...left } = plain.body;
    const { generatedAt: _b, ...right } = res.body;
    expect(right).toEqual(left);
  });

  it("does not let IT Staff ask for the account counts: userCounts is not a parameter, and the answer has none", async () => {
    const res = await call("GET", "/api/staff/dashboard?userCounts=true&role=ADMINISTRATOR", cookies.staff);
    expect(res.status).toBe(200);
    expect("userCounts" in res.body).toBe(false);
  });
});
