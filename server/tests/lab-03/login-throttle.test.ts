import { describe, it, expect } from "vitest";
import { FAILURE_WINDOW_MS, LOCK_MS, LoginThrottle, MAX_FAILURES } from "../../src/loginThrottle.js";

// Lab 3, Issue 13 — UNIT-11 to UNIT-13 in docs/lab-03/tests.md. Pure, with an
// explicit clock, so a 15-minute lock is tested without waiting 15 minutes.

const MIN = 60 * 1000;
const EMAIL = "someone@toktickit.local";

function failTimes(throttle: LoginThrottle, email: string, times: number[]) {
  for (const at of times) throttle.recordFailure(email, at);
}

describe("UNIT-11 five failures lock the email for fifteen minutes (BR-67)", () => {
  it("does not lock after four failures", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 1, 2, 3]);
    expect(t.retryAfterSeconds(EMAIL, 4)).toBe(0);
  });

  it("locks on the fifth, for 15 minutes from that failure", () => {
    const t = new LoginThrottle();
    expect(MAX_FAILURES).toBe(5);
    expect(LOCK_MS).toBe(15 * MIN);
    failTimes(t, EMAIL, [0, 1 * MIN, 2 * MIN, 3 * MIN, 4 * MIN]);

    expect(t.retryAfterSeconds(EMAIL, 4 * MIN)).toBe(15 * 60);
    expect(t.retryAfterSeconds(EMAIL, 4 * MIN + 14 * MIN + 59_000)).toBe(1);
  });

  it("lifts the lock exactly when it expires, with a clean count", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0, 0, 0, 0]);
    expect(t.retryAfterSeconds(EMAIL, LOCK_MS)).toBe(0);
    expect(t.size).toBe(0);

    // One failure after the lock is one failure, not the sixth.
    t.recordFailure(EMAIL, LOCK_MS + 1);
    expect(t.retryAfterSeconds(EMAIL, LOCK_MS + 2)).toBe(0);
  });
});

describe("UNIT-12 only failures inside the window count", () => {
  it("forgets a failure once it is fifteen minutes old", () => {
    const t = new LoginThrottle();
    expect(FAILURE_WINDOW_MS).toBe(15 * MIN);
    // Four inside the window, then the oldest ages out just before the fifth.
    failTimes(t, EMAIL, [0, 5 * MIN, 10 * MIN, 14 * MIN, 15 * MIN]);
    expect(t.retryAfterSeconds(EMAIL, 15 * MIN)).toBe(0);

    // The next failure makes five inside the window: 5, 10, 14, 15, 15:01.
    t.recordFailure(EMAIL, 15 * MIN + 1000);
    expect(t.retryAfterSeconds(EMAIL, 15 * MIN + 1000)).toBe(15 * 60);
  });
});

describe("UNIT-14 attempts in flight count against the limit (BR-67)", () => {
  it("refuses a sixth attempt while five are still being checked", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 5; i++) expect(t.beginAttempt(EMAIL, 0).allowed).toBe(true);

    const sixth = t.beginAttempt(EMAIL, 0);
    expect(sixth).toEqual({ allowed: false, retryAfterSeconds: 15 * 60 });
  });

  it("counts in-flight attempts together with earlier failures", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0, 0]);
    expect(t.beginAttempt(EMAIL, 1).allowed).toBe(true);
    expect(t.beginAttempt(EMAIL, 1).allowed).toBe(true);
    expect(t.beginAttempt(EMAIL, 1).allowed).toBe(false);
  });

  it("locks when the reserved attempts come back as failures", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 5; i++) t.beginAttempt(EMAIL, 0);
    for (let i = 0; i < 5; i++) t.endAttempt(EMAIL, "failure", 1);
    expect(t.retryAfterSeconds(EMAIL, 1)).toBe(15 * 60);
  });

  it("gives the slot back for a neutral outcome without counting it", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 5; i++) t.beginAttempt(EMAIL, 0);
    for (let i = 0; i < 5; i++) t.endAttempt(EMAIL, "neutral", 0);
    expect(t.size).toBe(0);
    expect(t.beginAttempt(EMAIL, 0).allowed).toBe(true);
  });

  it("clears failures on success without losing other attempts still in flight", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0, 0]);
    t.beginAttempt(EMAIL, 1); // a guess still being checked
    t.beginAttempt(EMAIL, 1); // the correct password
    t.endAttempt(EMAIL, "success", 2);
    // One attempt is still in flight, so four more fit, not five.
    for (let i = 0; i < 4; i++) expect(t.beginAttempt(EMAIL, 3).allowed).toBe(true);
    expect(t.beginAttempt(EMAIL, 3).allowed).toBe(false);
  });
});

describe("UNIT-13 the counter's key, reset, and size limit", () => {
  it("treats case and surrounding spaces as the same email", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0]);
    failTimes(t, `  ${EMAIL.toUpperCase()} `, [0, 0, 0]);
    expect(t.retryAfterSeconds(EMAIL, 1)).toBeGreaterThan(0);
  });

  it("counts emails separately", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0, 0, 0, 0]);
    expect(t.retryAfterSeconds("someone.else@toktickit.local", 1)).toBe(0);
  });

  it("clears the count on a successful sign-in", () => {
    const t = new LoginThrottle();
    failTimes(t, EMAIL, [0, 0, 0, 0]);
    t.recordSuccess(EMAIL);
    failTimes(t, EMAIL, [1, 1, 1, 1]);
    expect(t.retryAfterSeconds(EMAIL, 2)).toBe(0);
  });

  it("never tracks more emails than its cap", () => {
    const t = new LoginThrottle(3);
    for (const n of [1, 2, 3, 4, 5]) t.recordFailure(`user${n}@example.test`, n);
    expect(t.size).toBe(3);
  });

  it("forgets unlocked emails before locked ones, so flooding cannot lift a lock", () => {
    const t = new LoginThrottle(3);
    failTimes(t, EMAIL, [0, 0, 0, 0, 0]); // locked, and the oldest entry
    for (const n of [1, 2, 3, 4, 5, 6]) t.recordFailure(`flood${n}@example.test`, n);

    expect(t.size).toBe(3);
    expect(t.retryAfterSeconds(EMAIL, 10)).toBeGreaterThan(0);
  });
});
