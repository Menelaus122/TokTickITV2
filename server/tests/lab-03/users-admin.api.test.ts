import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle } from "../../src/loginThrottle.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 10 — Administrator User Management (API-53 to API-66 in
// docs/lab-03/tests.md; api-spec §6, BR-45 to BR-52). Needs the migrated and
// seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// Every account this suite changes is one it created, except in the BR-49
// race, which briefly deactivates the seeded Administrators so that two of
// this suite's own are the only active ones, and restores them afterwards.
// Suites run one file at a time (vitest.config.ts), so no other suite sees it.

const prisma = getPrisma();
const stamp = Date.now().toString(36);
const PASSWORD = "Admin-suite#2026";
const NEW_PASSWORD = "Changed-suite#2026";

const createdIds: number[] = [];
const ticketIds: number[] = [];
const cookies = {} as Record<"admin" | "staff" | "requester", string>;
let adminId: number;

const users = (query: Record<string, string> = {}, cookie = cookies.admin) =>
  request(app).get("/api/admin/users").query(query).set("Cookie", cookie);
const create = (body: unknown, cookie = cookies.admin) =>
  request(app).post("/api/admin/users").set("Cookie", cookie).send(body as object);
const edit = (id: number, body: unknown, cookie = cookies.admin) =>
  request(app).patch(`/api/admin/users/${id}`).set("Cookie", cookie).send(body as object);
const issuePassword = (id: number, initialPassword: unknown, cookie = cookies.admin) =>
  request(app).post(`/api/admin/users/${id}/initial-password`).set("Cookie", cookie).send({ initialPassword });
const login = (email: string, password: string) => request(app).post("/api/auth/login").send({ email, password });

function cookieFrom(res: request.Response): string {
  const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("tt_sid="))!;
  return cookie.split(";")[0];
}

let sequence = 0;
function newUser(overrides: Record<string, unknown> = {}) {
  return {
    fullName: `Suite Person ${sequence}`,
    email: `admin.suite.${stamp}.${sequence++}@example.test`,
    role: "REQUESTER",
    isActive: true,
    initialPassword: PASSWORD,
    ...overrides,
  };
}

/** Creates a user directly, ready to sign in (no password change pending). */
async function seedUser(role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", overrides: { isActive?: boolean } = {}) {
  const user = await prisma.user.create({
    data: {
      fullName: `Suite ${role} ${sequence}`,
      email: `admin.suite.${stamp}.${sequence++}@example.test`,
      role,
      isActive: overrides.isActive ?? true,
      passwordHash: await hashPassword(PASSWORD),
      mustChangePassword: false,
    },
  });
  createdIds.push(user.id);
  return user;
}

async function signedIn(email: string) {
  const res = await login(email, PASSWORD);
  expect(res.status, email).toBe(201);
  return cookieFrom(res);
}

beforeAll(async () => {
  resetLoginThrottle();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false }, orderBy: { id: "asc" } });
  const staff = await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true, mustChangePassword: false } });
  const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true, mustChangePassword: false } });
  adminId = admin.id;
  cookies.admin = await signInAs(admin.id);
  cookies.staff = await signInAs(staff.id);
  cookies.requester = await signInAs(requester.id);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  const created = await prisma.user.findMany({ where: { email: { startsWith: `admin.suite.${stamp}.` } }, select: { id: true } });
  const ids = [...new Set([...createdIds, ...created.map((u) => u.id)])];
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await endTestSessions();
  resetLoginThrottle();
  await prisma.$disconnect();
});

describe("GET /api/admin/users", () => {
  it("API-53 lists every user with name, email, role, and status, and no password material (AC-28, BR-52)", async () => {
    const res = await users();
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(await prisma.user.count());
    for (const user of res.body.users) {
      expect(Object.keys(user).sort()).toEqual(["department", "email", "fullName", "id", "isActive", "lastLoginAt", "mustChangePassword", "role"]);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$|tokenHash|session/i);
  });

  it("orders by name", async () => {
    const names = (await users()).body.users.map((u: { fullName: string }) => u.fullName);
    expect(names).toEqual([...names].sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it("API-54 matches q against name and email, case-insensitively (AC-29)", async () => {
    const target = await seedUser("REQUESTER");
    const byName = await users({ q: target.fullName.toUpperCase() });
    expect(byName.body.users.map((u: { id: number }) => u.id)).toContain(target.id);
    const byEmail = await users({ q: target.email.toUpperCase() });
    expect(byEmail.body.users.map((u: { id: number }) => u.id)).toEqual([target.id]);
    for (const user of (await users({ q: "suite" })).body.users) {
      expect(`${user.fullName} ${user.email}`.toLowerCase()).toContain("suite");
    }
    expect((await users({ q: "nobody-matches-this-zzz" })).body.users).toEqual([]);
  });

  it("API-55 filters by one role, and refuses an unknown role with 400 INVALID_QUERY", async () => {
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]) {
      const res = await users({ role });
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(await prisma.user.count({ where: { role: role as "REQUESTER" } }));
      for (const user of res.body.users) expect(user.role).toBe(role);
    }
    for (const role of ["ADMIN", "requester"]) {
      const res = await users({ role });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_QUERY");
      expect(res.body.users).toBeUndefined();
    }
  });
});

describe("POST /api/admin/users", () => {
  it("API-56 creates a user with one role who must change the password (BR-46, AC-30)", async () => {
    const body = newUser({ role: "IT_STAFF", mustChangePassword: false, passwordHash: "x" });
    const res = await create({ ...body, email: body.email.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ fullName: body.fullName, email: body.email, role: "IT_STAFF", isActive: true, mustChangePassword: true });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|initialPassword|Admin-suite|\$2[aby]\$/i);
    createdIds.push(res.body.user.id);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.mustChangePassword).toBe(true);
  });

  it("API-58 the new user signs in, must change the password, and can work once it is changed (AC-30)", async () => {
    const body = newUser({ role: "REQUESTER" });
    const created = await create(body);
    createdIds.push(created.body.user.id);

    const signIn = await login(body.email, PASSWORD);
    expect(signIn.status).toBe(201);
    expect(signIn.body.user.mustChangePassword).toBe(true);
    const cookie = cookieFrom(signIn);
    const blocked = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(changed.status).toBe(200);
    expect((await request(app).get("/api/tickets").set("Cookie", cookie)).status).toBe(200);
  });

  it("API-57 refuses an email already in use, differing only in case, on the email field (BR-45, AC-31)", async () => {
    const existing = await seedUser("REQUESTER");
    const res = await create(newUser({ email: existing.email.toUpperCase() }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
    expect(res.body.error.fields.email).toBeDefined();
  });

  it("API-59 refuses an invalid role, a 7-character password, and a blank name, each on its own field (FR-43)", async () => {
    const res = await create(newUser({ role: "SUPERUSER", initialPassword: "Short#1", fullName: "   " }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["fullName", "initialPassword", "role"]);

    for (const [body, field] of [
      [newUser({ role: ["IT_STAFF", "ADMINISTRATOR"] }), "role"],
      [newUser({ isActive: undefined }), "isActive"],
      [newUser({ email: "not-an-email" }), "email"],
      [newUser({ initialPassword: "x".repeat(73) }), "initialPassword"],
    ] as const) {
      const one = await create(body);
      expect(one.status, field).toBe(400);
      expect(Object.keys(one.body.error.fields), field).toEqual([field]);
    }
  });

  it("creates an inactive account that cannot sign in", async () => {
    const body = newUser({ isActive: false });
    const res = await create(body);
    expect(res.status).toBe(201);
    createdIds.push(res.body.user.id);
    expect((await login(body.email, PASSWORD)).status).toBe(403);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("API-60 edits name, email, role, and activation, and ignores password fields (AC-28)", async () => {
    const target = await seedUser("REQUESTER");
    const email = `admin.suite.${stamp}.renamed.${sequence++}@example.test`;
    for (const [body, expected] of [
      [{ fullName: "Renamed Person" }, { fullName: "Renamed Person" }],
      [{ email: email.toUpperCase() }, { email }],
      [{ role: "IT_STAFF" }, { role: "IT_STAFF" }],
      [{ isActive: false }, { isActive: false }],
      [{ isActive: true }, { isActive: true }],
    ] as const) {
      const res = await edit(target.id, body);
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(res.body.user).toMatchObject(expected);
    }
    const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    const ignored = await edit(target.id, { passwordHash: "x", mustChangePassword: true, initialPassword: "Ignored#2026" });
    expect(ignored.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.mustChangePassword).toBe(false);
  });

  it("API-61 refuses an email already in use by another user, and allows keeping one's own", async () => {
    const a = await seedUser("REQUESTER");
    const b = await seedUser("REQUESTER");
    const res = await edit(b.id, { email: a.email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
    expect(res.body.error.fields.email).toBeDefined();
    expect((await edit(b.id, { email: b.email })).status).toBe(200);
  });

  it("validates each field sent and answers 404 for an unknown user", async () => {
    const target = await seedUser("REQUESTER");
    for (const body of [{ fullName: "" }, { email: "nope" }, { role: "ROOT" }, { isActive: "no" }]) {
      const res = await edit(target.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    }
    expect((await edit(2147483647, { fullName: "Nobody" })).status).toBe(404);
    expect((await edit(Number.NaN, { fullName: "Nobody" })).status).toBe(400);
  });

  it("API-62 refuses an Administrator deactivating themselves or changing their own role (BR-48, AC-32)", async () => {
    for (const body of [{ isActive: false }, { role: "IT_STAFF" }, { role: "REQUESTER", isActive: false }]) {
      const res = await edit(adminId, body);
      expect(res.status, JSON.stringify(body)).toBe(409);
      expect(res.body.error.code).toBe("SELF_DEACTIVATION");
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({ role: "ADMINISTRATOR", isActive: true });
    // Their own name is still theirs to change (D-15).
    const me = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect((await edit(adminId, { fullName: me.fullName, role: "ADMINISTRATOR", isActive: true })).status).toBe(200);
  });

  it("API-63 never leaves zero active Administrators, even when two deactivate each other at once (BR-49, AC-33)", async () => {
    const a = await seedUser("ADMINISTRATOR");
    const b = await seedUser("ADMINISTRATOR");
    const cookieA = await signedIn(a.email);
    const cookieB = await signedIn(b.email);
    // Make a and b the only active Administrators for this test.
    const others = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [a.id, b.id] } },
      select: { id: true },
    });
    await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: false } });
    try {
      const results = await Promise.all([edit(b.id, { isActive: false }, cookieA), edit(a.id, { role: "IT_STAFF" }, cookieB)]);
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      // The loser was judged after the winner: refused as the last
      // Administrator, or already signed out by the winner's deactivation.
      for (const res of results.filter((r) => r.status !== 200)) {
        expect([401, 409]).toContain(res.status);
        if (res.status === 409) expect(res.body.error.code).toBe("LAST_ADMINISTRATOR");
      }
      expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: true } });
    }
  });

  it("API-63 waits for any concurrent change to the active Administrators before deciding (BR-49)", async () => {
    // The race above rarely overlaps for real, so this holds the lock itself:
    // while another transaction has an active Administrator's row locked, the
    // route must not decide, because what it would count may be about to change.
    const target = await seedUser("ADMINISTRATOR");
    let answered = false;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${adminId} FOR UPDATE`;
      const pending = edit(target.id, { isActive: false }).then((res) => {
        answered = true;
        return res;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(answered).toBe(false);
      // Released when this transaction ends; the route then proceeds.
      void pending.then((res) => expect(res.status).toBe(200));
    });
    await expect.poll(() => answered, { timeout: 3000 }).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isActive).toBe(false);
  });

  it("API-65 deactivating a user deletes their sessions and keeps their ticket ownership (BR-51, BR-26)", async () => {
    const staff = await seedUser("IT_STAFF");
    const cookie = await signedIn(staff.email);
    const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true } });
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TT-9996-${String(Date.now() % 90000).padStart(5, "0")}`,
        requesterId: requester.id,
        ownerId: staff.id,
        categoryId: (await prisma.category.findFirstOrThrow()).id,
        relatedSystemId: (await prisma.relatedSystem.findFirstOrThrow()).id,
        summary: "Owned by a soon-inactive account",
        description: "Created by the admin users suite.",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "IN_PROGRESS",
      },
    });
    ticketIds.push(ticket.id);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", cookie)).status).toBe(200);

    expect((await edit(staff.id, { isActive: false })).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: staff.id } })).toBe(0);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", cookie)).status).toBe(401);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBe(staff.id);
  });
});

describe("POST /api/admin/users/:id/initial-password", () => {
  it("API-64 sets a new initial password: old sessions stop working and the next sign-in must change it (BR-47, AC-34)", async () => {
    const target = await seedUser("REQUESTER");
    const oldCookie = await signedIn(target.email);
    expect((await request(app).get("/api/tickets").set("Cookie", oldCookie)).status).toBe(200);

    const res = await issuePassword(target.id, "Fresh-start#2026");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mustChangePassword: true });

    expect((await request(app).get("/api/tickets").set("Cookie", oldCookie)).status).toBe(401);
    expect((await login(target.email, PASSWORD)).status).toBe(401);
    const fresh = await login(target.email, "Fresh-start#2026");
    expect(fresh.status).toBe(201);
    expect(fresh.body.user.mustChangePassword).toBe(true);
  });

  it("validates the password, refuses the caller's own account, and answers 404 for an unknown user", async () => {
    const target = await seedUser("REQUESTER");
    for (const password of [undefined, "", "Short#1", "x".repeat(73), target.email]) {
      const res = await issuePassword(target.id, password);
      expect(res.status, String(password)).toBe(400);
      expect(res.body.error.fields.initialPassword).toBeDefined();
    }
    const own = await issuePassword(adminId, "Fresh-start#2026");
    expect(own.status).toBe(409);
    expect(own.body.error.code).toBe("SELF_DEACTIVATION");
    expect((await issuePassword(2147483647, "Fresh-start#2026")).status).toBe(404);
  });
});

describe("roles and removal", () => {
  it("refuses IT Staff and a Requester on every route with 403 and no user data, and 401 without a session", async () => {
    const target = await seedUser("REQUESTER");
    for (const cookie of [cookies.staff, cookies.requester]) {
      for (const res of [
        await users({}, cookie),
        await create(newUser(), cookie),
        await edit(target.id, { fullName: "Hijacked" }, cookie),
        await issuePassword(target.id, "Fresh-start#2026", cookie),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
        expect(res.body.users ?? res.body.user).toBeUndefined();
      }
    }
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).fullName).not.toBe("Hijacked");
  });

  it("API-66 has no delete route for a user (BR-50)", async () => {
    const target = await seedUser("REQUESTER");
    const res = await request(app).delete(`/api/admin/users/${target.id}`).set("Cookie", cookies.admin);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(await prisma.user.findUnique({ where: { id: target.id } })).not.toBeNull();
  });
});
