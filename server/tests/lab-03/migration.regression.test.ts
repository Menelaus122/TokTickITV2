import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { ACCOUNTS, FIRST_LOGIN_EMAIL, SEED_PASSWORD, TICKETS, runSeed } from "../../prisma/seedData.js";
import { endTestSessions, signInAs } from "../helpers/signIn.js";

// Lab 3, Issue 2 — migration and regression (MIG-01 to MIG-10 in
// docs/lab-03/tests.md).
//
// Two halves:
//
//   * "the migration" replays the real migration files against Lab 2-shaped
//     data inside a scratch schema, inside a transaction that is always rolled
//     back. It proves the hand-written Lab 3 SQL preserves Lab 2 data
//     (specification.md §7.6, D-21) without touching the development database.
//
//   * "the seed" runs against the development database like every other API
//     suite, so it needs the usual migrated and seeded database:
//       cd server && npx prisma migrate deploy && npm run prisma:seed

const prisma = getPrisma();

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../prisma/migrations");
const LAB3_MIGRATION = "20261001130000_lab3_users_roles_and_collaboration";

// Prisma sends each raw query as one prepared statement, which Postgres runs
// only one statement at a time, so a migration file is split before replaying.
// The migration files contain no functions or quoted semicolons, so splitting
// on a semicolon at the end of a line is exact for them.
function statementsOf(migration: string): string[] {
  const sql = readFileSync(join(MIGRATIONS_DIR, migration, "migration.sql"), "utf8");
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const migrationsBeforeLab3 = readdirSync(MIGRATIONS_DIR)
  .filter((name) => /^\d{14}_/.test(name) && name < LAB3_MIGRATION)
  .sort();

class RolledBack extends Error {}

type Run = (sql: string) => Promise<unknown>;
type Query = <R>(sql: string) => Promise<R[]>;

// Runs `body` in a fresh schema on one connection, then rolls everything back,
// schema included. Nothing it does survives the test.
async function inScratchSchema(body: (run: Run, query: Query) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const schema = `lab3_migration_${Date.now()}`;
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await body(
          (sql) => tx.$executeRawUnsafe(sql),
          <R,>(sql: string) => tx.$queryRawUnsafe<R[]>(sql),
        );
        throw new RolledBack();
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof RolledBack)) throw error;
  }
}

interface TicketRow {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requestedPriority: string;
  currentStatus: string;
}

interface AttachmentRow {
  id: number;
  ticketId: number;
  storedFilename: string;
  removedAt: Date | null;
  removalReason: string | null;
}

interface LabTwoRequester {
  id: number;
  email: string;
  fullName: string;
  department: string | null;
  isActive: boolean;
}

const TICKETS_SQL = `SELECT "id", "ticketNumber", "requesterId", "requestedPriority"::text AS "requestedPriority",
  "currentStatus"::text AS "currentStatus" FROM "Ticket" ORDER BY "id"`;
const ATTACHMENTS_SQL = `SELECT "id", "ticketId", "storedFilename", "removedAt", "removalReason" FROM "Attachment" ORDER BY "id"`;

describe("the migration", () => {
  // Everything is captured inside one rolled-back transaction, then asserted
  // afterwards, so each `it` below reads a fact rather than repeating the replay.
  let before: { tickets: TicketRow[]; attachments: AttachmentRow[]; requesters: LabTwoRequester[] };
  let after: {
    tickets: (TicketRow & { itPriority: string; ownerId: number | null; requesterResolvedAt: Date | null })[];
    attachments: AttachmentRow[];
    users: (LabTwoRequester & { role: string; mustChangePassword: boolean; passwordHash: string | null })[];
    orphanTickets: number;
    statuses: string[];
    relations: { name: string }[];
    types: { name: string }[];
    indexes: { name: string }[];
    sequences: { name: string }[];
    nextUserId: number;
    requesterFkTarget: string;
  };

  beforeAll(async () => {
    await inScratchSchema(async (run, query) => {
      for (const migration of migrationsBeforeLab3) {
        for (const statement of statementsOf(migration)) await run(statement);
      }

      // Lab 2-shaped data: every priority, an inactive Requester, a Requester
      // with two tickets, an active and a soft-removed attachment.
      await run(`INSERT INTO "Category" ("name") VALUES ('Hardware'), ('Network')`);
      await run(`INSERT INTO "RelatedSystem" ("name") VALUES ('Printer'), ('VPN')`);
      await run(`INSERT INTO "RequesterUser" ("fullName", "email", "department", "isActive", "updatedAt") VALUES
        ('Requester One', 'one@example.test', 'Library', true, now()),
        ('Requester Two', '  Two.Mixed@Example.TEST ', NULL, true, now()),
        ('Requester Three', 'three@example.test', 'Finance', false, now())`);
      await run(`INSERT INTO "Ticket" ("ticketNumber", "requesterId", "categoryId", "relatedSystemId",
          "summary", "description", "requestedPriority", "updatedAt") VALUES
        ('TT-2026-00001', 1, 1, 1, 'First ticket', 'Lab 2 ticket used by the migration test.', 'LOW', now()),
        ('TT-2026-00002', 1, 2, 2, 'Second ticket', 'Lab 2 ticket used by the migration test.', 'URGENT', now()),
        ('TT-2026-00003', 2, 1, 2, 'Third ticket', 'Lab 2 ticket used by the migration test.', 'HIGH', now()),
        ('TT-2026-00004', 3, 2, 1, 'Fourth ticket', 'Lab 2 ticket used by the migration test.', 'MEDIUM', now())`);
      await run(`INSERT INTO "Attachment" ("ticketId", "originalFilename", "storedFilename", "mimeType", "sizeBytes", "removedAt", "removalReason") VALUES
        (1, 'screen.png', 'a1.png', 'image/png', 1024, NULL, NULL),
        (3, 'invoice.pdf', 'a2.pdf', 'application/pdf', 2048, now(), 'Uploaded the wrong file')`);

      before = {
        tickets: await query<TicketRow>(TICKETS_SQL),
        attachments: await query<AttachmentRow>(ATTACHMENTS_SQL),
        requesters: await query<LabTwoRequester>(
          `SELECT "id", "email", "fullName", "department", "isActive" FROM "RequesterUser" ORDER BY "id"`,
        ),
      };

      for (const statement of statementsOf(LAB3_MIGRATION)) await run(statement);

      // A new user must not collide with a migrated id: the renamed sequence
      // has to carry on from where RequesterUser's left off.
      const [inserted] = await query<{ id: number }>(
        `INSERT INTO "User" ("fullName", "email", "updatedAt") VALUES ('After Migration', 'after@example.test', now()) RETURNING "id"`,
      );

      after = {
        tickets: await query(
          `SELECT "id", "ticketNumber", "requesterId", "requestedPriority"::text AS "requestedPriority",
             "currentStatus"::text AS "currentStatus", "itPriority"::text AS "itPriority", "ownerId",
             "requesterResolvedAt" FROM "Ticket" ORDER BY "id"`,
        ),
        attachments: await query<AttachmentRow>(ATTACHMENTS_SQL),
        users: await query(
          `SELECT "id", "email", "fullName", "department", "isActive", "role"::text AS "role",
             "mustChangePassword", "passwordHash" FROM "User" WHERE "id" <> ${inserted.id} ORDER BY "id"`,
        ),
        orphanTickets: Number(
          (
            await query<{ n: bigint }>(
              `SELECT count(*) AS n FROM "Ticket" t LEFT JOIN "User" u ON u."id" = t."requesterId" WHERE u."id" IS NULL`,
            )
          )[0].n,
        ),
        // Read from the catalog rather than with enum_range(): values added by
        // ADD VALUE cannot be used before their transaction commits, and this
        // transaction never commits. The catalog read touches no enum value.
        statuses: (
          await query<{ v: string }>(
            `SELECT enumlabel AS v FROM pg_enum WHERE enumtypid = '"TicketStatus"'::regtype ORDER BY enumsortorder`,
          )
        ).map((row) => row.v),
        relations: await query(
          `SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'r'`,
        ),
        types: await query(
          `SELECT t.typname AS name FROM pg_type t WHERE t.typnamespace = current_schema()::regnamespace AND t.typtype = 'e'`,
        ),
        indexes: await query(
          `SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'i'`,
        ),
        sequences: await query(
          `SELECT c.relname AS name FROM pg_class c WHERE c.relnamespace = current_schema()::regnamespace AND c.relkind = 'S'`,
        ),
        nextUserId: inserted.id,
        requesterFkTarget: (
          await query<{ target: string }>(
            // Filtered by namespace: once the development database is migrated,
            // public has a constraint of the same name, and this must read the
            // scratch schema's.
            `SELECT confrelid::regclass::text AS target FROM pg_constraint
               WHERE conname = 'Ticket_requesterId_fkey' AND connamespace = current_schema()::regnamespace`,
          )
        )[0].target,
      };
    });
  });

  it("MIG-01 keeps every ticket, attachment, and requester binding", () => {
    expect(after.tickets.map(({ id, ticketNumber, requesterId, currentStatus }) => ({ id, ticketNumber, requesterId, currentStatus })))
      .toEqual(before.tickets.map(({ id, ticketNumber, requesterId, currentStatus }) => ({ id, ticketNumber, requesterId, currentStatus })));
    expect(after.attachments).toEqual(before.attachments);
  });

  it("MIG-02 keeps every Requested Priority and backfills IT Priority from it", () => {
    // Prisma's own generated SQL drops and re-adds requestedPriority, which
    // would erase these values. This is the assertion that catches it.
    expect(after.tickets.map((t) => t.requestedPriority)).toEqual(before.tickets.map((t) => t.requestedPriority));
    for (const ticket of after.tickets) {
      expect(ticket.itPriority).toBe(ticket.requestedPriority);
      expect(ticket.ownerId).toBeNull();
      expect(ticket.requesterResolvedAt).toBeNull();
    }
  });

  it("MIG-03 turns each Lab 2 Requester into a locked REQUESTER user", () => {
    // Emails are compared normalised here; MIG-12 checks the normalisation.
    expect(after.users.map(({ id, email, fullName, department, isActive }) => ({ id, email, fullName, department, isActive })))
      .toEqual(before.requesters.map((r) => ({ ...r, email: r.email.trim().toLowerCase() })));
    for (const user of after.users) {
      expect(user.role).toBe("REQUESTER");
      expect(user.mustChangePassword).toBe(true);
      expect(user.passwordHash).toBeNull();
    }
  });

  it("MIG-04 renames rather than replaces, so every reference still resolves", () => {
    expect(after.orphanTickets).toBe(0);
    expect(after.requesterFkTarget).toBe('"User"');

    const relations = after.relations.map((r) => r.name);
    expect(relations).toContain("User");
    expect(relations).not.toContain("RequesterUser");
    expect(relations).toEqual(expect.arrayContaining(["Session", "PublicComment", "InternalNote"]));

    const types = after.types.map((t) => t.name);
    expect(types).toEqual(expect.arrayContaining(["Priority", "Role", "TicketStatus"]));
    expect(types).not.toContain("RequestedPriority");

    const indexes = after.indexes.map((i) => i.name);
    expect(indexes).toEqual(expect.arrayContaining(["User_pkey", "User_email_key", "User_role_isActive_idx"]));
    expect(indexes).not.toContain("RequesterUser_isActive_idx");

    expect(after.sequences.map((s) => s.name)).toContain("User_id_seq");
    expect(after.nextUserId).toBeGreaterThan(Math.max(...before.requesters.map((r) => r.id)));
  });

  it("widens Current Status to the eight Lab 3 values (BR-31)", () => {
    expect(after.statuses).toEqual([
      "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
    ]);
  });

  it("MIG-12 lowercases and trims every migrated email (BR-45)", () => {
    const mixed = before.requesters.find((r) => r.email !== r.email.trim().toLowerCase());
    // The fixture really does contain a mixed-case, padded email.
    expect(mixed).toBeDefined();
    expect(after.users.find((u) => u.id === mixed!.id)!.email).toBe("two.mixed@example.test");
    for (const user of after.users) expect(user.email).toBe(user.email.trim().toLowerCase());
  });

  it("MIG-08 a migrated account cannot authenticate before the seed runs", async () => {
    // The login endpoint arrives in Issue 3 and is covered there by API-67; this
    // asserts the primitive it relies on, against the real migrated state.
    for (const user of after.users) {
      expect(await verifyPassword(SEED_PASSWORD, user.passwordHash)).toBe(false);
    }
  });
});

describe("the seed", () => {
  const MIGRATED_EMAILS = ACCOUNTS.filter((a) => a.email.endsWith("@kmutt.ac.th")).map((a) => a.email);
  const DRIFT_EMAIL = "kanya.sris@kmutt.ac.th";
  const UNDOCUMENTED_EMAIL = `undocumented.${Date.now()}@example.test`;
  let undocumentedId: number | null = null;
  const createdTicketIds: number[] = [];

  afterAll(async () => {
    if (createdTicketIds.length > 0) await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    if (undocumentedId !== null) {
      await prisma.session.deleteMany({ where: { userId: undocumentedId } });
      await prisma.user.delete({ where: { id: undocumentedId } });
    }
    await endTestSessions();
    await prisma.$disconnect();
  });

  // Whole rows, timestamps included. Comparing only a few columns once hid the
  // seed rewriting updatedAt on every run.
  async function snapshot() {
    return {
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      tickets: await prisma.ticket.findMany({ orderBy: { id: "asc" } }),
      comments: await prisma.publicComment.findMany({ orderBy: { id: "asc" } }),
      notes: await prisma.internalNote.findMany({ orderBy: { id: "asc" } }),
      sessions: await prisma.session.findMany({ orderBy: { id: "asc" } }),
    };
  }

  it("MIG-06 runs twice and ends in the same database, every column included", async () => {
    await runSeed(prisma);
    const first = await snapshot();
    await runSeed(prisma);
    const second = await snapshot();

    expect(second).toEqual(first);
  });

  it("MIG-07 provides the accounts and tickets §7.5 requires", async () => {
    const count = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", isActive: boolean) =>
      prisma.user.count({ where: { role, isActive } });

    expect(await count("REQUESTER", true)).toBeGreaterThanOrEqual(4);
    expect(await count("REQUESTER", false)).toBeGreaterThanOrEqual(1);
    expect(await count("IT_STAFF", true)).toBeGreaterThanOrEqual(3);
    expect(await count("IT_STAFF", false)).toBeGreaterThanOrEqual(1);
    expect(await count("ADMINISTRATOR", true)).toBeGreaterThanOrEqual(2);

    const seeded = await prisma.ticket.findMany({
      where: { OR: TICKETS.map((t) => ({ summary: t.summary })) },
      select: { currentStatus: true, itPriority: true, ownerId: true, requesterId: true },
    });
    expect(seeded).toHaveLength(TICKETS.length);
    expect(new Set(seeded.map((t) => t.currentStatus)).size).toBe(8);
    expect(new Set(seeded.map((t) => t.itPriority)).size).toBe(4);
    expect(new Set(seeded.map((t) => t.requesterId)).size).toBeGreaterThanOrEqual(4);
    expect(seeded.some((t) => t.ownerId === null)).toBe(true);
    expect(seeded.some((t) => t.ownerId !== null)).toBe(true);
    expect(await prisma.publicComment.count()).toBeGreaterThan(0);
    expect(await prisma.internalNote.count()).toBeGreaterThan(0);
  });

  it("MIG-07 gives seeded tickets a believable timeline rather than the moment the seed ran", async () => {
    const seeded = await prisma.ticket.findMany({
      where: { OR: TICKETS.map((t) => ({ summary: t.summary })) },
      select: { createdAt: true, updatedAt: true, requesterResolvedAt: true },
    });
    const now = Date.now();
    for (const t of seeded) {
      expect(t.updatedAt.getTime()).toBeGreaterThanOrEqual(t.createdAt.getTime());
      expect(t.updatedAt.getTime()).toBeLessThan(now);
      if (t.requesterResolvedAt) expect(t.requesterResolvedAt.getTime()).toBeLessThan(now);
    }
    // Spread across days, so a Last Updated sort means something.
    expect(new Set(seeded.map((t) => t.updatedAt.toISOString())).size).toBe(seeded.length);
  });

  it("seeds resolved, closed, cancelled, and reopened tickets the way BR-35 to BR-37 would leave them", async () => {
    const tickets = await prisma.ticket.findMany({
      where: { OR: TICKETS.map((t) => ({ summary: t.summary })) },
      select: { currentStatus: true, ownerId: true, _count: { select: { publicComments: true } } },
    });
    for (const ticket of tickets) {
      // BR-35 — nothing is resolved or closed anonymously; cancel may be unowned.
      if (ticket.currentStatus === "RESOLVED" || ticket.currentStatus === "CLOSED") expect(ticket.ownerId).not.toBeNull();
      // BR-36, BR-37 — those transitions always leave a reason in the thread.
      if (["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"].includes(ticket.currentStatus)) {
        expect(ticket._count.publicComments).toBeGreaterThan(0);
      }
    }
  });

  it("MIG-08 every documented account signs in with the documented password, and only first.login must change it", async () => {
    for (const account of ACCOUNTS) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
      expect(await verifyPassword(SEED_PASSWORD, user.passwordHash)).toBe(true);
      expect(user.mustChangePassword).toBe(account.email === FIRST_LOGIN_EMAIL);
      expect(user.role).toBe(account.role);
      expect(user.isActive).toBe(account.isActive);
    }
    // The migrated Lab 2 Requesters are among them, with their flags cleared.
    expect(MIGRATED_EMAILS).toHaveLength(5);
  });

  it("MIG-09 re-running the seed restores drifted accounts and leaves undocumented ones alone", async () => {
    const drifted = await prisma.user.findUniqueOrThrow({ where: { email: DRIFT_EMAIL } });
    await prisma.user.update({
      where: { id: drifted.id },
      data: { passwordHash: await hashPassword("changed-during-a-demo"), mustChangePassword: true },
    });
    await prisma.session.create({
      data: { tokenHash: "d".repeat(64), userId: drifted.id, expiresAt: new Date(Date.now() + 60_000) },
    });

    const outsiderHash = await hashPassword("created-through-user-management");
    const outsider = await prisma.user.create({
      data: { fullName: "Undocumented User", email: UNDOCUMENTED_EMAIL, role: "IT_STAFF", passwordHash: outsiderHash, mustChangePassword: true },
    });
    undocumentedId = outsider.id;

    await runSeed(prisma);

    const restored = await prisma.user.findUniqueOrThrow({ where: { id: drifted.id } });
    expect(await verifyPassword(SEED_PASSWORD, restored.passwordHash)).toBe(true);
    expect(restored.mustChangePassword).toBe(false);
    expect(await prisma.session.count({ where: { userId: drifted.id } })).toBe(0);

    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } });
    expect(untouched.passwordHash).toBe(outsiderHash);
    expect(untouched.mustChangePassword).toBe(true);
  });

  it("MIG-10 a ticket created through the Lab 2 endpoint starts with IT Priority equal to Requested Priority", async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true }, orderBy: { id: "asc" } });
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });

    const res = await request(app)
      .post("/api/tickets")
      .set("Cookie", await signInAs(requester.id))
      .send({
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "Migration suite ticket for IT Priority",
        description: "Created by the Lab 3 migration suite to check IT Priority at creation.",
        requestedPriority: "URGENT",
      });

    expect(res.status).toBe(201);
    createdTicketIds.push(res.body.id);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(ticket.requestedPriority).toBe("URGENT");
    expect(ticket.itPriority).toBe("URGENT");
    expect(ticket.ownerId).toBeNull();
  });

  it("MIG-11 does not let an IT Staff account act as a Requester", async () => {
    // Issue 4 refused a staff id on the Lab 2 header; Issue 6 removed the
    // header and the selector's list, so a staff account can reach the Lab 2
    // endpoints only through its own session, which they refuse (BR-18).
    const staff = await prisma.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true, mustChangePassword: false } });
    const header = await request(app).get("/api/tickets").set("X-Requester-Id", String(staff.id));
    expect(header.status).toBe(401);
    expect(header.body.error.code).toBe("AUTH_REQUIRED");

    const session = await request(app).get("/api/tickets").set("Cookie", await signInAs(staff.id));
    expect(session.status).toBe(403);
    expect(session.body.error.code).toBe("FORBIDDEN");

    expect((await request(app).get("/api/requesters")).status).toBe(404);
  });
});
