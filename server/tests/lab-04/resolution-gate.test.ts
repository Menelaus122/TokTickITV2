import { describe, it, expect } from "vitest";
import {
  BLOCK_MESSAGES,
  permittedTransitions,
  resolutionGate,
  transitionOptions,
  type GateAction,
  type GateResult,
} from "../../src/transitions.js";
import { TICKET_STATUSES, type TicketStatus } from "../../src/listQuery.js";

// Lab 4, Issue 6 — UNIT-07 to UNIT-10 in docs/lab-04/tests.md §2.1 (specification.md
// BR-15, BR-17, BR-18, BR-24, D-07; api-spec §3.1).
//
// The gate and the transition options are pure functions of what the database
// holds, so every case is decided here without a server. The Ticket's Action
// Date/Time is not an input to the gate at all: BR-17 reads the order they were
// RECORDED in, which the user cannot type or edit.

const at = (hour: number, minute = 0, second = 0) => new Date(Date.UTC(2026, 9, 5, hour, minute, second));

/** An action as the gate sees it. `actionAt` is carried only to show it changes nothing. */
function recorded(id: number, when: Date, followUpRequired: boolean, actionAt: Date = at(0)): GateAction & { actionAt: Date } {
  return { id, createdAt: when, followUpRequired, actionAt };
}

describe("UNIT-07 the gate with no actions (AC-03, BR-17, BR-18)", () => {
  it("refuses a Ticket that has none, as ACTION_REQUIRED", () => {
    expect(resolutionGate([], null)).toEqual({ ok: false, code: "ACTION_REQUIRED" });
  });

  it("refuses a reopened Ticket with no action since it was reopened, however many came before", () => {
    const before = [recorded(1, at(9), false), recorded(2, at(10), false)];
    expect(resolutionGate(before, at(11))).toEqual({ ok: false, code: "ACTION_REQUIRED" });
  });
});

describe("UNIT-08 the gate reads the most recently RECORDED action (AC-03, BR-17, D-07)", () => {
  it("passes when the only action needs no follow-up, and refuses with FOLLOW_UP_PENDING when it does", () => {
    expect(resolutionGate([recorded(1, at(9), false)], null)).toEqual({ ok: true });
    expect(resolutionGate([recorded(1, at(9), true)], null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
  });

  it("passes when an earlier action needed follow-up and a later one does not: the follow-up is settled by recording another action", () => {
    const actions = [recorded(1, at(9), true), recorded(2, at(10), false)];
    expect(resolutionGate(actions, null)).toEqual({ ok: true });
  });

  it("refuses when the latest needs follow-up, even though an earlier one did not", () => {
    const actions = [recorded(1, at(9), false), recorded(2, at(10), true)];
    expect(resolutionGate(actions, null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
  });

  it("does not depend on the order the actions are handed over in", () => {
    const actions = [recorded(1, at(9), true), recorded(2, at(10), false), recorded(3, at(8), true)];
    const results = new Set<string>();
    for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2], [1, 2, 0], [0, 2, 1], [2, 0, 1]]) {
      results.add(JSON.stringify(resolutionGate(order.map((i) => actions[i]), null)));
    }
    expect([...results]).toEqual([JSON.stringify({ ok: true })]);
  });

  it("breaks a tie on when they were recorded by id, the higher id being the later", () => {
    const sameInstant = at(9, 30);
    expect(resolutionGate([recorded(5, sameInstant, true), recorded(6, sameInstant, false)], null)).toEqual({ ok: true });
    expect(resolutionGate([recorded(5, sameInstant, false), recorded(6, sameInstant, true)], null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
    expect(resolutionGate([recorded(6, sameInstant, true), recorded(5, sameInstant, false)], null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
  });

  it("is decided by when they were recorded, never by the Action Date/Time the person typed (AC-03, BR-08)", () => {
    // #1 was recorded first and dated 10:00; #2 was recorded later but dated 09:00 and needs follow-up.
    // In the list #2 sorts first, and it is still the latest recorded, so the follow-up is pending.
    const first = recorded(1, at(12), false, at(10));
    const second = recorded(2, at(13), true, at(9));
    expect(resolutionGate([first, second], null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });

    // Moving either typed date to any place at all changes nothing.
    for (const [a, b] of [[at(1), at(23)], [at(23), at(1)], [at(10), at(10)], [at(9), at(10)]]) {
      const redated = [{ ...first, actionAt: a }, { ...second, actionAt: b }];
      expect(resolutionGate(redated, null)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
    }

    // A closing action recorded after both opens the gate, wherever it is dated.
    const closing = recorded(3, at(14), false, at(2));
    expect(resolutionGate([first, second, closing], null)).toEqual({ ok: true });
  });
});

describe("UNIT-09 the gate across a reopen (AC-12, BR-17, D-07)", () => {
  const reopened = at(12);

  it("ignores every action created before the latest reopen", () => {
    const actions = [recorded(1, at(9), false), recorded(2, at(11, 59, 59), false)];
    expect(resolutionGate(actions, reopened)).toEqual({ ok: false, code: "ACTION_REQUIRED" });
  });

  it("counts an action created after the reopen", () => {
    const actions = [recorded(1, at(9), false), recorded(2, at(12, 0, 1), false)];
    expect(resolutionGate(actions, reopened)).toEqual({ ok: true });
  });

  it("does not count an action created at the very instant of the reopen: it has to be after it", () => {
    expect(resolutionGate([recorded(1, reopened, false)], reopened)).toEqual({ ok: false, code: "ACTION_REQUIRED" });
  });

  it("reads the follow-up of the post-reopen actions only: an old Yes before the reopen no longer blocks", () => {
    const actions = [recorded(1, at(9), true), recorded(2, at(13), false)];
    expect(resolutionGate(actions, reopened)).toEqual({ ok: true });
    // And a Yes after the reopen does.
    expect(resolutionGate([recorded(1, at(9), false), recorded(2, at(13), true)], reopened)).toEqual({ ok: false, code: "FOLLOW_UP_PENDING" });
  });

  it("treats a Ticket with no reopen entry as never reopened, so every action counts", () => {
    const actions = [recorded(1, at(1), false)];
    expect(resolutionGate(actions, null)).toEqual({ ok: true });
  });
});

describe("UNIT-10 the transition options for every status (AC-11, AC-16, BR-15, BR-24)", () => {
  const OK: GateResult = { ok: true };
  const ACTION: GateResult = { ok: false, code: "ACTION_REQUIRED" };
  const FOLLOW_UP: GateResult = { ok: false, code: "FOLLOW_UP_PENDING" };

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

  const allContexts: Array<[string, { hasOwner: boolean; gate: GateResult }]> = [
    ["owned, gate open", { hasOwner: true, gate: OK }],
    ["unowned, gate open", { hasOwner: false, gate: OK }],
    ["owned, no action", { hasOwner: true, gate: ACTION }],
    ["owned, follow-up pending", { hasOwner: true, gate: FOLLOW_UP }],
    ["unowned, no action", { hasOwner: false, gate: ACTION }],
    ["unowned, follow-up pending", { hasOwner: false, gate: FOLLOW_UP }],
  ];

  it.each(TICKET_STATUSES)("%s: permitted and blocked together are exactly the matrix row, in the matrix's order", (status) => {
    for (const [label, context] of allContexts) {
      const { permitted, blocked } = transitionOptions(status, context);
      const together = [...permitted, ...blocked.map((b) => b.to)];
      expect(together.slice().sort(), `${status}, ${label}`).toEqual(MATRIX[status].slice().sort());
      // Each list keeps the matrix's own order, and nothing is in both.
      expect(MATRIX[status].filter((to) => permitted.includes(to)), `${status}, ${label}`).toEqual(permitted);
      expect(MATRIX[status].filter((to) => blocked.some((b) => b.to === to)), `${status}, ${label}`).toEqual(blocked.map((b) => b.to));
    }
  });

  it("the unchanged matrix function still answers the bare row (Lab 3's name and meaning are kept)", () => {
    for (const status of TICKET_STATUSES) expect(permittedTransitions(status)).toEqual(MATRIX[status]);
  });

  it("offers every move of an owned Ticket with the gate open", () => {
    for (const status of TICKET_STATUSES) {
      expect(transitionOptions(status, { hasOwner: true, gate: OK })).toEqual({ permitted: MATRIX[status], blocked: [] });
    }
  });

  it("blocks RESOLVED with the gate's own code, and says why in words safe to show", () => {
    for (const status of ["IN_PROGRESS", "WAITING_FOR_REQUESTER"] as const) {
      const none = transitionOptions(status, { hasOwner: true, gate: ACTION });
      expect(none.blocked).toEqual([{ to: "RESOLVED", code: "ACTION_REQUIRED", message: "Record at least one action before resolving this ticket." }]);
      expect(none.permitted).toEqual(MATRIX[status].filter((to) => to !== "RESOLVED"));

      const pending = transitionOptions(status, { hasOwner: true, gate: FOLLOW_UP });
      expect(pending.blocked).toEqual([
        {
          to: "RESOLVED",
          code: "FOLLOW_UP_PENDING",
          message: "The most recently recorded action still needs follow-up. Record the follow-up as a new action first.",
        },
      ]);
    }
  });

  it("blocks RESOLVED on an unowned Ticket as OWNER_REQUIRED, ahead of the gate (BR-24)", () => {
    for (const gate of [OK, ACTION, FOLLOW_UP]) {
      const { permitted, blocked } = transitionOptions("IN_PROGRESS", { hasOwner: false, gate });
      expect(blocked).toEqual([{ to: "RESOLVED", code: "OWNER_REQUIRED", message: "Claim or assign the ticket before resolving or closing it." }]);
      expect(permitted).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    }
  });

  it("blocks CLOSED on an unowned Ticket, and leaves REOPENED open (BR-19)", () => {
    const { permitted, blocked } = transitionOptions("RESOLVED", { hasOwner: false, gate: ACTION });
    expect(blocked).toEqual([{ to: "CLOSED", code: "OWNER_REQUIRED", message: "Claim or assign the ticket before resolving or closing it." }]);
    expect(permitted).toEqual(["REOPENED"]);
  });

  it("applies the gate to RESOLVED only: no other move is ever blocked by it", () => {
    for (const status of TICKET_STATUSES) {
      const { blocked } = transitionOptions(status, { hasOwner: true, gate: ACTION });
      expect(blocked.every((b) => b.to === "RESOLVED"), status).toBe(true);
    }
  });

  it("offers nothing from CANCELLED, which is final", () => {
    for (const [, context] of allContexts) expect(transitionOptions("CANCELLED", context)).toEqual({ permitted: [], blocked: [] });
  });

  it("uses one message per code, the same text the API answers a refused move with", () => {
    expect(BLOCK_MESSAGES.ACTION_REQUIRED).toBe("Record at least one action before resolving this ticket.");
    expect(BLOCK_MESSAGES.FOLLOW_UP_PENDING).toBe("The most recently recorded action still needs follow-up. Record the follow-up as a new action first.");
    expect(BLOCK_MESSAGES.OWNER_REQUIRED).toBe("Claim or assign the ticket before resolving or closing it.");
  });
});
