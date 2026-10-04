import { describe, it, expect, afterEach } from "vitest";
import {
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
  isSessionExpired,
  sessionCookieOptions,
  sessionExpiry,
} from "../../src/session.js";

// Lab 3, Issue 3 — UNIT-04 and UNIT-05 in docs/lab-03/tests.md. Pure, no database.

describe("UNIT-04 session tokens (BR-09, BR-10)", () => {
  it("is 32 random bytes, URL-safe", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });

  it("is stored only as a 64-character SHA-256 hex digest", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hashSessionToken(generateSessionToken())).not.toBe(hash);
  });
});

describe("UNIT-05 session lifetime and cookie (BR-09, BR-11)", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("expires 8 hours after creation", () => {
    const now = new Date("2026-10-01T08:00:00.000Z");
    expect(SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000);
    expect(sessionExpiry(now).toISOString()).toBe("2026-10-01T16:00:00.000Z");
  });

  it("is valid one second before expiry and invalid at it and one second after", () => {
    const expiresAt = new Date("2026-10-01T16:00:00.000Z");
    expect(isSessionExpired(expiresAt, new Date("2026-10-01T15:59:59.000Z"))).toBe(false);
    expect(isSessionExpired(expiresAt, new Date("2026-10-01T16:00:00.000Z"))).toBe(true);
    expect(isSessionExpired(expiresAt, new Date("2026-10-01T16:00:01.000Z"))).toBe(true);
  });

  it("sets an HttpOnly, SameSite=Lax cookie for the whole site, lasting as long as the session", () => {
    process.env.NODE_ENV = "development";
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS,
      secure: false,
    });
  });

  it("marks the cookie Secure outside local development", () => {
    process.env.NODE_ENV = "production";
    expect(sessionCookieOptions().secure).toBe(true);
  });
});
