import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, UPLOAD_DIR } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { TICKET_STATUSES, type TicketStatus } from "../../src/listQuery.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 9 — IT Staff Ticket Detail operations (API-40 to API-52 and
// API-68 in docs/lab-03/tests.md; api-spec §5.2 to §5.5, BR-24 to BR-38).
// Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// Every test makes its own ticket, so no test depends on another's order.

const prisma = getPrisma();

// BR-33, written out independently of src/transitions.ts.
const MATRIX: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};
const NEEDS_REASON: TicketStatus[] = ["RESOLVED", "CANCELLED", "REOPENED"];
const REASON = "Checked with the Requester and fixed.";

const cookies = {} as Record<"staff" | "colleague" | "admin" | "requester", string>;
const ids = {} as Record<"me" | "colleague" | "admin" | "requester" | "inactiveStaff", number>;
let categoryId: number;
let relatedSystemId: number;
const ticketIds: number[] = [];
const storedFiles: string[] = [];
let sequence = 0;
const numberBase = Date.now() % 80000;

async function makeTicket(overrides: { ownerId?: number | null; currentStatus?: TicketStatus; requesterResolvedAt?: Date | null } = {}) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9994-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId: ids.requester,
      ownerId: overrides.ownerId ?? null,
      categoryId,
      relatedSystemId,
      summary: "Projector in room 4 flickers",
      description: "Created by the staff ticket detail API suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: overrides.currentStatus ?? "NEW",
      requesterResolvedAt: overrides.requesterResolvedAt ?? null,
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

const detail = (id: number | string, cookie = cookies.staff) =>
  request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookie);
const patch = (id: number, action: "owner" | "it-priority" | "status", body: unknown, cookie = cookies.staff) =>
  request(app).patch(`/api/staff/tickets/${id}/${action}`).set("Cookie", cookie).send(body as object);
const row = (id: number) => prisma.ticket.findUniqueOrThrow({ where: { id } });
const reasonFor = (to: TicketStatus) => (NEEDS_REASON.includes(to) ? { reason: REASON } : {});

beforeAll(async () => {
  const [me, colleague] = await prisma.user.findMany({
    where: { role: "IT_STAFF", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
    take: 2,
  });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } });
  const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } });
  const inactiveStaff = await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: false }, orderBy: { id: "asc" } });
  Object.assign(ids, { me: me.id, colleague: colleague.id, admin: admin.id, requester: requester.id, inactiveStaff: inactiveStaff.id });

  cookies.staff = await signInAs(me.id);
  cookies.colleague = await signInAs(colleague.id);
  cookies.admin = await signInAs(admin.id);
  cookies.requester = await signInAs(requester.id);

  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  // Comments, notes, and attachment rows cascade with their ticket.
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  for (const file of storedFiles) await rm(join(UPLOAD_DIR, file), { force: true }).catch(() => {});
  await endTestSessions();
  await prisma.$disconnect();
});

describe("GET /api/staff/tickets/:id", () => {
  it("API-51 returns the ticket with permittedTransitions from the matrix for its status (FR-34)", async () => {
    for (const status of TICKET_STATUSES) {
      const id = await makeTicket({ currentStatus: status, ownerId: ids.me });
      const res = await detail(id);
      expect(res.status, status).toBe(200);
      expect(res.body.ticket.currentStatus).toBe(status);
      expect(res.body.ticket.permittedTransitions).toEqual(MATRIX[status]);
    }
  });

  it("carries both priorities, the owner, and the Requester in the permitted user shape", async () => {
    const id = await makeTicket({ ownerId: ids.me });
    const { ticket } = (await detail(id)).body;
    expect(ticket).toMatchObject({
      id,
      summary: "Projector in room 4 flickers",
      description: "Created by the staff ticket detail API suite.",
      categoryName: expect.any(String),
      relatedSystemName: expect.any(String),
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      owner: { id: ids.me, fullName: expect.any(String), isActive: true },
      attachments: [],
    });
    expect(Object.keys(ticket.requester).sort()).toEqual(["email", "fullName", "id", "isActive", "role"]);
    expect(JSON.stringify(ticket)).not.toMatch(/password|hash|token/i);
  });

  it("is 404 for a ticket that does not exist and 400 for a malformed id", async () => {
    expect((await detail(2147483647)).status).toBe(404);
    expect((await detail("abc")).status).toBe(400);
  });

  it("is refused to a Requester and an Administrator with no ticket data, and 401 without a session (BR-19, BR-21)", async () => {
    const id = await makeTicket();
    for (const cookie of [cookies.requester, cookies.admin]) {
      const res = await detail(id, cookie);
      expect(res.status).toBe(403);
      expect(res.body.ticket).toBeUndefined();
    }
    expect((await request(app).get(`/api/staff/tickets/${id}`)).status).toBe(401);
  });
});

describe("ownership — PATCH /api/staff/tickets/:id/owner", () => {
  it("API-40 claiming an unassigned NEW ticket sets the owner and moves it to OPEN in one operation (BR-34)", async () => {
    const id = await makeTicket({ requesterResolvedAt: new Date() });
    const res = await patch(id, "owner", { ownerId: ids.me, expectedOwnerId: null });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ owner: { id: ids.me }, currentStatus: "OPEN", requesterResolvedAt: null });
    expect(res.body.ticket.permittedTransitions).toEqual(MATRIX.OPEN);
    expect(await row(id)).toMatchObject({ ownerId: ids.me, currentStatus: "OPEN" });
  });

  it("claiming a ticket past NEW keeps its status", async () => {
    const id = await makeTicket({ currentStatus: "REOPENED" });
    const res = await patch(id, "owner", { ownerId: ids.me, expectedOwnerId: null });
    expect(res.status).toBe(200);
    expect(res.body.ticket.currentStatus).toBe("REOPENED");
  });

  it("API-41 a second claim is refused as a conflict and the owner is unchanged (BR-25, AC-23)", async () => {
    const id = await makeTicket();
    expect((await patch(id, "owner", { ownerId: ids.me, expectedOwnerId: null })).status).toBe(200);
    const second = await patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: null }, cookies.colleague);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("TICKET_ALREADY_OWNED");
    expect((await row(id)).ownerId).toBe(ids.me);
  });

  it("API-41 two simultaneous claims: exactly one wins", async () => {
    const id = await makeTicket();
    const results = await Promise.all([
      patch(id, "owner", { ownerId: ids.me, expectedOwnerId: null }),
      patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: null }, cookies.colleague),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results[0].status === 200 ? ids.me : ids.colleague;
    expect(await row(id)).toMatchObject({ ownerId: winner, currentStatus: "OPEN" });
  });

  it("API-42 reassigns to another active IT Staff member, then unassigns", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "IN_PROGRESS" });
    const reassigned = await patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: ids.me });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.ticket.owner.id).toBe(ids.colleague);

    const unassigned = await patch(id, "owner", { ownerId: null, expectedOwnerId: ids.colleague });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.ticket.owner).toBeNull();
    // Ownership is not a status: unassigning leaves the work where it was.
    expect(unassigned.body.ticket.currentStatus).toBe("IN_PROGRESS");
  });

  it("refuses a reassignment made from a stale screen", async () => {
    const id = await makeTicket({ ownerId: ids.colleague, currentStatus: "OPEN" });
    const res = await patch(id, "owner", { ownerId: ids.me, expectedOwnerId: ids.admin });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_ALREADY_OWNED");
    expect((await row(id)).ownerId).toBe(ids.colleague);
  });

  it("assigns an active Administrator, who may own a ticket (BR-20)", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "OPEN" });
    const res = await patch(id, "owner", { ownerId: ids.admin, expectedOwnerId: ids.me });
    expect(res.status).toBe(200);
    expect(res.body.ticket.owner.id).toBe(ids.admin);
  });

  it("API-43 refuses a Requester and an inactive IT Staff member as owner (BR-24)", async () => {
    const id = await makeTicket();
    for (const ownerId of [ids.requester, ids.inactiveStaff]) {
      const res = await patch(id, "owner", { ownerId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("OWNER_NOT_ASSIGNABLE");
    }
    expect(await row(id)).toMatchObject({ ownerId: null, currentStatus: "NEW" });
  });

  it("validates the body: ownerId is required, and must be an existing user's id or null", async () => {
    const id = await makeTicket();
    for (const body of [{}, { ownerId: String(ids.me) }, { ownerId: 1.5 }, { ownerId: 9999999999 }, { ownerId: ids.me, expectedOwnerId: "none" }]) {
      const res = await patch(id, "owner", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    }
    const missing = await patch(id, "owner", { ownerId: 2147483647 });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.ownerId).toBeDefined();
  });

  it("refuses any owner change on a CANCELLED ticket, which is terminal", async () => {
    const id = await makeTicket({ currentStatus: "CANCELLED" });
    const res = await patch(id, "owner", { ownerId: ids.me });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("refuses to unassign a RESOLVED or CLOSED ticket, which must keep an owner (BR-35)", async () => {
    for (const status of ["RESOLVED", "CLOSED"] as const) {
      const id = await makeTicket({ ownerId: ids.me, currentStatus: status });
      const res = await patch(id, "owner", { ownerId: null });
      expect(res.status, status).toBe(409);
      expect(res.body.error.code).toBe("OWNER_REQUIRED");
      expect((await row(id)).ownerId).toBe(ids.me);
    }
  });

  it("is 404 for a ticket that does not exist", async () => {
    expect((await request(app).patch("/api/staff/tickets/2147483647/owner").set("Cookie", cookies.staff).send({ ownerId: ids.me })).status).toBe(404);
  });
});

describe("IT Priority — PATCH /api/staff/tickets/:id/it-priority", () => {
  it("API-44 changes IT Priority and never Requested Priority (BR-27, AC-24)", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "OPEN" });
    const res = await patch(id, "it-priority", { itPriority: "URGENT", requestedPriority: "LOW" });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ itPriority: "URGENT", requestedPriority: "MEDIUM" });
    expect(await row(id)).toMatchObject({ itPriority: "URGENT", requestedPriority: "MEDIUM" });
  });

  it("refuses an unknown priority with 400, and an unknown ticket with 404", async () => {
    const id = await makeTicket();
    for (const body of [{}, { itPriority: "CRITICAL" }, { itPriority: "urgent" }, { itPriority: 3 }]) {
      const res = await patch(id, "it-priority", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.fields.itPriority).toBeDefined();
    }
    expect((await row(id)).itPriority).toBe("MEDIUM");
    expect((await request(app).patch("/api/staff/tickets/2147483647/it-priority").set("Cookie", cookies.staff).send({ itPriority: "LOW" })).status).toBe(404);
  });
});

describe("status — PATCH /api/staff/tickets/:id/status", () => {
  it("API-45 performs every permitted transition in the matrix", async () => {
    for (const from of TICKET_STATUSES) {
      for (const to of MATRIX[from]) {
        const id = await makeTicket({ ownerId: ids.me, currentStatus: from });
        const res = await patch(id, "status", { currentStatus: to, ...reasonFor(to) });
        expect(res.status, `${from} → ${to}`).toBe(200);
        expect(res.body.ticket.currentStatus).toBe(to);
        expect(res.body.ticket.permittedTransitions).toEqual(MATRIX[to]);
      }
    }
  });

  it("API-46 refuses every transition outside the matrix, and repeating the current status, leaving the status unchanged (BR-33, BR-38)", async () => {
    for (const from of TICKET_STATUSES) {
      const id = await makeTicket({ ownerId: ids.me, currentStatus: from });
      for (const to of TICKET_STATUSES) {
        if (MATRIX[from].includes(to)) continue;
        const res = await patch(id, "status", { currentStatus: to, ...reasonFor(to) });
        expect(res.status, `${from} → ${to}`).toBe(409);
        expect(res.body.error.code).toBe("INVALID_TRANSITION");
      }
      expect((await row(id)).currentStatus).toBe(from);
      // A refused move posts no reason either.
      expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(0);
    }
  });

  it("API-47 refuses Resolved, Cancelled, and Reopened without a 5–2000 character reason (BR-36, BR-37)", async () => {
    const cases: Array<[TicketStatus, TicketStatus]> = [["IN_PROGRESS", "RESOLVED"], ["OPEN", "CANCELLED"], ["CLOSED", "REOPENED"]];
    for (const [from, to] of cases) {
      const id = await makeTicket({ ownerId: ids.me, currentStatus: from });
      for (const reason of [undefined, "", "    ", "four", "x".repeat(2001), 12345]) {
        const res = await patch(id, "status", { currentStatus: to, reason });
        expect(res.status, `${to} with ${JSON.stringify(reason)}`).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_FAILED");
        expect(res.body.error.fields.reason).toBeDefined();
      }
      expect((await row(id)).currentStatus).toBe(from);
      expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(0);
    }
  });

  it("API-48 posts the reason as a Public Comment in the same operation (D-08)", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "IN_PROGRESS" });
    const res = await patch(id, "status", { currentStatus: "RESOLVED", reason: `  ${REASON}  ` });
    expect(res.status).toBe(200);
    expect(res.body.comment).toMatchObject({ body: REASON, author: { id: ids.me, role: "IT_STAFF" } });

    const comments = await prisma.publicComment.findMany({ where: { ticketId: id } });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: res.body.comment.id, authorId: ids.me, body: REASON });
    // The Requester reads it through their own thread.
    const thread = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookies.requester);
    expect(thread.body.comments.map((c: { body: string }) => c.body)).toEqual([REASON]);
  });

  it("does not post a comment for a transition that needs no reason", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "OPEN" });
    const res = await patch(id, "status", { currentStatus: "IN_PROGRESS", reason: "Ignored here." });
    expect(res.status).toBe(200);
    expect(res.body.comment).toBeNull();
    expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(0);
  });

  it("API-49 refuses to resolve or close a ticket with no owner (BR-35)", async () => {
    const cases: Array<[TicketStatus, TicketStatus]> = [["IN_PROGRESS", "RESOLVED"], ["RESOLVED", "CLOSED"]];
    for (const [from, to] of cases) {
      const id = await makeTicket({ currentStatus: from });
      const res = await patch(id, "status", { currentStatus: to, ...reasonFor(to) });
      expect(res.status, to).toBe(409);
      expect(res.body.error.code).toBe("OWNER_REQUIRED");
      expect((await row(id)).currentStatus).toBe(from);
      expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(0);
    }
  });

  it("API-68 cancels an unassigned NEW ticket with a reason — cancelling needs no owner (BR-35)", async () => {
    const id = await makeTicket();
    const res = await patch(id, "status", { currentStatus: "CANCELLED", reason: "Duplicate of an earlier ticket." });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ currentStatus: "CANCELLED", owner: null, permittedTransitions: [] });
  });

  it("API-50 any successful transition clears the Requester's appears-resolved signal (BR-30)", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "WAITING_FOR_REQUESTER", requesterResolvedAt: new Date() });
    const res = await patch(id, "status", { currentStatus: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.requesterResolvedAt).toBeNull();
    expect((await row(id)).requesterResolvedAt).toBeNull();
  });

  it("refuses an unknown target with 400", async () => {
    const id = await makeTicket();
    for (const body of [{}, { currentStatus: "DONE" }, { currentStatus: "open" }]) {
      const res = await patch(id, "status", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.fields.currentStatus).toBeDefined();
    }
  });

  it("two simultaneous transitions from one status: exactly one wins", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "IN_PROGRESS" });
    const results = await Promise.all([
      patch(id, "status", { currentStatus: "RESOLVED", reason: REASON }),
      patch(id, "status", { currentStatus: "RESOLVED", reason: REASON }, cookies.colleague),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.publicComment.count({ where: { ticketId: id } })).toBe(1);
  });
});

describe("roles on every write", () => {
  it("refuses a Requester and an Administrator on each operation, changing nothing (BR-18, BR-19)", async () => {
    const id = await makeTicket();
    const before = await row(id);
    for (const cookie of [cookies.requester, cookies.admin]) {
      for (const [action, body] of [
        ["owner", { ownerId: ids.me }],
        ["it-priority", { itPriority: "URGENT" }],
        ["status", { currentStatus: "CANCELLED", reason: REASON }],
      ] as const) {
        const res = await patch(id, action, body, cookie);
        expect(res.status, action).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
    }
    expect(await row(id)).toEqual(before);
  });
});

describe("attachments on the staff detail", () => {
  async function attach(ticketId: number, removed: boolean) {
    const storedFilename = `staff-detail-${Date.now()}-${sequence++}.pdf`;
    const bytes = Buffer.from("%PDF-1.4 staff detail suite");
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, storedFilename), bytes);
    storedFiles.push(storedFilename);
    return prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: removed ? "old-quote.pdf" : "error-report.pdf",
        storedFilename,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        ...(removed ? { removedAt: new Date(), removalReason: "Uploaded the wrong file." } : {}),
      },
    });
  }

  it("API-52 lists active attachments as downloadable and removed ones as marked metadata (FR-36, AC-27)", async () => {
    const id = await makeTicket({ ownerId: ids.me, currentStatus: "OPEN" });
    const active = await attach(id, false);
    const removed = await attach(id, true);

    const { attachments } = (await detail(id)).body.ticket;
    expect(attachments).toEqual([
      expect.objectContaining({ id: active.id, removedAt: null, downloadUrl: `/api/staff/attachments/${active.id}/download` }),
      expect.objectContaining({ id: removed.id, removalReason: "Uploaded the wrong file.", downloadUrl: null }),
    ]);
    expect(JSON.stringify(attachments)).not.toContain("storedFilename");

    const download = await request(app).get(`/api/staff/attachments/${active.id}/download`).set("Cookie", cookies.staff);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(download.headers["content-disposition"]).toContain('filename="error-report.pdf"');

    const gone = await request(app).get(`/api/staff/attachments/${removed.id}/download`).set("Cookie", cookies.staff);
    expect(gone.status).toBe(410);
    expect(gone.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  it("keeps the staff download to IT Staff, and keeps IT Staff off the Requester routes (BR-18)", async () => {
    const id = await makeTicket();
    const active = await attach(id, false);
    for (const cookie of [cookies.requester, cookies.admin]) {
      expect((await request(app).get(`/api/staff/attachments/${active.id}/download`).set("Cookie", cookie)).status).toBe(403);
    }
    expect((await request(app).get(`/api/attachments/${active.id}/download`).set("Cookie", cookies.staff)).status).toBe(403);
    expect((await request(app).get("/api/staff/attachments/2147483647/download").set("Cookie", cookies.staff)).status).toBe(404);
  });
});
