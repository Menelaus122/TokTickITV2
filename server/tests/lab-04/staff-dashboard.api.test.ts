import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Priority, Role, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { SEED_PASSWORD } from "../../prisma/seedData.js";
import { byStatusRows, cutDescription } from "../../src/staffDashboard.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 8 — the IT Staff and Administrator dashboard (DASH-10 to DASH-19 in
// docs/lab-04/tests.md §2.5; specification.md BR-30, BR-31, BR-34 to BR-41; api-spec §4.2, §5.1, §6).
// Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the real database.
// Every figure the endpoint reports is checked against a count or a list this file asks the
// database for itself, in raw SQL with its own ordering, so a mistake in the endpoint's query
// cannot also be a mistake in the check. The files of this suite run one at a time, so no other
// suite writes tickets while one of these runs. Tests that need exact data make their own
// staff members, so "me" starts empty and nothing the seed or another suite left behind can
// change what is expected. The same queries are recorded, as SQL, in tests.md §2.5.1 (Part 5).

const prisma = getPrisma();
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const OPEN_GROUP = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const CARDS = ["unassigned", "assignedToMe", "waitingForRequester", "urgent"] as const;
const CARD_HREF = {
  unassigned: "/queue?owner=unassigned&group=open",
  assignedToMe: "/queue?owner=me&group=open",
  waitingForRequester: "/queue?status=WAITING_FOR_REQUESTER",
  urgent: "/queue?itPriority=URGENT&group=open",
} as const;

const ticketIds: number[] = [];
const extraUserIds: number[] = [];
const cookies: Record<string, string> = {};
const ids: Record<string, number> = {};
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
  itPriority: string;
  owner: { id: number; fullName: string; isActive: boolean } | null;
}
interface ActionRow {
  id: number;
  ticketId: number;
  ticketNumber: string;
  actionAt: string;
  description: string;
  followUpRequired: boolean;
}
interface Board {
  generatedAt: string;
  metrics: Record<string, { value: number; href: string }>;
  byStatus: Array<{ status: string; value: number; href: string }>;
  myTickets: Row[];
  urgentTickets: Row[];
  myRecentActions: ActionRow[];
  userCounts?: Record<string, { value: number }>;
}

const board = (cookie?: string, query = "", headers: Record<string, string> = {}) => {
  const req = request(app).get(`/api/staff/dashboard${query}`);
  if (cookie) req.set("Cookie", cookie);
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
};

async function makeTicket(
  options: { ownerId?: number | null; status?: TicketStatus; itPriority?: Priority; createdAt?: Date; updatedAt?: Date; summary?: string } = {},
): Promise<number> {
  const createdAt = options.createdAt ?? new Date(Date.now() - 2 * DAY);
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9996-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId: ids.requester,
      ownerId: options.ownerId === undefined ? null : options.ownerId,
      categoryId,
      relatedSystemId,
      summary: options.summary ?? "Lab 4 staff dashboard suite ticket",
      description: "Created by the Lab 4 staff dashboard suite.",
      requestedPriority: "MEDIUM",
      itPriority: options.itPriority ?? "MEDIUM",
      currentStatus: options.status ?? "OPEN",
      createdAt,
      updatedAt: options.updatedAt ?? createdAt,
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

async function makeAction(ticketId: number, performedById: number, options: { createdAt?: Date; description?: string; followUpRequired?: boolean } = {}): Promise<number> {
  const createdAt = options.createdAt ?? new Date();
  const action = await prisma.actionTaken.create({
    data: {
      ticketId,
      performedById,
      actionAt: new Date(createdAt.getTime() - MINUTE),
      description: options.description ?? "Replaced the toner cartridge and ran a test page.",
      result: "The test page printed cleanly.",
      followUpRequired: options.followUpRequired ?? false,
      followUpNote: options.followUpRequired ? "Check again on Thursday." : null,
      createdAt,
    },
  });
  return action.id;
}

async function newUser(role: Role, label: string, isActive = true): Promise<{ id: number; cookie: string }> {
  const user = await prisma.user.create({
    data: {
      fullName: `Staff dashboard suite ${label}`,
      // Lower case: sign-in finds an account by its lower-cased email (Lab 3 BR-45).
      email: `sdash.${label.toLowerCase()}.${Date.now().toString(36)}.${extraUserIds.length}@example.test`,
      role,
      isActive,
      mustChangePassword: false,
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });
  extraUserIds.push(user.id);
  return { id: user.id, cookie: isActive ? await signInAs(user.id) : "" };
}

// --- the independent checks: raw SQL, written here ----------------------------------------------
const one = async (rows: Promise<Array<{ n: bigint }>>) => Number((await rows)[0].n);
const cardsOf = async (me: number) => ({
  unassigned: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "ownerId" IS NULL AND "currentStatus"::text = ANY(${OPEN_GROUP}::text[])`),
  assignedToMe: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "ownerId" = ${me} AND "currentStatus"::text = ANY(${OPEN_GROUP}::text[])`),
  waitingForRequester: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "currentStatus"::text = 'WAITING_FOR_REQUESTER'`),
  urgent: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "itPriority"::text = 'URGENT' AND "currentStatus"::text = ANY(${OPEN_GROUP}::text[])`),
});
const statusCount = (status: string) => one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "currentStatus"::text = ${status}`);
const idsOf = async (rows: Promise<Array<{ id: number }>>) => (await rows).map((r) => r.id);
const myTicketIds = (me: number) =>
  idsOf(prisma.$queryRaw`SELECT id FROM "Ticket" WHERE "ownerId" = ${me} AND "currentStatus"::text = ANY(${OPEN_GROUP}::text[]) ORDER BY "updatedAt" DESC, id DESC LIMIT 5`);
const urgentTicketIds = () =>
  idsOf(prisma.$queryRaw`SELECT id FROM "Ticket" WHERE "itPriority"::text = 'URGENT' AND "currentStatus"::text = ANY(${OPEN_GROUP}::text[]) ORDER BY "createdAt" ASC, id ASC LIMIT 5`);
const myActionIds = (me: number) =>
  idsOf(prisma.$queryRaw`SELECT id FROM "ActionTaken" WHERE "performedById" = ${me} ORDER BY "createdAt" DESC, id DESC LIMIT 5`);
const accountsNow = async () => ({
  activeRequesters: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "User" WHERE "isActive" AND role::text = 'REQUESTER'`),
  activeItStaff: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "User" WHERE "isActive" AND role::text = 'IT_STAFF'`),
  activeAdministrators: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "User" WHERE "isActive" AND role::text = 'ADMINISTRATOR'`),
  inactive: await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "User" WHERE NOT "isActive"`),
});

beforeAll(async () => {
  const find = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
  ids.staffA = await find("nattapong.it@toktickit.local");
  ids.staffB = await find("siriporn.it@toktickit.local");
  ids.admin = await find("malee.admin@toktickit.local");
  ids.idle = await find("idle.it@toktickit.local");
  ids.requester = await find("anucha.wong@kmutt.ac.th");
  for (const name of ["staffA", "staffB", "admin", "idle", "requester"]) cookies[name] = await signInAs(ids[name]);
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  // Tickets first: their actions go with them, and nothing then names the temporary users.
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  await endTestSessions();
  await prisma.$disconnect();
});

describe("DASH-10 the four cards equal independent counts, for IT Staff and for an Administrator (AC-19, BR-34)", () => {
  it.each(["staffA", "staffB", "admin", "idle"])("%s: every value is the count the database gives, and every card has its documented link", async (who) => {
    const expected = await cardsOf(ids[who]);
    const res = await board(cookies[who]);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.metrics)).toEqual([...CARDS]);
    for (const card of CARDS) {
      expect(res.body.metrics[card].value, `${who} ${card}`).toBe(expected[card]);
      expect(res.body.metrics[card].href, `${who} ${card}`).toBe(CARD_HREF[card]);
    }
  });

  it("is non-zero where there is work and zero where there is none, in the same answer", async () => {
    const res = await board(cookies.idle);
    expect(res.body.metrics.unassigned.value).toBeGreaterThan(0);
    expect(res.body.metrics.assignedToMe.value).toBe(0);
  });

  it("counts every Requester's Tickets in Unassigned, Waiting for Requester, and Urgent (BR-34), and only the caller's in Assigned to Me", async () => {
    const mine = await newUser("IT_STAFF", "scope");
    const before = await board(mine.cookie);
    await makeTicket({ ownerId: null, status: "NEW" });
    await makeTicket({ ownerId: ids.staffA, status: "WAITING_FOR_REQUESTER" });
    await makeTicket({ ownerId: ids.staffA, status: "IN_PROGRESS", itPriority: "URGENT" });
    const after = await board(mine.cookie);
    expect(after.body.metrics.unassigned.value - before.body.metrics.unassigned.value).toBe(1);
    expect(after.body.metrics.waitingForRequester.value - before.body.metrics.waitingForRequester.value).toBe(1);
    expect(after.body.metrics.urgent.value - before.body.metrics.urgent.value).toBe(1);
    expect(after.body.metrics.assignedToMe.value).toBe(0);
  });

  it("puts each status in the group the specification gives it: the open group has five statuses, and Waiting for Requester counts in it and by itself", async () => {
    const mine = await newUser("IT_STAFF", "groups");
    const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"];
    for (const status of statuses) await makeTicket({ ownerId: mine.id, status, itPriority: "URGENT" });
    const res = await board(mine.cookie);
    expect(res.body.metrics.assignedToMe.value).toBe(5);
    const independent = await cardsOf(mine.id);
    expect(res.body.metrics.urgent.value).toBe(independent.urgent);
    expect(res.body.metrics.waitingForRequester.value).toBe(independent.waitingForRequester);
  });

  it("computes on every request: a change is in the next answer, with nothing cached (BR-30)", async () => {
    const mine = await newUser("IT_STAFF", "fresh");
    const id = await makeTicket({ ownerId: mine.id, status: "OPEN" });
    expect((await board(mine.cookie)).body.metrics.assignedToMe.value).toBe(1);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: "RESOLVED" } });
    expect((await board(mine.cookie)).body.metrics.assignedToMe.value).toBe(0);
  });
});

describe("DASH-11 the status row has the five open statuses, in order, each equal to an independent count (AC-19, BR-35)", () => {
  const ORDER = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

  it("is exactly five rows in the documented order, each with its count over all Tickets and its link", async () => {
    const res = await board(cookies.staffA);
    expect(res.body.byStatus.map((r: { status: string }) => r.status)).toEqual(ORDER);
    for (const row of res.body.byStatus) {
      expect(Object.keys(row).sort(), row.status).toEqual(["href", "status", "value"]);
      expect(row.value, row.status).toBe(await statusCount(row.status));
      expect(row.href, row.status).toBe(`/queue?status=${row.status}`);
    }
  });

  it("is the same for an Administrator, and for a person with no work of their own: it is every Ticket's, not the caller's", async () => {
    const a = await board(cookies.admin);
    const b = await board(cookies.idle);
    expect(a.body.byStatus).toEqual(b.body.byStatus);
  });

  it("leaves Resolved, Closed, and Cancelled out of the row", async () => {
    const res = await board(cookies.staffA);
    const statuses = res.body.byStatus.map((r: { status: string }) => r.status);
    for (const gone of ["RESOLVED", "CLOSED", "CANCELLED"]) expect(statuses).not.toContain(gone);
  });

  it("moves a Ticket from one row to another when its status changes", async () => {
    const id = await makeTicket({ status: "NEW" });
    const before = await board(cookies.staffA);
    await prisma.ticket.update({ where: { id }, data: { currentStatus: "IN_PROGRESS" } });
    const after = await board(cookies.staffA);
    const value = (b: Board, status: string) => b.byStatus.find((r) => r.status === status)!.value;
    expect(value(after.body, "NEW") - value(before.body, "NEW")).toBe(-1);
    expect(value(after.body, "IN_PROGRESS") - value(before.body, "IN_PROGRESS")).toBe(1);
  });

  it("fills a status that no Ticket has with 0, and keeps the five rows in order whatever is counted (the rule, without a database)", () => {
    expect(byStatusRows({})).toEqual(ORDER.map((status) => ({ status, value: 0, href: `/queue?status=${status}` })));
    const rows = byStatusRows({ REOPENED: 4, NEW: 2, CLOSED: 9 });
    expect(rows.map((r) => [r.status, r.value])).toEqual([["NEW", 2], ["OPEN", 0], ["IN_PROGRESS", 0], ["WAITING_FOR_REQUESTER", 0], ["REOPENED", 4]]);
  });
});

describe("DASH-12 what is 'mine' is the session user's, and nothing the client sends changes it (AC-19, BR-37)", () => {
  let x: { id: number; cookie: string };
  let y: { id: number; cookie: string };
  const mine = { x: [] as number[], y: [] as number[] };
  const actions = { x: [] as number[], y: [] as number[] };

  beforeAll(async () => {
    x = await newUser("IT_STAFF", "meX");
    y = await newUser("IT_STAFF", "meY");
    const now = Date.now();
    for (const minutesAgo of [30, 20, 10]) mine.x.unshift(await makeTicket({ ownerId: x.id, updatedAt: new Date(now - minutesAgo * MINUTE) }));
    mine.y.push(await makeTicket({ ownerId: y.id, updatedAt: new Date(now - 5 * MINUTE) }));
    await makeTicket({ ownerId: x.id, status: "RESOLVED" });
    actions.x.push(await makeAction(mine.x[0], x.id, { createdAt: new Date(now - 4 * MINUTE) }));
    actions.x.unshift(await makeAction(mine.x[1], x.id, { createdAt: new Date(now - 3 * MINUTE) }));
    actions.y.push(await makeAction(mine.y[0], y.id, { createdAt: new Date(now - 2 * MINUTE) }));
  });

  it("gives two IT Staff members different 'mine' figures, each exactly their own", async () => {
    const [a, b] = [await board(x.cookie), await board(y.cookie)];
    expect(a.body.metrics.assignedToMe.value).toBe(3);
    expect(b.body.metrics.assignedToMe.value).toBe(1);
    expect(a.body.myTickets.map((t: Row) => t.id)).toEqual(mine.x);
    expect(b.body.myTickets.map((t: Row) => t.id)).toEqual(mine.y);
    expect(a.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual(actions.x);
    expect(b.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual(actions.y);
  });

  it("agrees with the independent queries for each", async () => {
    for (const who of [x, y]) {
      const res = await board(who.cookie);
      expect(res.body.metrics.assignedToMe.value).toBe((await cardsOf(who.id)).assignedToMe);
      expect(res.body.myTickets.map((t: Row) => t.id)).toEqual(await myTicketIds(who.id));
      expect(res.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual(await myActionIds(who.id));
    }
  });

  it("ignores a me, userId, owner, or requesterId in the query and an X-User-Id header naming the other member", async () => {
    const plain = await board(x.cookie);
    const trying = await board(x.cookie, `?me=${y.id}&userId=${y.id}&owner=${y.id}&requesterId=${y.id}`, { "X-User-Id": String(y.id), "X-Requester-Id": String(y.id) });
    expect(trying.status).toBe(200);
    const { generatedAt: _a, ...left } = plain.body;
    const { generatedAt: _b, ...right } = trying.body;
    expect(right).toEqual(left);
  });

  it.each([
    ["group", "?group=open"],
    ["status", "?status=NEW"],
    ["itPriority", "?itPriority=URGENT"],
    ["limit", "?limit=1"],
    ["a made-up parameter", "?nothing=at-all"],
    ["a repeated parameter", "?group=open&group=open"],
    ["an unknown group", "?group=nonsense"],
  ])("takes no parameters, so %s changes nothing, and is not an error (api-spec §4)", async (_name, query) => {
    const plain = await board(cookies.staffA);
    const trying = await board(cookies.staffA, query);
    expect(trying.status).toBe(200);
    const { generatedAt: _a, ...left } = plain.body;
    const { generatedAt: _b, ...right } = trying.body;
    expect(right).toEqual(left);
  });

  it("makes an Administrator's 'mine' their own, as they act as IT Staff (BR-42)", async () => {
    const admin = await newUser("ADMINISTRATOR", "meAdmin");
    const id = await makeTicket({ ownerId: admin.id });
    const res = await board(admin.cookie);
    expect(res.body.metrics.assignedToMe.value).toBe(1);
    expect(res.body.myTickets.map((t: Row) => t.id)).toEqual([id]);
  });
});

describe("DASH-13 an IT Staff member with no work gets zeros and empty lists (AC-19, BR-39)", () => {
  it("is the case for a brand new member: 0 on 'mine', and 'mine' lists empty, the cards and the status row still there", async () => {
    const fresh = await newUser("IT_STAFF", "idleNew");
    const res = await board(fresh.cookie);
    expect(res.status).toBe(200);
    expect(res.body.metrics.assignedToMe).toEqual({ value: 0, href: CARD_HREF.assignedToMe });
    expect(res.body.myTickets).toEqual([]);
    expect(res.body.myRecentActions).toEqual([]);
    expect(Object.keys(res.body.metrics)).toEqual([...CARDS]);
    expect(res.body.byStatus).toHaveLength(5);
  });

  it("is the case for the seeded idle.it@toktickit.local, who owns nothing and has recorded nothing", async () => {
    expect(await myTicketIds(ids.idle)).toEqual([]);
    expect(await myActionIds(ids.idle)).toEqual([]);
    const res = await board(cookies.idle);
    expect(res.body.metrics.assignedToMe.value).toBe(0);
    expect(res.body.myTickets).toEqual([]);
    expect(res.body.myRecentActions).toEqual([]);
  });
});

describe("DASH-14 the three lists are bounded, ordered as the specification says, and short (AC-19, BR-36)", () => {
  let me: { id: number; cookie: string };
  const expected = { mine: [] as number[], urgent: [] as number[], actions: [] as number[] };

  beforeAll(async () => {
    me = await newUser("IT_STAFF", "lists");
    const now = Date.now();
    // Seven open Tickets of mine; the two newest share one instant, inside the five that are shown,
    // so the id breaks a tie that matters.
    const mine: number[] = [];
    for (const minutesAgo of [50, 40, 30, 20, 10, 5, 5]) mine.push(await makeTicket({ ownerId: me.id, updatedAt: new Date(now - minutesAgo * MINUTE) }));
    // Not mine to list: resolved, cancelled, and someone else's.
    await makeTicket({ ownerId: me.id, status: "RESOLVED", updatedAt: new Date(now) });
    await makeTicket({ ownerId: me.id, status: "CANCELLED", updatedAt: new Date(now) });
    await makeTicket({ ownerId: ids.staffA, updatedAt: new Date(now + MINUTE) });
    // Newest of mine first, a tie going to the higher id: the two at 5 minutes (the later-made first), then 10, 20, and 30.
    expected.mine = [mine[6], mine[5], mine[4], mine[3], mine[2]];

    // Urgent: older than anything else in the database, two of them created at the same instant.
    const oldest = new Date("2001-01-01T00:00:00.000Z");
    const urgent: number[] = [];
    for (const [i, offset] of [[0, 0], [1, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5]] as const) {
      void i;
      urgent.push(await makeTicket({ ownerId: i % 2 === 0 ? null : ids.staffB, itPriority: "URGENT", createdAt: new Date(oldest.getTime() + offset * DAY) }));
    }
    // Excluded though urgent and old: cancelled, resolved. And old but not urgent.
    await makeTicket({ itPriority: "URGENT", status: "CANCELLED", createdAt: new Date(oldest.getTime() - DAY) });
    await makeTicket({ itPriority: "URGENT", status: "RESOLVED", createdAt: new Date(oldest.getTime() - DAY) });
    await makeTicket({ itPriority: "HIGH", createdAt: new Date(oldest.getTime() - DAY) });
    expected.urgent = urgent.slice(0, 5);

    // Seven actions of mine, two sharing the newest instant; one of someone else's, newer still.
    const home = mine[0];
    const newest = new Date(now - MINUTE);
    const made: number[] = [];
    for (const minutesAgo of [90, 80, 70, 60, 50]) made.push(await makeAction(home, me.id, { createdAt: new Date(now - minutesAgo * MINUTE) }));
    made.push(await makeAction(home, me.id, { createdAt: newest }));
    made.push(await makeAction(home, me.id, { createdAt: newest }));
    await makeAction(home, ids.staffB, { createdAt: new Date(now) });
    expected.actions = [made[6], made[5], made[4], made[3], made[2]];
  });

  it("holds at most five of each, though there are seven of mine, seven urgent, and seven actions", async () => {
    const res = await board(me.cookie);
    expect(res.body.myTickets).toHaveLength(5);
    expect(res.body.urgentTickets).toHaveLength(5);
    expect(res.body.myRecentActions).toHaveLength(5);
  });

  it("puts My Tickets newest change first, a tie going to the higher id, and only open Tickets of mine", async () => {
    const res = await board(me.cookie);
    expect(res.body.myTickets.map((t: Row) => t.id)).toEqual(expected.mine);
    for (const t of res.body.myTickets as Row[]) {
      expect(OPEN_GROUP).toContain(t.currentStatus);
      expect(t.owner?.id).toBe(me.id);
    }
  });

  it("puts Urgent Tickets oldest first, a tie going to the lower id, from every owner and none, never a cancelled or resolved one", async () => {
    const res = await board(me.cookie);
    expect(res.body.urgentTickets.map((t: Row) => t.id)).toEqual(expected.urgent);
    for (const t of res.body.urgentTickets as Row[]) {
      expect(t.itPriority).toBe("URGENT");
      expect(OPEN_GROUP).toContain(t.currentStatus);
    }
  });

  it("puts My Recent Actions in the order they were recorded, newest first, a tie going to the higher id, and only mine", async () => {
    const res = await board(me.cookie);
    expect(res.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual(expected.actions);
  });

  it("orders My Recent Actions by when they were recorded, not by the date typed on them: one recorded later with an earlier date is still first (BR-36)", async () => {
    const mine = await newUser("IT_STAFF", "backdated");
    const ticket = await makeTicket({ ownerId: mine.id });
    const now = Date.now();
    // Recorded first, but dated an hour ago... and recorded second, but dated three days ago.
    const first = await prisma.actionTaken.create({
      data: { ticketId: ticket, performedById: mine.id, actionAt: new Date(now - 60 * MINUTE), createdAt: new Date(now - 2 * MINUTE), description: "Recorded first.", result: "Done.", followUpRequired: false },
    });
    const second = await prisma.actionTaken.create({
      data: { ticketId: ticket, performedById: mine.id, actionAt: new Date(now - 3 * DAY), createdAt: new Date(now - MINUTE), description: "Recorded second, dated earlier.", result: "Done.", followUpRequired: false },
    });
    const res = await board(mine.cookie);
    expect(res.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual([second.id, first.id]);
    // The independent query orders by the same column, so this also pins what "recorded" means.
    expect(await myActionIds(mine.id)).toEqual([second.id, first.id]);
  });

  it("agrees with the lists an independent query asks the database for", async () => {
    const res = await board(me.cookie);
    expect(res.body.myTickets.map((t: Row) => t.id)).toEqual(await myTicketIds(me.id));
    expect(res.body.urgentTickets.map((t: Row) => t.id)).toEqual(await urgentTicketIds());
    expect(res.body.myRecentActions.map((r: ActionRow) => r.id)).toEqual(await myActionIds(me.id));
  });

  it("agrees with them for the seeded staff too, whose lists are long", async () => {
    for (const who of ["staffA", "staffB", "admin"]) {
      const res = await board(cookies[who]);
      expect(res.body.myTickets.map((t: Row) => t.id), who).toEqual(await myTicketIds(ids[who]));
      expect(res.body.myRecentActions.map((r: ActionRow) => r.id), who).toEqual(await myActionIds(ids[who]));
      expect(res.body.urgentTickets.map((t: Row) => t.id), who).toEqual(await urgentTicketIds());
    }
  });

  it("gives each Ticket row exactly the concise fields, plus IT Priority and the owner, never a description or a requester", async () => {
    const res = await board(me.cookie);
    for (const row of [...res.body.myTickets, ...res.body.urgentTickets] as Row[]) {
      expect(Object.keys(row).sort()).toEqual(["currentStatus", "id", "itPriority", "owner", "summary", "ticketNumber", "updatedAt"]);
      if (row.owner) expect(Object.keys(row.owner).sort()).toEqual(["fullName", "id", "isActive"]);
    }
    expect(res.body.urgentTickets.some((t: Row) => t.owner === null)).toBe(true);
    expect(res.body.urgentTickets.some((t: Row) => t.owner !== null)).toBe(true);
  });

  it("gives each action row exactly the five documented fields and the Ticket's number", async () => {
    const res = await board(me.cookie);
    for (const row of res.body.myRecentActions as ActionRow[]) {
      expect(Object.keys(row).sort()).toEqual(["actionAt", "description", "followUpRequired", "id", "ticketId", "ticketNumber"]);
      expect(row.ticketNumber).toMatch(/^TT-9996-/);
    }
  });

  it("marks the Owner of an urgent Ticket as inactive when their account is, so the screen can say so", async () => {
    const gone = await newUser("IT_STAFF", "gone", false);
    const id = await makeTicket({ ownerId: gone.id, itPriority: "URGENT", createdAt: new Date("2000-06-01T00:00:00.000Z") });
    const res = await board(me.cookie);
    const row = (res.body.urgentTickets as Row[]).find((t) => t.id === id)!;
    expect(row.owner).toEqual({ id: gone.id, fullName: "Staff dashboard suite gone", isActive: false });
  });
});

describe("DASH-14 (continued) a long description is cut at 120 characters with an ellipsis (BR-36, api-spec §4.2)", () => {
  it("leaves a description of 119 and of exactly 120 characters whole", () => {
    expect(cutDescription("a".repeat(119))).toBe("a".repeat(119));
    expect(cutDescription("a".repeat(120))).toBe("a".repeat(120));
  });

  it("cuts one of 121 characters to the first 120 and an ellipsis", () => {
    expect(cutDescription("b".repeat(121))).toBe("b".repeat(120) + "…");
    expect(cutDescription("c".repeat(5000))).toBe("c".repeat(120) + "…");
  });

  it("counts characters, not code units: an emoji at the boundary is kept whole or left out, never split", () => {
    const text = "a".repeat(119) + "😀" + "z".repeat(40);
    const cut = cutDescription(text);
    expect(cut).toBe("a".repeat(119) + "😀" + "…");
    expect(Array.from(cut.slice(0, -1))).toHaveLength(120);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("keeps whatever whitespace and line breaks the text has, as the Ticket has them", () => {
    expect(cutDescription("two\nlines")).toBe("two\nlines");
  });

  it("is what the API returns for a long action, and the full text is still on the Ticket", async () => {
    const me = await newUser("IT_STAFF", "cut");
    const ticket = await makeTicket({ ownerId: me.id });
    const long = "Replaced the toner cartridge and ran a test page, then checked the paper tray, the fuser, and the rollers one after another. ".repeat(3);
    const short = "Rebooted the print server.";
    await makeAction(ticket, me.id, { description: short, createdAt: new Date(Date.now() - 2 * MINUTE) });
    await makeAction(ticket, me.id, { description: long, createdAt: new Date(Date.now() - MINUTE) });
    const res = await board(me.cookie);
    expect(res.body.myRecentActions.map((r: ActionRow) => r.description)).toEqual([long.slice(0, 120) + "…", short]);
    expect((await prisma.actionTaken.findMany({ where: { ticketId: ticket }, orderBy: { id: "asc" } }))[1].description).toBe(long);
  });

  it("says whether the action needs follow-up, as the pill will", async () => {
    const me = await newUser("IT_STAFF", "pill");
    const ticket = await makeTicket({ ownerId: me.id });
    await makeAction(ticket, me.id, { followUpRequired: true, createdAt: new Date(Date.now() - MINUTE) });
    await makeAction(ticket, me.id, { followUpRequired: false, createdAt: new Date(Date.now() - 2 * MINUTE) });
    const res = await board(me.cookie);
    expect(res.body.myRecentActions.map((r: ActionRow) => r.followUpRequired)).toEqual([true, false]);
  });
});

describe("DASH-15 a Cancelled Ticket is in no open count (AC-19, BR-31)", () => {
  it("leaves out a Cancelled Ticket with no owner, a Cancelled urgent one, and a Cancelled one of mine, from every card, row, and list", async () => {
    const me = await newUser("IT_STAFF", "cancel");
    const before = await board(me.cookie);
    await makeTicket({ ownerId: null, status: "CANCELLED" });
    await makeTicket({ ownerId: null, status: "CANCELLED", itPriority: "URGENT", createdAt: new Date("1999-01-01T00:00:00.000Z") });
    await makeTicket({ ownerId: me.id, status: "CANCELLED", itPriority: "URGENT" });
    const after = await board(me.cookie);
    const { generatedAt: _a, ...left } = before.body;
    const { generatedAt: _b, ...right } = after.body;
    expect(right).toEqual(left);
    expect(after.body.myTickets).toEqual([]);
  });

  it("keeps a Cancelled Ticket out even when it is the oldest urgent one", async () => {
    const id = await makeTicket({ status: "CANCELLED", itPriority: "URGENT", createdAt: new Date("1998-01-01T00:00:00.000Z") });
    const res = await board(cookies.staffA);
    expect((res.body.urgentTickets as Row[]).map((t) => t.id)).not.toContain(id);
  });
});

describe("DASH-16 only an Administrator receives the account counts, and they are plain numbers (AC-20, BR-38, BR-40)", () => {
  it("gives an Administrator four numbers equal to the user table, and nothing else in each", async () => {
    const res = await board(cookies.admin);
    expect(Object.keys(res.body.userCounts)).toEqual(["activeRequesters", "activeItStaff", "activeAdministrators", "inactive"]);
    const expected = await accountsNow();
    for (const [name, entry] of Object.entries(res.body.userCounts as Record<string, Record<string, number>>)) {
      expect(Object.keys(entry), name).toEqual(["value"]);
      expect(entry.value, name).toBe(expected[name as keyof typeof expected]);
    }
  });

  it("has no href anywhere in the account counts, so nothing can be followed for them", async () => {
    const res = await board(cookies.admin);
    expect(JSON.stringify(res.body.userCounts)).not.toMatch(/href|\/users/);
  });

  it("gives IT Staff no userCounts key at all, not an empty one", async () => {
    const res = await board(cookies.staffA);
    expect(res.status).toBe(200);
    expect("userCounts" in res.body).toBe(false);
    expect(Object.keys(res.body).sort()).toEqual(["byStatus", "generatedAt", "metrics", "myRecentActions", "myTickets", "urgentTickets"]);
  });

  it("follows the user table: a new active staff member, administrator, and an inactive account each move one number", async () => {
    const before = (await board(cookies.admin)).body.userCounts;
    await newUser("IT_STAFF", "countStaff");
    await newUser("ADMINISTRATOR", "countAdmin");
    await newUser("REQUESTER", "countInactive", false);
    const after = (await board(cookies.admin)).body.userCounts;
    expect(after.activeItStaff.value - before.activeItStaff.value).toBe(1);
    expect(after.activeAdministrators.value - before.activeAdministrators.value).toBe(1);
    expect(after.inactive.value - before.inactive.value).toBe(1);
    expect(after.activeRequesters.value - before.activeRequesters.value).toBe(0);
  });

  it("counts an inactive account in 'inactive' only, whatever its role", async () => {
    const before = (await board(cookies.admin)).body.userCounts;
    await newUser("IT_STAFF", "inactiveStaff", false);
    const after = (await board(cookies.admin)).body.userCounts;
    expect(after.inactive.value - before.inactive.value).toBe(1);
    expect(after.activeItStaff.value).toBe(before.activeItStaff.value);
  });
});

describe("DASH-17 every link goes to a list that shows exactly the number on its card (AC-21, BR-40)", () => {
  /** The staff queue takes the route's own query string. */
  const queueOf = (href: string) => {
    const url = new URL(href, "http://client.invalid");
    expect(url.pathname).toBe("/queue");
    return url.search.slice(1);
  };

  const callers = async () => {
    const busy = await newUser("IT_STAFF", "links");
    for (const status of ["OPEN", "WAITING_FOR_REQUESTER", "NEW", "REOPENED", "CANCELLED"] as const) await makeTicket({ ownerId: busy.id, status, itPriority: status === "NEW" ? "URGENT" : "MEDIUM" });
    const fresh = await newUser("IT_STAFF", "linksFresh");
    return [["staffA", cookies.staffA], ["staffB", cookies.staffB], ["admin", cookies.admin], ["idle", cookies.idle], ["busy", busy.cookie], ["fresh", fresh.cookie]] as const;
  };

  it("opens, for each of the four cards and the five status rows of each caller, a queue whose total equals the value", async () => {
    for (const [who, cookie] of await callers()) {
      const res = await board(cookie);
      for (const card of CARDS) {
        const list = await request(app).get(`/api/staff/tickets?${queueOf(res.body.metrics[card].href)}&pageSize=50`).set("Cookie", cookie);
        expect(list.status, `${who} ${card}`).toBe(200);
        expect(list.body.totalItems, `${who} ${card}`).toBe(res.body.metrics[card].value);
      }
      for (const row of res.body.byStatus as Array<{ status: string; value: number; href: string }>) {
        const list = await request(app).get(`/api/staff/tickets?${queueOf(row.href)}&pageSize=50`).set("Cookie", cookie);
        expect(list.status, `${who} ${row.status}`).toBe(200);
        expect(list.body.totalItems, `${who} ${row.status}`).toBe(row.value);
      }
    }
  });

  it("opens, for every row of the Ticket lists and every action, a Ticket the caller can read, with the same number", async () => {
    for (const [who, cookie] of await callers()) {
      const res = await board(cookie);
      for (const row of [...res.body.myTickets, ...res.body.urgentTickets] as Row[]) {
        const detail = await request(app).get(`/api/staff/tickets/${row.id}`).set("Cookie", cookie);
        expect(detail.status, `${who} ${row.ticketNumber}`).toBe(200);
        expect(detail.body.ticket.ticketNumber).toBe(row.ticketNumber);
      }
      for (const action of res.body.myRecentActions as ActionRow[]) {
        const detail = await request(app).get(`/api/staff/tickets/${action.ticketId}`).set("Cookie", cookie);
        expect(detail.status, `${who} action ${action.id}`).toBe(200);
        expect(detail.body.ticket.ticketNumber).toBe(action.ticketNumber);
      }
    }
  });

  it("has an href on every card and status row, and on nothing else", async () => {
    const res = await board(cookies.admin);
    for (const card of CARDS) expect(Object.keys(res.body.metrics[card]).sort()).toEqual(["href", "value"]);
    expect(JSON.stringify(res.body.userCounts)).not.toContain("href");
  });
});

describe("DASH-18 group=open on the Ticket Queue (AC-21, BR-31, api-spec §5.1)", () => {
  const queue = (query: string, cookie = cookies.staffA) => request(app).get(`/api/staff/tickets?${query}&pageSize=50`).set("Cookie", cookie);

  it("alone, lists the five open statuses and nothing else, as many as the database has", async () => {
    const res = await queue("group=open");
    expect(res.status).toBe(200);
    const expected = await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket" WHERE "currentStatus"::text = ANY(${OPEN_GROUP}::text[])`);
    expect(res.body.totalItems).toBe(expected);
    for (const t of res.body.tickets as Array<{ currentStatus: string }>) expect(OPEN_GROUP).toContain(t.currentStatus);
  });

  it("with a status inside the group, lists that status only", async () => {
    const res = await queue("group=open&status=WAITING_FOR_REQUESTER");
    expect(res.body.totalItems).toBe(await statusCount("WAITING_FOR_REQUESTER"));
  });

  it("with a status outside the group, is an empty list and not an error, for each of the three", async () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"]) {
      const res = await queue(`group=open&status=${status}`);
      expect(res.status, status).toBe(200);
      expect(res.body.tickets, status).toEqual([]);
      expect(res.body.totalItems, status).toBe(0);
    }
  });

  it("combines with the owner and IT priority by AND, as the cards' links do", async () => {
    const unassigned = await queue("group=open&owner=unassigned");
    expect(unassigned.body.totalItems).toBe((await cardsOf(ids.staffA)).unassigned);
    const mine = await queue("group=open&owner=me");
    expect(mine.body.totalItems).toBe((await cardsOf(ids.staffA)).assignedToMe);
    const urgent = await queue("group=open&itPriority=URGENT");
    expect(urgent.body.totalItems).toBe((await cardsOf(ids.staffA)).urgent);
  });

  it("resolves owner=me against the caller's own session, so two members see two lists", async () => {
    const a = await queue("group=open&owner=me", cookies.staffA);
    const b = await queue("group=open&owner=me", cookies.staffB);
    expect(a.body.totalItems).toBe((await cardsOf(ids.staffA)).assignedToMe);
    expect(b.body.totalItems).toBe((await cardsOf(ids.staffB)).assignedToMe);
  });

  it("is 400 INVALID_QUERY when it is repeated, and when it is unknown, with no ticket data in the answer", async () => {
    for (const query of ["group=open&group=open", "group=closed", "group=OPEN", "group=open,closed"]) {
      const res = await queue(query);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code, query).toBe("INVALID_QUERY");
      expect(Object.keys(res.body), query).toEqual(["error"]);
    }
  });

  it("leaves every request without it exactly as it was: all eight statuses", async () => {
    const res = await queue("");
    expect(res.body.totalItems).toBe(await one(prisma.$queryRaw`SELECT count(*)::bigint AS n FROM "Ticket"`));
  });
});

describe("DASH-19 a Requester and nobody are refused the staff dashboard (AC-20, BR-43)", () => {
  it("is 403 FORBIDDEN for a Requester, with nothing else in the body", async () => {
    const res = await board(cookies.requester);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(Object.keys(res.body)).toEqual(["error"]);
  });

  it("is 401 AUTH_REQUIRED with no session, and with a cookie that names no session, before it is 403 for the wrong role", async () => {
    for (const cookie of [undefined, "tt_sid=not-a-session"]) {
      const res = await board(cookie);
      expect(res.status, String(cookie)).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("is refused to a staff member who must still change their password", async () => {
    const user = await prisma.user.create({
      data: {
        fullName: "Staff dashboard suite first login",
        email: `sdash.firstlogin.${Date.now().toString(36)}@example.test`,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
        passwordHash: await hashPassword(SEED_PASSWORD),
      },
    });
    extraUserIds.push(user.id);
    const res = await board(await signInAs(user.id));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(res.body.metrics).toBeUndefined();
  });
});

describe("DASH-10 (continued) the response is short, and has exactly the documented keys (FR-19, BR-30)", () => {
  it("has only generatedAt, metrics, byStatus, myTickets, urgentTickets, myRecentActions, and, for an Administrator, userCounts", async () => {
    const res = await board(cookies.admin);
    expect(Object.keys(res.body).sort()).toEqual(["byStatus", "generatedAt", "metrics", "myRecentActions", "myTickets", "urgentTickets", "userCounts"]);
  });

  it("gives each card only a non-negative whole number and an href", async () => {
    const res = await board(cookies.staffA);
    for (const card of CARDS) {
      expect(Number.isInteger(res.body.metrics[card].value), card).toBe(true);
      expect(res.body.metrics[card].value, card).toBeGreaterThanOrEqual(0);
    }
  });

  it("bounds every list at five, for the staff member with the most work", async () => {
    const res = await board(cookies.staffA);
    for (const list of ["myTickets", "urgentTickets", "myRecentActions"]) expect(res.body[list].length, list).toBeLessThanOrEqual(5);
  });

  it("is generated now, as an ISO 8601 UTC instant, and is never cached", async () => {
    const before = Date.now();
    const res = await board(cookies.staffA);
    expect(res.body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(res.body.generatedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(res.body.generatedAt)).toBeLessThanOrEqual(Date.now() + 1000);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
  });

  it("has no write route: a POST, PATCH, or DELETE is the unknown-route 404 and changes nothing", async () => {
    for (const method of ["post", "patch", "delete"] as const) {
      const res = await request(app)[method]("/api/staff/dashboard").set("Cookie", cookies.staffA).send({});
      expect(res.status, method).toBe(404);
    }
  });

  it("does not shadow the staff Ticket routes beside it", async () => {
    const res = await request(app).get("/api/staff/tickets?pageSize=10").set("Cookie", cookies.staffA);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tickets)).toBe(true);
  });
});
