import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 4 — Actions Taken API (API-01 to API-17 in docs/lab-04/tests.md
// §2.2; api-spec §1.3, §2; specification.md BR-01 to BR-14, BR-27 to BR-29,
// BR-44, BR-52). Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the
// real database. Every test makes its own ticket, so none depends on another's
// order, and afterAll removes them (their actions and history go with them).

const prisma = getPrisma();

type Who = "requester" | "otherRequester" | "owner" | "colleague" | "admin";
const ids = {} as Record<Who, number>;
const cookies = {} as Record<Who, string>;
const ticketIds: number[] = [];
let categoryId: number;
let relatedSystemId: number;
let sequence = 0;
const numberBase = Date.now() % 80000;

async function makeTicket(
  options: { requesterId?: number; ownerId?: number | null; status?: TicketStatus; createdAt?: Date } = {},
): Promise<number> {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9992-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId: options.requesterId ?? ids.requester,
      ownerId: options.ownerId === undefined ? ids.owner : options.ownerId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 actions API suite ticket",
      description: "Created by the Lab 4 Actions Taken API suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: options.status ?? "IN_PROGRESS",
      // A ticket created a day ago leaves room for an action dated before now.
      createdAt: options.createdAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

const HOUR = 60 * 60 * 1000;

// A row written straight to the table, so a read test controls ids and dates.
function storeAction(
  ticketId: number,
  overrides: Partial<{ performedById: number; actionAt: Date; createdAt: Date; description: string; followUpRequired: boolean; followUpNote: string | null }> = {},
) {
  const createdAt = overrides.createdAt ?? new Date(Date.now() - HOUR);
  return prisma.actionTaken.create({
    data: {
      ticketId,
      performedById: overrides.performedById ?? ids.owner,
      actionAt: overrides.actionAt ?? new Date(Date.now() - 2 * HOUR),
      description: overrides.description ?? "Replaced the toner cartridge and ran a test page.",
      result: "The test page printed cleanly.",
      followUpRequired: overrides.followUpRequired ?? false,
      followUpNote: overrides.followUpNote ?? null,
      createdAt,
      updatedAt: createdAt,
    },
  });
}

const list = (ticketId: number | string, cookie?: string) => {
  const req = request(app).get(`/api/tickets/${ticketId}/actions-taken`);
  return cookie ? req.set("Cookie", cookie) : req;
};

// api-spec §1.3 — the shape of one action, and nothing wider (no request key).
const ACTION_KEYS = [
  "actionAt", "attachmentNotes", "createdAt", "description", "followUpNote", "followUpRequired",
  "id", "performedBy", "result", "ticketId", "updatedAt", "updatedBy", "version",
];

beforeAll(async () => {
  const pick = async (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", skip = 0) =>
    (
      await prisma.user.findMany({
        where: { role, isActive: true, mustChangePassword: false },
        orderBy: { id: "asc" },
        select: { id: true },
        skip,
        take: 1,
      })
    )[0].id;
  ids.requester = await pick("REQUESTER");
  ids.otherRequester = await pick("REQUESTER", 1);
  ids.owner = await pick("IT_STAFF");
  ids.colleague = await pick("IT_STAFF", 1);
  ids.admin = await pick("ADMINISTRATOR");
  for (const who of Object.keys(ids) as Who[]) cookies[who] = await signInAs(ids[who]);

  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("GET /api/tickets/:id/actions-taken", () => {
  it("API-01 answers 200 with an empty list for a Ticket that has no Actions Taken (FR-08, AC-10, AC-23)", async () => {
    const id = await makeTicket();
    for (const who of ["owner", "admin", "requester"] as const) {
      const res = await list(id, cookies[who]);
      expect(res.status, who).toBe(200);
      expect(res.body, who).toEqual({ actions: [] });
    }
  });

  it("API-01 answers the same for a seeded legacy Ticket, one that existed before Lab 4 (MIG-03, AC-23)", async () => {
    // Not one of this suite's tickets: the oldest seeded ticket that has no action.
    const legacy = await prisma.ticket.findFirstOrThrow({
      where: { actionsTaken: { none: {} }, NOT: { ticketNumber: { startsWith: "TT-999" } } },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    for (const who of ["owner", "admin"] as const) {
      const res = await list(legacy.id, cookies[who]);
      expect(res.status, who).toBe(200);
      expect(res.body, who).toEqual({ actions: [] });
    }
  });

  it("API-02 lists in reading order: oldest Action Date/Time first, ties by id, the same on every read (BR-08, AC-10)", async () => {
    const id = await makeTicket();
    const t = Date.now();
    // Created in an order that is neither the date order nor the id order.
    const late = await storeAction(id, { actionAt: new Date(t - 1 * HOUR), description: "Dated latest, recorded first." });
    const tieA = await storeAction(id, { actionAt: new Date(t - 3 * HOUR), description: "Tie, lower id." });
    const early = await storeAction(id, { actionAt: new Date(t - 5 * HOUR), description: "Dated earliest, recorded third." });
    const tieB = await storeAction(id, { actionAt: new Date(t - 3 * HOUR), description: "Tie, higher id." });

    const expected = [early.id, tieA.id, tieB.id, late.id];
    for (let read = 0; read < 3; read++) {
      const res = await list(id, cookies.owner);
      expect(res.status).toBe(200);
      expect(res.body.actions.map((a: { id: number }) => a.id), `read ${read}`).toEqual(expected);
    }
  });

  it("returns exactly the documented shape, with the performer as an author and no request key (api-spec §1.3)", async () => {
    const id = await makeTicket();
    await storeAction(id, { performedById: ids.colleague, followUpRequired: true, followUpNote: "Check again on Thursday." });
    const [action] = (await list(id, cookies.owner)).body.actions;

    expect(Object.keys(action).sort()).toEqual(ACTION_KEYS);
    expect(Object.keys(action.performedBy).sort()).toEqual(["fullName", "id", "role"]);
    expect(action).toMatchObject({
      ticketId: id,
      performedBy: { id: ids.colleague, role: "IT_STAFF" },
      followUpRequired: true,
      followUpNote: "Check again on Thursday.",
      attachmentNotes: null,
      version: 1,
      updatedBy: null,
    });
    expect(JSON.stringify(action)).not.toMatch(/requestKey|password|hash|email/i);
  });

  it("API-15 (read) lets a Requester read every field on their own Ticket, and answers 404 for another's, identical to a missing one (BR-13, BR-44)", async () => {
    const mine = await makeTicket({ requesterId: ids.requester });
    await storeAction(mine, { performedById: ids.colleague, followUpRequired: true, followUpNote: "Check again on Thursday." });

    const own = await list(mine, cookies.requester);
    expect(own.status).toBe(200);
    expect(own.body.actions).toHaveLength(1);
    expect(Object.keys(own.body.actions[0]).sort()).toEqual(ACTION_KEYS);
    // Nothing about an Action Taken is internal: the note and the performer are visible.
    expect(own.body.actions[0]).toMatchObject({ followUpNote: "Check again on Thursday.", performedBy: { id: ids.colleague } });

    const someoneElses = await list(mine, cookies.otherRequester);
    const missing = await list(2147483647, cookies.otherRequester);
    expect(someoneElses.status).toBe(404);
    expect(missing.status).toBe(404);
    // Byte for byte: the text on the wire, not only the parsed body (BR-44).
    expect(someoneElses.text).toBe(missing.text);
    expect(someoneElses.text).not.toContain("toner");
  });

  it("is 401 without a session, 400 for a malformed or out-of-range id, and never cached", async () => {
    const id = await makeTicket();
    const anonymous = await list(id);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("AUTH_REQUIRED");

    for (const bad of ["abc", "0", "-1", "1.5", "2147483648", "1e0"]) {
      const res = await list(bad, cookies.owner);
      expect(res.status, bad).toBe(400);
      expect(res.body.error.code, bad).toBe("INVALID_QUERY");
    }
    expect((await list(id, cookies.owner)).headers["cache-control"]).toContain("no-store");
  });
});

// ---------------------------------------------------------------------------
// Creating — POST /api/staff/tickets/:id/actions-taken (api-spec §2.2)
// ---------------------------------------------------------------------------

const create = (ticketId: number | string, cookie: string | undefined, body: unknown) => {
  const req = request(app).post(`/api/staff/tickets/${ticketId}/actions-taken`);
  return (cookie ? req.set("Cookie", cookie) : req).send(body as object);
};

const validBody = (overrides: Record<string, unknown> = {}) => ({
  actionAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  description: "Replaced the toner cartridge and ran a test page.",
  result: "Test page printed cleanly.",
  followUpRequired: false,
  ...overrides,
});

const actionsOf = async (ticketId: number) => (await list(ticketId, cookies.admin)).body.actions as Array<Record<string, any>>;

// The Ticket's own `version` is not exposed by the API until Issue 6, so the
// create tests read it where it lives.
const ticketVersion = async (id: number) => (await prisma.ticket.findUniqueOrThrow({ where: { id }, select: { version: true } })).version;

describe("POST /api/staff/tickets/:id/actions-taken — a valid action", () => {
  it("API-03 creates under the path's Ticket, performed by the signed-in user, version 1, and moves the Ticket's Last Updated but not its version (BR-01, BR-05, BR-11)", async () => {
    const id = await makeTicket();
    const before = new Date(Date.now() - HOUR);
    await prisma.ticket.update({ where: { id }, data: { updatedAt: before } });
    const versionBefore = await ticketVersion(id);

    const res = await create(id, cookies.owner, validBody({ followUpRequired: true, followUpNote: "Check the printer again on Thursday.", attachmentNotes: "Look for the photo of the toner label." }));
    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["action"]);
    expect(Object.keys(res.body.action).sort()).toEqual(ACTION_KEYS);
    expect(res.body.action).toMatchObject({
      ticketId: id,
      performedBy: { id: ids.owner, role: "IT_STAFF" },
      description: "Replaced the toner cartridge and ran a test page.",
      result: "Test page printed cleanly.",
      followUpRequired: true,
      followUpNote: "Check the printer again on Thursday.",
      attachmentNotes: "Look for the photo of the toner label.",
      version: 1,
      updatedBy: null,
    });

    // What was answered is what a later read returns.
    expect(await actionsOf(id)).toEqual([res.body.action]);

    const detail = await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.owner);
    expect(new Date(detail.body.ticket.updatedAt).getTime()).toBeGreaterThan(before.getTime());
    expect(await ticketVersion(id)).toBe(versionBefore);
  });

  it("API-04 lets the Ticket Owner, a different IT Staff member, and an Administrator each record one, and changes no ownership (BR-02, AC-05)", async () => {
    const id = await makeTicket({ ownerId: ids.owner });
    for (const who of ["owner", "colleague", "admin"] as const) {
      const res = await create(id, cookies[who], validBody({ description: `Recorded by the ${who} on this ticket.` }));
      expect(res.status, who).toBe(201);
      expect(res.body.action.performedBy.id, who).toBe(ids[who]);
    }
    expect((await actionsOf(id)).map((a) => a.performedBy.id).sort()).toEqual([ids.owner, ids.colleague, ids.admin].sort());

    const detail = await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.admin);
    expect(detail.body.ticket.owner.id).toBe(ids.owner);
    expect(detail.body.ticket.currentStatus).toBe("IN_PROGRESS");
  });

  it("API-04 also lets an IT Staff member record on an unowned Ticket without claiming it (D-06)", async () => {
    const id = await makeTicket({ ownerId: null, status: "NEW" });
    const res = await create(id, cookies.colleague, validBody());
    expect(res.status).toBe(201);
    const detail = await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.colleague);
    expect(detail.body.ticket.owner).toBeNull();
    expect(detail.body.ticket.currentStatus).toBe("NEW");
  });

  it("API-06 ignores performedBy, ticketId, createdAt, version, id, and updatedBy in the body (BR-05)", async () => {
    const id = await makeTicket();
    const elsewhere = await makeTicket();
    const res = await create(
      id,
      cookies.colleague,
      validBody({
        id: 1,
        performedBy: { id: ids.owner },
        performedById: ids.owner,
        ticketId: elsewhere,
        createdAt: "2001-01-01T00:00:00.000Z",
        updatedAt: "2001-01-01T00:00:00.000Z",
        updatedBy: { id: ids.owner },
        version: 99,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.action).toMatchObject({ ticketId: id, performedBy: { id: ids.colleague }, version: 1, updatedBy: null });
    expect(res.body.action.id).not.toBe(1);
    expect(new Date(res.body.action.createdAt).getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(await actionsOf(elsewhere)).toEqual([]);
  });

  it("trims the text it stores and stores a blank Attachment Notes as null (BR-03)", async () => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, validBody({ description: "  Cleaned the fuser.  ", result: "\n Works now. \n", attachmentNotes: "   " }));
    expect(res.status).toBe(201);
    expect(res.body.action).toMatchObject({ description: "Cleaned the fuser.", result: "Works now.", attachmentNotes: null });
  });

  it("accepts an Action Date/Time with an offset and stores it as the same instant in UTC (BR-06)", async () => {
    const id = await makeTicket();
    const instant = new Date(Date.now() - 3 * HOUR);
    // The same instant, written as UTC+07:00.
    const local = new Date(instant.getTime() + 7 * HOUR).toISOString().replace("Z", "+07:00");
    const res = await create(id, cookies.owner, validBody({ actionAt: local }));
    expect(res.status).toBe(201);
    expect(res.body.action.actionAt).toBe(instant.toISOString());
  });
});

describe("POST /api/staff/tickets/:id/actions-taken — validation", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["a missing Action Description", { description: undefined }, "description"],
    ["a whitespace-only Action Description", { description: "     " }, "description"],
    ["a 4-character Action Description", { description: "abcd" }, "description"],
    ["a 2001-character Action Description", { description: "x".repeat(2001) }, "description"],
    ["a missing Result", { result: undefined }, "result"],
    ["a 1-character Result", { result: "x" }, "result"],
    ["a 1001-character Result", { result: "x".repeat(1001) }, "result"],
    ["a missing Follow-Up Required", { followUpRequired: undefined }, "followUpRequired"],
    ["a Follow-Up Required that is the string \"true\"", { followUpRequired: "true" }, "followUpRequired"],
    ["a Follow-Up Required that is 1", { followUpRequired: 1 }, "followUpRequired"],
    ["a 501-character Attachment Notes", { attachmentNotes: "x".repeat(501) }, "attachmentNotes"],
    ["an Attachment Notes that is a number", { attachmentNotes: 5 }, "attachmentNotes"],
    ["a Follow-up Note of 4 characters when follow-up is required", { followUpRequired: true, followUpNote: "abcd" }, "followUpNote"],
    ["a Follow-up Note of 1001 characters when follow-up is required", { followUpRequired: true, followUpNote: "x".repeat(1001) }, "followUpNote"],
  ];

  it.each(cases)("API-07 refuses %s with 400 on that field alone, and stores nothing", async (_name, overrides, field) => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, validBody(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual([field]);
    expect(typeof res.body.error.fields[field]).toBe("string");
    expect(await actionsOf(id)).toEqual([]);
  });

  it("API-07 reports one message for every offending field at once (AC-04)", async () => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, { description: "  ", result: "x", followUpRequired: true });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["actionAt", "description", "followUpNote", "result"]);
    expect(await actionsOf(id)).toEqual([]);
  });

  it("API-07 answers 400, not 500, for a body that is not an object", async () => {
    const id = await makeTicket();
    // Raw JSON, so that a number or a string reaches the server as itself.
    for (const body of [[], "text", 7, null]) {
      const res = await request(app)
        .post(`/api/staff/tickets/${id}/actions-taken`)
        .set("Cookie", cookies.owner)
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const noBody = await request(app).post(`/api/staff/tickets/${id}/actions-taken`).set("Cookie", cookies.owner);
    expect(noBody.status).toBe(400);
    expect(noBody.body.error.code).toBe("VALIDATION_FAILED");
    expect(await actionsOf(id)).toEqual([]);
  });

  it("API-08 refuses Yes without a note, and stores null for a note sent with No (BR-04, D-18)", async () => {
    const id = await makeTicket();
    const missing = await create(id, cookies.owner, validBody({ followUpRequired: true }));
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.error.fields)).toEqual(["followUpNote"]);
    const blank = await create(id, cookies.owner, validBody({ followUpRequired: true, followUpNote: "      " }));
    expect(blank.status).toBe(400);

    const no = await create(id, cookies.owner, validBody({ followUpRequired: false, followUpNote: "A note nobody asked for." }));
    expect(no.status).toBe(201);
    expect(no.body.action).toMatchObject({ followUpRequired: false, followUpNote: null });
    expect(await actionsOf(id)).toHaveLength(1);
  });

  it("API-09 refuses an Action Date/Time in the future, before the Ticket existed, missing, or not ISO with a zone (BR-06)", async () => {
    const createdAt = new Date(Date.now() - 24 * HOUR);
    const id = await makeTicket({ createdAt });
    const bad: Array<[string, unknown]> = [
      ["an hour in the future", new Date(Date.now() + HOUR).toISOString()],
      ["six minutes in the future", new Date(Date.now() + 6 * 60 * 1000).toISOString()],
      ["before the ticket was created", new Date(createdAt.getTime() - 1000).toISOString()],
      ["missing", undefined],
      ["null", null],
      ["words", "yesterday afternoon"],
      ["a bare date", "2026-10-05"],
      ["a local time with no zone", "2026-10-05T10:00:00"],
      ["a number", Date.now() - HOUR],
      ["an impossible date", "2026-02-31T10:00:00Z"],
    ];
    for (const [name, actionAt] of bad) {
      const res = await create(id, cookies.owner, validBody({ actionAt }));
      expect(res.status, name).toBe(400);
      expect(Object.keys(res.body.error.fields), name).toEqual(["actionAt"]);
    }
    expect(await actionsOf(id)).toEqual([]);

    // The inside of both bounds is accepted.
    const soon = await create(id, cookies.owner, validBody({ actionAt: new Date(Date.now() + 60 * 1000).toISOString() }));
    expect(soon.status).toBe(201);
    const atCreation = await create(id, cookies.owner, validBody({ actionAt: createdAt.toISOString() }));
    expect(atCreation.status).toBe(201);
  });
});

describe("POST /api/staff/tickets/:id/actions-taken — Ticket state", () => {
  it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)("API-14 refuses to record on a %s Ticket with 409 TICKET_NOT_ACTIVE, and writes nothing (BR-10, AC-09)", async (status) => {
    const id = await makeTicket({ status });
    const before = (await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.owner)).body.ticket.updatedAt;
    const res = await create(id, cookies.owner, validBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_NOT_ACTIVE");
    expect(await actionsOf(id)).toEqual([]);
    const after = (await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.owner)).body.ticket.updatedAt;
    expect(after).toBe(before);
  });

  it.each(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const)("API-14 records on a %s Ticket (BR-10)", async (status) => {
    const id = await makeTicket({ status });
    const res = await create(id, cookies.owner, validBody());
    expect(res.status).toBe(201);
    expect(await actionsOf(id)).toHaveLength(1);
  });

  it("validation comes before the Ticket's state: an invalid body on a resolved Ticket is 400, a valid one is 409 (api-spec §2.2)", async () => {
    const id = await makeTicket({ status: "RESOLVED" });
    expect((await create(id, cookies.owner, validBody({ description: "x" }))).status).toBe(400);
    expect((await create(id, cookies.owner, validBody())).status).toBe(409);
  });
});

describe("POST /api/staff/tickets/:id/actions-taken — who may call it", () => {
  it("API-15 refuses a Requester with 403 FORBIDDEN and no Ticket data, on their own Ticket, another's, and a missing one (BR-13, BR-44)", async () => {
    const mine = await makeTicket({ requesterId: ids.requester });
    const responses = [
      await create(mine, cookies.requester, validBody({ description: "A requester trying to write." })),
      await create(mine, cookies.otherRequester, validBody({ description: "A requester trying to write." })),
      await create(2147483647, cookies.requester, validBody({ description: "A requester trying to write." })),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(JSON.stringify(res.body)).not.toMatch(/toner|summary|ticketNumber/i);
    }
    expect(responses[0].body).toEqual(responses[2].body);
    expect(await actionsOf(mine)).toEqual([]);
  });

  it("is 401 AUTH_REQUIRED with no session, even for a missing Ticket (guard order)", async () => {
    const id = await makeTicket();
    for (const target of [id, 2147483647]) {
      const res = await create(target, undefined, validBody());
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
    }
    expect(await actionsOf(id)).toEqual([]);
  });

  it("answers 404 NOT_FOUND to IT Staff for a Ticket that does not exist, and 400 INVALID_QUERY for a malformed or out-of-range id", async () => {
    const missing = await create(2147483647, cookies.owner, validBody());
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    for (const bad of ["abc", "0", "-1", "1.5", "2147483648"]) {
      const res = await create(bad, cookies.owner, validBody());
      expect(res.status, bad).toBe(400);
      expect(res.body.error.code, bad).toBe("INVALID_QUERY");
    }
  });
});

describe("POST /api/staff/tickets/:id/actions-taken — NUL characters (BR-12, BR-52)", () => {
  it.each([
    ["description", { description: "Replaced the toner\u0000 cartridge." }],
    ["result", { result: "Test page\u0000 printed." }],
    ["followUpNote", { followUpRequired: true, followUpNote: "Check on\u0000 Thursday." }],
    ["followUpNote", { followUpRequired: false, followUpNote: "Ignored but\u0000 still refused." }],
    ["attachmentNotes", { attachmentNotes: "The photo\u0000 of the label." }],
  ])("API-17 answers 400 on %s, never 500, and stores nothing", async (field, overrides) => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, validBody(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual([field]);
    expect(await actionsOf(id)).toEqual([]);
  });

  it("API-17 answers 400 for a NUL in actionAt too", async () => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, validBody({ actionAt: "2026-10-05T10:00:00Z\u0000" }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(["actionAt"]);
  });
});

describe("POST /api/staff/tickets/:id/actions-taken — a resend with the same requestKey (BR-28, D-04)", () => {
  const key = () => `key-${Date.now().toString(36)}-${(sequence++).toString(36)}-abcdef`;

  it("API-13 answers a second send in sequence with 200 and the same action, and records one (AC-07)", async () => {
    const id = await makeTicket();
    const requestKey = key();
    const first = await create(id, cookies.owner, validBody({ requestKey }));
    const second = await create(id, cookies.owner, validBody({ requestKey }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await actionsOf(id)).toHaveLength(1);
  });

  it("API-13 records one when many sends of the same key arrive together: one 201, the rest 200, the same action (BR-29)", async () => {
    const id = await makeTicket();
    const requestKey = key();
    const sent = await Promise.all(Array.from({ length: 12 }, () => create(id, cookies.owner, validBody({ requestKey }))));
    expect(sent.map((r) => r.status).sort()).toEqual([...Array(11).fill(200), 201]);
    expect(new Set(sent.map((r) => r.body.action.id)).size).toBe(1);
    expect(await actionsOf(id)).toHaveLength(1);
  });

  it("API-13 gives another user's send of the same key a separate action, and the same user's key on another Ticket too", async () => {
    const id = await makeTicket();
    const other = await makeTicket();
    const requestKey = key();
    const mine = await create(id, cookies.owner, validBody({ requestKey }));
    const theirs = await create(id, cookies.colleague, validBody({ requestKey }));
    const elsewhere = await create(other, cookies.owner, validBody({ requestKey }));
    expect([mine.status, theirs.status, elsewhere.status]).toEqual([201, 201, 201]);
    expect(new Set([mine.body.action.id, theirs.body.action.id, elsewhere.body.action.id]).size).toBe(3);
    expect(theirs.body.action.performedBy.id).toBe(ids.colleague);
    expect(await actionsOf(id)).toHaveLength(2);
    expect(await actionsOf(other)).toHaveLength(1);
  });

  it("API-13 still answers 200 with the original action after the Ticket was resolved, closed, or cancelled — not TICKET_NOT_ACTIVE (BR-28, AC-07)", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const id = await makeTicket();
      const requestKey = key();
      const first = await create(id, cookies.owner, validBody({ requestKey }));
      expect(first.status, status).toBe(201);
      await prisma.ticket.update({ where: { id }, data: { currentStatus: status } });

      const retry = await create(id, cookies.owner, validBody({ requestKey }));
      expect(retry.status, status).toBe(200);
      expect(retry.body, status).toEqual(first.body);
      // A new submission on the same Ticket is still refused.
      expect((await create(id, cookies.owner, validBody({ requestKey: key() }))).status, status).toBe(409);
      expect(await actionsOf(id), status).toHaveLength(1);
    }
  });

  it("API-13 recognises the key before validating the body: the key names the submission, and a different or invalid body changes nothing (api-spec §2.2)", async () => {
    const id = await makeTicket();
    const requestKey = key();
    const first = await create(id, cookies.owner, validBody({ requestKey, description: "The first and only description." }));
    const different = await create(id, cookies.owner, validBody({ requestKey, description: "A different description entirely." }));
    expect(different.status).toBe(200);
    expect(different.body.action.description).toBe("The first and only description.");
    const invalid = await create(id, cookies.owner, { requestKey, description: "x" });
    expect(invalid.status).toBe(200);
    expect(invalid.body).toEqual(first.body);
    expect(await actionsOf(id)).toHaveLength(1);
  });

  it("API-13 does not use up a key on a submission that was refused, so the corrected resend is created", async () => {
    const id = await makeTicket();
    const requestKey = key();
    const refused = await create(id, cookies.owner, validBody({ requestKey, description: "x" }));
    expect(refused.status).toBe(400);
    const corrected = await create(id, cookies.owner, validBody({ requestKey }));
    expect(corrected.status).toBe(201);

    const resolved = await makeTicket({ status: "RESOLVED" });
    const keyAfter = key();
    expect((await create(resolved, cookies.owner, validBody({ requestKey: keyAfter }))).status).toBe(409);
    await prisma.ticket.update({ where: { id: resolved }, data: { currentStatus: "REOPENED" } });
    expect((await create(resolved, cookies.owner, validBody({ requestKey: keyAfter }))).status).toBe(201);
  });

  it("API-13 lets sends with no key each create an action: no key means no deduplication", async () => {
    const id = await makeTicket();
    const body = validBody();
    const sent = await Promise.all([create(id, cookies.owner, body), create(id, cookies.owner, body)]);
    expect(sent.map((r) => r.status)).toEqual([201, 201]);
    expect((await create(id, cookies.owner, { ...body, requestKey: null })).status).toBe(201);
    expect(await actionsOf(id)).toHaveLength(3);
  });

  it.each([
    ["7 characters", "abcdefg"],
    ["65 characters", "a".repeat(65)],
    ["a space", "abcd efgh"],
    ["a slash", "abcd/efgh"],
    ["an accented letter", "abcdéfgh"],
    ["a number", 12345678],
    ["an object", { key: "abcdefgh" }],
  ])("API-13 refuses a requestKey of %s with 400 on requestKey, and stores nothing (UNIT-06)", async (_name, requestKey) => {
    const id = await makeTicket();
    const res = await create(id, cookies.owner, validBody({ requestKey }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(["requestKey"]);
    expect(await actionsOf(id)).toEqual([]);
  });

  it("API-13 accepts a requestKey of exactly 8 and exactly 64 characters, and never returns it (BR-28)", async () => {
    const id = await makeTicket();
    const eight = await create(id, cookies.owner, validBody({ requestKey: "Ab1_-xYz" }));
    const sixtyFour = await create(id, cookies.owner, validBody({ requestKey: "k".repeat(64) }));
    expect([eight.status, sixtyFour.status]).toEqual([201, 201]);
    expect(JSON.stringify([eight.body, sixtyFour.body])).not.toMatch(/Ab1_-xYz|kkkkkkkk/);
  });

  it("API-13 answers a replay on a Ticket that does not exist with 404, not 200", async () => {
    const res = await create(2147483647, cookies.owner, validBody({ requestKey: key() }));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Editing — PATCH /api/staff/tickets/:id/actions-taken/:actionId (api-spec §2.3)
// ---------------------------------------------------------------------------

const edit = (ticketId: number | string, actionId: number | string, cookie: string | undefined, body: unknown) => {
  const req = request(app).patch(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`);
  return (cookie ? req.set("Cookie", cookie) : req).send(body as object);
};

/** An action recorded through the API, as its owner would, so its history is real. */
async function recordedAction(ticketId: number, overrides: Record<string, unknown> = {}, who: Who = "owner") {
  const res = await create(ticketId, cookies[who], validBody(overrides));
  expect(res.status).toBe(201);
  return res.body.action as Record<string, any>;
}

const ticketUpdatedAt = async (id: number) =>
  new Date((await request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies.admin)).body.ticket.updatedAt).getTime();

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — a valid edit", () => {
  it("API-05 lets a different IT Staff member edit: performedBy is unchanged, updatedBy is the editor, version + 1 (BR-07, BR-09, AC-05)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const res = await edit(id, original.id, cookies.colleague, { expectedVersion: 1, result: "Toner level confirmed at 100%." });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["action"]);
    expect(Object.keys(res.body.action).sort()).toEqual(ACTION_KEYS);
    expect(res.body.action).toMatchObject({
      id: original.id,
      ticketId: id,
      performedBy: { id: ids.owner },
      updatedBy: { id: ids.colleague, role: "IT_STAFF" },
      version: 2,
      result: "Toner level confirmed at 100%.",
      createdAt: original.createdAt,
    });
    expect(new Date(res.body.action.updatedAt).getTime()).toBeGreaterThan(new Date(original.updatedAt).getTime());
    expect(await actionsOf(id)).toEqual([res.body.action]);
  });

  it("API-05 lets an Administrator edit an action too, and a second edit moves updatedBy to the second editor", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const byAdmin = await edit(id, original.id, cookies.admin, { expectedVersion: 1, description: "Replaced the toner cartridge (admin note)." });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.action).toMatchObject({ version: 2, updatedBy: { id: ids.admin }, performedBy: { id: ids.owner } });
    const byOwner = await edit(id, original.id, cookies.owner, { expectedVersion: 2, description: "Replaced the toner cartridge again." });
    expect(byOwner.body.action).toMatchObject({ version: 3, updatedBy: { id: ids.owner }, performedBy: { id: ids.owner } });
  });

  it("API-10 adds 1 to the action's version, moves the Ticket's Last Updated, and leaves the Ticket's own version alone (BR-11, BR-27)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const past = new Date(Date.now() - HOUR);
    await prisma.ticket.update({ where: { id }, data: { updatedAt: past } });
    const versionBefore = await ticketVersion(id);

    const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, result: "A changed result." });
    expect(res.status).toBe(200);
    expect(res.body.action.version).toBe(2);
    expect(await ticketUpdatedAt(id)).toBeGreaterThan(past.getTime());
    expect(await ticketVersion(id)).toBe(versionBefore);
  });

  it("leaves a field that is not sent alone, and trims the ones that are (api-spec §2.3)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id, { attachmentNotes: "The label photo.", followUpRequired: true, followUpNote: "Check on Thursday." });
    const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, description: "  Replaced the toner and cleaned the rollers.  " });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({
      description: "Replaced the toner and cleaned the rollers.",
      result: original.result,
      actionAt: original.actionAt,
      attachmentNotes: "The label photo.",
      followUpRequired: true,
      followUpNote: "Check on Thursday.",
    });
  });

  it("ignores performedBy, ticketId, createdAt, id, updatedBy, requestKey, and a body version in an edit (BR-05, BR-09)", async () => {
    const id = await makeTicket();
    const elsewhere = await makeTicket();
    const original = await recordedAction(id);
    const res = await edit(id, original.id, cookies.colleague, {
      expectedVersion: 1,
      result: "Changed through the edit.",
      id: 1,
      ticketId: elsewhere,
      performedBy: { id: ids.admin },
      performedById: ids.admin,
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedBy: { id: ids.admin },
      requestKey: "abcdefgh-ijkl",
      version: 50,
    });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({
      id: original.id,
      ticketId: id,
      performedBy: { id: ids.owner },
      createdAt: original.createdAt,
      updatedBy: { id: ids.colleague },
      version: 2,
    });
    expect(await actionsOf(elsewhere)).toEqual([]);
  });

  it("changes the reading order when the Action Date/Time is edited (BR-08)", async () => {
    const id = await makeTicket();
    const first = await recordedAction(id, { actionAt: new Date(Date.now() - 5 * HOUR).toISOString(), description: "Dated first." });
    const second = await recordedAction(id, { actionAt: new Date(Date.now() - 3 * HOUR).toISOString(), description: "Dated second." });
    expect((await actionsOf(id)).map((a) => a.id)).toEqual([first.id, second.id]);
    const moved = await edit(id, first.id, cookies.owner, { expectedVersion: 1, actionAt: new Date(Date.now() - HOUR).toISOString() });
    expect(moved.status).toBe(200);
    expect((await actionsOf(id)).map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it("a replay of the original create returns the action as it is stored now, edits included (BR-28)", async () => {
    const id = await makeTicket();
    const requestKey = `edited-${Date.now().toString(36)}-${sequence++}`;
    const created = await create(id, cookies.owner, validBody({ requestKey }));
    await edit(id, created.body.action.id, cookies.colleague, { expectedVersion: 1, result: "Edited after the create." });
    const replay = await create(id, cookies.owner, validBody({ requestKey }));
    expect(replay.status).toBe(200);
    expect(replay.body.action).toMatchObject({ result: "Edited after the create.", version: 2, updatedBy: { id: ids.colleague } });
  });
});

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — a body that changes nothing", () => {
  it("answers 200 with version, updatedBy, and both Last Updated times unchanged (api-spec §2.3)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id, { attachmentNotes: "The label photo." });
    const past = new Date(Date.now() - HOUR);
    await prisma.ticket.update({ where: { id }, data: { updatedAt: past } });

    const bodies = [
      { expectedVersion: 1 },
      { expectedVersion: 1, result: original.result, description: `  ${original.description}  ` },
      { expectedVersion: 1, followUpRequired: false, followUpNote: "A note a No action never keeps." },
      { expectedVersion: 1, attachmentNotes: "The label photo." },
    ];
    for (const body of bodies) {
      const res = await edit(id, original.id, cookies.colleague, body);
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(res.body.action, JSON.stringify(body)).toEqual(original);
    }
    expect(await ticketUpdatedAt(id)).toBe(past.getTime());
  });

  it("is still refused as stale when the version is old, and as not active when the Ticket is closed", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    await edit(id, original.id, cookies.owner, { expectedVersion: 1, result: "A real change." });
    expect((await edit(id, original.id, cookies.owner, { expectedVersion: 1 })).status).toBe(409);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: "CLOSED" } });
    const closed = await edit(id, original.id, cookies.owner, { expectedVersion: 2 });
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe("TICKET_NOT_ACTIVE");
  });
});

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — the follow-up rules, merged (BR-04, D-18)", () => {
  it("API-08 clears the stored note when an edit says No", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id, { followUpRequired: true, followUpNote: "Check on Thursday." });
    const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, followUpRequired: false });
    expect(res.status).toBe(200);
    expect(res.body.action).toMatchObject({ followUpRequired: false, followUpNote: null, version: 2 });
    expect((await actionsOf(id))[0]).toMatchObject({ followUpRequired: false, followUpNote: null });
  });

  it("API-08 refuses Yes onto a record with no note unless the same request carries one, and stores nothing when refused", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id, { followUpRequired: false });
    const refused = await edit(id, original.id, cookies.owner, { expectedVersion: 1, followUpRequired: true });
    expect(refused.status).toBe(400);
    expect(Object.keys(refused.body.error.fields)).toEqual(["followUpNote"]);
    expect(await actionsOf(id)).toEqual([original]);

    const accepted = await edit(id, original.id, cookies.owner, { expectedVersion: 1, followUpRequired: true, followUpNote: "Check on Thursday." });
    expect(accepted.status).toBe(200);
    expect(accepted.body.action).toMatchObject({ followUpRequired: true, followUpNote: "Check on Thursday.", version: 2 });
  });

  it("API-08 refuses a blank or too-short note on a Yes record, and keeps the stored note when only the note is changed to a valid one", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id, { followUpRequired: true, followUpNote: "Check on Thursday." });
    for (const followUpNote of ["", "   ", "abcd", "x".repeat(1001), null]) {
      const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, followUpNote });
      expect(res.status, String(followUpNote).slice(0, 8)).toBe(400);
      expect(Object.keys(res.body.error.fields)).toEqual(["followUpNote"]);
    }
    const changed = await edit(id, original.id, cookies.owner, { expectedVersion: 1, followUpNote: "Check on Friday instead." });
    expect(changed.body.action).toMatchObject({ followUpRequired: true, followUpNote: "Check on Friday instead." });
  });
});

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — validation", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["a blank Action Description", { description: "     " }, "description"],
    ["a 4-character Action Description", { description: "abcd" }, "description"],
    ["a 2001-character Action Description", { description: "x".repeat(2001) }, "description"],
    ["a null Action Description", { description: null }, "description"],
    ["a 1-character Result", { result: "x" }, "result"],
    ["a 1001-character Result", { result: "x".repeat(1001) }, "result"],
    ["a Follow-Up Required that is \"false\"", { followUpRequired: "false" }, "followUpRequired"],
    ["a 501-character Attachment Notes", { attachmentNotes: "x".repeat(501) }, "attachmentNotes"],
    ["an Action Date/Time an hour in the future", { actionAt: new Date(Date.now() + HOUR).toISOString() }, "actionAt"],
    ["an Action Date/Time before the Ticket existed", { actionAt: new Date(Date.now() - 48 * HOUR).toISOString() }, "actionAt"],
    ["an Action Date/Time that is not ISO", { actionAt: "last tuesday" }, "actionAt"],
    ["an Action Date/Time with no zone", { actionAt: "2026-10-05T10:00:00" }, "actionAt"],
  ];

  it.each(cases)("API-07 / API-09 refuses %s with 400 on that field alone, and changes nothing", async (_name, overrides, field) => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual([field]);
    expect(await actionsOf(id)).toEqual([original]);
  });

  it("API-07 reports every offending field at once, expectedVersion among them", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const res = await edit(id, original.id, cookies.owner, { description: "x", result: "y" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["description", "expectedVersion", "result"]);
  });

  it("API-17 answers 400, never 500, for a NUL character in each text field of an edit", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const nuls: Array<[string, Record<string, unknown>]> = [
      ["description", { description: "Replaced the\u0000 toner." }],
      ["result", { result: "Printed\u0000 cleanly." }],
      ["followUpNote", { followUpRequired: true, followUpNote: "Check\u0000 Thursday." }],
      ["followUpNote", { followUpNote: "Ignored on a No record\u0000 but refused." }],
      ["attachmentNotes", { attachmentNotes: "The\u0000 photo." }],
    ];
    for (const [field, overrides] of nuls) {
      const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, ...overrides });
      expect(res.status, field).toBe(400);
      expect(Object.keys(res.body.error.fields), field).toEqual([field]);
    }
    expect(await actionsOf(id)).toEqual([original]);
  });
});

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — the version (BR-26, BR-27, BR-29)", () => {
  it("API-11 refuses a missing, non-integer, or non-positive expectedVersion with 400 on expectedVersion alone", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    for (const expectedVersion of [undefined, null, "1", 1.5, 0, -1, true, [1], {}]) {
      const res = await edit(id, original.id, cookies.owner, { expectedVersion, result: "A changed result." });
      expect(res.status, JSON.stringify(expectedVersion) ?? "undefined").toBe(400);
      expect(Object.keys(res.body.error.fields)).toEqual(["expectedVersion"]);
    }
    expect(await actionsOf(id)).toEqual([original]);
  });

  it("API-11 answers a stale version with 409 STALE_UPDATE whose error.current is the latest action, and the stored row unchanged (AC-06)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const winner = await edit(id, original.id, cookies.colleague, { expectedVersion: 1, result: "The first editor's result." });
    expect(winner.status).toBe(200);

    const stale = await edit(id, original.id, cookies.owner, { expectedVersion: 1, result: "The second editor's result." });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
    expect(typeof stale.body.error.message).toBe("string");
    expect(stale.body.error.current).toEqual(winner.body.action);
    expect(Object.keys(stale.body.error.current).sort()).toEqual(ACTION_KEYS);
    expect(await actionsOf(id)).toEqual([winner.body.action]);

    // A version from the future is stale too: it matches nothing.
    const ahead = await edit(id, original.id, cookies.owner, { expectedVersion: 3, result: "Ahead." });
    expect(ahead.status).toBe(409);
    expect(ahead.body.error.code).toBe("STALE_UPDATE");
  });

  it("API-12 lets exactly one of simultaneous edits with the same expectedVersion win, and stores the winner's values (BR-29, AC-06)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const editors = ["owner", "colleague", "admin", "owner", "colleague"] as const;
    const sent = await Promise.all(editors.map((who, n) => edit(id, original.id, cookies[who], { expectedVersion: 1, result: `Result from editor ${n}.` })));

    const statuses = sent.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
    const winnerIndex = sent.findIndex((r) => r.status === 200);
    for (const loser of sent.filter((r) => r.status === 409)) {
      expect(loser.body.error.code).toBe("STALE_UPDATE");
      expect(loser.body.error.current.version).toBe(2);
    }
    const [stored] = await actionsOf(id);
    expect(stored.result).toBe(`Result from editor ${winnerIndex}.`);
    expect(stored.version).toBe(2);
    expect(stored.updatedBy.id).toBe(ids[editors[winnerIndex]]);
  });
});

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId — Ticket state", () => {
  it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)("API-14 refuses to edit on a %s Ticket with 409 TICKET_NOT_ACTIVE, before the version is compared, and writes nothing (BR-10, AC-09)", async (status) => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: status } });
    const before = await ticketUpdatedAt(id);

    // A wrong version still gets TICKET_NOT_ACTIVE: the Ticket's state is checked first.
    for (const expectedVersion of [1, 9]) {
      const res = await edit(id, original.id, cookies.owner, { expectedVersion, result: "Too late to change." });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TICKET_NOT_ACTIVE");
    }
    expect(await actionsOf(id)).toEqual([original]);
    expect(await ticketUpdatedAt(id)).toBe(before);
  });

  it.each(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const)("API-14 edits on a %s Ticket (BR-10)", async (status) => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: status } });
    const res = await edit(id, original.id, cookies.owner, { expectedVersion: 1, result: "Changed while active." });
    expect(res.status).toBe(200);
  });

  it("validation comes before the Ticket's state: an invalid edit on a resolved Ticket is 400, a valid one 409", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: "RESOLVED" } });
    expect((await edit(id, original.id, cookies.owner, { expectedVersion: 1, description: "x" })).status).toBe(400);
    expect((await edit(id, original.id, cookies.owner, { expectedVersion: 1, description: "A valid description." })).status).toBe(409);
  });
});

describe("PATCH and DELETE /api/staff/tickets/:id/actions-taken/:actionId — who and which", () => {
  it("API-15 refuses a Requester's edit with 403 FORBIDDEN and no data, on their own Ticket and another's", async () => {
    const mine = await makeTicket({ requesterId: ids.requester });
    const original = await recordedAction(mine);
    const body = { expectedVersion: 1, result: "A requester trying to edit." };
    const own = await edit(mine, original.id, cookies.requester, body);
    const other = await edit(mine, original.id, cookies.otherRequester, body);
    const missing = await edit(2147483647, 2147483647, cookies.requester, body);
    for (const res of [own, other, missing]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(JSON.stringify(res.body)).not.toMatch(/toner|test page/i);
    }
    expect(own.body).toEqual(missing.body);
    expect(await actionsOf(mine)).toEqual([original]);
  });

  it("is 401 AUTH_REQUIRED with no session", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const res = await edit(id, original.id, undefined, { expectedVersion: 1, result: "No session." });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("API-16 answers 404 for an action of a different Ticket, and changes neither Ticket (BR-01)", async () => {
    const mine = await makeTicket();
    const theirs = await makeTicket();
    const original = await recordedAction(theirs);
    const res = await edit(mine, original.id, cookies.owner, { expectedVersion: 1, result: "Across tickets." });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(await actionsOf(theirs)).toEqual([original]);
    expect(await actionsOf(mine)).toEqual([]);
  });

  it("API-16 answers 404 for an action or a Ticket that does not exist, and 400 INVALID_QUERY for a malformed or out-of-range id", async () => {
    const id = await makeTicket();
    expect((await edit(id, 2147483647, cookies.owner, { expectedVersion: 1 })).status).toBe(404);
    expect((await edit(2147483647, 1, cookies.owner, { expectedVersion: 1 })).status).toBe(404);
    for (const bad of ["abc", "0", "-1", "1.5", "2147483648"]) {
      const badAction = await edit(id, bad, cookies.owner, { expectedVersion: 1 });
      expect(badAction.status, `action ${bad}`).toBe(400);
      expect(badAction.body.error.code).toBe("INVALID_QUERY");
      const badTicket = await edit(bad, 1, cookies.owner, { expectedVersion: 1 });
      expect(badTicket.status, `ticket ${bad}`).toBe(400);
      expect(badTicket.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("API-16 has no DELETE: it is the unknown-route 404, and the action stays (BR-09, D-13)", async () => {
    const id = await makeTicket();
    const original = await recordedAction(id);
    const unknown = await request(app).get("/api/no-such-route").set("Cookie", cookies.owner);
    for (const who of ["owner", "admin", "requester"] as const) {
      const res = await request(app).delete(`/api/staff/tickets/${id}/actions-taken/${original.id}`).set("Cookie", cookies[who]);
      // A Requester is turned away by the staff role guard before routing, as for any /api/staff route.
      expect(res.status, who).toBe(who === "requester" ? 403 : 404);
      if (who !== "requester") expect(res.body, who).toEqual(unknown.body);
    }
    const viaTickets = await request(app).delete(`/api/tickets/${id}/actions-taken/${original.id}`).set("Cookie", cookies.owner);
    expect(viaTickets.status).toBe(404);
    expect(viaTickets.body).toEqual(unknown.body);
    expect(await actionsOf(id)).toEqual([original]);
  });
});
