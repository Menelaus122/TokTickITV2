import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request, { type Test } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 2 — Administrator access to IT Staff ticket operations
// (SEC-01 to SEC-04, SEC-06, SEC-08, and SEC-09 in docs/lab-04/tests.md §2.3;
// specification.md BR-42 to BR-45, D-08). Needs the migrated and seeded
// database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the
// real database. Nothing here reaches into the guard to test it.
//
// SEC-05 and SEC-07, and the parts of SEC-01, SEC-08, and SEC-09 that concern
// the Actions Taken and dashboard endpoints, cannot be written until those
// endpoints exist. They arrive with Issues 4, 6, 7, and 8, which add their
// routes to the tables below. See tests.md §3.1.

const prisma = getPrisma();
const ALLOWED_ORIGIN = "http://localhost:5173";
const FOREIGN_ORIGIN = "https://evil.example";

type Method = "GET" | "POST" | "PATCH";
type Who = "requester" | "staff" | "admin";
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
];
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
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

const row = (id: number) => prisma.ticket.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  const pick = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") =>
    prisma.user.findFirstOrThrow({
      where: { role, isActive: true, mustChangePassword: false },
      orderBy: { id: "asc" },
      select: { id: true },
    });
  ids.requester = (await pick("REQUESTER")).id;
  ids.staff = (await pick("IT_STAFF")).id;
  ids.admin = (await pick("ADMINISTRATOR")).id;
  for (const who of ["requester", "staff", "admin"] as const) cookies[who] = await signInAs(ids[who]);

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
  it("covers the staff routes, the admin routes, and a staff route that does not exist", async () => {
    for (const [method, path] of [...STAFF_ROUTES, ...ADMIN_ROUTES, UNWRITTEN_STAFF_ROUTE]) {
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
      const req = method === "GET" ? agent.get(path) : agent.patch(path);
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
