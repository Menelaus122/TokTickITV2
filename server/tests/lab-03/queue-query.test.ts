import { describe, it, expect } from "vitest";
import { parseQueueQuery, queueOrderBy } from "../../src/queueQuery.js";

// Lab 3, Issue 8 — UNIT-09 and UNIT-10 in docs/lab-03/tests.md: the IT Staff
// queue's query contract (api-spec §5.1; BR-53 to BR-59).

function ok(raw: Record<string, unknown>) {
  const result = parseQueueQuery(raw);
  if (!result.ok) throw new Error(`expected success, got: ${result.message}`);
  return result.value;
}

function rejected(raw: Record<string, unknown>) {
  const result = parseQueueQuery(raw);
  expect(result.ok).toBe(false);
}

describe("UNIT-09 defaults, permitted values, and rejection", () => {
  it("applies the documented defaults when nothing is supplied", () => {
    expect(ok({})).toEqual({
      q: null,
      status: null,
      // Lab 4 (D-12): the optional `group` filter, none by default.
      group: null,
      itPriority: null,
      categoryId: null,
      owner: { kind: "any" },
      sort: "itPriority",
      direction: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("accepts every permitted sort, direction, and page size", () => {
    for (const sort of ["itPriority", "createdAt", "updatedAt"]) expect(ok({ sort }).sort).toBe(sort);
    for (const direction of ["asc", "desc"]) expect(ok({ direction }).direction).toBe(direction);
    for (const pageSize of ["10", "20", "50"]) expect(ok({ pageSize }).pageSize).toBe(Number(pageSize));
  });

  it("accepts every status and priority filter value", () => {
    expect(ok({ status: "WAITING_FOR_REQUESTER" }).status).toBe("WAITING_FOR_REQUESTER");
    expect(ok({ itPriority: "URGENT" }).itPriority).toBe("URGENT");
    expect(ok({ categoryId: "3" }).categoryId).toBe(3);
  });

  it("parses each owner form (D-18)", () => {
    expect(ok({ owner: "any" }).owner).toEqual({ kind: "any" });
    expect(ok({ owner: "unassigned" }).owner).toEqual({ kind: "unassigned" });
    expect(ok({ owner: "me" }).owner).toEqual({ kind: "me" });
    expect(ok({ owner: "7" }).owner).toEqual({ kind: "user", id: 7 });
  });

  it("rejects unknown values rather than correcting them (BR-58)", () => {
    rejected({ sort: "summary" });
    rejected({ sort: "ITPRIORITY" });
    rejected({ direction: "down" });
    rejected({ pageSize: "15" });
    rejected({ pageSize: "abc" });
    rejected({ page: "0" });
    rejected({ page: "-1" });
    rejected({ page: "1.5" });
    rejected({ status: "DONE" });
    rejected({ status: "new" });
    rejected({ itPriority: "CRITICAL" });
    rejected({ categoryId: "0" });
    rejected({ categoryId: "abc" });
    rejected({ owner: "nobody" });
    rejected({ owner: "0" });
  });

  it("rejects ids and pages beyond the database's integer range rather than letting them reach it", () => {
    expect(ok({ categoryId: "2147483647" }).categoryId).toBe(2147483647);
    expect(ok({ owner: "2147483647" }).owner).toEqual({ kind: "user", id: 2147483647 });
    rejected({ categoryId: "2147483648" });
    rejected({ categoryId: "9999999999" });
    rejected({ owner: "9999999999" });
    rejected({ page: "99999999999999999999" });
  });

  it("rejects numbers not written as plain digits", () => {
    rejected({ page: "1.0" });
    rejected({ pageSize: "10.0" });
    rejected({ categoryId: "1e0" });
    rejected({ owner: "+7" });
  });

  it("rejects a parameter given twice", () => {
    rejected({ status: ["NEW", "OPEN"] });
    rejected({ sort: ["createdAt", "updatedAt"] });
  });
});

describe("UNIT-10 search", () => {
  it("trims the search term", () => {
    expect(ok({ q: "  printer  " }).q).toBe("printer");
  });

  it("treats a blank term as absent (BR-53)", () => {
    expect(ok({ q: "" }).q).toBeNull();
    expect(ok({ q: "    " }).q).toBeNull();
  });

  it("keeps % and _ as typed — the route matches them literally", () => {
    expect(ok({ q: "50%" }).q).toBe("50%");
    expect(ok({ q: "file_name" }).q).toBe("file_name");
  });

  it("rejects a NUL character", () => {
    rejected({ q: "a\u0000b" });
  });
});

describe("ordering", () => {
  it("keeps the oldest ticket first within an IT Priority (BR-55)", () => {
    expect(queueOrderBy("itPriority", "desc")).toEqual([{ itPriority: "desc" }, { createdAt: "asc" }, { id: "desc" }]);
    expect(queueOrderBy("itPriority", "asc")).toEqual([{ itPriority: "asc" }, { createdAt: "asc" }, { id: "desc" }]);
  });

  it("ends every sort with id descending (BR-56)", () => {
    expect(queueOrderBy("createdAt", "asc")).toEqual([{ createdAt: "asc" }, { id: "desc" }]);
    expect(queueOrderBy("updatedAt", "desc")).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });
});
