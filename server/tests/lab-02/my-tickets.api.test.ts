import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// API-10 to API-15 — GET /api/tickets.
//
// The suite seeds its own tickets for two different requesters, then removes
// them in afterAll so the database is left as it was found.

const prisma = getPrisma();

let requesterA: number;
let requesterB: number;
let categoryX: number;
let categoryY: number;
let systemId: number;
const createdIds: number[] = [];

// 12 tickets for A across two categories and two priorities, 1 for B.
const A_COUNT = 12;

function list(requesterId: number | null, query = "") {
  const req = request(app).get(`/api/tickets${query}`);
  if (requesterId !== null) req.set("X-Requester-Id", String(requesterId));
  return req;
}

beforeAll(async () => {
  const [a, b] = await prisma.requesterUser.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  const categories = await prisma.category.findMany({ where: { isActive: true }, take: 2 });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });

  requesterA = a.id;
  requesterB = b.id;
  categoryX = categories[0].id;
  categoryY = categories[1].id;
  systemId = system.id;

  const stamp = Date.now();

  for (let i = 0; i < A_COUNT; i++) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TT-9998-${String(stamp % 90000 + i).padStart(5, "0")}`,
        requesterId: requesterA,
        categoryId: i % 2 === 0 ? categoryX : categoryY,
        relatedSystemId: systemId,
        summary: i === 0 ? "Laptop battery drains quickly" : `Seeded list ticket ${i}`,
        description: "Created by the my-tickets API test suite for list behaviour.",
        requestedPriority: i % 2 === 0 ? "MEDIUM" : "HIGH",
      },
    });
    createdIds.push(ticket.id);
  }

  const bTicket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9997-${String(stamp % 90000).padStart(5, "0")}`,
      requesterId: requesterB,
      categoryId: categoryX,
      relatedSystemId: systemId,
      summary: "Requester B private ticket",
      description: "This row must never appear in requester A's list.",
      requestedPriority: "URGENT",
    },
  });
  createdIds.push(bTicket.id);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe("ownership scoping", () => {
  it("returns only the tickets of the requester in the header", async () => {
    const res = await list(requesterA, "?pageSize=50");

    expect(res.status).toBe(200);
    const ids = res.body.data.map((t: { id: number }) => t.id);
    const owned = await prisma.ticket.findMany({
      where: { requesterId: requesterA },
      select: { id: true },
    });

    expect(ids.sort()).toEqual(owned.map((t) => t.id).sort());
  });

  it("never leaks another requester's ticket", async () => {
    const res = await list(requesterA, "?pageSize=50");
    const summaries = res.body.data.map((t: { summary: string }) => t.summary);

    expect(summaries).not.toContain("Requester B private ticket");
  });

  it("gives requester B only their own row", async () => {
    const res = await list(requesterB, "?pageSize=50");
    const bOwned = await prisma.ticket.count({ where: { requesterId: requesterB } });

    expect(res.body.data).toHaveLength(bOwned);
    for (const ticket of res.body.data) {
      const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(row.requesterId).toBe(requesterB);
    }
  });

  it("refuses a request with no requester context", async () => {
    const res = await list(null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });
});

describe("pagination", () => {
  it("returns the default page size with correct metadata", async () => {
    const res = await list(requesterA);
    const total = await prisma.ticket.count({ where: { requesterId: requesterA } });

    expect(res.body.data).toHaveLength(Math.min(10, total));
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
      totalItems: total,
      totalPages: Math.ceil(total / 10),
      hasPrev: false,
    });
  });

  it("walks pages without repeating or skipping a ticket", async () => {
    const first = await list(requesterA, "?page=1&pageSize=10");
    const second = await list(requesterA, "?page=2&pageSize=10");

    const firstIds = first.body.data.map((t: { id: number }) => t.id);
    const secondIds = second.body.data.map((t: { id: number }) => t.id);

    expect(firstIds.filter((id: number) => secondIds.includes(id))).toEqual([]);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(firstIds.length + secondIds.length);
  });

  it("returns an empty page past the end rather than 404", async () => {
    const res = await list(requesterA, "?page=99&pageSize=10");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.hasNext).toBe(false);
    expect(res.body.meta.totalItems).toBeGreaterThan(0);
  });

  it("honours a permitted page size", async () => {
    const res = await list(requesterA, "?pageSize=20");
    expect(res.body.meta.pageSize).toBe(20);
  });
});

describe("sorting", () => {
  it("defaults to newest first", async () => {
    const res = await list(requesterA, "?pageSize=50");
    const dates = res.body.data.map((t: { ticketDate: string }) => new Date(t.ticketDate).getTime());

    expect(dates).toEqual([...dates].sort((a: number, b: number) => b - a));
  });

  it("sorts oldest first when asked", async () => {
    const res = await list(requesterA, "?sortDir=asc&pageSize=50");
    const dates = res.body.data.map((t: { ticketDate: string }) => new Date(t.ticketDate).getTime());

    expect(dates).toEqual([...dates].sort((a: number, b: number) => a - b));
  });

  it("is stable when timestamps tie", async () => {
    // Rows created in the same millisecond fall back to id desc (BR-21), so
    // two identical requests return an identical order.
    const first = await list(requesterA, "?pageSize=50");
    const second = await list(requesterA, "?pageSize=50");

    expect(first.body.data.map((t: { id: number }) => t.id)).toEqual(
      second.body.data.map((t: { id: number }) => t.id),
    );
  });
});

describe("search", () => {
  it("matches the summary case-insensitively", async () => {
    const res = await list(requesterA, "?search=LAPTOP%20battery&pageSize=50");

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const ticket of res.body.data) {
      expect(ticket.summary.toLowerCase()).toContain("laptop battery");
    }
  });

  it("matches the ticket number", async () => {
    const anyTicket = await prisma.ticket.findFirstOrThrow({ where: { requesterId: requesterA } });
    const res = await list(requesterA, `?search=${anyTicket.ticketNumber}`);

    expect(res.body.data.map((t: { id: number }) => t.id)).toContain(anyTicket.id);
  });

  it("ignores a whitespace-only term", async () => {
    const all = await list(requesterA, "?pageSize=50");
    const blank = await list(requesterA, "?search=%20%20&pageSize=50");

    expect(blank.body.meta.totalItems).toBe(all.body.meta.totalItems);
  });

  it("cannot reach another requester's ticket through search", async () => {
    const res = await list(requesterA, "?search=Requester%20B%20private&pageSize=50");
    expect(res.body.data).toEqual([]);
  });
});

describe("filters", () => {
  it("filters by category", async () => {
    const res = await list(requesterA, `?categoryId=${categoryX}&pageSize=50`);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const ticket of res.body.data) {
      expect(ticket.category.id).toBe(categoryX);
    }
  });

  it("filters by requested priority", async () => {
    const res = await list(requesterA, "?requestedPriority=HIGH&pageSize=50");

    for (const ticket of res.body.data) {
      expect(ticket.requestedPriority).toBe("HIGH");
    }
  });

  it("combines filters with AND", async () => {
    const res = await list(
      requesterA,
      `?categoryId=${categoryX}&requestedPriority=HIGH&pageSize=50`,
    );

    // categoryX tickets were created with MEDIUM, so this combination is empty.
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.totalItems).toBe(0);
  });

  it("returns an empty result set rather than an error when nothing matches", async () => {
    const res = await list(requesterA, "?search=zzz-no-such-ticket-zzz&pageSize=50");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.totalItems).toBe(0);
  });
});

describe("invalid queries", () => {
  it("rejects an unknown sort field with no ticket data", async () => {
    const res = await list(requesterA, "?sortBy=summary");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.data).toBeUndefined();
  });

  it("rejects an unpermitted page size", async () => {
    const res = await list(requesterA, "?pageSize=7");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });

  it("rejects page 0", async () => {
    const res = await list(requesterA, "?page=0");
    expect(res.status).toBe(400);
  });

  it("rejects an unknown priority", async () => {
    const res = await list(requesterA, "?requestedPriority=CRITICAL");
    expect(res.status).toBe(400);
  });
});

describe("row shape", () => {
  it("carries what the list needs and omits the description", async () => {
    const res = await list(requesterA);
    const row = res.body.data[0];

    expect(Object.keys(row).sort()).toEqual([
      "activeAttachmentCount",
      "category",
      "currentStatus",
      "id",
      "relatedSystem",
      "requestedPriority",
      "summary",
      "ticketDate",
      "ticketNumber",
      "updatedAt",
    ]);
    expect(row.description).toBeUndefined();
  });

  it("counts only active attachments", async () => {
    const ticketId = createdIds[0];
    await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: "active.pdf",
        storedFilename: `list-active-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 100,
      },
    });
    await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: "removed.pdf",
        storedFilename: `list-removed-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 100,
        removedAt: new Date(),
        removalReason: "Removed by the list test",
      },
    });

    const res = await list(requesterA, "?pageSize=50");
    const row = res.body.data.find((t: { id: number }) => t.id === ticketId);

    expect(row.activeAttachmentCount).toBe(1);
  });
});
