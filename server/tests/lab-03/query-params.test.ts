import { describe, it, expect } from "vitest";
import { MAX_ID, containsText, parseSearch, positiveId } from "../../src/queryParams.js";
import { routeId } from "../../src/routeId.js";

// The shared id and search parsing behind every list query and route id
// (api-spec §1.5): a value the database cannot hold is a 400, never a 500.

describe("positiveId", () => {
  it("accepts plain digits from 1 to the Int32 maximum", () => {
    expect(positiveId("1")).toBe(1);
    expect(positiveId("42")).toBe(42);
    expect(positiveId(String(MAX_ID))).toBe(2_147_483_647);
  });

  it("rejects anything above the Int32 maximum", () => {
    for (const bad of [String(MAX_ID + 1), "9999999999", "99999999999999999999"]) {
      expect(positiveId(bad), bad).toBeNull();
    }
  });

  it("rejects zero, signs, decimals, exponents, hex, and padding", () => {
    for (const bad of ["0", "00", "-1", "+1", "1.0", "1.5", "1e0", "0x1", " 1", "1 ", "", "abc"]) {
      expect(positiveId(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(positiveId(undefined)).toBeNull();
  });

  it("is what routeId uses, so a huge route id is malformed rather than a database error", () => {
    expect(routeId("13")).toBe(13);
    expect(routeId("9999999999")).toBeNull();
    expect(routeId("1e0")).toBeNull();
  });
});

describe("parseSearch", () => {
  it("trims, and treats blank as no search", () => {
    expect(parseSearch("q", "  printer  ")).toEqual({ ok: true, value: "printer" });
    expect(parseSearch("q", "   ")).toEqual({ ok: true, value: null });
    expect(parseSearch("q", undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects a NUL character, which PostgreSQL text cannot hold", () => {
    expect(parseSearch("q", "a\u0000b").ok).toBe(false);
  });
});

describe("containsText", () => {
  it("escapes the ILIKE wildcards and the escape character so the term is literal", () => {
    expect(containsText("50%")).toEqual({ contains: "50\\%", mode: "insensitive" });
    expect(containsText("file_name")).toEqual({ contains: "file\\_name", mode: "insensitive" });
    expect(containsText("a\\b")).toEqual({ contains: "a\\\\b", mode: "insensitive" });
    expect(containsText("printer")).toEqual({ contains: "printer", mode: "insensitive" });
  });
});
