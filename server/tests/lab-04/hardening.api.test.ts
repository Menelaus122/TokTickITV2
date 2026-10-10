import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request, { type Test } from "supertest";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { MAX_FAILURES, resetLoginThrottle } from "../../src/loginThrottle.js";
import { SEED_PASSWORD } from "../../prisma/seedData.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 4, Issue 9 — hardening (HARD-01, HARD-02, HARD-03 in docs/lab-04/tests.md §2.7;
// specification.md BR-51, BR-52; api-spec §7). Needs the migrated and seeded database:
//   cd server && npx prisma migrate deploy && npm run prisma:seed
//
// The seam is the HTTP boundary: a real login cookie, the real Express app, the real database.
//
// BR-52: a NUL character in any string of a request body, and an id in a body outside
// 1–2147483647, are a client's mistake and a 400 on the field. PostgreSQL cannot hold either, so
// before this issue each came back as a 500. Every case here has a control: the same request with
// clean text must succeed, so a 400 is never an answer to some other mistake in the body.

const prisma = getPrisma();
const HOUR = 60 * 60 * 1000;
const NUL = "\u0000";

type Who = "requester" | "staff" | "colleague" | "admin";
const ids = {} as Record<Who, number>;
const cookies = {} as Record<Who, string>;
const ticketIds: number[] = [];
const userIds: number[] = [];
let categoryId: number;
let relatedSystemId: number;
let passwordHash: string;
let sequence = 0;
const numberBase = Date.now() % 80000;
const stamp = Date.now().toString(36);

/** The same text with a NUL character in the middle of it. */
function dirty(clean: string): string {
  const at = Math.max(1, Math.floor(clean.length / 2));
  return clean.slice(0, at) + NUL + clean.slice(at);
}

function send(method: "post" | "patch", path: string, cookie: string | undefined, body: unknown): Test {
  const pending = request(app)[method](path);
  if (cookie) pending.set("Cookie", cookie);
  return pending.send(body as object);
}

async function makeTicket(options: { status?: "IN_PROGRESS" | "NEW"; ownerId?: number | null } = {}): Promise<number> {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TT-9992-${String(numberBase + sequence++).padStart(5, "0")}`,
      requesterId: ids.requester,
      ownerId: options.ownerId === undefined ? ids.staff : options.ownerId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 hardening suite ticket",
      description: "Created by the Lab 4 hardening suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: options.status ?? "IN_PROGRESS",
      createdAt: new Date(Date.now() - 24 * HOUR),
    },
  });
  ticketIds.push(ticket.id);
  return ticket.id;
}

/** An account that this suite may sign in as, change the password of, and delete. */
async function makeUser(role: "REQUESTER" | "IT_STAFF" = "REQUESTER"): Promise<{ id: number; email: string }> {
  const email = `hardening.${stamp}.${sequence++}@example.test`;
  const user = await prisma.user.create({
    data: { fullName: "Hardening Suite User", email, role, isActive: true, passwordHash, mustChangePassword: false },
    select: { id: true, email: true },
  });
  userIds.push(user.id);
  return user;
}

async function recordAction(ticketId: number): Promise<{ id: number; version: number }> {
  const res = await send("post", `/api/staff/tickets/${ticketId}/actions-taken`, cookies.staff, {
    actionAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    description: "Replaced the toner cartridge and ran a test page.",
    result: "Test page printed cleanly.",
    followUpRequired: false,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.action;
}

async function counts() {
  const [tickets, comments, notes, actions, history, attachments, users, sessions] = await Promise.all([
    prisma.ticket.count(),
    prisma.publicComment.count(),
    prisma.internalNote.count(),
    prisma.actionTaken.count(),
    prisma.ticketStatusChange.count(),
    prisma.attachment.count(),
    prisma.user.count(),
    prisma.session.count(),
  ]);
  return { tickets, comments, notes, actions, history, attachments, users, sessions };
}

const ticketRow = (id: number | undefined) =>
  id === undefined
    ? null
    : prisma.ticket.findUniqueOrThrow({
        where: { id },
        select: { version: true, currentStatus: true, ownerId: true, itPriority: true, requesterResolvedAt: true, updatedAt: true },
      });

const userRow = (id: number | undefined) =>
  id === undefined ? null : prisma.user.findUniqueOrThrow({ where: { id }, select: { fullName: true, email: true, role: true, isActive: true, passwordHash: true } });

beforeAll(async () => {
  const pick = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", skip = 0) =>
    prisma.user.findFirstOrThrow({
      where: { role, isActive: true, mustChangePassword: false },
      orderBy: { id: "asc" },
      select: { id: true },
      skip,
    });
  ids.requester = (await pick("REQUESTER")).id;
  ids.staff = (await pick("IT_STAFF")).id;
  ids.colleague = (await pick("IT_STAFF", 1)).id;
  ids.admin = (await pick("ADMINISTRATOR")).id;
  for (const who of Object.keys(ids) as Who[]) cookies[who] = await signInAs(ids[who]);

  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
  passwordHash = await hashPassword(SEED_PASSWORD);
  resetLoginThrottle();
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { OR: [{ id: { in: ticketIds } }, { summary: { startsWith: "Hardening suite" } }] } });
  await prisma.session.deleteMany({ where: { user: { email: { startsWith: "hardening." } } } });
  await prisma.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { email: { startsWith: "hardening." } }] } });
  await endTestSessions();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// HARD-01 — a NUL character in each text field of every write endpoint
// ---------------------------------------------------------------------------

interface Fixture {
  ticketId?: number;
  attachmentId?: number;
  actionId?: number;
  user?: { id: number; email: string };
  cookie?: string;
}
type Body = Record<string, unknown>;
interface Endpoint {
  /** The route as the source registers it, for the completeness check below. */
  route: string;
  label: string;
  /** What the clean request answers. */
  ok: number;
  setup: () => Promise<Fixture>;
  /** The request: a valid body, with `overrides` laid over it. */
  call: (fixture: Fixture, overrides: Body) => Test;
  /** Each text field of the body, and a clean value that the endpoint accepts. */
  fields: Array<{ name: string; clean: () => string }>;
}

const NEW_PASSWORD = "Hardening-New-2026";
const actionAt = () => new Date(Date.now() - 2 * HOUR).toISOString();
let keySequence = 0;
const uniqueKey = () => `hardening-key-${stamp}-${keySequence++}`;

const ENDPOINTS: Endpoint[] = [
  {
    route: "POST /api/tickets",
    label: "POST /api/tickets",
    ok: 201,
    setup: async () => ({}),
    call: (_f, o) =>
      send("post", "/api/tickets", cookies.requester, {
        categoryId,
        relatedSystemId,
        summary: "Hardening suite printer fault",
        description: "Hardening suite: the printer shows a jam with no paper stuck in it.",
        requestedPriority: "MEDIUM",
        ...o,
      }),
    fields: [
      { name: "summary", clean: () => "Hardening suite clean summary" },
      { name: "description", clean: () => "Hardening suite: a clean description of more than twenty characters." },
      { name: "requestedPriority", clean: () => "HIGH" },
    ],
  },
  {
    route: "PATCH /api/attachments/:id/remove",
    label: "PATCH /api/attachments/:id/remove",
    ok: 200,
    setup: async () => {
      const ticketId = await makeTicket();
      const attachment = await prisma.attachment.create({
        data: { ticketId, originalFilename: "evidence.png", storedFilename: `hardening-${randomUUID()}.png`, mimeType: "image/png", sizeBytes: 1024 },
      });
      return { ticketId, attachmentId: attachment.id };
    },
    call: (f, o) => send("patch", `/api/attachments/${f.attachmentId}/remove`, cookies.requester, { removalReason: "Uploaded to the wrong ticket", ...o }),
    fields: [{ name: "removalReason", clean: () => "Uploaded to the wrong ticket" }],
  },
  {
    route: "POST /:id/comments",
    label: "POST /api/tickets/:id/comments",
    ok: 201,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) => send("post", `/api/tickets/${f.ticketId}/comments`, cookies.requester, { body: "Still jammed after the restart.", ...o }),
    fields: [{ name: "body", clean: () => "Still jammed after the restart." }],
  },
  {
    route: "POST /:id/notes",
    label: "POST /api/tickets/:id/notes",
    ok: 201,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) => send("post", `/api/tickets/${f.ticketId}/notes`, cookies.staff, { body: "Checked the fuser, looks worn.", ...o }),
    fields: [{ name: "body", clean: () => "Checked the fuser, looks worn." }],
  },
  {
    route: "PATCH /:id/appears-resolved",
    label: "PATCH /api/tickets/:id/appears-resolved",
    ok: 200,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) => send("patch", `/api/tickets/${f.ticketId}/appears-resolved`, cookies.requester, { appearsResolved: true, comment: "It looks fixed from here.", ...o }),
    fields: [{ name: "comment", clean: () => "It looks fixed from here." }],
  },
  {
    route: "PATCH /tickets/:id/owner",
    label: "PATCH /api/staff/tickets/:id/owner",
    ok: 200,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) => send("patch", `/api/staff/tickets/${f.ticketId}/owner`, cookies.staff, { ownerId: ids.colleague, ...o }),
    fields: [],
  },
  {
    route: "PATCH /tickets/:id/it-priority",
    label: "PATCH /api/staff/tickets/:id/it-priority",
    ok: 200,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) => send("patch", `/api/staff/tickets/${f.ticketId}/it-priority`, cookies.staff, { itPriority: "HIGH", ...o }),
    fields: [{ name: "itPriority", clean: () => "HIGH" }],
  },
  {
    route: "PATCH /tickets/:id/status",
    label: "PATCH /api/staff/tickets/:id/status",
    ok: 200,
    setup: async () => {
      const ticketId = await makeTicket();
      await recordAction(ticketId);
      return { ticketId };
    },
    call: (f, o) =>
      send("patch", `/api/staff/tickets/${f.ticketId}/status`, cookies.staff, {
        currentStatus: "RESOLVED",
        reason: "Replaced the toner and printed a test page.",
        ...o,
      }),
    fields: [
      { name: "currentStatus", clean: () => "RESOLVED" },
      { name: "reason", clean: () => "Replaced the toner and printed a test page." },
    ],
  },
  {
    route: "POST /tickets/:id/actions-taken",
    label: "POST /api/staff/tickets/:id/actions-taken",
    ok: 201,
    setup: async () => ({ ticketId: await makeTicket() }),
    call: (f, o) =>
      send("post", `/api/staff/tickets/${f.ticketId}/actions-taken`, cookies.staff, {
        actionAt: actionAt(),
        description: "Replaced the toner cartridge and ran a test page.",
        result: "Test page printed cleanly.",
        followUpRequired: true,
        followUpNote: "Check the printer again on Thursday.",
        attachmentNotes: "The photo of the toner label.",
        requestKey: uniqueKey(),
        ...o,
      }),
    fields: [
      { name: "actionAt", clean: actionAt },
      { name: "description", clean: () => "Replaced the toner cartridge and ran a test page." },
      { name: "result", clean: () => "Test page printed cleanly." },
      { name: "followUpNote", clean: () => "Check the printer again on Thursday." },
      { name: "attachmentNotes", clean: () => "The photo of the toner label." },
      { name: "requestKey", clean: uniqueKey },
    ],
  },
  {
    route: "PATCH /tickets/:id/actions-taken/:actionId",
    label: "PATCH /api/staff/tickets/:id/actions-taken/:actionId",
    ok: 200,
    setup: async () => {
      const ticketId = await makeTicket();
      return { ticketId, actionId: (await recordAction(ticketId)).id };
    },
    call: (f, o) =>
      send("patch", `/api/staff/tickets/${f.ticketId}/actions-taken/${f.actionId}`, cookies.staff, {
        expectedVersion: 1,
        description: "Replaced the toner cartridge and ran two test pages.",
        followUpRequired: true,
        followUpNote: "Check the printer again on Friday.",
        ...o,
      }),
    fields: [
      { name: "description", clean: () => "Replaced the toner cartridge and ran two test pages." },
      { name: "result", clean: () => "Both test pages printed cleanly." },
      { name: "followUpNote", clean: () => "Check the printer again on Friday." },
      { name: "attachmentNotes", clean: () => "The photo of the toner label." },
      { name: "actionAt", clean: actionAt },
    ],
  },
  {
    route: "POST /users",
    label: "POST /api/admin/users",
    ok: 201,
    setup: async () => ({}),
    call: (_f, o) =>
      send("post", "/api/admin/users", cookies.admin, {
        fullName: "Hardening Created User",
        email: `hardening.created.${stamp}.${sequence++}@example.test`,
        role: "REQUESTER",
        isActive: true,
        initialPassword: "Hardening-Pass-2026",
        ...o,
      }),
    fields: [
      { name: "fullName", clean: () => "Hardening Created User" },
      { name: "email", clean: () => `hardening.created.${stamp}.${sequence++}@example.test` },
      { name: "role", clean: () => "IT_STAFF" },
      { name: "initialPassword", clean: () => "Hardening-Pass-2026" },
    ],
  },
  {
    route: "PATCH /users/:id",
    label: "PATCH /api/admin/users/:id",
    ok: 200,
    setup: async () => ({ user: await makeUser() }),
    call: (f, o) => send("patch", `/api/admin/users/${f.user!.id}`, cookies.admin, { fullName: "Hardening Renamed User", ...o }),
    fields: [
      { name: "fullName", clean: () => "Hardening Renamed User" },
      { name: "email", clean: () => `hardening.renamed.${stamp}.${sequence++}@example.test` },
      { name: "role", clean: () => "IT_STAFF" },
    ],
  },
  {
    route: "POST /users/:id/initial-password",
    label: "POST /api/admin/users/:id/initial-password",
    ok: 200,
    setup: async () => ({ user: await makeUser() }),
    call: (f, o) => send("post", `/api/admin/users/${f.user!.id}/initial-password`, cookies.admin, { initialPassword: "Hardening-Reset-2026", ...o }),
    fields: [{ name: "initialPassword", clean: () => "Hardening-Reset-2026" }],
  },
  {
    route: "POST /login",
    label: "POST /api/auth/login",
    ok: 201,
    setup: async () => ({ user: await makeUser() }),
    call: (f, o) => send("post", "/api/auth/login", undefined, { email: f.user!.email, password: SEED_PASSWORD, ...o }),
    fields: [
      { name: "email", clean: () => "" },
      { name: "password", clean: () => SEED_PASSWORD },
    ],
  },
  {
    route: "POST /password",
    label: "POST /api/auth/password",
    ok: 200,
    setup: async () => {
      const user = await makeUser();
      return { user, cookie: await signInAs(user.id) };
    },
    call: (f, o) =>
      send("post", "/api/auth/password", f.cookie, { currentPassword: SEED_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD, ...o }),
    fields: [
      { name: "currentPassword", clean: () => SEED_PASSWORD },
      { name: "newPassword", clean: () => NEW_PASSWORD },
      { name: "confirmPassword", clean: () => NEW_PASSWORD },
    ],
  },
];

// The write routes that are not in the table, each with the reason.
const NOT_IN_THE_TABLE: Record<string, string> = {
  "POST /logout": "reads no body and stores nothing; refusing a sign-out helps nobody",
  "POST /api/tickets/:id/attachments": "multipart: the file name is the only string, tested on its own below",
};

/** The value to send for a field: the clean one, or the dirty one. A login's email is the fixture's. */
function valueOf(endpoint: Endpoint, fixture: Fixture, field: { name: string; clean: () => string }, withNul: boolean): string {
  const clean = endpoint.route === "POST /login" && field.name === "email" ? fixture.user!.email : field.clean();
  return withNul ? dirty(clean) : clean;
}

const CASES = ENDPOINTS.flatMap((endpoint) => endpoint.fields.map((field) => ({ endpoint, field })));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function expectRefusedAsNul(res: { status: number; body: any }, field: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_FAILED");
  expect(res.body.error.message).toBe("One or more fields are invalid.");
  expect(res.body.error.fields).toHaveProperty([field]);
  expect(typeof res.body.error.fields[field]).toBe("string");
  expect(res.body.error.fields[field].length).toBeGreaterThan(0);
  // The envelope, and nothing a person should not see.
  expect(Object.keys(res.body)).toEqual(["error"]);
  expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|invalid byte|0x00|stack|node_modules|SELECT |\\u0000/i);
}

describe("HARD-01 a NUL character in a text field of a write endpoint is a 400 on the field, never a 500", () => {
  it.each(CASES.map((c) => [`${c.endpoint.label} — ${c.field.name}`, c] as const))("%s", async (_label, { endpoint, field }) => {
    // Control: the same request with clean text succeeds, so the 400 below can only be the NUL.
    const control = await endpoint.setup();
    const accepted = await endpoint.call(control, { [field.name]: valueOf(endpoint, control, field, false) });
    expect(accepted.status, `${endpoint.label} with clean ${field.name}: ${JSON.stringify(accepted.body)}`).toBe(endpoint.ok);

    // The same request on a fresh fixture, with a NUL in the one field.
    const fixture = await endpoint.setup();
    const before = { counts: await counts(), ticket: await ticketRow(fixture.ticketId), user: await userRow(fixture.user?.id) };
    const res = await endpoint.call(fixture, { [field.name]: valueOf(endpoint, fixture, field, true) });
    await expectRefusedAsNul(res, field.name);

    // Nothing was written: not a row, not a changed Ticket, not a changed account.
    expect(await counts()).toEqual(before.counts);
    expect(await ticketRow(fixture.ticketId)).toEqual(before.ticket);
    expect(await userRow(fixture.user?.id)).toEqual(before.user);
  });

  it.each(ENDPOINTS.map((e) => [e.label, e] as const))("%s — a NUL in a field the endpoint does not read is refused too (BR-52 says any string)", async (_label, endpoint) => {
    const fixture = await endpoint.setup();
    const res = await endpoint.call(fixture, { unexpected: dirty("not a field of this form") });
    await expectRefusedAsNul(res, "unexpected");
  });

  it.each(ENDPOINTS.map((e) => [e.label, e] as const))("%s — a NUL deep inside an array or an object is refused, and named by its path", async (_label, endpoint) => {
    const fixture = await endpoint.setup();
    const res = await endpoint.call(fixture, { nested: { list: ["fine", { deeper: dirty("text") }] } });
    await expectRefusedAsNul(res, "nested.list[1].deeper");
  });

  describe("a NUL in the file name of an upload", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

    it("is refused when the name is written plainly: the multipart reader itself answers 400, and nothing is stored", async () => {
      const ticketId = await makeTicket();
      const before = await counts();
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Cookie", cookies.requester)
        .attach("file", png, { filename: `scree${NUL}n.png`, contentType: "image/png" });
      expect(res.status, JSON.stringify(res.body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(await counts()).toEqual(before);
    });

    // RFC 5987: `filename*=UTF-8''…` is percent-decoded by the multipart reader, so a NUL written as
    // %00 reaches the handler where a plain one does not.
    function encodedNameUpload(ticketId: number, cookie: string) {
      const boundary = "----hardening-boundary";
      const lines = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename*=UTF-8''scree%00n.png`,
        "Content-Type: image/png",
        "",
        "",
      ];
      const body = Buffer.concat([Buffer.from(lines.join("\r\n")), png, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      return request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Cookie", cookie)
        .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
        .send(body);
    }

    it("is refused when the name is written percent-encoded (filename*), which the multipart reader decodes and passes on", async () => {
      const ticketId = await makeTicket();
      const before = await counts();
      const res = await encodedNameUpload(ticketId, cookies.requester);
      await expectRefusedAsNul(res, "file");
      expect(await counts()).toEqual(before);
    });

    it("is refused only after ownership: another Requester's ticket is a 404 first (BR-37)", async () => {
      const ticketId = await makeTicket();
      const other = await makeUser();
      const res = await encodedNameUpload(ticketId, await signInAs(other.id));
      expect(res.status).toBe(404);
    });
  });

  it("does not count a refused sign-in as a wrong guess, so a NUL cannot lock an account (Lab 3 BR-67)", async () => {
    resetLoginThrottle();
    const user = await makeUser();
    for (let attempt = 0; attempt < MAX_FAILURES + 2; attempt += 1) {
      const refused = await send("post", "/api/auth/login", undefined, { email: user.email, password: dirty(SEED_PASSWORD) });
      expect(refused.status).toBe(400);
    }
    const signedIn = await send("post", "/api/auth/login", undefined, { email: user.email, password: SEED_PASSWORD });
    expect(signedIn.status, JSON.stringify(signedIn.body)).toBe(201);
  });

  it("answers a NUL in the email the same for a known and an unknown account, so it reveals nothing about either", async () => {
    resetLoginThrottle();
    const user = await makeUser();
    const known = await send("post", "/api/auth/login", undefined, { email: dirty(user.email), password: SEED_PASSWORD });
    const unknown = await send("post", "/api/auth/login", undefined, { email: dirty("nobody.at.all@example.test"), password: SEED_PASSWORD });
    expect(known.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(known.body).toEqual(unknown.body);
  });

  it("keeps the order of the guards: no session is 401, and the wrong role is 403, before the body is read (api-spec §8)", async () => {
    const ticketId = await makeTicket();
    const bad = { body: dirty("hello"), reason: dirty("hello there") };
    expect((await send("post", `/api/tickets/${ticketId}/comments`, undefined, bad)).status).toBe(401);
    expect((await send("post", `/api/tickets/${ticketId}/notes`, cookies.requester, bad)).status).toBe(403);
    expect((await send("patch", `/api/staff/tickets/${ticketId}/status`, cookies.requester, bad)).status).toBe(403);
    expect((await send("post", "/api/admin/users", cookies.staff, bad)).status).toBe(403);
    expect((await send("post", "/api/staff/tickets/1/actions-taken", cookies.requester, bad)).status).toBe(403);
  });

  it("keeps ownership before validation: another Requester's ticket is a 404 whatever the body holds", async () => {
    const other = await makeUser();
    const cookie = await signInAs(other.id);
    const ticketId = await makeTicket();
    const res = await send("post", `/api/tickets/${ticketId}/comments`, cookie, { body: dirty("hello there") });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("covers every write route the server registers: a new one must be added to the table above", () => {
    const srcDir = new URL("../../src/", import.meta.url);
    const found = new Set<string>();
    for (const file of readdirSync(srcDir).filter((name) => name.endsWith(".ts"))) {
      const text = readFileSync(new URL(file, srcDir), "utf8");
      for (const match of text.matchAll(/\b(?:app|[a-zA-Z]+Router)\.(post|patch|put|delete)\(\s*"([^"]+)"/g)) {
        found.add(`${match[1].toUpperCase()} ${match[2]}`);
      }
    }
    const covered = new Set([...ENDPOINTS.map((e) => e.route), ...Object.keys(NOT_IN_THE_TABLE)]);
    expect([...found].sort()).toEqual([...covered].sort());
  });
});

// ---------------------------------------------------------------------------
// SEC-09, completed: the Origin check on every write route (Lab 3 BR-65)
// ---------------------------------------------------------------------------

describe("SEC-09 a write that names a foreign Origin is refused on every write route, before its handler runs (Lab 3 BR-65)", () => {
  it.each(ENDPOINTS.map((endpoint) => [endpoint.label, endpoint] as const))("%s", async (_label, endpoint) => {
    const fixture = await endpoint.setup();
    const before = { counts: await counts(), ticket: await ticketRow(fixture.ticketId), user: await userRow(fixture.user?.id) };
    const res = await endpoint.call(fixture, {}).set("Origin", "https://evil.example");
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await counts()).toEqual(before.counts);
    expect(await ticketRow(fixture.ticketId)).toEqual(before.ticket);
    expect(await userRow(fixture.user?.id)).toEqual(before.user);
  });

  it("the upload route, which takes multipart/form-data that any HTML form can send, refuses it too", async () => {
    const ticketId = await makeTicket();
    const before = await counts();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", cookies.requester)
      .set("Origin", "https://evil.example")
      .attach("file", png, { filename: "screen.png", contentType: "image/png" });
    expect(res.status).toBe(403);
    expect(await counts()).toEqual(before);
  });

  it("the configured origin is let through, and so is a request with none (curl, Supertest)", async () => {
    const fixture = await ENDPOINTS[2].setup();
    const allowed = await ENDPOINTS[2].call(fixture, {}).set("Origin", "http://localhost:5173");
    expect(allowed.status).toBe(ENDPOINTS[2].ok);
  });
});

// ---------------------------------------------------------------------------
// HARD-02 — ids in a request body outside 1–2147483647
// ---------------------------------------------------------------------------

const NOT_AN_ID: Array<[string, unknown]> = [
  ["zero", 0],
  ["negative", -1],
  ["a fraction", 1.5],
  ["one past the column", 2_147_483_648],
  ["far past the column", 9_999_999_999],
  ["a number beyond 2^53", 1e21],
  ["digits past the column, as text", "9999999999"],
  ["a digit string, as text", "abc"],
  ["empty text", ""],
  ["true", true],
  ["an array", [1]],
  ["an object", {}],
];

describe("HARD-02 an id in a request body outside 1–2147483647 is a 400 on the field, never a 500", () => {
  it.each(NOT_AN_ID.map(([label, value]) => [label, value] as const))("POST /api/tickets: categoryId is %s", async (_label, value) => {
    const before = await counts();
    const res = await send("post", "/api/tickets", cookies.requester, {
      categoryId: value,
      relatedSystemId,
      summary: "Hardening suite printer fault",
      description: "Hardening suite: the printer shows a jam with no paper stuck in it.",
      requestedPriority: "MEDIUM",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual(["categoryId"]);
    expect(await counts()).toEqual(before);
  });

  it.each(NOT_AN_ID.map(([label, value]) => [label, value] as const))("POST /api/tickets: relatedSystemId is %s", async (_label, value) => {
    const before = await counts();
    const res = await send("post", "/api/tickets", cookies.requester, {
      categoryId,
      relatedSystemId: value,
      summary: "Hardening suite printer fault",
      description: "Hardening suite: the printer shows a jam with no paper stuck in it.",
      requestedPriority: "MEDIUM",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual(["relatedSystemId"]);
    expect(await counts()).toEqual(before);
  });

  it("POST /api/tickets: the largest id the column holds is still a valid id that names nothing, so it is the same 400", async () => {
    const res = await send("post", "/api/tickets", cookies.requester, {
      categoryId: 2_147_483_647,
      relatedSystemId: 2_147_483_647,
      summary: "Hardening suite printer fault",
      description: "Hardening suite: the printer shows a jam with no paper stuck in it.",
      requestedPriority: "MEDIUM",
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["categoryId", "relatedSystemId"]);
  });

  it("POST /api/tickets: Lab 2's ids written as digit text are still accepted (Lab 2 validation is unchanged)", async () => {
    const res = await send("post", "/api/tickets", cookies.requester, {
      categoryId: String(categoryId),
      relatedSystemId: String(relatedSystemId),
      summary: "Hardening suite digit text ids",
      description: "Hardening suite: ids written as digit text are what Lab 2 accepted.",
      requestedPriority: "LOW",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  });

  const OWNER_REQUESTS = NOT_AN_ID.filter(([, value]) => value !== "abc" && value !== "");
  it.each(OWNER_REQUESTS.map(([label, value]) => [label, value] as const))("PATCH /api/staff/tickets/:id/owner: ownerId is %s", async (_label, value) => {
    const ticketId = await makeTicket();
    const before = await ticketRow(ticketId);
    const res = await send("patch", `/api/staff/tickets/${ticketId}/owner`, cookies.staff, { ownerId: value });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields).toHaveProperty(["ownerId"]);
    expect(await ticketRow(ticketId)).toEqual(before);
  });

  it.each(OWNER_REQUESTS.map(([label, value]) => [label, value] as const))("PATCH /api/staff/tickets/:id/owner: expectedOwnerId is %s", async (_label, value) => {
    const ticketId = await makeTicket();
    const res = await send("patch", `/api/staff/tickets/${ticketId}/owner`, cookies.staff, { ownerId: ids.colleague, expectedOwnerId: value });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.fields).toHaveProperty(["expectedOwnerId"]);
  });

  it("PATCH /api/staff/tickets/:id/owner: the largest id the column holds names no user, and is a 400 on ownerId", async () => {
    const ticketId = await makeTicket();
    const res = await send("patch", `/api/staff/tickets/${ticketId}/owner`, cookies.staff, { ownerId: 2_147_483_647 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.ownerId).toBe("That user does not exist.");
  });

  it.each([
    ["owner", { ownerId: 1 }],
    ["it-priority", { itPriority: "HIGH" }],
    ["status", { currentStatus: "WAITING_FOR_REQUESTER" }],
  ] as const)("PATCH /api/staff/tickets/:id/%s: expectedVersion past the column is a 400 on expectedVersion", async (route, base) => {
    const ticketId = await makeTicket();
    for (const version of [0, 1.5, 2_147_483_648, 9_999_999_999, "1", null, true]) {
      const res = await send("patch", `/api/staff/tickets/${ticketId}/${route}`, cookies.staff, { ...base, expectedVersion: version });
      expect(res.status, `${route} ${String(version)}: ${JSON.stringify(res.body)}`).toBe(400);
      expect(res.body.error.fields).toHaveProperty(["expectedVersion"]);
    }
  });

  it("PATCH /api/staff/tickets/:id/actions-taken/:actionId: an expectedVersion past the column is a conflict or a 400, never a 500", async () => {
    const ticketId = await makeTicket();
    const action = await recordAction(ticketId);
    for (const version of [2_147_483_648, 9_999_999_999, 1e21]) {
      const res = await send("patch", `/api/staff/tickets/${ticketId}/actions-taken/${action.id}`, cookies.staff, { expectedVersion: version, result: "Printed again." });
      expect([400, 409], `${version}: ${JSON.stringify(res.body)}`).toContain(res.status);
    }
  });
});

// ---------------------------------------------------------------------------
// HARD-03 — the envelope, and nothing behind it
// ---------------------------------------------------------------------------

/** Nothing a person should see: a stack, SQL, a path, a driver's message, a code of the database. */
const LEAKS = /\bat\s+\S+\s+\(|node_modules|\/app\/|C:\\|P\d{4}\b|SELECT\s|INSERT\s|prisma|postgres|db:5432|"Ticket"|"Session"|stack/i;

function expectEnvelope(body: unknown, code: string) {
  expect(Object.keys(body as object)).toEqual(["error"]);
  const error = (body as { error: Record<string, unknown> }).error;
  expect(error.code).toBe(code);
  expect(typeof error.message).toBe("string");
  expect(Object.keys(error).every((key) => ["code", "message", "fields", "current"].includes(key))).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(LEAKS);
}

describe("HARD-03 unknown routes, malformed and oversized bodies, and server errors keep one envelope", () => {
  const UNKNOWN: Array<[string, string, Who | null]> = [
    ["GET", "/api/nothing-here", null],
    ["GET", "/api/tickets/1/nothing-here", "requester"],
    ["GET", "/api/staff/nothing-here", "staff"],
    ["GET", "/api/admin/nothing-here", "admin"],
    ["GET", "/api/dashboard/nothing-here", "requester"],
    ["POST", "/api/auth/nothing-here", null],
    ["PATCH", "/api/nothing-here", null],
    ["PUT", "/api/tickets", "requester"],
    ["DELETE", "/api/tickets/1", "requester"],
    ["DELETE", "/api/admin/users/1", "admin"],
    ["PUT", "/api/staff/tickets/1/status", "staff"],
  ];
  it.each(UNKNOWN)("%s %s is the JSON 404, not an HTML page", async (method, path, who) => {
    const pending = request(app)[method.toLowerCase() as "get" | "post" | "patch" | "put" | "delete"](path);
    if (who) pending.set("Cookie", cookies[who]);
    const res = await (method === "GET" ? pending : pending.send({}));
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "That resource does not exist." } });
  });

  it("answers 'sign in' before 'not found' on an unwritten staff route, so a stranger learns nothing of the routes", async () => {
    const res = await request(app).get("/api/staff/nothing-here");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  const WRITES: Array<[string, "post" | "patch", () => string, Who | null]> = [
    ["POST /api/auth/login", "post", () => "/api/auth/login", null],
    ["POST /api/tickets", "post", () => "/api/tickets", "requester"],
    ["POST /api/tickets/:id/comments", "post", () => "/api/tickets/1/comments", "requester"],
    ["PATCH /api/staff/tickets/:id/status", "patch", () => "/api/staff/tickets/1/status", "staff"],
    ["POST /api/staff/tickets/:id/actions-taken", "post", () => "/api/staff/tickets/1/actions-taken", "staff"],
    ["POST /api/admin/users", "post", () => "/api/admin/users", "admin"],
    ["POST /api/auth/password", "post", () => "/api/auth/password", "requester"],
  ];

  it.each(WRITES)("%s: malformed JSON is a 400 in the envelope", async (_label, method, path, who) => {
    const pending = request(app)[method](path()).set("Content-Type", "application/json");
    if (who) pending.set("Cookie", cookies[who]);
    const res = await pending.send('{"summary": "unfinished');
    expect(res.status).toBe(400);
    expectEnvelope(res.body, "VALIDATION_FAILED");
    expect(res.body.error.message).toBe("The request body is not valid JSON.");
  });

  it.each(WRITES)("%s: a body over the limit is a 413 in the envelope", async (_label, method, path, who) => {
    const pending = request(app)[method](path()).set("Content-Type", "application/json");
    if (who) pending.set("Cookie", cookies[who]);
    const res = await pending.send(JSON.stringify({ body: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
    expectEnvelope(res.body, "REQUEST_TOO_LARGE");
  });

  it.each(WRITES)("%s: a body in a character set the server cannot read is a 415 in the envelope", async (_label, method, path, who) => {
    const pending = request(app)[method](path()).set("Content-Type", "application/json; charset=klingon");
    if (who) pending.set("Cookie", cookies[who]);
    const res = await pending.send("{}");
    expect(res.status).toBe(415);
    expectEnvelope(res.body, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("a body nested far deeper than the call stack is answered, not crashed on", async () => {
    const depth = 15_000;
    const body = `${'{"a":'.repeat(depth)}1${"}".repeat(depth)}`;
    const res = await request(app).post("/api/tickets/1/comments").set("Content-Type", "application/json").set("Cookie", cookies.requester).send(body);
    expect([400, 404, 413]).toContain(res.status);
    expect(typeof res.body.error?.code).toBe("string");
    expect((await request(app).get("/api/health")).status).toBe(200);
  });

  // A server error is forced by making one database call fail with the kind of message a driver
  // gives: SQL, a host name, a path. Patched by hand: Prisma's model delegates are proxies, and
  // vi.spyOn's restore leaves them broken for the rest of the run (Lab 3's authorization suite).
  type Delegate = Record<string, unknown>;
  const SECRET = new Error('P1001: Can\'t reach database server at db:5432 — SELECT * FROM "Ticket" WHERE id = 1 at /app/node_modules/@prisma/client/runtime/library.js:12:34 C:\\app\\server');

  async function withFailure<T>(targets: Array<[string | null, string]>, run: () => Promise<T>): Promise<T> {
    const saved: Array<[Delegate, string, unknown]> = [];
    for (const [model, method] of targets) {
      const owner = (model === null ? prisma : (prisma as unknown as Record<string, Delegate>)[model]) as unknown as Delegate;
      saved.push([owner, method, owner[method]]);
      // A query is lazy in Prisma: it runs, and fails, only when it is awaited. A handler that builds
      // several for one $transaction and awaits the transaction therefore never awaits the rest, and an
      // eagerly rejected promise would be reported as unhandled here though nothing in the app is wrong.
      owner[method] = model === null ? () => Promise.reject(SECRET) : () => ({ then: (ok: never, fail: never) => Promise.reject(SECRET).then(ok, fail) });
    }
    try {
      return await run();
    } finally {
      for (const [owner, method, original] of saved) owner[method] = original;
    }
  }

  const FAILING: Array<[string, Array<[string | null, string]>, () => Test]> = [
    ["GET /api/tickets", [["ticket", "findMany"], ["ticket", "count"]], () => request(app).get("/api/tickets").set("Cookie", cookies.requester)],
    ["GET /api/tickets/:id", [["ticket", "findFirst"]], () => request(app).get("/api/tickets/1").set("Cookie", cookies.requester)],
    ["POST /api/tickets", [["category", "findFirst"]], () =>
      send("post", "/api/tickets", cookies.requester, {
        categoryId, relatedSystemId, summary: "Hardening suite forced failure", description: "Hardening suite: a forced failure of the database call.", requestedPriority: "LOW",
      })],
    ["GET /api/categories", [["category", "findMany"]], () => request(app).get("/api/categories").set("Cookie", cookies.requester)],
    ["GET /api/related-systems", [["relatedSystem", "findMany"]], () => request(app).get("/api/related-systems").set("Cookie", cookies.requester)],
    ["GET /api/tickets/:id/comments", [["ticket", "findFirst"]], () => request(app).get("/api/tickets/1/comments").set("Cookie", cookies.requester)],
    ["GET /api/tickets/:id/actions-taken", [["ticket", "findFirst"]], () => request(app).get("/api/tickets/1/actions-taken").set("Cookie", cookies.requester)],
    ["GET /api/dashboard/requester", [[null, "$transaction"], ["ticket", "count"], ["ticket", "groupBy"], ["ticket", "findMany"]], () => request(app).get("/api/dashboard/requester").set("Cookie", cookies.requester)],
    ["GET /api/staff/dashboard", [[null, "$transaction"], ["ticket", "count"], ["ticket", "groupBy"], ["ticket", "findMany"]], () => request(app).get("/api/staff/dashboard").set("Cookie", cookies.staff)],
    ["GET /api/staff/tickets", [["ticket", "findMany"], ["ticket", "count"]], () => request(app).get("/api/staff/tickets").set("Cookie", cookies.staff)],
    ["GET /api/staff/tickets/:id", [["ticket", "findUnique"]], () => request(app).get("/api/staff/tickets/1").set("Cookie", cookies.staff)],
    ["PATCH /api/staff/tickets/:id/status", [[null, "$transaction"]], () => send("patch", "/api/staff/tickets/1/status", cookies.staff, { currentStatus: "WAITING_FOR_REQUESTER" })],
    ["POST /api/staff/tickets/:id/actions-taken", [[null, "$transaction"]], () =>
      send("post", "/api/staff/tickets/1/actions-taken", cookies.staff, {
        actionAt: actionAt(), description: "Replaced the toner cartridge.", result: "Printed cleanly.", followUpRequired: false,
      })],
    ["GET /api/admin/users", [["user", "findMany"]], () => request(app).get("/api/admin/users").set("Cookie", cookies.admin)],
    ["POST /api/admin/users", [["user", "findUnique"]], () =>
      send("post", "/api/admin/users", cookies.admin, {
        fullName: "Hardening Failure", email: `hardening.failure.${stamp}@example.test`, role: "REQUESTER", isActive: true, initialPassword: "Hardening-Pass-2026",
      })],
  ];

  it.each(FAILING.map((row) => [row[0], row[1], row[2]] as const))("%s: a database failure is a 500 in the envelope, with nothing of the failure in it", async (_label, targets, call) => {
    const res = await withFailure([...targets], async () => call());
    expect(res.status, JSON.stringify(res.body)).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expectEnvelope(res.body, "INTERNAL_ERROR");
    expect(res.body.error.message).not.toMatch(/P1001|SELECT|db:5432/);
    // The server is still serving, and the same request works once the database does.
    expect((await request(app).get("/api/health")).status).toBe(200);
  });
});
