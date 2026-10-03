import { describe, it, expect } from "vitest";
import { TICKET_STATUSES, type TicketStatus } from "../../src/listQuery.js";
import { isPermittedTransition, permittedTransitions, requiresOwner, requiresReason } from "../../src/transitions.js";

// Lab 3, Issue 9 — UNIT-06 to UNIT-08 in docs/lab-03/tests.md: the status
// lifecycle (specification.md §5.5, BR-33 to BR-38).

// BR-33, written out independently of the module under test.
const PERMITTED: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

describe("UNIT-06 every pair in the BR-33 matrix", () => {
  it("allows exactly the 15 permitted pairs and refuses the other 41 of the 56", () => {
    let allowed = 0;
    let refused = 0;
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        if (from === to) continue;
        const expected = PERMITTED[from].includes(to);
        expect(isPermittedTransition(from, to), `${from} → ${to}`).toBe(expected);
        expected ? allowed++ : refused++;
      }
    }
    // 8 × 7 = 56 ordered pairs of different statuses; the same-status pairs
    // are UNIT-07's.
    expect(allowed).toBe(15);
    expect(refused).toBe(41);
  });

  it("lists the permitted targets for each status, which the detail response carries (FR-34)", () => {
    for (const from of TICKET_STATUSES) expect(permittedTransitions(from)).toEqual(PERMITTED[from]);
  });

  it("treats CANCELLED as terminal", () => {
    expect(permittedTransitions("CANCELLED")).toEqual([]);
    for (const to of TICKET_STATUSES) expect(isPermittedTransition("CANCELLED", to)).toBe(false);
  });

  it("hands out a copy, so a caller cannot change the matrix", () => {
    permittedTransitions("NEW").push("CLOSED");
    expect(permittedTransitions("NEW")).toEqual(["OPEN", "CANCELLED"]);
  });
});

describe("UNIT-07 same-status transition", () => {
  it("is refused for every status (BR-38)", () => {
    for (const status of TICKET_STATUSES) {
      expect(isPermittedTransition(status, status), status).toBe(false);
      expect(permittedTransitions(status)).not.toContain(status);
    }
  });
});

describe("UNIT-08 reason and owner requirements", () => {
  it("requires a reason for Resolved, Cancelled, and Reopened only (BR-36, BR-37)", () => {
    for (const status of TICKET_STATUSES) {
      expect(requiresReason(status), status).toBe(["RESOLVED", "CANCELLED", "REOPENED"].includes(status));
    }
  });

  it("requires an owner for Resolved and Closed only, not Cancelled (BR-35)", () => {
    for (const status of TICKET_STATUSES) {
      expect(requiresOwner(status), status).toBe(["RESOLVED", "CLOSED"].includes(status));
    }
  });
});
