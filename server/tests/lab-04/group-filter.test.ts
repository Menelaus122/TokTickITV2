import { describe, it, expect } from "vitest";
import { OPEN_GROUP, allowedStatuses, parseGroup, parseTicketListQuery, TICKET_STATUSES } from "../../src/listQuery.js";

// Lab 4, Issue 7 — UNIT-11 in docs/lab-04/tests.md §2.1 (api-spec §5.1; specification.md
// BR-31, D-12). Pure parsing and the pure rule that combines `group` with `status`, so every
// boundary is tested without a database. The same two functions serve the Ticket Queue in
// Issue 8, which is why they are exported on their own.

describe("UNIT-11 the open group is exactly the five statuses nobody has resolved, closed, or cancelled (BR-31)", () => {
  it("is NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, and REOPENED", () => {
    expect([...OPEN_GROUP]).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]);
  });

  it("leaves out RESOLVED, CLOSED, and CANCELLED, and every other status is in it", () => {
    for (const status of TICKET_STATUSES) {
      expect(OPEN_GROUP.includes(status as (typeof OPEN_GROUP)[number]), status).toBe(!["RESOLVED", "CLOSED", "CANCELLED"].includes(status));
    }
  });
});

describe("UNIT-11 group query parsing (AC-21, api-spec §5.1)", () => {
  it("accepts open", () => {
    expect(parseGroup("open")).toEqual({ ok: true, value: "open" });
  });

  it("treats a missing or empty group as no group, as every other parameter", () => {
    for (const raw of [undefined, null, ""]) expect(parseGroup(raw), String(raw)).toEqual({ ok: true, value: null });
  });

  it.each(["closed", "OPEN", "Open", "all", "open ", " open", "1", "true", "open,closed", "%"])("rejects the unknown value %j, not correcting it to a default", (value) => {
    const parsed = parseGroup(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/group/);
  });

  it("rejects a group given twice, whatever the two values are", () => {
    expect(parseGroup(["open", "open"]).ok).toBe(false);
    expect(parseGroup(["open", "closed"]).ok).toBe(false);
  });

  it("rejects a value that is not text", () => {
    for (const raw of [{}, 7, true, [{}], [[]]]) expect(parseGroup(raw).ok, JSON.stringify(raw)).toBe(false);
  });
});

describe("UNIT-11 group inside the ticket list query", () => {
  it("is null when absent, so every Lab 2 and Lab 3 request still means what it meant", () => {
    const parsed = parseTicketListQuery({});
    expect(parsed.ok && parsed.value.group).toBeNull();
  });

  it("is carried with every other parameter, and changes none of their defaults", () => {
    const withGroup = parseTicketListQuery({ group: "open" });
    const without = parseTicketListQuery({});
    expect(withGroup.ok && withGroup.value).toEqual({ ...(without.ok ? without.value : {}), group: "open" });
  });

  it("is carried together with currentStatus, which it combines with", () => {
    const parsed = parseTicketListQuery({ group: "open", currentStatus: "CLOSED" });
    expect(parsed.ok && [parsed.value.group, parsed.value.currentStatus]).toEqual(["open", "CLOSED"]);
  });

  it("is a rejected query when it is unknown or repeated, and the message names it (BR-23)", () => {
    for (const raw of [{ group: "closed" }, { group: ["open", "open"] }, { group: "open", page: "0" }]) {
      const parsed = parseTicketListQuery(raw);
      expect(parsed.ok, JSON.stringify(raw)).toBe(false);
    }
    const unknown = parseTicketListQuery({ group: "closed" });
    expect(!unknown.ok && unknown.message).toMatch(/group/);
  });
});

describe("UNIT-11 group combines with status by AND, never by OR (BR-31, api-spec §5.1)", () => {
  it("restricts to the open group when only group is given", () => {
    expect(allowedStatuses("open", null)).toEqual([...OPEN_GROUP]);
  });

  it("restricts to the one status when only a status is given", () => {
    expect(allowedStatuses(null, "CLOSED")).toEqual(["CLOSED"]);
  });

  it("does not restrict at all when neither is given", () => {
    expect(allowedStatuses(null, null)).toBeNull();
  });

  it("keeps a status that is inside the group, and only that one", () => {
    expect(allowedStatuses("open", "WAITING_FOR_REQUESTER")).toEqual(["WAITING_FOR_REQUESTER"]);
    expect(allowedStatuses("open", "REOPENED")).toEqual(["REOPENED"]);
  });

  it("is empty, not an error, for a status that is outside the group", () => {
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) expect(allowedStatuses("open", status), status).toEqual([]);
  });

  it("never lets the group widen a status filter: each of the eight statuses with the group is a subset of both", () => {
    for (const status of TICKET_STATUSES) {
      const both = allowedStatuses("open", status) ?? [];
      expect(both.every((s) => s === status && OPEN_GROUP.includes(s as (typeof OPEN_GROUP)[number])), status).toBe(true);
    }
  });
});
