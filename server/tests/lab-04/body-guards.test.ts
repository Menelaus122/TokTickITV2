import { describe, expect, it } from "vitest";
import { MAX_ID } from "../../src/queryParams.js";
import { NUL_MESSAGE, bodyId, findNul, nulFailure } from "../../src/bodyGuards.js";

// UNIT-12 — the two guards of BR-52, as pure functions. PostgreSQL text cannot hold a NUL character
// and an `Int` column cannot hold a number above 2147483647; either would reach the database and
// come back as a 500, so each is refused first, as a 400 on the field.

describe("UNIT-12 findNul: a NUL anywhere in a body is found, and named", () => {
  it("finds one in a top-level string and returns the field's name", () => {
    expect(findNul({ summary: "Printer\u0000 jams" })).toBe("summary");
  });

  it("finds one at the very start, the very end, and as the whole value", () => {
    expect(findNul({ a: "\u0000start" })).toBe("a");
    expect(findNul({ a: "end\u0000" })).toBe("a");
    expect(findNul({ a: "\u0000" })).toBe("a");
  });

  it("finds one inside an object, naming the path with dots", () => {
    expect(findNul({ outer: { inner: { deep: "x\u0000y" } } })).toBe("outer.inner.deep");
  });

  it("finds one inside an array, naming the index", () => {
    expect(findNul({ list: ["fine", "bad\u0000"] })).toBe("list[1]");
    expect(findNul({ list: [{ note: "ok" }, { note: "no\u0000" }] })).toBe("list[1].note");
  });

  it("finds one in a key, because a key is a string of the body too", () => {
    expect(findNul({ "ke\u0000y": 1 })).toContain("ke");
    expect(findNul({ "ke\u0000y": 1 })).not.toBeNull();
  });

  it("reports the first one in the order the body was written", () => {
    expect(findNul({ first: "a\u0000", second: "b\u0000" })).toBe("first");
    expect(findNul({ clean: "ok", bad: { x: "\u0000" }, later: "\u0000" })).toBe("bad.x");
  });

  it("reports the first one of an array in its order too, not the last", () => {
    expect(findNul({ list: ["a\u0000", "b\u0000"] })).toBe("list[0]");
    expect(findNul(["ok", "x\u0000", "y\u0000"])).toBe("[1]");
    expect(findNul({ rows: [{ note: "ok" }, { note: "first\u0000" }, { note: "second\u0000" }] })).toBe("rows[1].note");
  });

  it("finds one in a string that is itself the body", () => {
    expect(findNul("a\u0000b")).toBe("");
  });

  it("finds none in text with every other control character, an emoji, or non-Latin letters", () => {
    expect(findNul({ a: "tab\there\nnew line\r\u0001\u001f\u007f", b: "😀 ทดสอบ ñ  " })).toBeNull();
  });

  it("finds none in numbers, booleans, null, empty strings, empty objects, and empty arrays", () => {
    expect(findNul({ n: 0, f: 1.5, t: true, z: null, e: "", o: {}, a: [] })).toBeNull();
    expect(findNul(null)).toBeNull();
    expect(findNul(undefined)).toBeNull();
    expect(findNul(0)).toBeNull();
    expect(findNul([])).toBeNull();
  });

  it("does not recurse: a body nested far deeper than the call stack is walked, not crashed on", () => {
    let nested: unknown = { leaf: "ok" };
    for (let level = 0; level < 50_000; level += 1) nested = { next: nested };
    expect(findNul(nested)).toBeNull();

    let bad: unknown = { leaf: "no\u0000" };
    for (let level = 0; level < 50_000; level += 1) bad = { next: bad };
    expect(findNul(bad)).not.toBeNull();
  });

  it("does not loop on a value that refers to itself", () => {
    const loop: Record<string, unknown> = { name: "ok" };
    loop.self = loop;
    expect(() => findNul(loop)).not.toThrow();
  });
});

describe("UNIT-12 nulFailure: the answer a handler sends", () => {
  it("is null for a clean body", () => {
    expect(nulFailure({ body: "hello", n: 3 })).toBeNull();
    expect(nulFailure(undefined)).toBeNull();
  });

  it("is the Lab 3 envelope, VALIDATION_FAILED, with the offending field and a plain message", () => {
    expect(nulFailure({ body: "a\u0000b" })).toEqual({
      error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields: { body: NUL_MESSAGE } },
    });
  });

  it("names a nested field by its path, and a body that is a bare string by 'body'", () => {
    expect(nulFailure({ a: { b: "\u0000" } })?.error.fields).toEqual({ "a.b": NUL_MESSAGE });
    expect(nulFailure("x\u0000")?.error.fields).toEqual({ body: NUL_MESSAGE });
  });

  it("says nothing about NUL beyond the fact, so no internal detail is in it", () => {
    expect(NUL_MESSAGE).toBe("This text contains a character that is not allowed.");
    expect(JSON.stringify(nulFailure({ x: "\u0000" }))).not.toMatch(/postgres|prisma|invalid byte|0x00|\\u0000/i);
  });
});

describe("UNIT-12 bodyId: an id in a request body is a JSON integer from 1 to 2147483647", () => {
  it("accepts the whole range, and both of its ends", () => {
    expect(bodyId(1)).toBe(1);
    expect(bodyId(2)).toBe(2);
    expect(bodyId(42)).toBe(42);
    expect(bodyId(MAX_ID - 1)).toBe(MAX_ID - 1);
    expect(bodyId(MAX_ID)).toBe(2_147_483_647);
  });

  it("rejects zero and the one above the end", () => {
    expect(bodyId(0)).toBeNull();
    expect(bodyId(2_147_483_648)).toBeNull();
    expect(bodyId(MAX_ID + 1)).toBeNull();
  });

  it("rejects a negative number, a fraction, and a number far past the column", () => {
    expect(bodyId(-1)).toBeNull();
    expect(bodyId(1.5)).toBeNull();
    expect(bodyId(0.1)).toBeNull();
    expect(bodyId(9_999_999_999)).toBeNull();
    expect(bodyId(Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(bodyId(1e21)).toBeNull();
  });

  it('rejects "1": a body id is a number, and a string is never guessed at', () => {
    expect(bodyId("1")).toBeNull();
    expect(bodyId("2147483647")).toBeNull();
    expect(bodyId(" 1")).toBeNull();
  });

  it("rejects everything else a JSON body can carry in an id's place", () => {
    for (const value of [null, undefined, true, false, "", {}, [], [1], NaN, Infinity, -Infinity]) {
      expect(bodyId(value), String(value)).toBeNull();
    }
  });
});
