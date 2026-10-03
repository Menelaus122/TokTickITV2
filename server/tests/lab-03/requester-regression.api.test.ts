import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 6 — the Lab 2 Requester flow on a real session (API-15 to
// API-18, SEC-08 in docs/lab-03/tests.md). Needs the migrated and seeded
// database:  cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The Lab 2 suites in tests/lab-02 keep proving each behaviour in depth, now
// signed in. This suite walks the whole journey once as a person would, and
// pins what Issue 6 itself changed: the header is gone, the selector's list is
// gone, and the status filter knows the eight Lab 3 statuses.

const prisma = getPrisma();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n");
const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

let requesterA: number;
let requesterB: number;
let cookieA: string;
let categoryId: number;
let relatedSystemId: number;
const createdTicketIds: number[] = [];

beforeAll(async () => {
  const [a, b] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
    take: 2,
  });
  requesterA = a.id;
  requesterB = b.id;
  cookieA = await signInAs(requesterA);
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  const files = await prisma.attachment.findMany({
    where: { ticketId: { in: createdTicketIds } },
    select: { storedFilename: true },
  });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  for (const file of files) await rm(join(UPLOAD_DIR, file.storedFilename), { force: true }).catch(() => {});
  await endTestSessions();
  await prisma.$disconnect();
});

function createTicket(cookie: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/tickets")
    .set("Cookie", cookie)
    .send({
      categoryId,
      relatedSystemId,
      summary: "Requester regression journey",
      description: "Created by the Lab 3 requester regression suite while signed in.",
      requestedPriority: "HIGH",
      ...extra,
    });
}

describe("the Lab 2 journey as a signed-in Requester", () => {
  it("API-15 creates, lists, reads, attaches, downloads, and soft-removes", async () => {
    const created = await createTicket(cookieA);
    expect(created.status).toBe(201);
    createdTicketIds.push(created.body.id);
    expect(created.body.requester.id).toBe(requesterA);
    expect(created.body.currentStatus).toBe("NEW");

    const list = await request(app).get("/api/tickets?search=Requester%20regression%20journey").set("Cookie", cookieA);
    expect(list.status).toBe(200);
    expect(list.body.data.map((t: { id: number }) => t.id)).toContain(created.body.id);

    const detail = await request(app).get(`/api/tickets/${created.body.id}`).set("Cookie", cookieA);
    expect(detail.status).toBe(200);
    expect(detail.body.ticketNumber).toBe(created.body.ticketNumber);

    const upload = await request(app)
      .post(`/api/tickets/${created.body.id}/attachments`)
      .set("Cookie", cookieA)
      .attach("file", PDF, { filename: "journey.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);

    const attachments = await request(app).get(`/api/tickets/${created.body.id}/attachments`).set("Cookie", cookieA);
    expect(attachments.status).toBe(200);
    expect(attachments.body.map((row: { id: number }) => row.id)).toContain(upload.body.id);

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set("Cookie", cookieA)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(Buffer.from(download.body).equals(PDF)).toBe(true);

    const removed = await request(app)
      .patch(`/api/attachments/${upload.body.id}/remove`)
      .set("Cookie", cookieA)
      .send({ removalReason: "Uploaded to the wrong ticket." });
    expect(removed.status).toBe(200);
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(row.removedAt).not.toBeNull();
    expect(row.removalReason).toBe("Uploaded to the wrong ticket.");
  });

  it("SEC-08 ignores a body ticketNumber and currentStatus; the backend's values win", async () => {
    const res = await createTicket(cookieA, { ticketNumber: "TT-1999-00001", currentStatus: "CLOSED" });
    expect(res.status).toBe(201);
    createdTicketIds.push(res.body.id);
    expect(res.body.ticketNumber).not.toBe("TT-1999-00001");
    expect(res.body.ticketNumber).toMatch(/^TT-\d{4}-\d{5}$/);
    expect(res.body.currentStatus).toBe("NEW");
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.currentStatus).toBe("NEW");
    expect(row.requesterId).toBe(requesterA);
  });
});

describe("Problem Appears Resolved (BR-29, BR-30, BR-05)", () => {
  async function ownTicket(status: "NEW" | "IN_PROGRESS" = "IN_PROGRESS") {
    const created = await createTicket(cookieA);
    createdTicketIds.push(created.body.id);
    await prisma.ticket.update({ where: { id: created.body.id }, data: { currentStatus: status } });
    return created.body.id as number;
  }

  function mark(id: number, body: unknown, cookie = cookieA) {
    return request(app).patch(`/api/tickets/${id}/appears-resolved`).set("Cookie", cookie).send(body as object);
  }

  it("API-19 records the signal and a Public Comment, and leaves Current Status alone", async () => {
    const id = await ownTicket();
    const res = await mark(id, { appearsResolved: true, comment: "  Printer works again since this morning.  " });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toEqual({ id, requesterResolvedAt: expect.any(String), currentStatus: "IN_PROGRESS" });
    expect(res.body.comment).toMatchObject({ body: "Printer works again since this morning.", author: { id: requesterA, role: "REQUESTER" } });
    expect(res.body.comment.createdAt).toBe(res.body.ticket.requesterResolvedAt);

    const row = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(row.currentStatus).toBe("IN_PROGRESS");
    expect(row.requesterResolvedAt?.toISOString()).toBe(res.body.ticket.requesterResolvedAt);
    const thread = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookieA);
    expect(thread.body.comments.map((c: { id: number }) => c.id)).toEqual([res.body.comment.id]);

    // The detail screen learns about it too.
    const detail = await request(app).get(`/api/tickets/${id}`).set("Cookie", cookieA);
    expect(detail.body.requesterResolvedAt).toBe(res.body.ticket.requesterResolvedAt);
  });

  it("API-19 the Requester can withdraw the signal without a comment (BR-30)", async () => {
    const id = await ownTicket();
    expect((await mark(id, { appearsResolved: true, comment: "Looks fixed to me." })).status).toBe(200);
    const comments = await prisma.publicComment.count({ where: { ticketId: id } });

    const undo = await mark(id, { appearsResolved: false });
    expect(undo.status).toBe(200);
    expect(undo.body).toEqual({ ticket: { id, requesterResolvedAt: null, currentStatus: "IN_PROGRESS" }, comment: null });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).toBeNull();
    expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(comments);
  });

  it("API-20 requires a comment of 5 to 2000 characters, and records nothing otherwise", async () => {
    const id = await ownTicket();
    for (const comment of [undefined, "", "   ", "Fine", "a".repeat(2001), 12345]) {
      const res = await mark(id, { appearsResolved: true, comment });
      expect(res.status, JSON.stringify(comment)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.fields.comment).toBeTruthy();
    }
    for (const appearsResolved of [undefined, "true", 1, null]) {
      const res = await mark(id, { appearsResolved, comment: "Looks fixed to me." });
      expect(res.status, JSON.stringify(appearsResolved)).toBe(400);
      expect(res.body.error.fields.appearsResolved).toBeTruthy();
    }
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).toBeNull();
    expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(0);

    expect((await mark(id, { appearsResolved: true, comment: "Fixed" })).status).toBe(200); // 5 is enough
    expect((await mark(id, { appearsResolved: true, comment: "b".repeat(2000) })).status).toBe(200);
  });

  it("API-21 no Requester request can set Current Status (BR-05)", async () => {
    const id = await ownTicket("NEW");
    const attempts = [
      await mark(id, { appearsResolved: true, comment: "Please close this.", currentStatus: "RESOLVED" }),
      await request(app).post(`/api/tickets/${id}/comments`).set("Cookie", cookieA).send({ body: "Closing it myself.", currentStatus: "CLOSED" }),
      await request(app).patch(`/api/staff/tickets/${id}/status`).set("Cookie", cookieA).send({ currentStatus: "RESOLVED", reason: "Fixed now." }),
      await request(app).patch(`/api/tickets/${id}`).set("Cookie", cookieA).send({ currentStatus: "RESOLVED" }),
      await request(app).patch(`/api/tickets/${id}/status`).set("Cookie", cookieA).send({ currentStatus: "RESOLVED" }),
    ];
    expect(attempts.map((r) => r.status)).toEqual([200, 201, 403, 404, 404]);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe("NEW");
  });

  it("is the owning Requester's alone: another Requester gets 404, IT Staff and Administrators 403", async () => {
    const id = await ownTicket();
    const other = await signInAs(requesterB);
    const staff = await signInAs((await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } })).id);
    const admin = await signInAs((await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } })).id);
    const body = { appearsResolved: true, comment: "Looks fixed from here." };

    expect((await mark(id, body, other)).status).toBe(404);
    expect((await mark(id, body, staff)).status).toBe(403);
    expect((await mark(id, body, admin)).status).toBe(403);
    expect((await request(app).patch(`/api/tickets/${id}/appears-resolved`).send(body)).status).toBe(401);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).requesterResolvedAt).toBeNull();
  });
});

describe("identity comes from the session only", () => {
  it("API-16 ignores X-Requester-Id naming another user; the session's tickets come back", async () => {
    const res = await request(app)
      .get("/api/tickets?pageSize=50")
      .set("Cookie", cookieA)
      .set("X-Requester-Id", String(requesterB));
    expect(res.status).toBe(200);
    expect(res.body.meta.totalItems).toBe(await prisma.ticket.count({ where: { requesterId: requesterA } }));
    const owners = await prisma.ticket.findMany({
      where: { id: { in: res.body.data.map((t: { id: number }) => t.id) } },
      select: { requesterId: true },
    });
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((t) => t.requesterId === requesterA)).toBe(true);
  });

  it("API-16 answers 401 to the header alone, on reads and on writes", async () => {
    const read = await request(app).get("/api/tickets").set("X-Requester-Id", String(requesterA));
    expect(read.status).toBe(401);
    expect(read.body.error.code).toBe("AUTH_REQUIRED");

    const before = await prisma.ticket.count();
    const write = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterA))
      .send({ categoryId, relatedSystemId, summary: "Header only", description: "Must never be created.", requestedPriority: "LOW" });
    expect(write.status).toBe(401);
    expect(await prisma.ticket.count()).toBe(before);
  });

  it("API-18 no longer serves GET /api/requesters (FR-16)", async () => {
    for (const cookie of [undefined, cookieA]) {
      const req = request(app).get("/api/requesters");
      if (cookie) req.set("Cookie", cookie);
      const res = await req;
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("My Tickets with Lab 3 statuses", () => {
  it("API-17 filters by each of the eight statuses, still scoped to the session", async () => {
    // The seed spreads the eight statuses across the four active Requesters
    // (MIG-07), so each status is checked as a Requester who has one.
    for (const status of STATUSES) {
      const owner = await prisma.ticket.findFirstOrThrow({
        where: { currentStatus: status, requester: { isActive: true, mustChangePassword: false, role: "REQUESTER" } },
        orderBy: { id: "asc" },
        select: { requesterId: true },
      });
      const cookie = owner.requesterId === requesterA ? cookieA : await signInAs(owner.requesterId);
      const res = await request(app).get(`/api/tickets?currentStatus=${status}&pageSize=50`).set("Cookie", cookie);
      expect(res.status, status).toBe(200);
      expect(res.body.meta.totalItems, status).toBe(
        await prisma.ticket.count({ where: { requesterId: owner.requesterId, currentStatus: status } }),
      );
      expect(res.body.data.length, status).toBeGreaterThan(0);
      expect(res.body.data.every((t: { currentStatus: string }) => t.currentStatus === status), status).toBe(true);
    }
  });

  it("API-17 still refuses a status outside the eight with 400 INVALID_QUERY", async () => {
    for (const status of ["closed", "ARCHIVED"]) {
      const res = await request(app).get(`/api/tickets?currentStatus=${status}`).set("Cookie", cookieA);
      expect(res.status, status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("API-17 keeps search, sort, and pagination as Lab 2 defined them", async () => {
    const page = await request(app).get("/api/tickets?sortBy=createdAt&sortDir=asc&pageSize=10&page=1").set("Cookie", cookieA);
    expect(page.status).toBe(200);
    expect(page.body.meta).toMatchObject({ page: 1, pageSize: 10 });
    const times = page.body.data.map((t: { ticketDate: string }) => Date.parse(t.ticketDate));
    expect(times).toEqual([...times].sort((x, y) => x - y));

    const bad = await request(app).get("/api/tickets?pageSize=7").set("Cookie", cookieA);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_QUERY");
  });
});

describe("malformed route ids", () => {
  it("answers an id Express cannot decode as the handler would: 400 INVALID_QUERY", async () => {
    const cases: [string, string][] = [
      ["/api/tickets/%E0", "The ticket id is not valid."],
      ["/api/tickets/%E0/attachments", "The ticket id is not valid."],
      ["/api/attachments/%E0/download", "The attachment id is not valid."],
    ];
    for (const [path, message] of cases) {
      const res = await request(app).get(path).set("Cookie", cookieA);
      expect(res.status, path).toBe(400);
      expect(res.body).toEqual({ error: { code: "INVALID_QUERY", message } });
    }
  });
});
