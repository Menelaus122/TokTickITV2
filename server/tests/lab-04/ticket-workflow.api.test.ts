import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 6 — the ticket workflow (WF-01 to WF-17, WF-19, and WF-20 in
// docs/lab-04/tests.md §2.4; specification.md BR-15 to BR-26, BR-29; api-spec §3).
// Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the
// real database. Every test makes its own tickets, so none depends on another's
// order, and afterAll removes them (their actions, history, and comments go with
// them).

const prisma = getPrisma();
const HOUR = 60 * 60 * 1000;

type Who = "requester" | "otherRequester" | "owner" | "colleague" | "admin";
const ids = {} as Record<Who, number>;
const cookies = {} as Record<Who, string>;
const ticketIds: number[] = [];
let categoryId: number;
let relatedSystemId: number;
let sequence = 0;
const numberBase = Date.now() % 80000;

// The matrix, written out independently of the code (BR-15).
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
const STATUSES = Object.keys(MATRIX) as TicketStatus[];
const PERMITTED_PAIRS = STATUSES.flatMap((from) => MATRIX[from].map((to) => [from, to] as const));
const NEEDS_REASON: TicketStatus[] = ["RESOLVED", "CANCELLED", "REOPENED"];
const REASON = "Replaced the toner and printed a test page.";

async function makeTicket(
  options: { status?: TicketStatus; ownerId?: number | null; requesterId?: number; createdAt?: Date } = {},
): Promise<number> {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9994-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId: options.requesterId ?? ids.requester,
      ownerId: options.ownerId === undefined ? ids.owner : options.ownerId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 workflow suite ticket",
      description: "Created by the Lab 4 workflow suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: options.status ?? "IN_PROGRESS",
      createdAt: options.createdAt ?? new Date(Date.now() - 24 * HOUR),
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

const detail = (id: number | string, who: Who = "owner") => request(app).get(`/api/staff/tickets/${id}`).set("Cookie", cookies[who]);
const patch = (id: number | string, action: "status" | "owner" | "it-priority", body: object, who: Who = "owner") =>
  request(app).patch(`/api/staff/tickets/${id}/${action}`).set("Cookie", cookies[who]).send(body);
const status = (id: number, to: TicketStatus, extra: object = {}, who: Who = "owner") =>
  patch(id, "status", { currentStatus: to, ...(NEEDS_REASON.includes(to) ? { reason: REASON } : {}), ...extra }, who);
const history = (id: number | string, who: Who = "owner") => request(app).get(`/api/tickets/${id}/status-history`).set("Cookie", cookies[who]);

/** Records an Action Taken through the API, as a person would. */
async function record(id: number, followUpRequired = false, who: Who = "owner", extra: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/staff/tickets/${id}/actions-taken`)
    .set("Cookie", cookies[who])
    .send({
      actionAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      description: "Replaced the toner cartridge and ran a test page.",
      result: "Test page printed cleanly.",
      followUpRequired,
      ...(followUpRequired ? { followUpNote: "Check the printer again on Thursday." } : {}),
      ...extra,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.action as { id: number; actionAt: string; version: number };
}

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

// ---------------------------------------------------------------------------
// What a Ticket can do right now
// ---------------------------------------------------------------------------

describe("WF-16 the detail lists the moves the Ticket can make now, and why the others are not available (AC-16, BR-17, api-spec §3.1)", () => {
  it.each(STATUSES)("%s: permitted and blocked together are exactly the matrix row, in the matrix's order", async (from) => {
    const id = await makeTicket({ status: from });
    const res = await detail(id);
    expect(res.status).toBe(200);
    const { permittedTransitions, blockedTransitions } = res.body.ticket;
    const together = [...permittedTransitions, ...blockedTransitions.map((b: { to: string }) => b.to)];
    expect(together.slice().sort()).toEqual(MATRIX[from].slice().sort());
    expect(MATRIX[from].filter((to) => permittedTransitions.includes(to))).toEqual(permittedTransitions);
    // An owned Ticket with no action: only RESOLVED is held back, by the gate.
    expect(blockedTransitions.map((b: { to: string }) => b.to)).toEqual(MATRIX[from].filter((to) => to === "RESOLVED"));
  });

  it("answers the blocked move with its code and a message safe to show", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const res = await detail(id);
    expect(res.body.ticket.blockedTransitions).toEqual([
      { to: "RESOLVED", code: "ACTION_REQUIRED", message: "Record at least one action before resolving this ticket." },
    ]);
    expect(res.body.ticket.permittedTransitions).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
  });

  it("moves RESOLVED into the permitted moves once an action with no follow-up is recorded, and out again when the latest needs one", async () => {
    const id = await makeTicket({ status: "WAITING_FOR_REQUESTER" });
    await record(id, false);
    expect((await detail(id)).body.ticket).toMatchObject({ permittedTransitions: ["IN_PROGRESS", "RESOLVED", "CANCELLED"], blockedTransitions: [] });

    await record(id, true);
    const pending = (await detail(id)).body.ticket;
    expect(pending.permittedTransitions).toEqual(["IN_PROGRESS", "CANCELLED"]);
    expect(pending.blockedTransitions).toEqual([
      {
        to: "RESOLVED",
        code: "FOLLOW_UP_PENDING",
        message: "The most recently recorded action still needs follow-up. Record the follow-up as a new action first.",
      },
    ]);
  });

  it("blocks RESOLVED as OWNER_REQUIRED on an unowned Ticket, ahead of the gate, and CLOSED on an unowned resolved one", async () => {
    const unowned = await makeTicket({ status: "IN_PROGRESS", ownerId: null });
    await record(unowned, false);
    expect((await detail(unowned)).body.ticket.blockedTransitions).toEqual([
      { to: "RESOLVED", code: "OWNER_REQUIRED", message: "Claim or assign the ticket before resolving or closing it." },
    ]);

    const resolved = await makeTicket({ status: "RESOLVED", ownerId: null });
    const res = (await detail(resolved)).body.ticket;
    expect(res.permittedTransitions).toEqual(["REOPENED"]);
    expect(res.blockedTransitions.map((b: { to: string; code: string }) => [b.to, b.code])).toEqual([["CLOSED", "OWNER_REQUIRED"]]);
  });

  it("carries the Ticket's version and the owner's role, and keeps every field Lab 3 returned", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const { ticket } = (await detail(id)).body;
    expect(ticket.version).toBe(1);
    expect(ticket.owner).toEqual({ id: ids.owner, fullName: expect.any(String), role: "IT_STAFF", isActive: true });
    for (const field of ["id", "ticketNumber", "summary", "description", "categoryName", "relatedSystemName", "requestedPriority", "itPriority", "currentStatus", "requesterResolvedAt", "createdAt", "updatedAt", "requester", "attachments"]) {
      expect(ticket, field).toHaveProperty(field);
    }
  });

  it("is the same for an Administrator as for IT Staff", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    expect((await detail(id, "admin")).body.ticket.blockedTransitions).toEqual((await detail(id, "owner")).body.ticket.blockedTransitions);
  });
});

// ---------------------------------------------------------------------------
// Moving a Ticket
// ---------------------------------------------------------------------------

describe("WF-01 every permitted transition succeeds, for IT Staff and for an Administrator (AC-11, BR-15, BR-16)", () => {
  it.each(["owner", "admin"] as const)("all %s: 15 pairs, each a 200 that moves the status, the version, and the history by one", async (who) => {
    expect(PERMITTED_PAIRS).toHaveLength(15);
    for (const [from, to] of PERMITTED_PAIRS) {
      const id = await makeTicket({ status: from });
      // The gate on RESOLVED is satisfied honestly: an action is recorded first.
      if (to === "RESOLVED") await record(id, false, who);
      const res = await status(id, to, {}, who);
      expect(res.status, `${from} -> ${to}: ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body.ticket, `${from} -> ${to}`).toMatchObject({ currentStatus: to, version: 2 });
      const rows = (await history(id, who)).body.history;
      expect(rows.map((r: { fromStatus: string; toStatus: string; changedBy: { id: number } }) => [r.fromStatus, r.toStatus, r.changedBy.id]), `${from} -> ${to}`).toEqual([[from, to, ids[who]]]);
    }
  });
});

describe("WF-02 every other pair, and a move to the current status, is refused as INVALID_TRANSITION (AC-11, BR-15)", () => {
  it("refuses the 49 pairs outside the matrix, leaving the status, the version, and the history alone", async () => {
    const refused = STATUSES.flatMap((from) => STATUSES.filter((to) => !MATRIX[from].includes(to)).map((to) => [from, to] as const));
    expect(refused).toHaveLength(49);
    for (const [from, to] of refused) {
      const id = await makeTicket({ status: from });
      const res = await status(id, to);
      expect(res.status, `${from} -> ${to}`).toBe(409);
      expect(res.body.error.code, `${from} -> ${to}`).toBe("INVALID_TRANSITION");
      expect((await detail(id)).body.ticket, `${from} -> ${to}`).toMatchObject({ currentStatus: from, version: 1 });
      expect((await history(id)).body.history, `${from} -> ${to}`).toEqual([]);
    }
  });
});

describe("WF-03 a Requester cannot change a status, and marking the problem resolved is only a signal (AC-11, AC-15, BR-16, BR-20)", () => {
  it("answers a Requester's call to each staff route with 403, and changes nothing", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    for (const [action, body] of [
      ["status", { currentStatus: "RESOLVED", reason: REASON }],
      ["status", { currentStatus: "CLOSED" }],
      ["owner", { ownerId: ids.requester }],
      ["it-priority", { itPriority: "URGENT" }],
    ] as const) {
      const res = await patch(id, action, body, "requester");
      expect(res.status, `${action} ${JSON.stringify(body)}`).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: "IN_PROGRESS", version: 1, itPriority: "MEDIUM" });
  });

  it("records the signal and leaves currentStatus alone, however the Requester words it", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const res = await request(app)
      .patch(`/api/tickets/${id}/appears-resolved`)
      .set("Cookie", cookies.requester)
      .send({ appearsResolved: true, comment: "It prints fine now, thank you.", currentStatus: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ currentStatus: "IN_PROGRESS" });
    expect(res.body.ticket.requesterResolvedAt).not.toBeNull();
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: "IN_PROGRESS" });
  });
});

describe("WF-04 to WF-06 the resolution gate, enforced by the API for every caller (AC-03, BR-17, BR-18, FR-10)", () => {
  it.each(["owner", "admin"] as const)("%s: RESOLVED on an owned Ticket with no action is 409 ACTION_REQUIRED, and nothing changes (WF-04, WF-06)", async (who) => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const res = await status(id, "RESOLVED", {}, who);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: "ACTION_REQUIRED", message: "Record at least one action before resolving this ticket." });
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: "IN_PROGRESS", version: 1 });
    expect((await history(id)).body.history).toEqual([]);
    // The reason that came with the refused move is not posted either.
    const comments = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookies.owner);
    expect(comments.body.comments).toEqual([]);
  });

  it.each(["owner", "admin"] as const)("%s: RESOLVED while the most recently recorded action needs follow-up is 409 FOLLOW_UP_PENDING; a closing action opens it (WF-05, WF-06)", async (who) => {
    const id = await makeTicket({ status: "WAITING_FOR_REQUESTER" });
    await record(id, true, who);
    const refused = await status(id, "RESOLVED", {}, who);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toEqual({
      code: "FOLLOW_UP_PENDING",
      message: "The most recently recorded action still needs follow-up. Record the follow-up as a new action first.",
    });
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: "WAITING_FOR_REQUESTER", version: 1 });

    await record(id, false, who);
    const moved = await status(id, "RESOLVED", {}, who);
    expect(moved.status).toBe(200);
    expect(moved.body.ticket.currentStatus).toBe("RESOLVED");
  });

  it("does not let an Action Taken recorded on another Ticket count", async () => {
    const mine = await makeTicket({ status: "IN_PROGRESS" });
    const theirs = await makeTicket({ status: "IN_PROGRESS" });
    await record(theirs, false);
    expect((await status(mine, "RESOLVED")).body.error.code).toBe("ACTION_REQUIRED");
  });
});

describe("WF-07 a reopened Ticket needs a new action before it can be resolved again (AC-12, BR-17, D-07)", () => {
  it("refuses the second resolve until an action is recorded after the reopen, then allows it", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    expect((await status(id, "REOPENED")).status).toBe(200);
    expect((await status(id, "IN_PROGRESS", {})).status).toBe(200);

    // The action that justified the first resolve came before the reopen, so it no longer counts.
    const again = await status(id, "RESOLVED");
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ACTION_REQUIRED");

    await record(id, false);
    const resolved = await status(id, "RESOLVED");
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
  });

  it("ignores an old Yes from before the reopen, and is held by a Yes recorded after it", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, true);
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    await status(id, "REOPENED");
    await status(id, "IN_PROGRESS");
    await record(id, true);
    expect((await status(id, "RESOLVED")).body.error.code).toBe("FOLLOW_UP_PENDING");
  });

  // Review of PR #87: the gate must date itself from the LAST reopen. A lookup that took the first one
  // would let an action recorded between two reopens justify a third resolve, which is exactly the
  // "resolved again on work done before it failed again" that D-07 exists to stop.
  it("dates the gate from the last reopen: an action recorded between two reopens does not justify the next resolve", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    expect((await status(id, "REOPENED")).status).toBe(200);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);

    // Recorded after the first reopen, so it justifies the second resolve...
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    // ...and the Ticket fails again.
    expect((await status(id, "REOPENED")).status).toBe(200);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);

    // That action now came before the latest reopen. Nothing has been done since.
    const third = await status(id, "RESOLVED");
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("ACTION_REQUIRED");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe("IN_PROGRESS");

    // The detail says the same, from the same lookup, so the screen and the API cannot differ.
    const shown = await detail(id);
    expect(shown.body.ticket.permittedTransitions).not.toContain("RESOLVED");
    expect(shown.body.ticket.blockedTransitions).toContainEqual(expect.objectContaining({ to: "RESOLVED", code: "ACTION_REQUIRED" }));

    // An action recorded after the second reopen is what opens it.
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
  });

  it("does not let a Yes recorded between two reopens hold the next resolve: after the second reopen the answer is ACTION_REQUIRED", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    expect((await status(id, "REOPENED")).status).toBe(200);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);

    // After the first reopen a Yes holds the gate, as WF-05 says...
    await record(id, true);
    expect((await status(id, "RESOLVED")).body.error.code).toBe("FOLLOW_UP_PENDING");
    // ...until a closing action follows it.
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
    expect((await status(id, "REOPENED")).status).toBe(200);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);

    // The Yes, and the closing action after it, are both before the second reopen now: neither counts.
    const third = await status(id, "RESOLVED");
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("ACTION_REQUIRED");
  });

  it("treats a legacy Reopened Ticket, with no history row to date the reopen from, as never reopened", async () => {
    const id = await makeTicket({ status: "REOPENED" });
    expect((await history(id)).body.history).toEqual([]);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);
    // It has no action at all, so the gate still asks for one; with one, it passes.
    expect((await status(id, "RESOLVED")).body.error.code).toBe("ACTION_REQUIRED");
    await record(id, false);
    expect((await status(id, "RESOLVED")).status).toBe(200);
  });
});

describe("WF-08 a Requester's signal does not touch the gate (AC-15, BR-20, FR-11)", () => {
  it("leaves the status alone and still answers ACTION_REQUIRED for a Ticket with no action", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const marked = await request(app)
      .patch(`/api/tickets/${id}/appears-resolved`)
      .set("Cookie", cookies.requester)
      .send({ appearsResolved: true, comment: "It prints fine now, thank you." });
    expect(marked.status).toBe(200);

    expect((await detail(id)).body.ticket.currentStatus).toBe("IN_PROGRESS");
    const res = await status(id, "RESOLVED");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACTION_REQUIRED");
    expect((await detail(id)).body.ticket.blockedTransitions.map((b: { code: string }) => b.code)).toEqual(["ACTION_REQUIRED"]);
  });
});

describe("WF-14 the order the checks run in (AC-11, BR-24)", () => {
  it("tells a stale request that is also a move the matrix refuses that it is stale", async () => {
    const id = await makeTicket({ status: "OPEN" });
    // Someone changes it first, so version 1 is old; and OPEN -> RESOLVED is not in the matrix.
    await patch(id, "it-priority", { itPriority: "HIGH" }, "colleague");
    const res = await status(id, "RESOLVED", { expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_UPDATE");
  });

  it("refuses a malformed body before anything about the Ticket is looked at", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await patch(id, "it-priority", { itPriority: "HIGH" }, "colleague");
    const res = await patch(id, "status", { currentStatus: "IN_PROGRESS", expectedVersion: "1" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(["expectedVersion"]);
    const noReason = await patch(id, "status", { currentStatus: "CANCELLED", expectedVersion: 1 });
    expect(noReason.status).toBe(400);
    expect(Object.keys(noReason.body.error.fields)).toEqual(["reason"]);
  });

  it("tells an unowned, ungated request to claim the Ticket first", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS", ownerId: null });
    const res = await status(id, "RESOLVED");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OWNER_REQUIRED");
    // Claimed, the gate speaks next.
    await patch(id, "owner", { ownerId: ids.owner, expectedOwnerId: null });
    expect((await status(id, "RESOLVED")).body.error.code).toBe("ACTION_REQUIRED");
  });

  it("tells a move the matrix refuses it is invalid before it asks for an owner or an action", async () => {
    const id = await makeTicket({ status: "NEW", ownerId: null });
    expect((await status(id, "RESOLVED")).body.error.code).toBe("INVALID_TRANSITION");
    expect((await status(id, "CLOSED")).body.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("WF-15 the reason for RESOLVED, CANCELLED, and REOPENED is a Public Comment, written with the move (AC-11, BR-19)", () => {
  const cases: Array<[TicketStatus, TicketStatus]> = [["IN_PROGRESS", "RESOLVED"], ["OPEN", "CANCELLED"], ["CLOSED", "REOPENED"]];

  it.each(cases)("%s -> %s: 400 on reason without one of 5 to 2000 characters, and nothing changes", async (from, to) => {
    const id = await makeTicket({ status: from });
    if (to === "RESOLVED") await record(id, false);
    for (const reason of [undefined, "", "     ", "abcd", "x".repeat(2001), 12345]) {
      const res = await patch(id, "status", { currentStatus: to, ...(reason === undefined ? {} : { reason }) });
      expect(res.status, String(reason)).toBe(400);
      expect(Object.keys(res.body.error.fields), String(reason)).toEqual(["reason"]);
    }
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: from, version: 1 });
  });

  it.each(cases)("%s -> %s: posts the trimmed reason as a Public Comment by the person who moved it", async (from, to) => {
    const id = await makeTicket({ status: from });
    if (to === "RESOLVED") await record(id, false);
    const res = await patch(id, "status", { currentStatus: to, reason: `  ${REASON}  ` }, "colleague");
    expect(res.status).toBe(200);
    expect(res.body.comment).toMatchObject({ body: REASON, author: { id: ids.colleague } });
    const comments = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookies.requester);
    expect(comments.body.comments.map((c: { body: string }) => c.body)).toEqual([REASON]);
  });

  it("does not ask for a reason where Lab 3 did not, and posts none", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const res = await patch(id, "status", { currentStatus: "IN_PROGRESS", reason: "Not needed here, and not posted." });
    expect(res.status).toBe(200);
    expect(res.body.comment).toBeNull();
    const comments = await request(app).get(`/api/tickets/${id}/comments`).set("Cookie", cookies.requester);
    expect(comments.body.comments).toEqual([]);
  });
});

describe("WF-19 the gate follows the order actions were recorded in, not the dates typed on them (AC-03, AC-10, BR-08, BR-17)", () => {
  it("holds RESOLVED on a backdated Yes whatever any Action Date/Time is edited to, and opens when a closing action is recorded", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const t = Date.now();
    // #1 is recorded first, dated three hours ago, and needs nothing. #2 is recorded after it, dated FIVE
    // hours ago (earlier), and needs follow-up. The list shows #2 first; the gate reads #2 as the latest.
    const first = await record(id, false, "owner", { actionAt: new Date(t - 3 * HOUR).toISOString() });
    const second = await record(id, true, "owner", { actionAt: new Date(t - 5 * HOUR).toISOString() });
    const order = async () => ((await request(app).get(`/api/tickets/${id}/actions-taken`).set("Cookie", cookies.owner)).body.actions as Array<{ id: number }>).map((a) => a.id);

    expect(await order()).toEqual([second.id, first.id]);
    expect((await status(id, "RESOLVED")).body.error.code).toBe("FOLLOW_UP_PENDING");

    // Move #1's date earlier than #2's, then later than anything: the answer never changes.
    let firstVersion = 1;
    const edit = (when: number) =>
      request(app)
        .patch(`/api/staff/tickets/${id}/actions-taken/${first.id}`)
        .set("Cookie", cookies.owner)
        .send({ expectedVersion: firstVersion++, actionAt: new Date(when).toISOString() });
    expect((await edit(t - 9 * HOUR)).status).toBe(200);
    expect(await order()).toEqual([first.id, second.id]);
    expect((await status(id, "RESOLVED")).body.error.code).toBe("FOLLOW_UP_PENDING");
    expect((await edit(t - 1 * HOUR)).status).toBe(200);
    expect(await order()).toEqual([second.id, first.id]);
    expect((await status(id, "RESOLVED")).body.error.code).toBe("FOLLOW_UP_PENDING");

    // A closing action, recorded last, opens the gate wherever it is dated; the list stays in date order.
    const closing = await record(id, false, "owner", { actionAt: new Date(t - 20 * HOUR).toISOString() });
    expect(await order()).toEqual([closing.id, second.id, first.id]);
    expect((await status(id, "RESOLVED")).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Status History
// ---------------------------------------------------------------------------

describe("WF-09 every change of status writes one history row, in the same transaction (AC-13, BR-21)", () => {
  it("records a transition with who, from, to, and when; and a refused transition records nothing", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const before = Date.now();
    expect((await status(id, "IN_PROGRESS", {}, "colleague")).status).toBe(200);
    const refused = await status(id, "CLOSED");
    expect(refused.status).toBe(409);

    const rows = (await history(id)).body.history;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: expect.any(Number),
      fromStatus: "OPEN",
      toStatus: "IN_PROGRESS",
      changedBy: { id: ids.colleague, fullName: expect.any(String), role: "IT_STAFF" },
      createdAt: expect.any(String),
    });
    expect(new Date(rows[0].createdAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(rows[0].createdAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("records the NEW -> OPEN that a claim causes, and none for a claim of a ticket that is already open, a reassignment, or an unassignment", async () => {
    const id = await makeTicket({ status: "NEW", ownerId: null });
    const claim = await patch(id, "owner", { ownerId: ids.owner, expectedOwnerId: null });
    expect(claim.status).toBe(200);
    expect(claim.body.ticket.currentStatus).toBe("OPEN");
    expect((await history(id)).body.history.map((r: { fromStatus: string; toStatus: string; changedBy: { id: number } }) => [r.fromStatus, r.toStatus, r.changedBy.id])).toEqual([["NEW", "OPEN", ids.owner]]);

    await patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: ids.owner });
    await patch(id, "owner", { ownerId: null, expectedOwnerId: ids.colleague });
    const reclaim = await patch(id, "owner", { ownerId: ids.owner, expectedOwnerId: null }, "admin");
    expect(reclaim.status).toBe(200);
    expect((await history(id)).body.history).toHaveLength(1);
  });

  it("records the actor as the Administrator when an Administrator moves a Ticket (BR-45)", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await status(id, "IN_PROGRESS", {}, "admin");
    expect((await history(id)).body.history[0].changedBy).toMatchObject({ id: ids.admin, role: "ADMINISTRATOR" });
  });

  it("keeps the history in the order the changes were made, oldest first", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await status(id, "IN_PROGRESS");
    await status(id, "WAITING_FOR_REQUESTER");
    await status(id, "IN_PROGRESS");
    await record(id, false);
    await status(id, "RESOLVED");
    const rows = (await history(id)).body.history as Array<{ id: number; fromStatus: string; toStatus: string; createdAt: string }>;
    expect(rows.map((r) => `${r.fromStatus}>${r.toStatus}`)).toEqual([
      "OPEN>IN_PROGRESS", "IN_PROGRESS>WAITING_FOR_REQUESTER", "WAITING_FOR_REQUESTER>IN_PROGRESS", "IN_PROGRESS>RESOLVED",
    ]);
    const stamps = rows.map((r) => new Date(r.createdAt).getTime());
    expect(stamps).toEqual(stamps.slice().sort((a, b) => a - b));
    expect(rows.map((r) => r.id)).toEqual(rows.map((r) => r.id).slice().sort((a, b) => a - b));
  });
});

describe("WF-10 who can read the history, and that nobody can change it (AC-13, BR-22, BR-23)", () => {
  it("lets the owning Requester, any IT Staff member, and an Administrator read it", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await status(id, "IN_PROGRESS");
    for (const who of ["requester", "owner", "colleague", "admin"] as const) {
      const res = await history(id, who);
      expect(res.status, who).toBe(200);
      expect(Object.keys(res.body), who).toEqual(["history"]);
      expect(res.body.history.map((r: { toStatus: string }) => r.toStatus), who).toEqual(["IN_PROGRESS"]);
    }
  });

  it("answers another Requester with 404, byte for byte what a ticket that does not exist gets (BR-44)", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await status(id, "IN_PROGRESS");
    const theirs = await history(id, "otherRequester");
    const missing = await history(2147483647, "otherRequester");
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(theirs.text).toBe(missing.text);
    expect(theirs.text).not.toContain("IN_PROGRESS");
  });

  it("answers an empty list, 200, for a Ticket that has never changed, including a legacy one", async () => {
    const id = await makeTicket({ status: "OPEN" });
    for (const who of ["requester", "owner"] as const) {
      const res = await history(id, who);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ history: [] });
    }
    // A seeded Lab 3 ticket, which predates Lab 4 and has no row.
    const legacy = await prisma.ticket.findFirstOrThrow({
      where: { statusChanges: { none: {} }, NOT: { ticketNumber: { startsWith: "TT-999" } } },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    expect((await history(legacy.id, "admin")).body).toEqual({ history: [] });
  });

  it("is 401 without a session, 400 for a malformed or out-of-range id, and never cached", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const anonymous = await request(app).get(`/api/tickets/${id}/status-history`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("AUTH_REQUIRED");
    for (const bad of ["abc", "0", "-1", "1.5", "2147483648"]) {
      const res = await history(bad);
      expect(res.status, bad).toBe(400);
      expect(res.body.error.code, bad).toBe("INVALID_QUERY");
    }
    expect((await history(id)).headers["cache-control"]).toContain("no-store");
  });

  it("has no route to change or delete a row: a PATCH, PUT, POST, or DELETE is the unknown-route 404 for staff", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await status(id, "IN_PROGRESS");
    const row = (await history(id)).body.history[0];
    const unknown = await request(app).get("/api/no-such-route").set("Cookie", cookies.owner);
    for (const target of [`/api/tickets/${id}/status-history`, `/api/tickets/${id}/status-history/${row.id}`, `/api/staff/tickets/${id}/status-history/${row.id}`]) {
      for (const method of ["patch", "put", "post", "delete"] as const) {
        const res = await request(app)[method](target).set("Cookie", cookies.admin).send({ toStatus: "CLOSED" });
        expect([res.status, method, target].join(" "), `${method} ${target}`).toMatch(/^404 /);
        expect(res.body).toEqual(unknown.body);
      }
    }
    expect((await history(id)).body.history).toEqual([row]);
  });

  it("carries nothing a Requester should not see: no email, no internal note, no reason", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    await status(id, "RESOLVED");
    const text = JSON.stringify((await history(id, "requester")).body);
    expect(text).not.toMatch(/@|password|hash|email|internal/i);
    expect(text).not.toContain(REASON);
  });
});

// ---------------------------------------------------------------------------
// Versions, stale saves, and simultaneous writers
// ---------------------------------------------------------------------------

const version = async (id: number) => (await detail(id)).body.ticket.version as number;

/** The Requester marks the problem as appearing resolved, or withdraws that. */
const signal = (id: number, appearsResolved: boolean) =>
  request(app)
    .patch(`/api/tickets/${id}/appears-resolved`)
    .set("Cookie", cookies.requester)
    .send(appearsResolved ? { appearsResolved, comment: "It prints fine now, thank you." } : { appearsResolved });

describe("WF-11 the version moves by one for every real change, and for nothing else (AC-14, BR-25)", () => {
  it("adds one for each change of owner, IT Priority, status, and the Requester's signal, and for its withdrawal", async () => {
    const id = await makeTicket({ status: "OPEN" });
    expect(await version(id)).toBe(1);

    expect((await patch(id, "it-priority", { itPriority: "HIGH" })).status).toBe(200);
    expect(await version(id)).toBe(2);

    expect((await patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: ids.owner })).status).toBe(200);
    expect(await version(id)).toBe(3);

    expect((await status(id, "IN_PROGRESS")).status).toBe(200);
    expect(await version(id)).toBe(4);

    expect((await signal(id, true)).status).toBe(200);
    expect(await version(id)).toBe(5);
    // Marking again moves the timestamp, so it is a change like the first mark.
    expect((await signal(id, true)).status).toBe(200);
    expect(await version(id)).toBe(6);
    expect((await signal(id, false)).status).toBe(200);
    expect(await version(id)).toBe(7);
  });

  it("adds exactly one for a claim that changes both the owner and the status", async () => {
    const id = await makeTicket({ status: "NEW", ownerId: null });
    const claim = await patch(id, "owner", { ownerId: ids.owner, expectedOwnerId: null });
    expect(claim.body.ticket).toMatchObject({ currentStatus: "OPEN", version: 2 });
  });

  it("leaves it alone for a no-op: the same IT Priority, the same owner, a withdrawal with nothing to withdraw", async () => {
    const id = await makeTicket({ status: "OPEN" });
    expect((await patch(id, "it-priority", { itPriority: "MEDIUM" })).status).toBe(200);
    expect((await patch(id, "owner", { ownerId: ids.owner, expectedOwnerId: ids.owner })).status).toBe(200);
    expect((await signal(id, false)).status).toBe(200);
    expect(await version(id)).toBe(1);
  });

  it("leaves it alone for a refused change, and for a repeat of the current status", async () => {
    const id = await makeTicket({ status: "OPEN" });
    expect((await status(id, "OPEN")).status).toBe(409);
    expect((await status(id, "CLOSED")).status).toBe(409);
    expect((await patch(id, "owner", { ownerId: 2147483647, expectedOwnerId: ids.owner })).status).toBe(400);
    expect(await version(id)).toBe(1);
  });

  it("leaves it alone for an Action Taken, a Public Comment, and an Internal Note (BR-11)", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    expect((await request(app).post(`/api/tickets/${id}/comments`).set("Cookie", cookies.owner).send({ body: "We are on it." })).status).toBe(201);
    expect((await request(app).post(`/api/tickets/${id}/notes`).set("Cookie", cookies.owner).send({ body: "Check the switch first." })).status).toBe(201);
    expect(await version(id)).toBe(1);
  });
});

describe("WF-12 a save made against an old version is refused, and the other change survives (AC-14, BR-26, FR-12)", () => {
  /** A Ticket that a Requester's signal has moved to version 2 since a screen loaded it at 1. */
  async function staleTicket() {
    const id = await makeTicket({ status: "OPEN" });
    expect((await signal(id, true)).status).toBe(200);
    expect(await version(id)).toBe(2);
    return id;
  }

  it.each([
    ["owner", {}],
    ["it-priority", { itPriority: "URGENT" }],
    ["status", { currentStatus: "IN_PROGRESS" }],
  ] as const)("%s: answers 409 STALE_UPDATE with the Ticket as it is now, and writes nothing", async (action, body) => {
    const id = await staleTicket();
    const payload = action === "owner" ? { ownerId: ids.colleague, expectedOwnerId: ids.owner, expectedVersion: 1 } : { ...body, expectedVersion: 1 };
    const res = await patch(id, action, payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_UPDATE");
    expect(typeof res.body.error.message).toBe("string");

    // `current` is the §3.1 ticket, the same thing the detail returns.
    const now = (await detail(id)).body.ticket;
    expect(res.body.error.current).toEqual(now);
    expect(res.body.error.current.version).toBe(2);
    // The other change survived: the Requester's signal is still there, and nothing was written.
    expect(now).toMatchObject({ currentStatus: "OPEN", itPriority: "MEDIUM", version: 2 });
    expect(now.requesterResolvedAt).not.toBeNull();
    expect(now.owner.id).toBe(ids.owner);
    expect((await history(id)).body.history).toEqual([]);
  });

  it("accepts the same save once it carries the current version, and the new version is in the answer", async () => {
    const id = await staleTicket();
    for (const [action, body, expected] of [
      ["it-priority", { itPriority: "URGENT" }, 3],
      ["owner", { ownerId: ids.colleague, expectedOwnerId: ids.owner }, 4],
      ["status", { currentStatus: "IN_PROGRESS" }, 5],
    ] as const) {
      const res = await patch(id, action, { ...body, expectedVersion: expected - 1 });
      expect(res.status, action).toBe(200);
      expect(res.body.ticket.version, action).toBe(expected);
    }
  });

  it("still takes a save with no expectedVersion at all, so a Lab 3 client keeps working (BR-26)", async () => {
    const id = await staleTicket();
    expect((await patch(id, "it-priority", { itPriority: "HIGH" })).status).toBe(200);
    expect((await status(id, "IN_PROGRESS")).status).toBe(200);
  });

  it("answers a stale expectedOwnerId with TICKET_ALREADY_OWNED even when the version is stale too: that is checked first", async () => {
    const id = await staleTicket();
    await patch(id, "owner", { ownerId: ids.colleague, expectedOwnerId: ids.owner });
    const res = await patch(id, "owner", { ownerId: ids.admin, expectedOwnerId: ids.owner, expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_ALREADY_OWNED");
    // Without a stale owner, the stale version speaks.
    const version409 = await patch(id, "owner", { ownerId: ids.admin, expectedOwnerId: ids.colleague, expectedVersion: 1 });
    expect(version409.body.error.code).toBe("STALE_UPDATE");
  });

  it("refuses an expectedVersion that is not a version, on each of the three, as 400 on that field", async () => {
    const id = await makeTicket({ status: "OPEN" });
    for (const bad of ["1", 1.5, 0, -1, null, true, [1], {}, 2147483648]) {
      for (const [action, body] of [
        ["owner", { ownerId: ids.owner, expectedOwnerId: ids.owner }],
        ["it-priority", { itPriority: "HIGH" }],
        ["status", { currentStatus: "IN_PROGRESS" }],
      ] as const) {
        const res = await patch(id, action, { ...body, expectedVersion: bad });
        expect(res.status, `${action} ${JSON.stringify(bad)}`).toBe(400);
        expect(Object.keys(res.body.error.fields), `${action} ${JSON.stringify(bad)}`).toEqual(["expectedVersion"]);
      }
    }
    expect(await version(id)).toBe(1);
  });

  it("is told the Ticket does not exist, not that it is stale, for a Ticket that is not there", async () => {
    const res = await patch(2147483647, "status", { currentStatus: "IN_PROGRESS", expectedVersion: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("WF-13 of two simultaneous status changes with the same version, exactly one succeeds (AC-14, BR-29)", () => {
  it("lets one of six identical requests through, refuses the rest as stale, and writes one history row", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const sent = await Promise.all(
      (["owner", "colleague", "admin", "owner", "colleague", "admin"] as const).map((who) => status(id, "IN_PROGRESS", { expectedVersion: 1 }, who)),
    );
    expect(sent.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409, 409]);
    for (const loser of sent.filter((r) => r.status === 409)) expect(loser.body.error.code).toBe("STALE_UPDATE");
    expect((await detail(id)).body.ticket).toMatchObject({ currentStatus: "IN_PROGRESS", version: 2 });
    expect((await history(id)).body.history).toHaveLength(1);
  });

  it("lets one of two different moves through when both were made against the same version", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    const [wait, cancel] = await Promise.all([
      status(id, "WAITING_FOR_REQUESTER", { expectedVersion: 1 }, "owner"),
      status(id, "CANCELLED", { expectedVersion: 1 }, "colleague"),
    ]);
    expect([wait.status, cancel.status].sort()).toEqual([200, 409]);
    const rows = (await history(id)).body.history;
    expect(rows).toHaveLength(1);
    expect((await detail(id)).body.ticket.currentStatus).toBe(rows[0].toStatus);
  });

  it("serialises requests that carry no version too: the second is judged against the first's result", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const [a, b] = await Promise.all([status(id, "IN_PROGRESS", {}, "owner"), status(id, "IN_PROGRESS", {}, "colleague")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    // The loser is told the Ticket is already there, not that it failed.
    expect(loser.body.error.code).toBe("INVALID_TRANSITION");
    expect((await history(id)).body.history).toHaveLength(1);
  });

  it("holds RESOLVED against an action recorded in the same instant: the gate is checked in the move's own transaction (BR-17)", async () => {
    const id = await makeTicket({ status: "IN_PROGRESS" });
    await record(id, false);
    // A Yes arrives while a resolve is in flight. Whichever the lock lets in first, the result is consistent:
    // either the resolve ran first (and the later action is refused as the Ticket is closed to actions)
    // or the Yes was recorded first and the resolve is held.
    const [resolve, yes] = await Promise.all([status(id, "RESOLVED"), record(id, true).then(() => "recorded", () => "refused")]);
    const now = (await detail(id)).body.ticket.currentStatus;
    if (resolve.status === 200) {
      expect(now).toBe("RESOLVED");
    } else {
      expect(resolve.body.error.code).toBe("FOLLOW_UP_PENDING");
      expect(now).toBe("IN_PROGRESS");
      expect(yes).toBe("recorded");
    }
  });
});

describe("WF-17 IT Priority, with a version (AC-14, BR-25, BR-27, BR-29)", () => {
  it("refuses a change made against a stale version, and leaves the priority as it was", async () => {
    const id = await makeTicket({ status: "OPEN" });
    await patch(id, "it-priority", { itPriority: "HIGH" }, "colleague");
    const res = await patch(id, "it-priority", { itPriority: "URGENT", expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_UPDATE");
    expect((await detail(id)).body.ticket).toMatchObject({ itPriority: "HIGH", version: 2 });
  });

  it("answers resending the value the Ticket already has with 200 and leaves the version where it was", async () => {
    const id = await makeTicket({ status: "OPEN" });
    expect((await patch(id, "it-priority", { itPriority: "HIGH" })).body.ticket.version).toBe(2);
    const again = await patch(id, "it-priority", { itPriority: "HIGH", expectedVersion: 2 });
    expect(again.status).toBe(200);
    expect(again.body.ticket).toMatchObject({ itPriority: "HIGH", version: 2 });
  });

  it("never changes Requested Priority, whatever the body carries", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const res = await patch(id, "it-priority", { itPriority: "URGENT", requestedPriority: "LOW", expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ itPriority: "URGENT", requestedPriority: "MEDIUM" });
  });

  it("serialises two simultaneous changes made against the same version: one wins, one is stale", async () => {
    const id = await makeTicket({ status: "OPEN" });
    const sent = await Promise.all([
      patch(id, "it-priority", { itPriority: "HIGH", expectedVersion: 1 }, "owner"),
      patch(id, "it-priority", { itPriority: "URGENT", expectedVersion: 1 }, "colleague"),
      patch(id, "it-priority", { itPriority: "LOW", expectedVersion: 1 }, "admin"),
    ]);
    expect(sent.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    const winner = sent.find((r) => r.status === 200)!;
    expect((await detail(id)).body.ticket).toMatchObject({ itPriority: winner.body.ticket.itPriority, version: 2 });
  });

  it("answers 404 for a Ticket that is not there, and is the Administrator's too", async () => {
    expect((await patch(2147483647, "it-priority", { itPriority: "HIGH" })).status).toBe(404);
    const id = await makeTicket({ status: "OPEN" });
    expect((await patch(id, "it-priority", { itPriority: "HIGH", expectedVersion: 1 }, "admin")).status).toBe(200);
  });
});

describe("WF-20 an assignment racing the deactivation of the proposed owner (AC-14, BR-24, BR-29)", () => {
  const extraUserIds: number[] = [];
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function newStaffUser() {
    const user = await prisma.user.create({
      data: {
        fullName: "Workflow suite assignee",
        email: `wf20.${Date.now().toString(36)}.${extraUserIds.length}@example.test`,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: false,
        passwordHash: await hashPassword("Correct-horse-1"),
      },
    });
    extraUserIds.push(user.id);
    return user.id;
  }

  afterAll(async () => {
    // The tickets go first (afterAll above), so nothing still names these users.
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  });

  it("waits for the user row's lock, and once the deactivation has committed refuses the assignment, leaving the owner as it was", async () => {
    const target = await newStaffUser();
    const id = await makeTicket({ status: "OPEN", ownerId: null });

    let release!: () => void;
    let held!: () => void;
    const mayCommit = new Promise<void>((resolve) => (release = resolve));
    const holding = new Promise<void>((resolve) => (held = resolve));
    // A second transaction takes the user's row and does not let go until told to.
    const deactivation = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${target} FOR UPDATE`;
        held();
        await mayCommit;
        await tx.user.update({ where: { id: target }, data: { isActive: false } });
      },
      { timeout: 30000, maxWait: 30000 },
    );
    await holding;

    // The assignment starts now, and has to wait for that lock.
    const assignment = patch(id, "owner", { ownerId: target, expectedOwnerId: null }).then((res) => res);
    const early = await Promise.race([assignment.then(() => "answered"), sleep(700).then(() => "waiting")]);
    expect(early, "the assignment must wait for the user's row, not read it and go on").toBe("waiting");

    release();
    await deactivation;
    const res = await assignment;
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OWNER_NOT_ASSIGNABLE");
    expect((await detail(id)).body.ticket.owner).toBeNull();
  });

  it("in the other order, the assignment goes through and the owner stays when the account is deactivated afterwards (Lab 3 BR-26)", async () => {
    const target = await newStaffUser();
    const id = await makeTicket({ status: "OPEN", ownerId: null });
    expect((await patch(id, "owner", { ownerId: target, expectedOwnerId: null })).status).toBe(200);
    await prisma.user.update({ where: { id: target }, data: { isActive: false } });
    const { owner } = (await detail(id)).body.ticket;
    expect(owner).toMatchObject({ id: target, isActive: false, role: "IT_STAFF" });
  });

  it("refuses an account that was already deactivated, and one that is not IT Staff or an Administrator", async () => {
    const inactive = await newStaffUser();
    await prisma.user.update({ where: { id: inactive }, data: { isActive: false } });
    const id = await makeTicket({ status: "OPEN", ownerId: null });
    for (const target of [inactive, ids.requester]) {
      const res = await patch(id, "owner", { ownerId: target, expectedOwnerId: null });
      expect(res.status, String(target)).toBe(409);
      expect(res.body.error.code).toBe("OWNER_NOT_ASSIGNABLE");
    }
    expect((await patch(id, "owner", { ownerId: 2147483647, expectedOwnerId: null })).status).toBe(400);
    expect((await detail(id)).body.ticket.owner).toBeNull();
  });
});
