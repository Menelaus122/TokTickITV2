import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashSessionToken } from "../../src/session.js";
import { SEED_PASSWORD } from "../../prisma/seedData.js";

// Lab 3, Issue 6 — the Lab 2 Requester suites sign in like a person would,
// through POST /api/auth/login with the seeded password, and send the session
// cookie instead of the retired X-Requester-Id header.
//
// Every session made here is remembered, so endTestSessions() removes exactly
// those and a developer signed in to the same account in a browser stays
// signed in.

const tokens: string[] = [];

/** Signs in as a seeded account and returns its `Cookie` header value. */
export async function signInAs(userId: number): Promise<string> {
  const user = await getPrisma().user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: SEED_PASSWORD });
  if (res.status !== 201) {
    throw new Error(`Signing in as ${user.email} answered ${res.status}; is the database seeded?`);
  }
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith("tt_sid="))!.split(";")[0];
  tokens.push(cookie.slice("tt_sid=".length));
  return cookie;
}

/** Signs in as each id once; the map is keyed by user id. */
export async function signInAll(...userIds: number[]): Promise<Map<number, string>> {
  const cookies = new Map<number, string>();
  for (const id of userIds) cookies.set(id, await signInAs(id));
  return cookies;
}

export async function endTestSessions(): Promise<void> {
  if (tokens.length === 0) return;
  await getPrisma().session.deleteMany({ where: { tokenHash: { in: tokens.map(hashSessionToken) } } });
  tokens.length = 0;
}
