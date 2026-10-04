import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAll } from "../helpers/signIn.js";
import { createSession, hashSessionToken } from "../../src/session.js";
import { TICKET_NUMBER_PATTERN, parseYear } from "../../src/ticketNumber.js";

// API-05 to API-09 — POST /api/tickets and the reference-data endpoints.
//
// Requires a migrated and seeded database:
//   docker compose up -d db server
//   docker exec toktickit-server npx prisma migrate deploy
//   docker exec toktickit-server npm run prisma:seed

const prisma = getPrisma();

// Lab 3, Issue 6 — each Requester signs in; the session is the identity.
let cookies = new Map<number, string>();
function cookieOf(requesterId: number | string): string {
  const cookie = cookies.get(Number(requesterId));
  if (!cookie) throw new Error(`no session for requester ${requesterId}`);
  return cookie;
}

let activeRequesterId: number;
let inactiveRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

// Every ticket this suite creates is recorded so it can be removed afterwards,
// leaving the database as it was found.
const createdTicketIds: number[] = [];

const VALID_BODY = {
  summary: "Laptop battery drains within 30 minutes",
  description:
    "Since Monday the corporate laptop battery falls from 100% to 5% in about half an hour, even with only a browser open.",
  requestedPriority: "MEDIUM",
};

async function createTicket(body: Record<string, unknown>, requesterId: number | string | null) {
  const req = request(app).post("/api/tickets").send(body);
  if (requesterId !== null) req.set("Cookie", cookieOf(requesterId));
  const res = await req;
  if (res.status === 201) createdTicketIds.push(res.body.id);
  return res;
}

beforeAll(async () => {
  const active = await prisma.user.findFirstOrThrow({
    where: { isActive: true, role: "REQUESTER", mustChangePassword: false },
    orderBy: { id: "asc" },
  });
  const inactive = await prisma.user.findFirstOrThrow({ where: { isActive: false, role: "REQUESTER" }, orderBy: { id: "asc" } });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });

  activeRequesterId = active.id;
  inactiveRequesterId = inactive.id;
  categoryId = category.id;
  relatedSystemId = system.id;

  cookies = await signInAll(activeRequesterId);
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  await endTestSessions();
  await prisma.$disconnect();
});

describe("GET /api/related-systems", () => {
  it("returns the active related systems sorted by name", async () => {
    const res = await request(app).get("/api/related-systems").set("Cookie", cookieOf(activeRequesterId));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(6);

    const names = res.body.map((row: { name: string }) => row.name);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));

    for (const row of res.body) {
      expect(Object.keys(row).sort()).toEqual(["id", "name"]);
    }
  });

  it("matches what the database marks active", async () => {
    const active = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const res = await request(app).get("/api/related-systems").set("Cookie", cookieOf(activeRequesterId));

    expect(res.body.map((r: { id: number }) => r.id).sort()).toEqual(
      active.map((r) => r.id).sort(),
    );
  });
});

describe("POST /api/tickets — success", () => {
  it("creates one ticket and returns 201 with the official number", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId },
      activeRequesterId,
    );

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(TICKET_NUMBER_PATTERN);
    expect(parseYear(res.body.ticketNumber)).toBe(new Date().getFullYear());
  });

  it("saves the ticket bound to the requester from the header", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId },
      activeRequesterId,
    );

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.requesterId).toBe(activeRequesterId);
    expect(res.body.requester.id).toBe(activeRequesterId);
  });

  it("starts the ticket at status NEW", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId },
      activeRequesterId,
    );

    expect(res.body.currentStatus).toBe("NEW");
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.currentStatus).toBe("NEW");
  });

  it("persists exactly what was sent, trimmed", async () => {
    const res = await createTicket(
      { ...VALID_BODY, summary: "  Printer jams on duplex  ", categoryId, relatedSystemId },
      activeRequesterId,
    );

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.summary).toBe("Printer jams on duplex");
    expect(saved.description).toBe(VALID_BODY.description);
    expect(saved.requestedPriority).toBe("MEDIUM");
  });

  it("returns a server-owned ticket date rather than a client one", async () => {
    const before = Date.now();
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId, ticketDate: "1999-01-01T00:00:00.000Z" },
      activeRequesterId,
    );
    const after = Date.now();

    const ticketDate = new Date(res.body.ticketDate).getTime();
    expect(ticketDate).toBeGreaterThanOrEqual(before - 1000);
    expect(ticketDate).toBeLessThanOrEqual(after + 1000);
  });

  it("gives consecutive tickets different unique numbers", async () => {
    const first = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId },
      activeRequesterId,
    );
    const second = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId },
      activeRequesterId,
    );

    expect(first.body.ticketNumber).not.toBe(second.body.ticketNumber);
    expect(second.body.ticketNumber).toMatch(TICKET_NUMBER_PATTERN);

    const count = await prisma.ticket.count({
      where: { ticketNumber: { in: [first.body.ticketNumber, second.body.ticketNumber] } },
    });
    expect(count).toBe(2);
  });
});

describe("POST /api/tickets — client-supplied system fields are ignored", () => {
  it("never accepts a ticket number from the body", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId, ticketNumber: "TT-1999-00001" },
      activeRequesterId,
    );

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).not.toBe("TT-1999-00001");
  });

  it("never accepts a requester id from the body", async () => {
    const other = await prisma.user.findFirstOrThrow({
      where: { isActive: true, role: "REQUESTER", id: { not: activeRequesterId } },
      orderBy: { id: "asc" },
    });

    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId, requesterId: other.id },
      activeRequesterId,
    );

    // The header wins; the body is not consulted for identity (BR-06, BR-14).
    expect(res.body.requester.id).toBe(activeRequesterId);
  });

  it("never accepts a status from the body", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId, currentStatus: "CLOSED" },
      activeRequesterId,
    );

    expect(res.body.currentStatus).toBe("NEW");
  });
});

describe("POST /api/tickets — validation", () => {
  it("rejects a missing summary with a field-level message and saves nothing", async () => {
    const before = await prisma.ticket.count();
    const res = await createTicket(
      { ...VALID_BODY, summary: "", categoryId, relatedSystemId },
      activeRequesterId,
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.summary).toMatch(/required/i);
    expect(await prisma.ticket.count()).toBe(before);
  });

  it("reports every invalid field at once", async () => {
    const res = await createTicket({}, activeRequesterId);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      "categoryId",
      "description",
      "relatedSystemId",
      "requestedPriority",
      "summary",
    ]);
  });

  it("rejects a category that does not exist", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId: 999999, relatedSystemId },
      activeRequesterId,
    );

    expect(res.status).toBe(400);
    expect(res.body.error.fields.categoryId).toBeDefined();
  });

  it("rejects a related system that does not exist", async () => {
    const res = await createTicket(
      { ...VALID_BODY, categoryId, relatedSystemId: 999999 },
      activeRequesterId,
    );

    expect(res.status).toBe(400);
    expect(res.body.error.fields.relatedSystemId).toBeDefined();
  });

  it("leaks no internal detail in an error body", async () => {
    const res = await createTicket({}, activeRequesterId);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|select |\.ts:|stack/i);
  });
});

// Lab 3, Issue 6 — the Lab 2 requester-context errors are retired; who may
// create a ticket is now decided by the session alone (api-spec §1.4).
describe("POST /api/tickets — requester context", () => {
  it("refuses a request with no session", async () => {
    const res = await createTicket({ ...VALID_BODY, categoryId, relatedSystemId }, null);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("refuses the retired X-Requester-Id header on its own and creates nothing", async () => {
    const before = await prisma.ticket.count();
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send({ ...VALID_BODY, categoryId, relatedSystemId });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
    expect(await prisma.ticket.count()).toBe(before);
  });

  it("refuses a session whose account is inactive and creates nothing", async () => {
    // A session row left over from before the account was deactivated.
    const token = await createSession(prisma, inactiveRequesterId);
    try {
      const before = await prisma.ticket.count();
      const res = await request(app)
        .post("/api/tickets")
        .set("Cookie", `tt_sid=${token}`)
        .send({ ...VALID_BODY, categoryId, relatedSystemId });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
      expect(await prisma.ticket.count()).toBe(before);
    } finally {
      await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    }
  });
});
