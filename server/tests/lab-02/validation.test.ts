import { describe, it, expect } from "vitest";
import {
  validateTicketInput,
  SUMMARY_MIN,
  SUMMARY_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
} from "../../src/validation.js";

// UNIT-03 — ticket validation at its boundaries (BR-25 to BR-28).

const VALID = {
  categoryId: 2,
  relatedSystemId: 2,
  summary: "Laptop battery drains within 30 minutes",
  description:
    "Since Monday the corporate laptop battery falls from 100% to 5% in about half an hour.",
  requestedPriority: "MEDIUM",
};

function text(length: number) {
  return "a".repeat(length);
}

describe("valid input", () => {
  it("accepts a well-formed ticket", () => {
    const result = validateTicketInput(VALID);
    expect(result.ok).toBe(true);
  });

  it("returns trimmed values for storage", () => {
    const result = validateTicketInput({
      ...VALID,
      summary: "   Padded summary here   ",
      description: `   ${VALID.description}   `,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe("Padded summary here");
      expect(result.value.description).toBe(VALID.description);
    }
  });

  it("preserves internal whitespace", () => {
    const result = validateTicketInput({ ...VALID, summary: "VPN  drops   often" });
    if (result.ok) expect(result.value.summary).toBe("VPN  drops   often");
  });

  it("accepts numeric ids sent as strings", () => {
    const result = validateTicketInput({ ...VALID, categoryId: "2", relatedSystemId: "3" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.categoryId).toBe(2);
      expect(result.value.relatedSystemId).toBe(3);
    }
  });
});

describe("summary boundaries", () => {
  it(`rejects ${SUMMARY_MIN - 1} characters and accepts ${SUMMARY_MIN}`, () => {
    expect(validateTicketInput({ ...VALID, summary: text(SUMMARY_MIN - 1) }).ok).toBe(false);
    expect(validateTicketInput({ ...VALID, summary: text(SUMMARY_MIN) }).ok).toBe(true);
  });

  it(`accepts ${SUMMARY_MAX} characters and rejects ${SUMMARY_MAX + 1}`, () => {
    expect(validateTicketInput({ ...VALID, summary: text(SUMMARY_MAX) }).ok).toBe(true);
    expect(validateTicketInput({ ...VALID, summary: text(SUMMARY_MAX + 1) }).ok).toBe(false);
  });

  it("measures after trimming, so padding cannot fake length", () => {
    const result = validateTicketInput({ ...VALID, summary: `  ${text(SUMMARY_MIN - 1)}  ` });
    expect(result.ok).toBe(false);
  });

  it("reports whitespace-only as required rather than too short", () => {
    const result = validateTicketInput({ ...VALID, summary: "     " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.summary).toMatch(/required/i);
  });
});

describe("description boundaries", () => {
  it(`rejects ${DESCRIPTION_MIN - 1} characters and accepts ${DESCRIPTION_MIN}`, () => {
    expect(validateTicketInput({ ...VALID, description: text(DESCRIPTION_MIN - 1) }).ok).toBe(false);
    expect(validateTicketInput({ ...VALID, description: text(DESCRIPTION_MIN) }).ok).toBe(true);
  });

  it(`accepts ${DESCRIPTION_MAX} characters and rejects ${DESCRIPTION_MAX + 1}`, () => {
    expect(validateTicketInput({ ...VALID, description: text(DESCRIPTION_MAX) }).ok).toBe(true);
    expect(validateTicketInput({ ...VALID, description: text(DESCRIPTION_MAX + 1) }).ok).toBe(false);
  });
});

describe("required fields and enums", () => {
  it("reports every missing field at once, not just the first", () => {
    const result = validateTicketInput({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fields).sort()).toEqual([
        "categoryId",
        "description",
        "relatedSystemId",
        "requestedPriority",
        "summary",
      ]);
    }
  });

  it("rejects a priority outside the enum", () => {
    const result = validateTicketInput({ ...VALID, requestedPriority: "CRITICAL" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.requestedPriority).toMatch(/must be one of/i);
  });

  it("has no default priority — it must be chosen", () => {
    const { requestedPriority: _omitted, ...withoutPriority } = VALID;
    const result = validateTicketInput(withoutPriority);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.requestedPriority).toMatch(/required/i);
  });

  it("rejects non-positive and non-integer ids", () => {
    for (const bad of [0, -1, 1.5, "abc", null, undefined]) {
      expect(validateTicketInput({ ...VALID, categoryId: bad }).ok).toBe(false);
    }
  });

  it("survives a body that is not an object at all", () => {
    for (const bad of [null, undefined, "string", 42, []]) {
      expect(validateTicketInput(bad).ok).toBe(false);
    }
  });
});

describe("fields the client may not set", () => {
  it("ignores ticketNumber, requesterId, and currentStatus in the payload", () => {
    const result = validateTicketInput({
      ...VALID,
      ticketNumber: "TT-1999-00001",
      requesterId: 99,
      currentStatus: "CLOSED",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual([
        "categoryId",
        "description",
        "relatedSystemId",
        "requestedPriority",
        "summary",
      ]);
    }
  });
});
