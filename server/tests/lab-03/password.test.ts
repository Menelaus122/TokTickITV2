import { describe, it, expect } from "vitest";
import {
  PASSWORD_MAX_BYTES,
  checkNewPassword,
  hashPassword,
  verifyPassword,
  verifyPasswordForLogin,
} from "../../src/password.js";

// Lab 3, Issue 3 — UNIT-01 to UNIT-03 in docs/lab-03/tests.md. Pure, no database.

const EMAIL = "someone@toktickit.local";

describe("UNIT-01 password length rules (BR-07)", () => {
  it.each([
    ["7 characters", "a".repeat(7), false],
    ["8 characters", "a".repeat(8), true],
    ["72 characters", "a".repeat(72), true],
    ["73 characters", "a".repeat(73), false],
  ])("%s", (_label, password, accepted) => {
    expect(checkNewPassword(password, EMAIL) === null).toBe(accepted);
  });

  it("rejects a password within 72 characters that exceeds bcrypt's 72-byte limit", () => {
    // 25 Thai characters are 75 bytes in UTF-8. bcrypt would silently ignore
    // the last three bytes, so two different passwords would verify as one.
    const thai = "ก".repeat(25);
    expect([...thai].length).toBeLessThanOrEqual(72);
    expect(Buffer.byteLength(thai, "utf8")).toBeGreaterThan(PASSWORD_MAX_BYTES);
    expect(checkNewPassword(thai, EMAIL)).toMatch(/too long/);
  });

  it("accepts a Thai password that fits in 72 bytes", () => {
    expect(checkNewPassword("ก".repeat(24), EMAIL)).toBeNull();
  });

  it("counts an emoji as one character, not two UTF-16 units", () => {
    // 7 letters plus one emoji is 8 characters, so it meets the minimum.
    expect(checkNewPassword("abcdefg\u{1F600}", EMAIL)).toBeNull();
  });

  it("never trims: leading and trailing spaces are part of the password", () => {
    expect(checkNewPassword("   abc   ", EMAIL)).toBeNull();
  });

  it("rejects a missing or non-string password", () => {
    expect(checkNewPassword("", EMAIL)).not.toBeNull();
    expect(checkNewPassword(undefined, EMAIL)).not.toBeNull();
    expect(checkNewPassword(12345678, EMAIL)).not.toBeNull();
  });
});

describe("UNIT-02 a password may not be the user's email (BR-07)", () => {
  it("rejects the email itself", () => {
    expect(checkNewPassword(EMAIL, EMAIL)).toMatch(/email/);
  });

  it("rejects the email in different case", () => {
    expect(checkNewPassword(EMAIL.toUpperCase(), EMAIL)).toMatch(/email/);
  });

  it("accepts a password that merely contains the email's name", () => {
    expect(checkNewPassword("someone-2026", EMAIL)).toBeNull();
  });
});

describe("UNIT-03 hashing (BR-06)", () => {
  it("round-trips, and the hash is never the password", async () => {
    const hash = await hashPassword("Correct-horse-1");
    expect(hash).not.toContain("Correct-horse-1");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword("Correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-1", hash)).toBe(false);
  });

  it("salts every hash, so the same password hashes differently twice", async () => {
    expect(await hashPassword("Correct-horse-1")).not.toBe(await hashPassword("Correct-horse-1"));
  });

  it("never matches a null hash, through either check (BR-66)", async () => {
    expect(await verifyPassword("anything-at-all", null)).toBe(false);
    expect(await verifyPasswordForLogin("anything-at-all", null)).toBe(false);
  });

  it("matches through the login check exactly as through the plain one", async () => {
    const hash = await hashPassword("Correct-horse-1");
    expect(await verifyPasswordForLogin("Correct-horse-1", hash)).toBe(true);
    expect(await verifyPasswordForLogin("Wrong-horse-1", hash)).toBe(false);
  });
});
