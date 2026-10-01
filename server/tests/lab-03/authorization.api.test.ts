import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request, { type Response } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle } from "../../src/loginThrottle.js";
import { SEED_PASSWORD } from "../../prisma/seedData.js";

// Lab 3, Issue 4 — authorization and safe errors (SEC-01 to SEC-04, SEC-06,
// SEC-07, SEC-09 to SEC-11 in docs/lab-03/tests.md). Needs the migrated and
// seeded database:  cd server && npx prisma migrate deploy && npm run prisma:seed
//
// Every forbidden case is asserted with a direct request. A hidden button
// proves nothing (labsheet §4.3).

const prisma = getPrisma();
const ALLOWED_ORIGIN = "http://localhost:5173";
const FOREIGN_ORIGIN = "https://evil.example";

// api-spec §7 — every route under the two guarded families, including those
// later issues write. The guard answers before any handler exists.
const STAFF_ROUTES: [string, string][] = [
  ["GET", "/api/staff/tickets"],
  ["GET", "/api/staff/tickets/1"],
  ["PATCH", "/api/staff/tickets/1/owner"],
  ["PATCH", "/api/staff/tickets/1/it-priority"],
  ["PATCH", "/api/staff/tickets/1/status"],
  ["GET", "/api/staff/assignable-users"],
];
const ADMIN_ROUTES: [string, string][] = [
  ["GET", "/api/admin/users"],
  ["POST", "/api/admin/users"],
  ["PATCH", "/api/admin/users/1"],
  ["POST", "/api/admin/users/1/initial-password"],
];
const SESSION_ROUTES: [string, string][] = [
  ["GET", "/api/auth/me"],
  ["POST", "/api/auth/password"],
];

function call(method: string, path: string, cookie?: string) {
  const agent = request(app);
  const req =
    method === "GET" ? agent.get(path) : method === "POST" ? agent.post(path) : agent.patch(path);
  if (cookie) req.set("Cookie", cookie);
  return method === "GET" ? req : req.send({});
}

function sessionCookie(res: Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[];
  return cookies.find((c) => c.startsWith("tt_sid="))!.split(";")[0];
}

async function signIn(email: string, password = SEED_PASSWORD): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status, email).toBe(201);
  return sessionCookie(res);
}

const cookies = {} as Record<"requesterA" | "requesterB" | "staff" | "admin", string>;
let requesterA: number;
let requesterB: number;
let ticketOfB: number;
let attachmentOfB: number;
let attachmentOfA: number;
let mustChangeUserId: number;
const createdTicketIds: number[] = [];

beforeAll(async () => {
  resetLoginThrottle();
  cookies.requesterA = await signIn("anucha.wong@kmutt.ac.th");
  cookies.requesterB = await signIn("kanya.sris@kmutt.ac.th");
  cookies.staff = await signIn("nattapong.it@toktickit.local");
  cookies.admin = await signIn("malee.admin@toktickit.local");
  requesterA = (await prisma.user.findUniqueOrThrow({ where: { email: "anucha.wong@kmutt.ac.th" } })).id;
  requesterB = (await prisma.user.findUniqueOrThrow({ where: { email: "kanya.sris@kmutt.ac.th" } })).id;

  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  const stamp = Date.now() % 90000;
  const makeTicket = (requesterId: number, n: number) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `TT-9994-${String(stamp + n).padStart(5, "0")}`,
        requesterId,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `Authorization suite ticket ${n}`,
        description: "Created by the Lab 3 authorization suite.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
      },
    });
  const a = await makeTicket(requesterA, 1);
  const b = await makeTicket(requesterB, 2);
  ticketOfB = b.id;
  createdTicketIds.push(a.id, b.id);

  // Attachment rows only: every request below is refused or 404s before any
  // file would be read.
  const attach = (ticketId: number, n: number) =>
    prisma.attachment.create({
      data: { ticketId, originalFilename: "evidence.pdf", storedFilename: `authz-${stamp}-${n}.pdf`, mimeType: "application/pdf", sizeBytes: 10 },
    });
  attachmentOfB = (await attach(b.id, 1)).id;
  attachmentOfA = (await attach(a.id, 2)).id;

  const mustChange = await prisma.user.create({
    data: {
      fullName: "Authorization Suite must-change",
      email: `authz.mustchange.${stamp}@example.test`,
      role: "IT_STAFF",
      mustChangePassword: true,
      passwordHash: await hashPassword("Correct-horse-1"),
    },
  });
  mustChangeUserId = mustChange.id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.user.delete({ where: { id: mustChangeUserId } });
  // The suite's own sign-ins; the seeded accounts' passwords are untouched.
  await prisma.session.deleteMany({ where: { userId: { in: [requesterA, requesterB] } } });
  await prisma.session.deleteMany({ where: { user: { email: { in: ["nattapong.it@toktickit.local", "malee.admin@toktickit.local"] } } } });
  resetLoginThrottle();
  await prisma.$disconnect();
});

describe("guards on every protected route family (BR-18, BR-21)", () => {
  it("SEC-01 answers 401 AUTH_REQUIRED, never 403, without a session", async () => {
    for (const [method, path] of [...SESSION_ROUTES, ...STAFF_ROUTES, ...ADMIN_ROUTES]) {
      const res = await call(method, path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("SEC-02 refuses a Requester on every IT Staff route", async () => {
    for (const [method, path] of STAFF_ROUTES) {
      const res = await call(method, path, cookies.requesterA);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("SEC-03 refuses an Administrator on every IT Staff route (BR-19)", async () => {
    for (const [method, path] of STAFF_ROUTES) {
      const res = await call(method, path, cookies.admin);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("SEC-04 refuses IT Staff and Requesters on every Administrator route", async () => {
    for (const cookie of [cookies.staff, cookies.requesterA]) {
      for (const [method, path] of ADMIN_ROUTES) {
        const res = await call(method, path, cookie);
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
    }
  });

  it("lets the right role through the guard to the route itself", async () => {
    // These handlers arrive in Issues 8 and 10, so for now the request reaches
    // the end of the API and gets the JSON 404 — past the guard, not stopped by it.
    expect((await call("GET", "/api/staff/tickets", cookies.staff)).status).toBe(404);
    expect((await call("GET", "/api/admin/users", cookies.admin)).status).toBe(404);
  });

  it("SEC-09 checks the session before the role, and the password change before both", async () => {
    // No session on a role-guarded route: 401, not 403.
    expect((await call("GET", "/api/staff/tickets")).status).toBe(401);

    // A session that must change its password is stopped by BR-14 first.
    const mustChange = await prisma.user.findUniqueOrThrow({ where: { id: mustChangeUserId } });
    const cookie = await signIn(mustChange.email, "Correct-horse-1");
    const res = await call("GET", "/api/staff/tickets", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});

describe("Requester ownership through the session (BR-03, BR-22)", () => {
  it("SEC-06 answers 404 for another Requester's ticket on every route, exactly like a missing one", async () => {
    const MISSING = 2_000_000_000;
    const pairs: [string, (id: number) => request.Test][] = [
      ["ticket detail", (id) => request(app).get(`/api/tickets/${id}`)],
      ["attachment list", (id) => request(app).get(`/api/tickets/${id}/attachments`)],
      ["upload", (id) => request(app).post(`/api/tickets/${id}/attachments`).attach("file", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" })],
    ];
    for (const [label, build] of pairs) {
      const theirs = await build(ticketOfB).set("Cookie", cookies.requesterA);
      const missing = await build(MISSING).set("Cookie", cookies.requesterA);
      expect(theirs.status, label).toBe(404);
      expect(theirs.body, label).toEqual(missing.body);
    }

    for (const [label, build] of [
      ["download", (id: number) => request(app).get(`/api/attachments/${id}/download`)],
      ["remove", (id: number) => request(app).patch(`/api/attachments/${id}/remove`).send({ removalReason: "Not mine at all" })],
    ] as [string, (id: number) => request.Test][]) {
      const theirs = await build(attachmentOfB).set("Cookie", cookies.requesterA);
      const missing = await build(MISSING).set("Cookie", cookies.requesterA);
      expect(theirs.status, label).toBe(404);
      expect(theirs.body, label).toEqual(missing.body);
    }

    // Nothing of B's was touched.
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentOfB } })).removedAt).toBeNull();
  });

  it("SEC-07 ignores X-Requester-Id and a body requesterId when a session is present", async () => {
    const list = await request(app).get("/api/tickets?pageSize=50").set("Cookie", cookies.requesterA).set("X-Requester-Id", String(requesterB));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    const owners = await prisma.ticket.findMany({ where: { id: { in: list.body.data.map((t: { id: number }) => t.id) } }, select: { requesterId: true } });
    expect(owners.every((t) => t.requesterId === requesterA)).toBe(true);

    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookies.requesterA)
      .set("X-Requester-Id", String(requesterB))
      .send({
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "Authorization suite identity check",
        description: "This ticket must belong to the signed-in Requester.",
        requestedPriority: "LOW",
        requesterId: requesterB,
      });
    expect(created.status).toBe(201);
    createdTicketIds.push(created.body.id);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: created.body.id } })).requesterId).toBe(requesterA);
  });

  it("SEC-07 refuses Requester-only routes to IT Staff and Administrators (BR-18)", async () => {
    for (const cookie of [cookies.staff, cookies.admin]) {
      for (const res of [
        await request(app).get("/api/tickets").set("Cookie", cookie),
        await request(app).post("/api/tickets").set("Cookie", cookie).send({}),
        await request(app).get(`/api/tickets/${ticketOfB}`).set("Cookie", cookie),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
    }
  });
});

describe("no password material leaves the API (BR-52)", () => {
  it("SEC-10 keeps hashes and tokens out of every user-carrying response", async () => {
    const responses = [
      await request(app).post("/api/auth/login").send({ email: "kanya.sris@kmutt.ac.th", password: SEED_PASSWORD }),
      await request(app).get("/api/auth/me").set("Cookie", cookies.staff),
      await request(app).get("/api/requesters"),
    ];
    for (const res of responses) {
      expect(res.status).toBeLessThan(300);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|initialPassword|\$2[aby]\$/);
    }
  });
});

describe("cross-site requests (BR-65)", () => {
  it("SEC-11 refuses a state-changing request from a foreign Origin before any handler runs", async () => {
    const login = await request(app).post("/api/auth/login").set("Origin", FOREIGN_ORIGIN).send({ email: "anucha.wong@kmutt.ac.th", password: SEED_PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("FORBIDDEN");
    expect(login.headers["set-cookie"]).toBeUndefined();

    const remove = await request(app).patch(`/api/attachments/${attachmentOfA}/remove`).set("Cookie", cookies.requesterA).set("Origin", FOREIGN_ORIGIN).send({ removalReason: "Forged from another site" });
    expect(remove.status).toBe(403);
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentOfA } })).removedAt).toBeNull();

    // The case D-13 is about: a multipart upload, which any HTML form can send.
    const before = await prisma.attachment.count();
    const upload = await request(app).post(`/api/tickets/${createdTicketIds[0]}/attachments`).set("Cookie", cookies.requesterA).set("Origin", FOREIGN_ORIGIN)
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "forged.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(403);
    expect(await prisma.attachment.count()).toBe(before);
  });

  it("SEC-11 lets the same requests through from the client's own origin, and never blocks a GET", async () => {
    // An unsupported file type proves the upload handler ran, without storing a file.
    const upload = await request(app).post(`/api/tickets/${createdTicketIds[0]}/attachments`).set("Cookie", cookies.requesterA).set("Origin", ALLOWED_ORIGIN)
      .attach("file", Buffer.from("plain text"), { filename: "notes.txt", contentType: "text/plain" });
    expect(upload.status).toBe(415);

    const remove = await request(app).patch(`/api/attachments/${attachmentOfA}/remove`).set("Cookie", cookies.requesterA).set("Origin", ALLOWED_ORIGIN).send({ removalReason: "Removed by the owner" });
    expect(remove.status).toBe(200);

    const read = await request(app).get("/api/auth/me").set("Cookie", cookies.requesterA).set("Origin", FOREIGN_ORIGIN);
    expect(read.status).toBe(200);
  });
});

describe("one distinct answer per kind of failure (§6.2, AC-10)", () => {
  it("separates unauthenticated, forbidden, invalid input, missing, and conflict", async () => {
    const cases: [string, Promise<Response>, number, string][] = [
      ["no session", call("GET", "/api/auth/me"), 401, "AUTH_REQUIRED"],
      ["wrong role", call("GET", "/api/staff/tickets", cookies.requesterB), 403, "FORBIDDEN"],
      ["malformed JSON", request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{not json"), 400, "VALIDATION_FAILED"],
      ["unknown API route", request(app).get("/api/no-such-thing"), 404, "NOT_FOUND"],
      ["missing ticket", request(app).get("/api/tickets/2000000000").set("Cookie", cookies.requesterA), 404, "NOT_FOUND"],
      // attachmentOfA was removed by the test above, so removing it again conflicts.
      ["conflict", request(app).patch(`/api/attachments/${attachmentOfA}/remove`).set("Cookie", cookies.requesterA).send({ removalReason: "Remove it twice" }), 409, "ATTACHMENT_ALREADY_REMOVED"],
    ];
    for (const [label, pending, status, code] of cases) {
      const res = await pending;
      expect(res.status, label).toBe(status);
      expect(res.body.error.code, label).toBe(code);
      expect(JSON.stringify(res.body), label).not.toMatch(/stack|prisma|SELECT|\\\\|node_modules/i);
    }
  });
});
