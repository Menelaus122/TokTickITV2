import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { SEED_PASSWORD } from "../../prisma/seedData.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 7 — the Requester dashboard (DASH-01 to DASH-09 in docs/lab-04/tests.md §2.5;
// specification.md BR-30 to BR-33, BR-37, BR-39 to BR-41; api-spec §4.1, §5.1, §6). Needs the
// migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the real database.
// Every figure the endpoint reports is checked against a count or a list that this file asks
// the database for itself, in raw SQL, with its own ordering, so a mistake in the endpoint's
// query cannot also be a mistake in the check. Tests that need exact data make their own
// Requester, so no test depends on what the seed or another suite left behind.

const prisma = getPrisma();
const MINUTE = 60 * 1000;

const OPEN_GROUP = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const SEEDED_REQUESTER_EMAILS = ["anucha.wong@kmutt.ac.th", "kanya.sris@kmutt.ac.th", "pornchai.than@kmutt.ac.th", "suchada.mees@kmutt.ac.th"];
const HREF = {
  openTickets: "/tickets?group=open",
  waitingForYou: "/tickets?status=WAITING_FOR_REQUESTER",
  resolved: "/tickets?status=RESOLVED",
  closed: "/tickets?status=CLOSED",
} as const;
const METRICS = Object.keys(HREF) as Array<keyof typeof HREF>;

const ticketIds: number[] = [];
const extraUserIds: number[] = [];
const cookies: Record<string, string> = {};
const userIds: Record<string, number> = {};
let categoryId: number;
let relatedSystemId: number;
let sequence = 0;
const numberBase = Date.now() % 80000;

interface Row {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  updatedAt: string;
}
interface Dashboard {
  generatedAt: string;
  metrics: Record<string, { value: number; href: string }>;
  needsAttention: Row[];
  recentTickets: Row[];
}

const dashboard = (cookie?: string, query = "", headers: Record<string, string> = {}) => {
  const req = request(app).get(`/api/dashboard/requester${query}`);
  if (cookie) req.set("Cookie", cookie);
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
};

async function makeTicket(requesterId: number, status: TicketStatus, updatedAt: Date, summary = "Lab 4 dashboard suite ticket"): Promise<number> {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9995-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary,
      description: "Created by the Lab 4 dashboard suite. A long description that a dashboard row must never carry.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      createdAt: new Date(updatedAt.getTime() - 60 * MINUTE),
      updatedAt,
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

async function newRequester(label: string): Promise<{ id: number; cookie: string }> {
  const user = await prisma.user.create({
    data: {
      fullName: `Dashboard suite ${label}`,
      email: `dash.${label}.${Date.now().toString(36)}@example.test`,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });
  extraUserIds.push(user.id);
  return { id: user.id, cookie: await signInAs(user.id) };
}

// --- the independent checks: raw SQL, written here -----------------------------------------
async function countOf(requesterId: number, statuses: string[]): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::bigint AS n FROM "Ticket" WHERE "requesterId" = ${requesterId} AND "currentStatus"::text = ANY(${statuses}::text[])`;
  return Number(rows[0].n);
}
async function waitingIds(requesterId: number): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Ticket" WHERE "requesterId" = ${requesterId} AND "currentStatus"::text = 'WAITING_FOR_REQUESTER'
    ORDER BY "updatedAt" ASC, id ASC LIMIT 5`;
  return rows.map((r) => r.id);
}
async function recentIds(requesterId: number): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Ticket" WHERE "requesterId" = ${requesterId} ORDER BY "updatedAt" DESC, id DESC LIMIT 5`;
  return rows.map((r) => r.id);
}
const ownIds = async (requesterId: number) => (await prisma.ticket.findMany({ where: { requesterId }, select: { id: true } })).map((t) => t.id);

beforeAll(async () => {
  for (const email of SEEDED_REQUESTER_EMAILS) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    userIds[email] = user.id;
    cookies[email] = await signInAs(user.id);
  }
  const noTickets = await prisma.user.findUniqueOrThrow({ where: { email: "no.tickets@toktickit.local" }, select: { id: true } });
  userIds.noTickets = noTickets.id;
  cookies.noTickets = await signInAs(noTickets.id);
  for (const [name, role] of [["staff", "IT_STAFF"], ["admin", "ADMINISTRATOR"]] as const) {
    const user = await prisma.user.findFirstOrThrow({ where: { role, isActive: true, mustChangePassword: false }, orderBy: { id: "asc" }, select: { id: true } });
    userIds[name] = user.id;
    cookies[name] = await signInAs(user.id);
  }
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("DASH-01 a Requester's dashboard holds only that Requester's Tickets, with others' Tickets present (AC-02, BR-32, BR-37)", () => {
  it("lists only the signed-in Requester's own Tickets, for each seeded Requester", async () => {
    // A newer ticket in someone else's name, waiting on them, so any leak would put it first.
    const intruder = await newRequester("intruder");
    await makeTicket(intruder.id, "WAITING_FOR_REQUESTER", new Date(Date.now() + MINUTE), "Someone else's ticket");

    for (const email of SEEDED_REQUESTER_EMAILS) {
      const res = await dashboard(cookies[email]);
      expect(res.status, email).toBe(200);
      const own = new Set(await ownIds(userIds[email]));
      for (const row of [...res.body.needsAttention, ...res.body.recentTickets] as Row[]) {
        expect(own.has(row.id), `${email}: ${row.ticketNumber}`).toBe(true);
        expect(row.summary).not.toBe("Someone else's ticket");
      }
    }
  });

  it("counts a Ticket of another Requester in no card", async () => {
    const other = await newRequester("other");
    const mine = await newRequester("mine");
    await makeTicket(other.id, "OPEN", new Date());
    await makeTicket(other.id, "RESOLVED", new Date());
    await makeTicket(mine.id, "OPEN", new Date());

    const res = await dashboard(mine.cookie);
    expect(res.body.metrics.openTickets.value).toBe(1);
    expect(res.body.metrics.resolved.value).toBe(0);
  });
});

describe("DASH-02 every card equals an independent count of that Requester's Tickets (AC-18, BR-32)", () => {
  const definitions: Record<keyof typeof HREF, string[]> = {
    openTickets: OPEN_GROUP,
    waitingForYou: ["WAITING_FOR_REQUESTER"],
    resolved: ["RESOLVED"],
    closed: ["CLOSED"],
  };

  it.each(SEEDED_REQUESTER_EMAILS)("%s: each of the four values is the independent count", async (email) => {
    const res = await dashboard(cookies[email]);
    expect(res.status).toBe(200);
    for (const metric of METRICS) {
      expect(res.body.metrics[metric].value, `${email} ${metric}`).toBe(await countOf(userIds[email], definitions[metric]));
    }
  });

  it("counts a Cancelled Ticket in no card, and keeps the four cards to exactly those four", async () => {
    const me = await newRequester("cancelled");
    for (const status of ["CANCELLED", "CANCELLED", "OPEN"] as const) await makeTicket(me.id, status, new Date());
    const res = await dashboard(me.cookie);
    expect(Object.keys(res.body.metrics)).toEqual(["openTickets", "waitingForYou", "resolved", "closed"]);
    expect(METRICS.map((m) => res.body.metrics[m].value)).toEqual([1, 0, 0, 0]);
  });

  it("puts each status in the group the specification gives it: the open group has five statuses, and Waiting for You is one of them", async () => {
    const me = await newRequester("groups");
    const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"];
    for (const status of statuses) await makeTicket(me.id, status, new Date());
    const res = await dashboard(me.cookie);
    expect(METRICS.map((m) => res.body.metrics[m].value)).toEqual([5, 1, 1, 1]);
  });

  it("computes on every request: a change is in the next answer, with nothing cached (BR-30)", async () => {
    const me = await newRequester("fresh");
    const id = await makeTicket(me.id, "OPEN", new Date());
    expect((await dashboard(me.cookie)).body.metrics.openTickets.value).toBe(1);
    expect((await dashboard(me.cookie)).body.metrics.resolved.value).toBe(0);

    await prisma.ticket.update({ where: { id }, data: { currentStatus: "RESOLVED" } });
    const after = await dashboard(me.cookie);
    expect(after.body.metrics.openTickets.value).toBe(0);
    expect(after.body.metrics.resolved.value).toBe(1);
  });
});

describe("DASH-03 a Requester with no Tickets gets zeros and empty lists (AC-18, BR-39)", () => {
  it("answers four 0 values, each still with its link, and two empty arrays", async () => {
    const res = await dashboard(cookies.noTickets);
    expect(res.status).toBe(200);
    expect(METRICS.map((m) => res.body.metrics[m])).toEqual(METRICS.map((m) => ({ value: 0, href: HREF[m] })));
    expect(res.body.needsAttention).toEqual([]);
    expect(res.body.recentTickets).toEqual([]);
  });

  it("is the same for a brand new account", async () => {
    const fresh = await newRequester("brandnew");
    const res = await dashboard(fresh.cookie);
    expect(METRICS.map((m) => res.body.metrics[m].value)).toEqual([0, 0, 0, 0]);
    expect([res.body.needsAttention, res.body.recentTickets]).toEqual([[], []]);
  });
});

describe("DASH-04 the two lists are bounded, and ordered as the specification says (AC-18, BR-33)", () => {
  let me: { id: number; cookie: string };
  const expected = { waiting: [] as number[], recent: [] as number[] };

  beforeAll(async () => {
    me = await newRequester("busy");
    const now = Date.now();
    // Seven waiting tickets; the two oldest share one instant, so the id breaks the tie.
    const waiting: number[] = [];
    for (const minutesAgo of [50, 50, 40, 30, 20, 10, 5]) waiting.push(await makeTicket(me.id, "WAITING_FOR_REQUESTER", new Date(now - minutesAgo * MINUTE)));
    // Others, with two sharing the newest instant of all.
    const newest = new Date(now + MINUTE);
    const others = [
      await makeTicket(me.id, "NEW", new Date(now - 90 * MINUTE)),
      await makeTicket(me.id, "RESOLVED", new Date(now - 3 * MINUTE)),
      await makeTicket(me.id, "CLOSED", new Date(now - 200 * MINUTE)),
      await makeTicket(me.id, "CANCELLED", newest),
      await makeTicket(me.id, "IN_PROGRESS", newest),
    ];
    expect(waiting.length + others.length).toBe(12);
    // Written out by hand from the data above, not by sorting what the endpoint returned:
    // oldest waiting first, the tie by id; newest overall first, the tie by id descending.
    expected.waiting = [waiting[0], waiting[1], waiting[2], waiting[3], waiting[4]];
    // (the two at +1 minute, then the Resolved one at 3 minutes ago, then the waiting ones at 5 and 10)
    expected.recent = [others[4], others[3], others[1], waiting[6], waiting[5]];
  });

  it("holds at most five of each, though the Requester has twelve Tickets and seven are waiting", async () => {
    const res = await dashboard(me.cookie);
    expect(res.body.needsAttention).toHaveLength(5);
    expect(res.body.recentTickets).toHaveLength(5);
    expect(res.body.metrics.waitingForYou.value).toBe(7);
  });

  it("puts Needs your attention in longest-waiting order, a tie going to the lower id", async () => {
    const res = await dashboard(me.cookie);
    expect((res.body.needsAttention as Row[]).map((r) => r.id)).toEqual(expected.waiting);
    expect(res.body.needsAttention.every((r: Row) => r.currentStatus === "WAITING_FOR_REQUESTER")).toBe(true);
  });

  it("puts Recently updated newest first whatever the status, a tie going to the higher id, a Cancelled Ticket included", async () => {
    const res = await dashboard(me.cookie);
    expect((res.body.recentTickets as Row[]).map((r) => r.id)).toEqual(expected.recent);
    expect((res.body.recentTickets as Row[]).map((r) => r.currentStatus)).toContain("CANCELLED");
  });

  it("agrees with the lists an independent query asks the database for", async () => {
    const res = await dashboard(me.cookie);
    expect((res.body.needsAttention as Row[]).map((r) => r.id)).toEqual(await waitingIds(me.id));
    expect((res.body.recentTickets as Row[]).map((r) => r.id)).toEqual(await recentIds(me.id));
  });

  it("agrees with the independent queries for each seeded Requester too, whose lists are long", async () => {
    for (const email of SEEDED_REQUESTER_EMAILS) {
      const res = await dashboard(cookies[email]);
      expect((res.body.needsAttention as Row[]).map((r) => r.id), email).toEqual(await waitingIds(userIds[email]));
      expect((res.body.recentTickets as Row[]).map((r) => r.id), email).toEqual(await recentIds(userIds[email]));
    }
  });

  it("leaves a list with fewer than five exactly as long as the Tickets there are, and an unrelated list empty", async () => {
    const small = await newRequester("small");
    await makeTicket(small.id, "OPEN", new Date());
    await makeTicket(small.id, "CLOSED", new Date(Date.now() - MINUTE));
    const res = await dashboard(small.cookie);
    expect(res.body.recentTickets).toHaveLength(2);
    expect(res.body.needsAttention).toEqual([]);
  });
});

describe("DASH-05 only a Requester may read it: IT Staff and an Administrator are refused, and nobody is 401 (AC-02, BR-43)", () => {
  it("is 403 FORBIDDEN for IT Staff, with nothing else in the body", async () => {
    const res = await dashboard(cookies.staff);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("is 403 FORBIDDEN for an Administrator, with nothing else in the body", async () => {
    const res = await dashboard(cookies.admin);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("is 401 AUTH_REQUIRED with no session, and with a session cookie that names no session", async () => {
    for (const cookie of [undefined, "tt_sid=not-a-session"]) {
      const res = await dashboard(cookie);
      expect(res.status, String(cookie)).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("is refused, not answered, for a session that must still change its password", async () => {
    const user = await prisma.user.create({
      data: {
        fullName: "Dashboard suite first login",
        email: `dash.firstlogin.${Date.now().toString(36)}@example.test`,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
        passwordHash: await hashPassword(SEED_PASSWORD),
      },
    });
    extraUserIds.push(user.id);
    const res = await dashboard(await signInAs(user.id));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(res.body.metrics).toBeUndefined();
  });
});

describe("DASH-06 nothing the client sends changes whose dashboard it is (AC-02, BR-37)", () => {
  it("ignores a requesterId in the query and an X-Requester-Id header, which name another Requester", async () => {
    const mine = userIds["kanya.sris@kmutt.ac.th"];
    const other = userIds["anucha.wong@kmutt.ac.th"];
    const plain = await dashboard(cookies["kanya.sris@kmutt.ac.th"]);
    const trying = await dashboard(cookies["kanya.sris@kmutt.ac.th"], `?requesterId=${other}`, { "X-Requester-Id": String(other) });
    expect(trying.status).toBe(200);
    const { generatedAt: _a, ...left } = plain.body;
    const { generatedAt: _b, ...right } = trying.body;
    expect(right).toEqual(left);
    for (const row of [...trying.body.needsAttention, ...trying.body.recentTickets] as Row[]) expect(await ownIds(mine)).toContain(row.id);
  });

  it.each([
    ["userId", "?userId=1"],
    ["me", "?me=other"],
    ["owner", "?owner=me"],
    ["group", "?group=open"],
    ["status", "?status=CLOSED"],
    ["limit", "?limit=1"],
    ["a made-up parameter", "?nothing=at-all"],
    ["a repeated parameter", "?group=open&group=open"],
    ["an unknown group", "?group=nonsense"],
  ])("takes no parameters, so %s changes nothing, and is not an error (api-spec §4)", async (_name, query) => {
    const plain = await dashboard(cookies["pornchai.than@kmutt.ac.th"]);
    const trying = await dashboard(cookies["pornchai.than@kmutt.ac.th"], query);
    expect(trying.status).toBe(200);
    const { generatedAt: _a, ...left } = plain.body;
    const { generatedAt: _b, ...right } = trying.body;
    expect(right).toEqual(left);
  });
});

describe("DASH-07 every link goes to a list that shows exactly the number on its card (AC-21, BR-40)", () => {
  /** What the web client sends for a dashboard link: `status` in the route is `currentStatus` to the list API. */
  function listQueryFor(href: string): string {
    const url = new URL(href, "http://client.invalid");
    expect(url.pathname).toBe("/tickets");
    const params = new URLSearchParams();
    for (const [name, value] of url.searchParams) params.set(name === "status" ? "currentStatus" : name, value);
    return params.toString();
  }

  const everyone = async () => {
    const busy = await newRequester("links");
    for (const status of ["OPEN", "WAITING_FOR_REQUESTER", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "CANCELLED"] as const) await makeTicket(busy.id, status, new Date());
    return [...SEEDED_REQUESTER_EMAILS.map((email) => [email, cookies[email]] as const), ["no.tickets", cookies.noTickets] as const, ["links", busy.cookie] as const];
  };

  it("has exactly the documented href on each card", async () => {
    const res = await dashboard(cookies["anucha.wong@kmutt.ac.th"]);
    for (const metric of METRICS) expect(res.body.metrics[metric].href, metric).toBe(HREF[metric]);
  });

  it("opens, for each card of each Requester, a My Tickets list whose total equals the card's value", async () => {
    for (const [who, cookie] of await everyone()) {
      const board = await dashboard(cookie);
      for (const metric of METRICS) {
        const list = await request(app).get(`/api/tickets?${listQueryFor(board.body.metrics[metric].href)}&pageSize=50`).set("Cookie", cookie);
        expect(list.status, `${who} ${metric}`).toBe(200);
        expect(list.body.meta.totalItems, `${who} ${metric}`).toBe(board.body.metrics[metric].value);
      }
    }
  });

  it("opens, for every row of both lists, a Ticket Detail the Requester can read, with the same number", async () => {
    for (const [who, cookie] of await everyone()) {
      const board = await dashboard(cookie);
      for (const row of [...board.body.needsAttention, ...board.body.recentTickets] as Row[]) {
        const detail = await request(app).get(`/api/tickets/${row.id}`).set("Cookie", cookie);
        expect(detail.status, `${who} ${row.ticketNumber}`).toBe(200);
        expect(detail.body.ticketNumber).toBe(row.ticketNumber);
      }
    }
  });
});

describe("DASH-08 group=open on My Tickets (AC-21, BR-31, api-spec §5.1)", () => {
  let me: { id: number; cookie: string };

  beforeAll(async () => {
    me = await newRequester("group");
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const) await makeTicket(me.id, status, new Date());
  });

  const list = (query: string) => request(app).get(`/api/tickets?${query}&pageSize=50`).set("Cookie", me.cookie);

  it("alone, lists the five open statuses and nothing else", async () => {
    const res = await list("group=open");
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ currentStatus: string }>).map((t) => t.currentStatus).sort()).toEqual([...OPEN_GROUP].sort());
    expect(res.body.meta.totalItems).toBe(5);
  });

  it("with a status inside the group, lists that status only", async () => {
    const res = await list("group=open&currentStatus=WAITING_FOR_REQUESTER");
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ currentStatus: string }>).map((t) => t.currentStatus)).toEqual(["WAITING_FOR_REQUESTER"]);
  });

  it("with a status outside the group, is an empty list and not an error, for each of the three", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"]) {
      const res = await list(`group=open&currentStatus=${status}`);
      expect(res.status, status).toBe(200);
      expect(res.body.data, status).toEqual([]);
      expect(res.body.meta.totalItems, status).toBe(0);
    }
  });

  it("combines with a search by AND, as every filter does", async () => {
    const res = await list("group=open&search=zzz-nothing-matches-this");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("is 400 INVALID_QUERY when it is repeated, and when it is unknown, with no ticket data in the answer", async () => {
    for (const query of ["group=open&group=open", "group=closed", "group=OPEN", "group=open,closed"]) {
      const res = await list(query);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code, query).toBe("INVALID_QUERY");
      expect(Object.keys(res.body), query).toEqual(["error"]);
    }
  });

  it("does not take `status` as a filter: the Requester's list calls it currentStatus, so a status is ignored like any unknown parameter (api-spec §5.1)", async () => {
    const res = await list("status=CLOSED");
    expect(res.status).toBe(200);
    expect(res.body.meta.totalItems).toBe(8);
  });

  it("leaves every request without it exactly as it was: all eight statuses", async () => {
    const res = await list("");
    expect(res.body.meta.totalItems).toBe(8);
  });

  it("is still scoped to the signed-in Requester's own Tickets", async () => {
    const res = await request(app).get("/api/tickets?group=open&pageSize=50").set("Cookie", cookies.noTickets);
    expect(res.body.meta.totalItems).toBe(0);
  });
});

describe("DASH-09 the response is short, and has exactly the documented keys (AC-18, FR-19, BR-30)", () => {
  it("has only generatedAt, metrics, needsAttention, and recentTickets", async () => {
    const res = await dashboard(cookies["anucha.wong@kmutt.ac.th"]);
    expect(Object.keys(res.body).sort()).toEqual(["generatedAt", "metrics", "needsAttention", "recentTickets"]);
    expect(Object.keys(res.body.metrics)).toEqual(["openTickets", "waitingForYou", "resolved", "closed"]);
  });

  it("gives each card only a non-negative whole-number value and an href", async () => {
    const res = await dashboard(cookies["anucha.wong@kmutt.ac.th"]);
    for (const metric of METRICS) {
      expect(Object.keys(res.body.metrics[metric]).sort(), metric).toEqual(["href", "value"]);
      expect(Number.isInteger(res.body.metrics[metric].value), metric).toBe(true);
      expect(res.body.metrics[metric].value, metric).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives each row only the five concise fields: no description, no requester, no owner, no priority", async () => {
    const res = await dashboard(cookies["anucha.wong@kmutt.ac.th"]);
    const rows = [...res.body.needsAttention, ...res.body.recentTickets] as Row[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["currentStatus", "id", "summary", "ticketNumber", "updatedAt"]);
      expect(typeof row.id).toBe("number");
      expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it("never carries a Ticket's description, which can be 4,000 characters, whatever its length", async () => {
    const me = await newRequester("longdescription");
    const marker = "DESCRIPTION-MARKER-" + "x".repeat(3900);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TT-9995-${String(numberBase + sequence++).padStart(5, "0")}`,
        requesterId: me.id,
        categoryId,
        relatedSystemId,
        summary: "A ticket with a very long description",
        description: marker,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "WAITING_FOR_REQUESTER",
      },
    });
    ticketIds.push(ticket.id);
    const res = await dashboard(me.cookie);
    expect(res.body.recentTickets).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain("DESCRIPTION-MARKER");
    expect(JSON.stringify(res.body).length).toBeLessThan(1500);
  });

  it("bounds both lists at five, even for the Requester with the most Tickets", async () => {
    const heaviest = await prisma.ticket.groupBy({ by: ["requesterId"], _count: { _all: true }, orderBy: { _count: { requesterId: "desc" } }, take: 1 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: heaviest[0].requesterId }, select: { id: true, role: true } });
    expect(user.role).toBe("REQUESTER");
    expect(heaviest[0]._count._all).toBeGreaterThan(5);
    const res = await dashboard(await signInAs(user.id));
    expect(res.body.needsAttention.length).toBeLessThanOrEqual(5);
    expect(res.body.recentTickets.length).toBeLessThanOrEqual(5);
  });

  it("is generated now, as an ISO 8601 UTC instant", async () => {
    const before = Date.now();
    const res = await dashboard(cookies["kanya.sris@kmutt.ac.th"]);
    expect(res.body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const at = Date.parse(res.body.generatedAt);
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("is never cached", async () => {
    const res = await dashboard(cookies["kanya.sris@kmutt.ac.th"]);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
  });

  it("is a different answer from another route: an unknown dashboard is the unknown-route 404", async () => {
    const res = await request(app).get("/api/dashboard/everyone").set("Cookie", cookies["kanya.sris@kmutt.ac.th"]);
    expect(res.status).toBe(404);
  });

  it("has no write route: a POST, PATCH, or DELETE is the unknown-route 404 and changes nothing", async () => {
    for (const method of ["post", "patch", "delete"] as const) {
      const res = await request(app)[method]("/api/dashboard/requester").set("Cookie", cookies["kanya.sris@kmutt.ac.th"]).send({});
      expect(res.status, method).toBe(404);
    }
  });
});
