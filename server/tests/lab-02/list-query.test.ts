import { describe, it, expect } from "vitest";
import {
  parseTicketListQuery,
  buildPageMeta,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  PERMITTED_PAGE_SIZES,
} from "../../src/listQuery.js";

// UNIT-05 — the ticket-list query contract (BR-18 to BR-24).

function ok(raw: Record<string, unknown>) {
  const result = parseTicketListQuery(raw);
  if (!result.ok) throw new Error(`expected success, got: ${result.message}`);
  return result.value;
}

describe("defaults", () => {
  it("applies the documented defaults when nothing is supplied", () => {
    expect(ok({})).toEqual({
      search: null,
      categoryId: null,
      relatedSystemId: null,
      requestedPriority: null,
      currentStatus: null,
      sortBy: "createdAt",
      sortDir: "desc",
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("defaults to newest first", () => {
    const query = ok({});
    expect(query.sortBy).toBe("createdAt");
    expect(query.sortDir).toBe("desc");
  });
});

describe("search", () => {
  it("trims the term", () => {
    expect(ok({ search: "  laptop  " }).search).toBe("laptop");
  });

  it("ignores a term that is empty after trimming", () => {
    // A blank search is not a filter that matches nothing (BR-18).
    expect(ok({ search: "   " }).search).toBeNull();
    expect(ok({ search: "" }).search).toBeNull();
  });

  it("keeps internal spacing", () => {
    expect(ok({ search: "campus  wi-fi" }).search).toBe("campus  wi-fi");
  });
});

describe("filters", () => {
  it("accepts positive integer ids", () => {
    const query = ok({ categoryId: "2", relatedSystemId: "7" });
    expect(query.categoryId).toBe(2);
    expect(query.relatedSystemId).toBe(7);
  });

  it("treats an absent filter as no filter", () => {
    expect(ok({ categoryId: "" }).categoryId).toBeNull();
  });

  it("rejects a non-positive or non-integer id", () => {
    for (const bad of ["0", "-1", "1.5", "abc"]) {
      expect(parseTicketListQuery({ categoryId: bad }).ok).toBe(false);
      expect(parseTicketListQuery({ relatedSystemId: bad }).ok).toBe(false);
    }
  });

  it("accepts the four priorities and rejects anything else", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
      expect(ok({ requestedPriority: priority }).requestedPriority).toBe(priority);
    }
    expect(parseTicketListQuery({ requestedPriority: "CRITICAL" }).ok).toBe(false);
    expect(parseTicketListQuery({ requestedPriority: "low" }).ok).toBe(false);
  });

  it("accepts NEW as the only status Lab 2 produces", () => {
    expect(ok({ currentStatus: "NEW" }).currentStatus).toBe("NEW");
    expect(parseTicketListQuery({ currentStatus: "CLOSED" }).ok).toBe(false);
  });
});

describe("sorting", () => {
  it("accepts the two sortable fields", () => {
    expect(ok({ sortBy: "createdAt" }).sortBy).toBe("createdAt");
    expect(ok({ sortBy: "updatedAt" }).sortBy).toBe("updatedAt");
  });

  it("rejects an unknown sort field", () => {
    const result = parseTicketListQuery({ sortBy: "summary" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/sortBy/);
  });

  it("accepts both directions and rejects others", () => {
    expect(ok({ sortDir: "asc" }).sortDir).toBe("asc");
    expect(ok({ sortDir: "desc" }).sortDir).toBe("desc");
    expect(parseTicketListQuery({ sortDir: "sideways" }).ok).toBe(false);
  });
});

describe("pagination", () => {
  it("accepts a page of 1 or more", () => {
    expect(ok({ page: "1" }).page).toBe(1);
    expect(ok({ page: "9" }).page).toBe(9);
  });

  it("rejects page 0, a negative page, and a non-integer page", () => {
    for (const bad of ["0", "-1", "1.5", "abc"]) {
      expect(parseTicketListQuery({ page: bad }).ok).toBe(false);
    }
  });

  it("accepts only the permitted page sizes", () => {
    for (const size of PERMITTED_PAGE_SIZES) {
      expect(ok({ pageSize: String(size) }).pageSize).toBe(size);
    }
  });

  it("rejects an unpermitted page size instead of clamping it", () => {
    // Silent correction would hide client bugs and make the invalid-query
    // criterion untestable (BR-23).
    for (const bad of ["7", "0", "100", "abc"]) {
      expect(parseTicketListQuery({ pageSize: bad }).ok).toBe(false);
    }
  });
});

describe("repeated parameters", () => {
  it("rejects a filter supplied twice", () => {
    expect(parseTicketListQuery({ categoryId: ["1", "2"] }).ok).toBe(false);
  });

  it("accepts a single-element array, which is how one value can arrive", () => {
    expect(ok({ categoryId: ["2"] }).categoryId).toBe(2);
  });
});

describe("page metadata", () => {
  it("computes pages and neighbours for a middle page", () => {
    expect(buildPageMeta(2, 10, 25)).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasPrev: true,
      hasNext: true,
    });
  });

  it("marks the first and last pages correctly", () => {
    expect(buildPageMeta(1, 10, 25).hasPrev).toBe(false);
    expect(buildPageMeta(3, 10, 25).hasNext).toBe(false);
  });

  it("reports zero pages for an empty result set", () => {
    const meta = buildPageMeta(1, 10, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(false);
  });

  it("handles a page past the end without pretending there is more", () => {
    const meta = buildPageMeta(9, 10, 25);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
    expect(meta.totalItems).toBe(25);
  });
});
