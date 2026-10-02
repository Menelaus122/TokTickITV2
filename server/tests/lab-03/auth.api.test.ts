import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request, { type Response } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { SESSION_COOKIE, hashSessionToken } from "../../src/session.js";
import { resetLoginThrottle } from "../../src/loginThrottle.js";

// Lab 3, Issue 3 — authentication API (API-01 to API-14 and API-67 in
// docs/lab-03/tests.md). Needs the migrated database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The suite creates its own accounts and deletes them afterwards (their
// sessions go with them), so it never changes a seeded account's password.

const prisma = getPrisma();
const stamp = Date.now();
const PASSWORD = "Correct-horse-1";

const accounts = {
  active: { email: `auth.active.${stamp}@example.test`, mustChangePassword: false, isActive: true, hash: true },
  mustChange: { email: `auth.mustchange.${stamp}@example.test`, mustChangePassword: true, isActive: true, hash: true },
  changer: { email: `auth.changer.${stamp}@example.test`, mustChangePassword: false, isActive: true, hash: true },
  multi: { email: `auth.multi.${stamp}@example.test`, mustChangePassword: false, isActive: true, hash: true },
  inactive: { email: `auth.inactive.${stamp}@example.test`, mustChangePassword: false, isActive: false, hash: true },
  noHash: { email: `auth.nohash.${stamp}@example.test`, mustChangePassword: true, isActive: true, hash: false },
};
type AccountKey = keyof typeof accounts;
const ids = {} as Record<AccountKey, number>;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  for (const [key, a] of Object.entries(accounts) as [AccountKey, (typeof accounts)[AccountKey]][]) {
    const user = await prisma.user.create({
      data: {
        fullName: `Auth Suite ${key}`,
        email: a.email,
        role: "REQUESTER",
        isActive: a.isActive,
        mustChangePassword: a.mustChangePassword,
        passwordHash: a.hash ? passwordHash : null,
      },
    });
    ids[key] = user.id;
  }
});

// Several tests here fail a login on purpose. Without a reset, those failures
// would add up across tests and one would lock out another's account (BR-67).
beforeEach(() => {
  resetLoginThrottle();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.$disconnect();
});

function login(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

// The raw "tt_sid=<token>" pair from a response, for sending back as a Cookie.
function sessionCookie(res: Response): string {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error("no session cookie was set");
  return cookie.split(";")[0];
}

const tokenOf = (cookie: string) => cookie.slice(SESSION_COOKIE.length + 1);
const sessionsOf = (key: AccountKey) => prisma.session.count({ where: { userId: ids[key] } });

async function loggedIn(key: AccountKey, password = PASSWORD): Promise<string> {
  const res = await login(accounts[key].email, password);
  expect(res.status).toBe(201);
  return sessionCookie(res);
}

describe("POST /api/auth/login", () => {
  it("API-01 signs in an active user and returns only the permitted user shape", async () => {
    const res = await login(accounts.active.email, PASSWORD);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual(["email", "fullName", "id", "isActive", "mustChangePassword", "role"]);
    expect(res.body.user).toMatchObject({ id: ids.active, email: accounts.active.email, role: "REQUESTER", mustChangePassword: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|\$2[aby]\$|tt_sid/);

    // BR-09 — the cookie's attributes.
    const raw = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("tt_sid="))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\//);
    expect(raw).toMatch(/Max-Age=28800/);

    // BR-10 — the database holds the token's hash, never the token.
    const token = tokenOf(sessionCookie(res));
    const row = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
    expect(row?.userId).toBe(ids.active);
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.active } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it("API-01 matches the email case-insensitively (BR-45)", async () => {
    const res = await login(`  ${accounts.active.email.toUpperCase()}  `, PASSWORD);
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(ids.active);
  });

  it("API-01 replaces the session a browser already holds rather than adding a second", async () => {
    const first = await loggedIn("active");
    const res = await request(app).post("/api/auth/login").set("Cookie", first).send({ email: accounts.active.email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(await prisma.session.count({ where: { tokenHash: hashSessionToken(tokenOf(first)) } })).toBe(0);
    expect((await request(app).get("/api/auth/me").set("Cookie", first)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", sessionCookie(res))).status).toBe(200);
  });

  it("API-02 and API-03 answer an unknown email and a wrong password identically (AC-04)", async () => {
    const unknown = await login(`nobody.${stamp}@example.test`, PASSWORD);
    const wrong = await login(accounts.active.email, "Wrong-horse-1");

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
    expect(wrong.body).toEqual(unknown.body);
    expect(unknown.headers["set-cookie"]).toBeUndefined();
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("API-67 answers an account with no password exactly like a wrong password (BR-66)", async () => {
    const before = await sessionsOf("noHash");
    const res = await login(accounts.noHash.email, PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
    expect(await sessionsOf("noHash")).toBe(before);
  });

  it("API-04 refuses an inactive account only after the password is proven (AC-03, BR-08)", async () => {
    const right = await login(accounts.inactive.email, PASSWORD);
    expect(right.status).toBe(403);
    expect(right.body.error.code).toBe("ACCOUNT_INACTIVE");
    expect(right.headers["set-cookie"]).toBeUndefined();

    // With the wrong password, an inactive account is indistinguishable from
    // any other failed login: nothing about the account leaks.
    const wrong = await login(accounts.inactive.email, "Wrong-horse-1");
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    expect(await sessionsOf("inactive")).toBe(0);
  });

  it("API-05 rejects a malformed email and a missing password field by field", async () => {
    const res = await login("not-an-email", "");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["email", "password"]);

    const empty = await request(app).post("/api/auth/login").send({});
    expect(empty.status).toBe(400);
    expect(Object.keys(empty.body.error.fields).sort()).toEqual(["email", "password"]);
  });
});

describe("GET /api/auth/me", () => {
  it("API-06 returns the current user for a valid session", async () => {
    const cookie = await loggedIn("active");
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: ids.active,
      fullName: "Auth Suite active",
      email: accounts.active.email,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    });
  });

  it("API-06 answers 401 without a session, and reads identity from the cookie only (BR-13)", async () => {
    const none = await request(app).get("/api/auth/me");
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe("AUTH_REQUIRED");

    // A valid token sent anywhere other than the cookie is not a session.
    const token = tokenOf(await loggedIn("active"));
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get(`/api/auth/me?tt_sid=${token}`)).status).toBe(401);
  });

  it("API-14 treats an expired session as no session and removes it (BR-11)", async () => {
    const cookie = await loggedIn("active");
    const tokenHash = hashSessionToken(tokenOf(cookie));
    await prisma.session.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
    expect(await prisma.session.count({ where: { tokenHash } })).toBe(0);
  });
});

describe("POST /api/auth/logout", () => {
  it("API-07 ends the session, and the same cookie is refused afterwards (AC-05)", async () => {
    const cookie = await loggedIn("active");
    const tokenHash = hashSessionToken(tokenOf(cookie));

    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(204);
    expect(await prisma.session.count({ where: { tokenHash } })).toBe(0);
    // The browser is told to drop the cookie as well.
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(/tt_sid=;/);

    for (const call of [
      request(app).get("/api/auth/me").set("Cookie", cookie),
      request(app).post("/api/auth/password").set("Cookie", cookie).send({ currentPassword: PASSWORD, newPassword: "Another-horse-2", confirmPassword: "Another-horse-2" }),
    ]) {
      const after = await call;
      expect(after.status).toBe(401);
      expect(after.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("API-08 is not an error without a session, or when repeated", async () => {
    expect((await request(app).post("/api/auth/logout")).status).toBe(204);

    const cookie = await loggedIn("active");
    expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(204);
    expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(204);
  });
});

describe("POST /api/auth/password", () => {
  const change = (cookie: string, body: Record<string, unknown>) =>
    request(app).post("/api/auth/password").set("Cookie", cookie).send(body);

  it("API-09 reports each rule beneath its own field (AC-02)", async () => {
    const cookie = await loggedIn("changer");
    const cases: [Record<string, unknown>, string, RegExp][] = [
      [{ currentPassword: PASSWORD, newPassword: "short-7", confirmPassword: "short-7" }, "newPassword", /at least 8/],
      [{ currentPassword: PASSWORD, newPassword: "a".repeat(73), confirmPassword: "a".repeat(73) }, "newPassword", /at most 72/],
      [{ currentPassword: PASSWORD, newPassword: "ก".repeat(25), confirmPassword: "ก".repeat(25) }, "newPassword", /too long/],
      [{ currentPassword: PASSWORD, newPassword: accounts.changer.email, confirmPassword: accounts.changer.email }, "newPassword", /email/],
      [{ currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD }, "newPassword", /different/],
      [{ currentPassword: PASSWORD, newPassword: "Another-horse-2", confirmPassword: "Another-horse-3" }, "confirmPassword", /do not match/],
      [{ newPassword: "Another-horse-2", confirmPassword: "Another-horse-2" }, "currentPassword", /current password/],
    ];

    for (const [body, field, message] of cases) {
      const res = await change(cookie, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.fields[field]).toMatch(message);
    }

    // Nothing above changed the password.
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: ids.changer } });
    expect(await verifyPassword(PASSWORD, stored.passwordHash)).toBe(true);
  });

  it("API-10 refuses a wrong current password and changes nothing", async () => {
    const cookie = await loggedIn("changer");
    const res = await change(cookie, { currentPassword: "Wrong-horse-1", newPassword: "Another-horse-2", confirmPassword: "Another-horse-2" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect((await login(accounts.changer.email, PASSWORD)).status).toBe(201);
    expect((await login(accounts.changer.email, "Another-horse-2")).status).toBe(401);
  });

  it("API-11 clears the must-change flag, and the new password replaces the old one (BR-02)", async () => {
    const cookie = await loggedIn("mustChange");
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).body.user.mustChangePassword).toBe(true);

    const res = await change(cookie, { currentPassword: PASSWORD, newPassword: "Brand-new-horse-9", confirmPassword: "Brand-new-horse-9" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ changed: true });

    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).body.user.mustChangePassword).toBe(false);
    expect((await login(accounts.mustChange.email, PASSWORD)).status).toBe(401);
    expect((await login(accounts.mustChange.email, "Brand-new-horse-9")).status).toBe(201);
  });

  it("API-12 ends every other session of that user, and keeps the one that changed it (AC-06, BR-15)", async () => {
    const a = await loggedIn("multi");
    const b = await loggedIn("multi");
    expect(await sessionsOf("multi")).toBe(2);

    const res = await change(a, { currentPassword: PASSWORD, newPassword: "Rotated-horse-4", confirmPassword: "Rotated-horse-4" });
    expect(res.status).toBe(200);

    expect((await request(app).get("/api/auth/me").set("Cookie", b)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", a)).status).toBe(200);
    expect(await sessionsOf("multi")).toBe(1);
  });
});

describe("a session that must change its password (BR-14)", () => {
  it("API-13 reaches only the auth endpoints until the password is changed (AC-02)", async () => {
    // Its own account, so the API-11 change above does not interfere.
    const email = `auth.gate.${stamp}@example.test`;
    const gate = await prisma.user.create({
      data: { fullName: "Auth Suite gate", email, role: "REQUESTER", mustChangePassword: true, passwordHash: await hashPassword(PASSWORD) },
    });
    try {
      const cookie = sessionCookie(await login(email, PASSWORD));

      for (const path of ["/api/categories", "/api/related-systems", "/api/tickets", "/api/requesters"]) {
        const res = await request(app).get(path).set("Cookie", cookie);
        expect(res.status, path).toBe(403);
        expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
      }
      const create = await request(app).post("/api/tickets").set("Cookie", cookie).send({});
      expect(create.status).toBe(403);
      expect(create.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

      // What stays reachable: the current user, the change itself, logout,
      // and the public endpoints that do not act through the session.
      expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
      expect((await request(app).get("/api/health").set("Cookie", cookie)).status).toBe(200);
      const reached = await request(app).post("/api/auth/password").set("Cookie", cookie).send({});
      expect(reached.status).toBe(400); // the handler ran and validated, not the gate
      expect(reached.body.error.code).toBe("VALIDATION_FAILED");

      // Once changed, the same session reaches the rest of the API.
      const changed = await request(app).post("/api/auth/password").set("Cookie", cookie)
        .send({ currentPassword: PASSWORD, newPassword: "Unlocked-horse-5", confirmPassword: "Unlocked-horse-5" });
      expect(changed.status).toBe(200);
      expect((await request(app).get("/api/categories").set("Cookie", cookie)).status).toBe(200);

      expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(204);
    } finally {
      await prisma.user.delete({ where: { id: gate.id } });
    }
  });

  it("answers a request with no session cookie 401, not the password gate (Issue 6)", async () => {
    // With the Lab 2 header gone there is no anonymous path left: no cookie
    // means "sign in", never PASSWORD_CHANGE_REQUIRED, and the selector's list
    // of requesters no longer exists.
    const categories = await request(app).get("/api/categories");
    expect(categories.status).toBe(401);
    expect(categories.body.error.code).toBe("AUTH_REQUIRED");
    expect((await request(app).get("/api/requesters")).status).toBe(404);
  });
});
