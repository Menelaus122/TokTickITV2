import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle } from "../../src/loginThrottle.js";

// Lab 3, Issue 13 — login attempt throttling through the API (API-69 to
// API-72 in docs/lab-03/tests.md). The counter is reset before every test, so
// one test's failures cannot lock out the next test's account.

const prisma = getPrisma();
const stamp = Date.now();
const PASSWORD = "Correct-horse-1";
const WRONG = "Wrong-horse-1";

const emails = {
  victim: `throttle.victim.${stamp}@example.test`,
  bystander: `throttle.bystander.${stamp}@example.test`,
  inactive: `throttle.inactive.${stamp}@example.test`,
  unknown: `throttle.nobody.${stamp}@example.test`,
};
const ids: number[] = [];

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  for (const [key, email] of Object.entries(emails)) {
    if (key === "unknown") continue;
    const user = await prisma.user.create({
      data: {
        fullName: `Throttle Suite ${key}`,
        email,
        role: "REQUESTER",
        isActive: key !== "inactive",
        mustChangePassword: false,
        passwordHash,
      },
    });
    ids.push(user.id);
  }
});

beforeEach(() => {
  resetLoginThrottle();
});

afterAll(async () => {
  resetLoginThrottle();
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

const login = (email: string, password: string) => request(app).post("/api/auth/login").send({ email, password });

async function failFiveTimes(email: string) {
  for (let i = 0; i < 5; i++) {
    const res = await login(email, WRONG);
    expect(res.status, `failure ${i + 1}`).toBe(401);
  }
}

describe("POST /api/auth/login throttling (BR-67)", () => {
  it("API-69 locks an email after five failures, refusing even the right password", async () => {
    await failFiveTimes(emails.victim);
    const sessionsBefore = await prisma.session.count({ where: { userId: ids[0] } });

    const res = await login(emails.victim, PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { code: "TOO_MANY_ATTEMPTS", message: "Too many sign-in attempts. Try again in 15 minutes." },
    });
    const retryAfter = Number(res.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(14 * 60);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.session.count({ where: { userId: ids[0] } })).toBe(sessionsBefore);
  });

  it("API-70 locks an unknown email exactly like a real one, so a lock reveals nothing (BR-16)", async () => {
    await failFiveTimes(emails.victim);
    await failFiveTimes(emails.unknown);

    const real = await login(emails.victim, WRONG);
    const unknown = await login(emails.unknown, WRONG);

    expect(unknown.status).toBe(429);
    expect(unknown.body).toEqual(real.body);
    expect(Math.abs(Number(unknown.headers["retry-after"]) - Number(real.headers["retry-after"]))).toBeLessThanOrEqual(2);
  });

  it("API-71 locks only that email, and a success clears its count", async () => {
    await failFiveTimes(emails.victim);
    expect((await login(emails.bystander, PASSWORD)).status).toBe(201);

    // Four failures, a success, then four more: never five in a row.
    for (let i = 0; i < 4; i++) expect((await login(emails.bystander, WRONG)).status).toBe(401);
    expect((await login(emails.bystander, PASSWORD)).status).toBe(201);
    for (let i = 0; i < 4; i++) expect((await login(emails.bystander, WRONG)).status).toBe(401);
    expect((await login(emails.bystander, PASSWORD)).status).toBe(201);
  });

  it("API-71 counts different spellings of one email together (BR-45)", async () => {
    for (const spelling of [emails.victim, emails.victim.toUpperCase(), `  ${emails.victim}  `, emails.victim, emails.victim.toUpperCase()]) {
      expect((await login(spelling, WRONG)).status).toBe(401);
    }
    expect((await login(emails.victim, PASSWORD)).status).toBe(429);
  });

  it("API-72 does not count malformed requests or an inactive account's correct password", async () => {
    for (let i = 0; i < 6; i++) {
      expect((await login(emails.victim, "")).status).toBe(400);
    }
    expect((await login(emails.victim, PASSWORD)).status).toBe(201);

    for (let i = 0; i < 6; i++) {
      const res = await login(emails.inactive, PASSWORD);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
    }
  });
});
