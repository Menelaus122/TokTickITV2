import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 9 — the performance smoke check (PERF-01 to PERF-03 in docs/lab-04/tests.md §2.7;
// specification.md BR-56, D-16, AC-32). Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// BR-56: on the seed data, each of the Requester dashboard, the IT Staff dashboard, and the Ticket
// Queue's first page answers 20 consecutive requests with no response slower than 1000 ms.
//
// D-16 is plain about what this is: a smoke check that catches an accidental N+1 or a missing index,
// not a benchmark and not a load test, so no claim is made beyond it. Each request waits for the
// last, and each is timed from the moment it is sent to the moment its body has been read.

const prisma = getPrisma();

const REQUESTS = 20;
const LIMIT_MS = 1000;

interface Timing {
  durations: number[];
  slowest: number;
  statuses: number[];
}

/** Sends `count` requests one after the other, and times each. */
async function timeRequests(count: number, send: () => PromiseLike<{ status: number }>): Promise<Timing> {
  const durations: number[] = [];
  const statuses: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const started = performance.now();
    const res = await send();
    durations.push(performance.now() - started);
    statuses.push(res.status);
  }
  return { durations, slowest: Math.max(...durations), statuses };
}

const summary = (timing: Timing) =>
  `slowest ${timing.slowest.toFixed(0)} ms of ${timing.durations.length}; ` +
  `all ${timing.durations.map((ms) => ms.toFixed(0)).join(", ")} ms`;

let requesterCookie: string;
let staffCookie: string;
let adminCookie: string;

beforeAll(async () => {
  // The seeded accounts that have the most to show: a Requester with Tickets, and the IT Staff member who owns the most.
  const owners = await prisma.ticket.groupBy({ by: ["ownerId"], where: { ownerId: { not: null } }, _count: { _all: true }, orderBy: { _count: { ownerId: "desc" } } });
  const requesters = await prisma.ticket.groupBy({ by: ["requesterId"], _count: { _all: true }, orderBy: { _count: { requesterId: "desc" } } });
  const requester = await prisma.user.findFirstOrThrow({
    where: { id: { in: requesters.map((r) => r.requesterId) }, role: "REQUESTER", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
  });
  const staff = await prisma.user.findFirstOrThrow({
    where: { id: { in: owners.map((o) => o.ownerId!) }, role: "IT_STAFF", isActive: true, mustChangePassword: false },
    orderBy: { id: "asc" },
  });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } });
  requesterCookie = await signInAs(requester.id);
  staffCookie = await signInAs(staff.id);
  adminCookie = await signInAs(admin.id);
});

afterAll(async () => {
  await endTestSessions();
  await prisma.$disconnect();
});

describe("PERF-00 the measure itself notices a slow answer, so a pass below means something", () => {
  const slowApp = express();
  slowApp.get("/slow", (_req, res) => setTimeout(() => res.json({ ok: true }), LIMIT_MS + 150));
  slowApp.get("/fast", (_req, res) => res.json({ ok: true }));

  it("reports an answer slower than the limit as slower than the limit", async () => {
    const timing = await timeRequests(2, () => request(slowApp).get("/slow"));
    expect(timing.slowest).toBeGreaterThan(LIMIT_MS);
  });

  it("reports a quick answer as quick, and counts every request it was asked for", async () => {
    const timing = await timeRequests(REQUESTS, () => request(slowApp).get("/fast"));
    expect(timing.durations).toHaveLength(REQUESTS);
    expect(timing.slowest).toBeLessThan(LIMIT_MS);
  });
});

describe("PERF-01 to PERF-03 each dashboard and the queue's first page answer 20 requests in a row, none over 1000 ms (BR-56, AC-32)", () => {
  it("PERF-01: the Requester dashboard", async () => {
    // A request that is refused is fast and proves nothing: the first one must be the real answer.
    const first = await request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie);
    expect(first.status).toBe(200);
    expect(first.body.recentTickets.length).toBeGreaterThan(0);

    const timing = await timeRequests(REQUESTS, () => request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie));
    expect(timing.statuses.every((status) => status === 200), `statuses ${timing.statuses.join(",")}`).toBe(true);
    expect(timing.durations).toHaveLength(REQUESTS);
    expect(timing.slowest, summary(timing)).toBeLessThanOrEqual(LIMIT_MS);
  });

  it("PERF-02: the IT Staff dashboard, and the Administrator's with its account counts", async () => {
    const first = await request(app).get("/api/staff/dashboard").set("Cookie", staffCookie);
    expect(first.status).toBe(200);
    expect(first.body.myTickets.length).toBeGreaterThan(0);

    const timing = await timeRequests(REQUESTS, () => request(app).get("/api/staff/dashboard").set("Cookie", staffCookie));
    expect(timing.statuses.every((status) => status === 200), `statuses ${timing.statuses.join(",")}`).toBe(true);
    expect(timing.durations).toHaveLength(REQUESTS);
    expect(timing.slowest, summary(timing)).toBeLessThanOrEqual(LIMIT_MS);

    const administrator = await timeRequests(REQUESTS, () => request(app).get("/api/staff/dashboard").set("Cookie", adminCookie));
    expect(administrator.statuses.every((status) => status === 200), `statuses ${administrator.statuses.join(",")}`).toBe(true);
    expect(administrator.slowest, summary(administrator)).toBeLessThanOrEqual(LIMIT_MS);
  });

  it("PERF-03: the Ticket Queue's first page, unfiltered and with the dashboard's own drill-down filters", async () => {
    const first = await request(app).get("/api/staff/tickets").set("Cookie", staffCookie);
    expect(first.status).toBe(200);
    expect(first.body.tickets.length).toBeGreaterThan(0);
    expect(first.body.page).toBe(1);

    const timing = await timeRequests(REQUESTS, () => request(app).get("/api/staff/tickets").set("Cookie", staffCookie));
    expect(timing.statuses.every((status) => status === 200), `statuses ${timing.statuses.join(",")}`).toBe(true);
    expect(timing.durations).toHaveLength(REQUESTS);
    expect(timing.slowest, summary(timing)).toBeLessThanOrEqual(LIMIT_MS);

    for (const query of ["?group=open&owner=me", "?group=open&owner=unassigned", "?itPriority=URGENT&group=open", "?status=WAITING_FOR_REQUESTER", "?q=printer&sort=updatedAt&direction=asc"]) {
      const filtered = await timeRequests(REQUESTS, () => request(app).get(`/api/staff/tickets${query}`).set("Cookie", staffCookie));
      expect(filtered.statuses.every((status) => status === 200), `${query}: statuses ${filtered.statuses.join(",")}`).toBe(true);
      expect(filtered.slowest, `${query}: ${summary(filtered)}`).toBeLessThanOrEqual(LIMIT_MS);
    }
  });
});
