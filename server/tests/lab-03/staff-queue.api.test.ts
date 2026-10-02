import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 8 — the IT Staff queue (API-30 to API-39 in docs/lab-03/tests.md;
// api-spec §5.1, BR-53 to BR-59). Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The queue shows every ticket in the database, seeded ones included, so each
// fixture's summary carries MARKER and every assertion about order or counts
// searches for it. That also exercises search combined with everything else
// (BR-54).

const prisma = getPrisma();

const MARKER = `qsuite${Date.now().toString(36)}`;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"] as const;
const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 } as const;

interface Fixture {
  id: number;
  ticketNumber: string;
  requesterId: number;
  ownerId: number | null;
  categoryId: number;
  itPriority: (typeof PRIORITIES)[number];
  currentStatus: (typeof STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

const fixtures: Fixture[] = [];
const cookies = {} as Record<"staff" | "admin" | "requester", string>;
const ids = {} as Record<"me" | "colleague" | "inactiveStaff", number>;
let requesterIds: number[] = [];
let categoryIds: number[] = [];

function queue(params: Record<string, string | number> = {}, cookie = cookies.staff) {
  return request(app).get("/api/staff/tickets").query(params).set("Cookie", cookie);
}

/** Every fixture, in one page, under the given extra parameters. */
async function mine(params: Record<string, string | number> = {}) {
  const res = await queue({ q: MARKER, pageSize: 50, ...params });
  expect(res.status).toBe(200);
  return res.body.tickets as Array<{ id: number } & Record<string, unknown>>;
}

const time = (d: Date) => d.getTime();

/** The documented order (BR-55, BR-56), written out independently of the server. */
function expectedOrder(rows: Fixture[], sort: "itPriority" | "createdAt" | "updatedAt", direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows]
    .sort((a, b) => {
      if (sort === "itPriority") {
        const byPriority = sign * (PRIORITY_RANK[a.itPriority] - PRIORITY_RANK[b.itPriority]);
        if (byPriority !== 0) return byPriority;
        const byAge = time(a.createdAt) - time(b.createdAt);
        if (byAge !== 0) return byAge;
      } else {
        const byField = sign * (time(a[sort]) - time(b[sort]));
        if (byField !== 0) return byField;
      }
      return b.id - a.id;
    })
    .map((row) => row.id);
}

beforeAll(async () => {
  const requesters = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
    take: 3,
  });
  requesterIds = requesters.map((r) => r.id);
  const [me, colleague] = await prisma.user.findMany({
    where: { role: "IT_STAFF", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
    take: 2,
  });
  const inactiveStaff = await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: false } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } });
  ids.me = me.id;
  ids.colleague = colleague.id;
  ids.inactiveStaff = inactiveStaff.id;

  cookies.staff = await signInAs(me.id);
  cookies.admin = await signInAs(admin.id);
  cookies.requester = await signInAs(requesterIds[0]);

  categoryIds = (await prisma.category.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 })).map((c) => c.id);
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });

  const owners = [null, ids.me, ids.colleague, ids.inactiveStaff];
  const base = Date.UTC(2026, 0, 1);
  const numberBase = Date.now() % 80000;
  for (let i = 0; i < 12; i++) {
    // Two tickets share a createdAt so the id tie-break is exercised (BR-56).
    const createdAt = new Date(base + (i === 11 ? 10 : i) * 3_600_000);
    // updatedAt runs in a different order from createdAt.
    const updatedAt = new Date(base + 100 * 3_600_000 + ((i * 5) % 12) * 60_000);
    const data = {
      ticketNumber: `TT-9993-${String(numberBase + i).padStart(5, "0")}`,
      requesterId: requesterIds[i % 3],
      ownerId: owners[Math.floor(i / 3) % 4],
      categoryId: categoryIds[i % 2],
      relatedSystemId: system.id,
      summary: `${i % 2 === 0 ? "Printer" : "VPN"} problem ${MARKER} #${i}`,
      description: "Created by the staff queue API suite.",
      requestedPriority: "MEDIUM" as const,
      itPriority: PRIORITIES[i % 4],
      currentStatus: STATUSES[i % 4],
      createdAt,
      updatedAt,
    };
    const ticket = await prisma.ticket.create({ data });
    fixtures.push({ ...data, id: ticket.id, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt });
  }
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: fixtures.map((f) => f.id) } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("the queue", () => {
  it("API-30 shows IT Staff the tickets of every Requester", async () => {
    const rows = await mine();
    expect(rows.map((r) => r.id).sort()).toEqual(fixtures.map((f) => f.id).sort());
    const requestersSeen = new Set(fixtures.filter((f) => rows.some((r) => r.id === f.id)).map((f) => f.requesterId));
    expect(requestersSeen.size).toBe(3);
  });

  it("returns the documented row shape and nothing wider", async () => {
    const [row] = await mine({ owner: "me" });
    expect(Object.keys(row).sort()).toEqual(
      [
        "id",
        "ticketNumber",
        "summary",
        "categoryName",
        "requestedPriority",
        "itPriority",
        "currentStatus",
        "owner",
        "requesterResolvedAt",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(row.owner).toEqual({ id: ids.me, fullName: expect.any(String), isActive: true });
  });

  it("API-31 orders by IT Priority descending, oldest first within a priority, by default", async () => {
    const rows = await mine();
    expect(rows.map((r) => r.id)).toEqual(expectedOrder(fixtures, "itPriority", "desc"));
  });

  it("is refused to a Requester and an Administrator (BR-19)", async () => {
    for (const cookie of [cookies.requester, cookies.admin]) {
      const res = await queue({}, cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.tickets).toBeUndefined();
    }
  });
});

describe("search and filters", () => {
  it("API-32 matches Ticket Number and Summary, case-insensitively", async () => {
    const bySummary = await mine({ q: `PRINTER PROBLEM ${MARKER.toUpperCase()}` });
    expect(bySummary.map((r) => r.id).sort()).toEqual(fixtures.filter((_, i) => i % 2 === 0).map((f) => f.id).sort());

    const target = fixtures[5];
    const res = await queue({ q: `  ${target.ticketNumber.toLowerCase()}  ` });
    expect(res.status).toBe(200);
    expect(res.body.tickets.map((r: { id: number }) => r.id)).toEqual([target.id]);
  });

  it("API-33 filters by status, IT Priority, and category, alone and combined with AND", async () => {
    const matches = (pred: (f: Fixture) => boolean) => fixtures.filter(pred).map((f) => f.id).sort();
    const idsOf = (rows: Array<{ id: number }>) => rows.map((r) => r.id).sort();

    expect(idsOf(await mine({ status: "OPEN" }))).toEqual(matches((f) => f.currentStatus === "OPEN"));
    expect(idsOf(await mine({ itPriority: "URGENT" }))).toEqual(matches((f) => f.itPriority === "URGENT"));
    expect(idsOf(await mine({ categoryId: categoryIds[1] }))).toEqual(matches((f) => f.categoryId === categoryIds[1]));

    const combined = await mine({ status: "IN_PROGRESS", itPriority: "HIGH", categoryId: categoryIds[0] });
    expect(idsOf(combined)).toEqual(
      matches((f) => f.currentStatus === "IN_PROGRESS" && f.itPriority === "HIGH" && f.categoryId === categoryIds[0]),
    );
    expect(combined.length).toBeGreaterThan(0);

    // A filter pair no fixture satisfies returns nothing, not either half.
    expect(await mine({ status: "NEW", itPriority: "URGENT" })).toEqual([]);
  });

  it("API-34 filters by owner: unassigned, me, and a named user", async () => {
    const unassigned = await mine({ owner: "unassigned" });
    expect(unassigned.map((r) => r.id).sort()).toEqual(fixtures.filter((f) => f.ownerId === null).map((f) => f.id).sort());
    for (const row of unassigned) expect(row.owner).toBeNull();

    const me = await mine({ owner: "me" });
    expect(me.map((r) => r.id).sort()).toEqual(fixtures.filter((f) => f.ownerId === ids.me).map((f) => f.id).sort());

    const colleague = await mine({ owner: ids.colleague });
    expect(colleague.map((r) => r.id).sort()).toEqual(fixtures.filter((f) => f.ownerId === ids.colleague).map((f) => f.id).sort());

    expect((await mine({ owner: "any" })).length).toBe(fixtures.length);
  });

  it("API-39 still shows the owner of a deactivated account, marked inactive (BR-26)", async () => {
    const rows = await mine({ owner: ids.inactiveStaff });
    expect(rows.length).toBe(fixtures.filter((f) => f.ownerId === ids.inactiveStaff).length);
    for (const row of rows) expect(row.owner).toEqual({ id: ids.inactiveStaff, fullName: expect.any(String), isActive: false });
  });
});

describe("sorting and pagination", () => {
  it("API-35 sorts by every permitted field in both directions, id descending on ties", async () => {
    for (const sort of ["itPriority", "createdAt", "updatedAt"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        const rows = await mine({ sort, direction });
        expect(rows.map((r) => r.id), `${sort} ${direction}`).toEqual(expectedOrder(fixtures, sort, direction));
      }
    }
  });

  it("API-36 slices pages with correct metadata", async () => {
    const order = expectedOrder(fixtures, "itPriority", "desc");

    const first = await queue({ q: MARKER });
    expect(first.body).toMatchObject({ page: 1, pageSize: 10, totalItems: 12, totalPages: 2 });
    expect(first.body.tickets.map((r: { id: number }) => r.id)).toEqual(order.slice(0, 10));

    const second = await queue({ q: MARKER, page: 2 });
    expect(second.body).toMatchObject({ page: 2, pageSize: 10, totalItems: 12, totalPages: 2 });
    expect(second.body.tickets.map((r: { id: number }) => r.id)).toEqual(order.slice(10));

    for (const pageSize of [20, 50]) {
      const res = await queue({ q: MARKER, pageSize });
      expect(res.body).toMatchObject({ page: 1, pageSize, totalItems: 12, totalPages: 1 });
      expect(res.body.tickets).toHaveLength(12);
    }
  });

  it("API-38 answers a page beyond the last with an empty list and true metadata (BR-59)", async () => {
    const res = await queue({ q: MARKER, page: 9 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tickets: [], page: 9, pageSize: 10, totalItems: 12, totalPages: 2 });
  });

  it("treats a blank search as absent rather than matching nothing (BR-53)", async () => {
    const res = await queue({ q: "   ", pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBeGreaterThanOrEqual(fixtures.length);
  });
});

describe("invalid queries", () => {
  it("API-37 refuses unknown or unpermitted values with 400 INVALID_QUERY (BR-58)", async () => {
    const bad: Array<Record<string, string | number>> = [
      { sort: "summary" },
      { direction: "sideways" },
      { pageSize: 15 },
      { page: 0 },
      { page: "two" },
      { status: "DONE" },
      { itPriority: "CRITICAL" },
      { owner: "someone" },
      { categoryId: "x" },
    ];
    for (const params of bad) {
      const res = await queue(params);
      expect(res.status, JSON.stringify(params)).toBe(400);
      expect(res.body.error.code).toBe("INVALID_QUERY");
      expect(res.body.tickets).toBeUndefined();
    }
  });
});

describe("assignable users — the Owner filter's options (api-spec §5.6)", () => {
  it("lists active IT Staff and Administrators by name, in the permitted user shape", async () => {
    const res = await request(app).get("/api/staff/assignable-users").set("Cookie", cookies.staff);
    expect(res.status).toBe(200);
    const users = res.body.users as Array<{ id: number; fullName: string; role: string; isActive: boolean }>;

    const expected = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    expect(users.map((u) => u.id)).toEqual(expected.map((u) => u.id));
    expect(users.map((u) => u.id)).not.toContain(ids.inactiveStaff);
    for (const user of users) {
      expect(Object.keys(user).sort()).toEqual(["fullName", "id", "isActive", "role"]);
      expect(user.role).not.toBe("REQUESTER");
    }
  });

  it("is refused to a Requester and an Administrator", async () => {
    for (const cookie of [cookies.requester, cookies.admin]) {
      expect((await request(app).get("/api/staff/assignable-users").set("Cookie", cookie)).status).toBe(403);
    }
  });
});
