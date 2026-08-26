import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// API-16 to API-18 — GET /api/tickets/:id, and the ownership rule that a
// ticket belonging to someone else is indistinguishable from one that does not
// exist (BR-16).

const prisma = getPrisma();

let requesterA: number;
let requesterB: number;
let ticketOfA: number;
let ticketOfB: number;
const createdIds: number[] = [];

function detail(requesterId: number | null, id: number | string) {
  const req = request(app).get(`/api/tickets/${id}`);
  if (requesterId !== null) req.set("X-Requester-Id", String(requesterId));
  return req;
}

beforeAll(async () => {
  const [a, b] = await prisma.requesterUser.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });

  requesterA = a.id;
  requesterB = b.id;

  const stamp = Date.now() % 90000;

  const ticketA = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9996-${String(stamp).padStart(5, "0")}`,
      requesterId: requesterA,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Detail suite ticket for requester A",
      description: "Created by the ticket-detail API suite.",
      requestedPriority: "MEDIUM",
    },
  });

  const ticketB = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9995-${String(stamp).padStart(5, "0")}`,
      requesterId: requesterB,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Detail suite ticket for requester B",
      description: "Requester A must never be able to read this row.",
      requestedPriority: "URGENT",
    },
  });

  ticketOfA = ticketA.id;
  ticketOfB = ticketB.id;
  createdIds.push(ticketA.id, ticketB.id);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe("reading an owned ticket", () => {
  it("returns 200 with the full ticket", async () => {
    const res = await detail(requesterA, ticketOfA);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketOfA);
    expect(res.body.summary).toBe("Detail suite ticket for requester A");
    expect(res.body.description).toBeTruthy();
  });

  it("includes the ticket date, requester, category, related system, and attachments", async () => {
    const res = await detail(requesterA, ticketOfA);

    expect(res.body.ticketDate).toBeTruthy();
    expect(res.body.requester.id).toBe(requesterA);
    expect(res.body.category.name).toBeTruthy();
    expect(res.body.relatedSystem.name).toBeTruthy();
    expect(Array.isArray(res.body.attachments)).toBe(true);
  });

  it("reports the status the ticket was created with", async () => {
    const res = await detail(requesterA, ticketOfA);
    expect(res.body.currentStatus).toBe("NEW");
  });
});

describe("ownership", () => {
  it("returns 404 for a ticket belonging to another requester", async () => {
    const res = await detail(requesterA, ticketOfB);

    expect(res.status).toBe(404);
    expect(res.body.summary).toBeUndefined();
    expect(res.body.description).toBeUndefined();
  });

  it("returns 404 for a ticket that does not exist", async () => {
    const res = await detail(requesterA, 999999);
    expect(res.status).toBe(404);
  });

  it("gives byte-identical bodies for not-owned and not-found", async () => {
    // Anything else would disclose that another requester's ticket exists.
    const notOwned = await detail(requesterA, ticketOfB);
    const missing = await detail(requesterA, 999999);

    expect(notOwned.body).toEqual(missing.body);
  });

  it("lets the real owner read the same ticket", async () => {
    const res = await detail(requesterB, ticketOfB);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketOfB);
  });

  it("refuses a request with no requester context", async () => {
    const res = await detail(null, ticketOfA);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });

  it("rejects a malformed ticket id", async () => {
    const res = await detail(requesterA, "abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });

  it("leaks no internal detail in a 404 body", async () => {
    const res = await detail(requesterA, ticketOfB);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|select |\.ts:|stack/i);
  });
});
