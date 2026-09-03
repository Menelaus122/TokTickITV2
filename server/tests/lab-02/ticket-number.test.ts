import { describe, it, expect } from "vitest";
import {
  TICKET_NUMBER_PATTERN,
  MAX_SEQUENCE,
  formatTicketNumber,
  parseSequence,
  parseYear,
  nextTicketNumber,
} from "../../src/ticketNumber.js";

// UNIT-01, UNIT-02 — Ticket Number generation (BR-01, BR-04).
// Pure logic, so no database is involved: the transaction client is stubbed.

function stubTx(latest: string | null) {
  return {
    ticket: {
      findFirst: async () => (latest === null ? null : { ticketNumber: latest }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("ticket number format", () => {
  it("produces TT-<YYYY>-<NNNNN>", () => {
    expect(formatTicketNumber(2026, 42)).toBe("TT-2026-00042");
    expect(TICKET_NUMBER_PATTERN.test(formatTicketNumber(2026, 42))).toBe(true);
  });

  it("zero-pads the sequence to five digits", () => {
    expect(formatTicketNumber(2026, 1)).toBe("TT-2026-00001");
    expect(formatTicketNumber(2026, 99999)).toBe("TT-2026-99999");
  });

  it("round-trips the year and sequence", () => {
    const number = formatTicketNumber(2026, 7);
    expect(parseYear(number)).toBe(2026);
    expect(parseSequence(number)).toBe(7);
  });

  it("rejects malformed numbers", () => {
    for (const bad of ["TT-2026-42", "TT-26-00042", "XX-2026-00042", "TT-2026-000042", ""]) {
      expect(TICKET_NUMBER_PATTERN.test(bad)).toBe(false);
      expect(parseSequence(bad)).toBeNull();
    }
  });
});

describe("sequence behaviour", () => {
  it("starts a year at 00001", async () => {
    expect(await nextTicketNumber(stubTx(null), 2026)).toBe("TT-2026-00001");
  });

  it("increments from the current maximum", async () => {
    expect(await nextTicketNumber(stubTx("TT-2026-00041"), 2026)).toBe("TT-2026-00042");
  });

  it("carries across the padding boundary", async () => {
    expect(await nextTicketNumber(stubTx("TT-2026-00009"), 2026)).toBe("TT-2026-00010");
    expect(await nextTicketNumber(stubTx("TT-2026-00099"), 2026)).toBe("TT-2026-00100");
  });

  it("restarts at 00001 in a new year", async () => {
    // The query is scoped to the year prefix, so last year's rows do not match
    // and the stub returns null for the new year.
    expect(await nextTicketNumber(stubTx(null), 2027)).toBe("TT-2027-00001");
  });

  it("refuses to wrap when a year's sequence is exhausted", async () => {
    await expect(nextTicketNumber(stubTx(formatTicketNumber(2026, MAX_SEQUENCE)), 2026)).rejects.toThrow(
      /exhausted/i,
    );
  });

  it("sorts by string the same way it sorts numerically", () => {
    // This is what lets one indexed descending lookup find the maximum.
    const numbers = [1, 2, 9, 10, 99, 100, 1000, 99999].map((n) => formatTicketNumber(2026, n));
    expect([...numbers].sort()).toEqual(numbers);
  });
});
