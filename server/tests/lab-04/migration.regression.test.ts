import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { ACCOUNTS, TICKETS, runSeed } from "../../prisma/seedData.js";
import { migrationNames, migrationSql, rollbackSql, withScratchSchema, type Scratch } from "../helpers/scratchSchema.js";

// Lab 4, Issue 3 — migration and regression (MIG-01 to MIG-05 and MIG-08 in
// docs/lab-04/tests.md §2.6; specification.md §5.7, §7.1 to §7.3, §7.6, BR-46
// to BR-49).
//
// The seam is the real migration files. A scratch schema is built exactly as
// Lab 3 left the database, filled with data in every status, and then the Lab 4
// migration (and, on a second schema, its rollback) is applied. The
// development database's own tables are never touched. It does need the
// database server:  cd server && npx prisma migrate deploy
//
// The last describe, "the Lab 4 seed" (MIG-06, MIG-07), runs against the
// development database like every other API suite, so it needs the migrated and
// seeded database:  cd server && npx prisma migrate deploy && npm run prisma:seed
//
// MIG-03 and MIG-04 are completed in later issues: the "legacy ticket opens
// with empty Actions Taken and history" half needs the API of Issues 4 and 6,
// and "a legacy ticket is gated" needs the gate of Issue 6 (tests.md §3.1). Here
// they prove what the migration itself guarantees: no row of either new table
// exists for a legacy ticket, and every legacy ticket is otherwise untouched.

const LAB4 = migrationNames().find((name) => name.endsWith("_lab4_actions_taken_and_workflow"));
const LAB3_STATE = migrationNames().filter((name) => LAB4 !== undefined && name < LAB4);

// The Lab 1 to Lab 3 tables whose rows the migration must leave alone (BR-46).
const LAB3_TABLES = ["Category", "RelatedSystem", "User", "Session", "Ticket", "Attachment", "PublicComment", "InternalNote"] as const;
type Row = Record<string, unknown>;

const rowsOf = async (s: Scratch, table: string): Promise<Row[]> =>
  (await s.query<{ j: string }>(`SELECT row_to_json(t)::text AS j FROM "${table}" t ORDER BY t."id"`)).map((r) => JSON.parse(r.j));

async function snapshot(s: Scratch): Promise<Record<string, Row[]>> {
  const out: Record<string, Row[]> = {};
  for (const table of LAB3_TABLES) out[table] = await rowsOf(s, table);
  return out;
}

// Everything about the schema's shape that a migration could change, without
// the ordinal positions a dropped column would leave a gap in.
async function fingerprint(s: Scratch) {
  return {
    columns: await s.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns WHERE table_schema = current_schema() ORDER BY table_name, column_name`,
    ),
    indexes: await s.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() ORDER BY indexname`),
    constraints: await s.query(
      `SELECT conname, contype::text AS contype, pg_get_constraintdef(oid) AS def
         FROM pg_constraint WHERE connamespace = current_schema()::regnamespace ORDER BY conname`,
    ),
    tables: await s.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name`,
    ),
  };
}
type Fingerprint = Awaited<ReturnType<typeof fingerprint>>;

// A database as Lab 3 leaves it: every status, owned and unowned tickets, an
// inactive user, attachments (one soft-removed), comments, a note, a session.
async function fillLab3Database(s: Scratch): Promise<void> {
  await s.run(`INSERT INTO "Category" ("name") VALUES ('Hardware'), ('Network')`);
  await s.run(`INSERT INTO "RelatedSystem" ("name") VALUES ('Printer'), ('VPN')`);
  await s.run(`INSERT INTO "User" ("fullName", "email", "department", "isActive", "role", "mustChangePassword", "updatedAt") VALUES
    ('Requester A', 'a@example.test', 'Library', true, 'REQUESTER', false, now()),
    ('Requester B', 'b@example.test', NULL, false, 'REQUESTER', true, now()),
    ('Staff One', 'staff@example.test', 'IT', true, 'IT_STAFF', false, now()),
    ('Admin One', 'admin@example.test', 'IT', true, 'ADMINISTRATOR', false, now())`);
  const statuses: [string, number | "NULL"][] = [
    ["NEW", "NULL"], ["OPEN", 3], ["IN_PROGRESS", 3], ["WAITING_FOR_REQUESTER", 4],
    ["RESOLVED", 4], ["CLOSED", 3], ["REOPENED", 3], ["CANCELLED", "NULL"],
  ];
  const tickets = statuses
    .map(([status, owner], i) => {
      const number = String(i + 1).padStart(5, "0");
      const requester = i % 2 === 0 ? 1 : 2;
      return `('TT-2026-${number}', ${requester}, ${owner}, ${(i % 2) + 1}, ${(i % 2) + 1}, 'Ticket ${i + 1}',
        'A Lab 3 ticket used by the Lab 4 migration test.', 'MEDIUM', 'HIGH', '${status}', now())`;
    })
    .join(",");
  await s.run(`INSERT INTO "Ticket" ("ticketNumber", "requesterId", "ownerId", "categoryId", "relatedSystemId",
      "summary", "description", "requestedPriority", "itPriority", "currentStatus", "updatedAt") VALUES ${tickets}`);
  await s.run(`INSERT INTO "Attachment" ("ticketId", "originalFilename", "storedFilename", "mimeType", "sizeBytes", "removedAt", "removalReason") VALUES
    (1, 'screen.png', 'a1.png', 'image/png', 1024, NULL, NULL),
    (2, 'invoice.pdf', 'a2.pdf', 'application/pdf', 2048, now(), 'Uploaded the wrong file')`);
  await s.run(`INSERT INTO "PublicComment" ("ticketId", "authorId", "body") VALUES (2, 3, 'We are looking at it.'), (5, 3, 'Resolved: fixed.')`);
  await s.run(`INSERT INTO "InternalNote" ("ticketId", "authorId", "body") VALUES (2, 3, 'Check the switch first.')`);
  await s.run(`INSERT INTO "Session" ("tokenHash", "userId", "expiresAt") VALUES (repeat('a', 64), 1, now() + interval '8 hours')`);
}

const insertAction = (ticketId: number, performedById: number, requestKey: string | null) =>
  `INSERT INTO "ActionTaken" ("ticketId", "actionAt", "description", "result", "performedById", "followUpRequired", "requestKey", "updatedAt")
   VALUES (${ticketId}, now(), 'Replaced the cartridge.', 'Printed a test page.', ${performedById}, false, ${requestKey === null ? "NULL" : `'${requestKey}'`}, now())`;

const failureOf = async (attempt: () => Promise<unknown>): Promise<string | null> => {
  try {
    await attempt();
    return null;
  } catch (error) {
    return String(error);
  }
};

const count = async (s: Scratch, sql: string) => Number((await s.query<{ n: bigint }>(sql))[0].n);

interface Migrated {
  before: Record<string, Row[]>;
  after: Record<string, Row[]>;
  fingerprint: Fingerprint;
  newTables: { ActionTaken: Row[]; TicketStatusChange: Row[] };
  legacy: Row[];
  probes: {
    duplicateKey: string | null;
    twoNullKeys: string | null;
    // A user who is only a performer, only an editor, or only a status-changer
    // cannot be deleted while that row exists, and can once it is gone.
    deleteWhileReferenced: { performer: string | null; editor: string | null; changer: string | null };
    deleteOnceUnreferenced: { performer: string | null; editor: string | null; changer: string | null };
    cascade: { actions: number; changes: number };
  };
}
interface RolledBack {
  before: Record<string, Row[]>;
  beforeFingerprint: Fingerprint;
  after: Record<string, Row[]>;
  afterFingerprint: Fingerprint;
  migratedTables: string[];
}

let migrated: Migrated;
let rolledBack: RolledBack;

beforeAll(async () => {
  expect(LAB4, "the Lab 4 migration folder (…_lab4_actions_taken_and_workflow) does not exist yet").toBeDefined();

  migrated = await withScratchSchema(async (s) => {
    await s.replay(LAB3_STATE);
    await fillLab3Database(s);
    const before = await snapshot(s);

    for (const statement of migrationSql(LAB4!)) await s.run(statement);

    const after = await snapshot(s);
    const fp = await fingerprint(s);
    const newTables = { ActionTaken: await rowsOf(s, "ActionTaken"), TicketStatusChange: await rowsOf(s, "TicketStatusChange") };
    // What a screen reads for a ticket: the ticket and whatever Actions Taken
    // and history it has. For a legacy ticket that is nothing.
    const legacy = await s.query(
      `SELECT t."id", t."currentStatus"::text AS "currentStatus", t."ownerId", t."version",
              count(DISTINCT a."id")::int AS actions, count(DISTINCT h."id")::int AS changes
         FROM "Ticket" t LEFT JOIN "ActionTaken" a ON a."ticketId" = t."id" LEFT JOIN "TicketStatusChange" h ON h."ticketId" = t."id"
        GROUP BY t."id" ORDER BY t."id"`,
    );

    // How the new constraints behave. Run last, because they change data.
    await s.run(insertAction(2, 3, "key-aaaa-0001"));
    const duplicateKey = await failureOf(() => s.run(insertAction(2, 3, "key-aaaa-0001")));
    const twoNullKeys = await failureOf(async () => {
      await s.run(insertAction(3, 3, null));
      await s.run(insertAction(3, 3, null));
    });
    // Three users who own no ticket and wrote nothing else, so the only thing
    // that can stop a delete is the one new row that refers to them.
    await s.run(`INSERT INTO "User" ("fullName", "email", "role", "mustChangePassword", "updatedAt") VALUES
      ('Only a performer', 'p5@example.test', 'IT_STAFF', false, now()),
      ('Only an editor', 'p6@example.test', 'IT_STAFF', false, now()),
      ('Only a status-changer', 'p7@example.test', 'IT_STAFF', false, now())`);
    const [performer, editor, changer] = (await s.query<{ id: number }>(`SELECT "id" FROM "User" WHERE "email" LIKE 'p%@example.test' ORDER BY "id"`)).map((r) => r.id);
    await s.run(insertAction(4, performer, "key-bbbb-0002"));
    await s.run(insertAction(4, 3, "key-cccc-0003"));
    await s.run(`UPDATE "ActionTaken" SET "updatedById" = ${editor} WHERE "requestKey" = 'key-cccc-0003'`);
    await s.run(`INSERT INTO "TicketStatusChange" ("ticketId", "fromStatus", "toStatus", "changedById") VALUES (4, 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', ${changer})`);
    const deleteUser = (id: number) => failureOf(() => s.run(`DELETE FROM "User" WHERE "id" = ${id}`));
    const deleteWhileReferenced = { performer: await deleteUser(performer), editor: await deleteUser(editor), changer: await deleteUser(changer) };
    await s.run(`DELETE FROM "ActionTaken" WHERE "ticketId" = 4`);
    await s.run(`DELETE FROM "TicketStatusChange" WHERE "ticketId" = 4`);
    const deleteOnceUnreferenced = { performer: await deleteUser(performer), editor: await deleteUser(editor), changer: await deleteUser(changer) };

    await s.run(`INSERT INTO "TicketStatusChange" ("ticketId", "fromStatus", "toStatus", "changedById") VALUES (2, 'NEW', 'OPEN', 3)`);
    await s.run(`DELETE FROM "Ticket" WHERE "id" = 2`);
    const cascade = {
      actions: await count(s, `SELECT count(*) AS n FROM "ActionTaken" WHERE "ticketId" = 2`),
      changes: await count(s, `SELECT count(*) AS n FROM "TicketStatusChange" WHERE "ticketId" = 2`),
    };

    return {
      before, after, fingerprint: fp, newTables, legacy,
      probes: { duplicateKey, twoNullKeys, deleteWhileReferenced, deleteOnceUnreferenced, cascade },
    };
  });

  // The rollback, on a second schema, in the state MIG-05 pins: a database in
  // the Lab 3 state that has had the migration and nothing else, no Lab 4 seed.
  rolledBack = await withScratchSchema(async (s) => {
    await s.replay(LAB3_STATE);
    await fillLab3Database(s);
    const before = await snapshot(s);
    const beforeFingerprint = await fingerprint(s);

    for (const statement of migrationSql(LAB4!)) await s.run(statement);
    const migratedTables = (await fingerprint(s)).tables.map((t) => String(t.table_name));

    for (const statement of rollbackSql("lab4_rollback.sql")) await s.run(statement);
    return { before, beforeFingerprint, after: await snapshot(s), afterFingerprint: await fingerprint(s), migratedTables };
  });
}, 240_000);

describe("the Lab 4 migration on a Lab 3 database", () => {
  it("MIG-01 keeps every row of every Lab 1–3 table (BR-46, AC-23)", () => {
    for (const table of LAB3_TABLES) {
      expect(migrated.before[table].length, `${table} had rows to keep`).toBeGreaterThan(0);
      expect(migrated.after[table].length, table).toBe(migrated.before[table].length);
    }
  });

  it("MIG-02 changes nothing about any existing row except giving every Ticket version 1 (BR-46)", () => {
    for (const table of LAB3_TABLES.filter((t) => t !== "Ticket")) {
      expect(migrated.after[table], table).toEqual(migrated.before[table]);
    }
    // Requester bindings, owners, and ticket numbers are in the Ticket rows.
    const withoutVersion = migrated.after.Ticket.map(({ version, ...rest }) => ({ version, rest }));
    expect(withoutVersion.map((t) => t.version)).toEqual(migrated.before.Ticket.map(() => 1));
    expect(withoutVersion.map((t) => t.rest)).toEqual(migrated.before.Ticket);
  });

  it("MIG-03 (data) gives a legacy Ticket no Actions Taken and no status history (BR-47)", () => {
    expect(migrated.legacy).toHaveLength(8);
    for (const row of migrated.legacy) expect(row, `ticket ${row.id}`).toMatchObject({ actions: 0, changes: 0, version: 1 });
    expect(migrated.newTables.ActionTaken).toEqual([]);
    expect(migrated.newTables.TicketStatusChange).toEqual([]);
  });

  it("MIG-04 (data) leaves a legacy resolved, closed, and in-progress Ticket exactly as it was (BR-48)", () => {
    const status = (id: number) => migrated.legacy.find((row) => row.id === id);
    // 3 IN_PROGRESS, 5 RESOLVED, 6 CLOSED in the fixture, each still with its owner.
    expect(status(3)).toMatchObject({ currentStatus: "IN_PROGRESS", ownerId: 3 });
    expect(status(5)).toMatchObject({ currentStatus: "RESOLVED", ownerId: 4 });
    expect(status(6)).toMatchObject({ currentStatus: "CLOSED", ownerId: 3 });
  });

  it("MIG-08 adds the tables, columns, keys, and indexes the specification names (§7.1 to §7.3)", () => {
    const column = (table: string, name: string) =>
      migrated.fingerprint.columns.find((c) => c.table_name === table && c.column_name === name);
    const expectColumn = (table: string, name: string, type: string, nullable: boolean, length: number | null = null) =>
      expect(column(table, name), `${table}.${name}`).toMatchObject({ data_type: type, is_nullable: nullable ? "YES" : "NO", character_maximum_length: length });

    expectColumn("ActionTaken", "id", "integer", false);
    expectColumn("ActionTaken", "ticketId", "integer", false);
    expectColumn("ActionTaken", "actionAt", "timestamp without time zone", false);
    expectColumn("ActionTaken", "description", "character varying", false, 2000);
    expectColumn("ActionTaken", "result", "character varying", false, 1000);
    expectColumn("ActionTaken", "performedById", "integer", false);
    expectColumn("ActionTaken", "followUpRequired", "boolean", false);
    expectColumn("ActionTaken", "followUpNote", "character varying", true, 1000);
    expectColumn("ActionTaken", "attachmentNotes", "character varying", true, 500);
    expectColumn("ActionTaken", "version", "integer", false);
    expect(column("ActionTaken", "version")?.column_default).toBe("1");
    expectColumn("ActionTaken", "requestKey", "character varying", true, 64);
    expectColumn("ActionTaken", "updatedById", "integer", true);
    expectColumn("ActionTaken", "createdAt", "timestamp without time zone", false);
    expectColumn("ActionTaken", "updatedAt", "timestamp without time zone", false);

    expectColumn("TicketStatusChange", "ticketId", "integer", false);
    expectColumn("TicketStatusChange", "fromStatus", "USER-DEFINED", false);
    expectColumn("TicketStatusChange", "toStatus", "USER-DEFINED", false);
    expectColumn("TicketStatusChange", "changedById", "integer", false);
    expectColumn("TicketStatusChange", "createdAt", "timestamp without time zone", false);

    expectColumn("Ticket", "version", "integer", false);
    expect(column("Ticket", "version")?.column_default).toBe("1");

    const indexes = migrated.fingerprint.indexes.map((i) => String(i.indexname));
    for (const name of [
      "ActionTaken_ticketId_performedById_requestKey_key",
      "ActionTaken_ticketId_actionAt_id_idx",
      "ActionTaken_performedById_createdAt_idx",
      "TicketStatusChange_ticketId_createdAt_id_idx",
      "Ticket_requesterId_currentStatus_idx",
      "Ticket_ownerId_currentStatus_idx",
    ]) {
      expect(indexes, name).toContain(name);
    }
    // The single-column owner index is superseded by (ownerId, currentStatus) and dropped (§7.3).
    expect(indexes).not.toContain("Ticket_ownerId_idx");
    // Lab 3's other Ticket indexes survive.
    expect(indexes).toContain("Ticket_requesterId_createdAt_idx");
    expect(indexes).toContain("Ticket_currentStatus_itPriority_createdAt_idx");

    const fk = (name: string) => String(migrated.fingerprint.constraints.find((c) => c.conname === name)?.def);
    expect(fk("ActionTaken_ticketId_fkey")).toContain("ON DELETE CASCADE");
    expect(fk("ActionTaken_performedById_fkey")).toContain("ON DELETE RESTRICT");
    expect(fk("ActionTaken_updatedById_fkey")).toContain("ON DELETE RESTRICT");
    expect(fk("TicketStatusChange_ticketId_fkey")).toContain("ON DELETE CASCADE");
    expect(fk("TicketStatusChange_changedById_fkey")).toContain("ON DELETE RESTRICT");
  });

  it("MIG-08 enforces the duplicate-submission key, restricts deleting an author, and cascades with the Ticket (BR-28, D-04)", () => {
    // The same key for the same Ticket and user is refused (a unique violation)...
    expect(migrated.probes.duplicateKey).toMatch(/unique|duplicate|23505/i);
    // ...but rows with no key are never in conflict, because NULLs are distinct.
    expect(migrated.probes.twoNullKeys).toBeNull();
    // A user who performed an action, last edited one, or changed a status cannot
    // be deleted out from under that row (Lab 3 BR-50)...
    for (const [who, failure] of Object.entries(migrated.probes.deleteWhileReferenced)) {
      expect(failure ?? "(the delete went through)", `deleting the ${who} while a row refers to them`).toMatch(/foreign key|violates|23503/i);
    }
    // ...and it was that row, and nothing else, that stopped the delete.
    expect(migrated.probes.deleteOnceUnreferenced).toEqual({ performer: null, editor: null, changer: null });
    // Deleting a Ticket takes its Actions Taken and history with it.
    expect(migrated.probes.cascade).toEqual({ actions: 0, changes: 0 });
  });
});

describe("the Lab 4 rollback (BR-49, specification §7.6)", () => {
  it("MIG-05 restores the Lab 3 tables row for row, and the Lab 3 schema shape exactly", () => {
    // The migration really did add the two tables, so the rollback has something to undo.
    expect(rolledBack.migratedTables).toEqual(expect.arrayContaining(["ActionTaken", "TicketStatusChange"]));

    for (const table of LAB3_TABLES) expect(rolledBack.after[table], table).toEqual(rolledBack.before[table]);
    expect(rolledBack.afterFingerprint.tables).toEqual(rolledBack.beforeFingerprint.tables);
    expect(rolledBack.afterFingerprint.columns).toEqual(rolledBack.beforeFingerprint.columns);
    expect(rolledBack.afterFingerprint.indexes).toEqual(rolledBack.beforeFingerprint.indexes);
    expect(rolledBack.afterFingerprint.constraints).toEqual(rolledBack.beforeFingerprint.constraints);
  });
});

// ---------------------------------------------------------------------------
// The seed (specification §7.5). These run against the development database.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

// BR-15, written out here independently of src/transitions.ts.
const MATRIX: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

async function seededTickets() {
  const found = [];
  for (const seed of TICKETS) {
    const requester = ACCOUNTS.find((account) => account.key === seed.requester)!;
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { requester: { email: requester.email }, summary: seed.summary },
      include: {
        owner: { select: { email: true, role: true } },
        actionsTaken: { orderBy: { id: "asc" }, include: { performedBy: { select: { email: true, role: true } }, updatedBy: { select: { email: true } } } },
        statusChanges: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { changedBy: { select: { email: true } } } },
      },
    });
    found.push({ seed, ticket });
  }
  return found;
}
type Seeded = Awaited<ReturnType<typeof seededTickets>>[number];

// The action the resolution gate reads: the most recently *recorded* (BR-17).
const latestRecorded = (ticket: Seeded["ticket"]) =>
  [...ticket.actionsTaken].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id).at(-1);

async function seedState() {
  const tickets = (await seededTickets()).map(({ ticket }) => ({
    summary: ticket.summary,
    status: ticket.currentStatus,
    owner: ticket.owner?.email ?? null,
    version: ticket.version,
    updatedAt: ticket.updatedAt.toISOString(),
    actions: ticket.actionsTaken.map((a) => ({
      requestKey: a.requestKey, by: a.performedBy.email, actionAt: a.actionAt.toISOString(), createdAt: a.createdAt.toISOString(),
      description: a.description, result: a.result, followUpRequired: a.followUpRequired, followUpNote: a.followUpNote,
      attachmentNotes: a.attachmentNotes, version: a.version, updatedBy: a.updatedBy?.email ?? null,
    })),
    history: ticket.statusChanges.map((c) => ({ from: c.fromStatus, to: c.toStatus, by: c.changedBy.email, at: c.createdAt.toISOString() })),
  }));
  return {
    tickets,
    totals: {
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
      actions: await prisma.actionTaken.count(),
      statusChanges: await prisma.ticketStatusChange.count(),
      comments: await prisma.publicComment.count(),
      notes: await prisma.internalNote.count(),
    },
  };
}

describe("the Lab 4 seed (specification §7.5)", () => {
  it("MIG-06 ends in the same database on a second run, with no duplicate action, history row, or account (AC-24)", async () => {
    await runSeed(prisma);
    const first = await seedState();
    await runSeed(prisma);
    const second = await seedState();
    expect(second).toEqual(first);

    // Exactly the documented rows exist: nothing missing, and nothing doubled.
    const documentedActions = TICKETS.reduce((n, seed) => n + (seed.actions?.length ?? 0), 0);
    const documentedChanges = TICKETS.reduce((n, seed) => n + (seed.history?.length ?? 0), 0);
    expect(documentedActions).toBeGreaterThan(0);
    expect(first.tickets.reduce((n, t) => n + t.actions.length, 0)).toBe(documentedActions);
    expect(first.tickets.reduce((n, t) => n + t.history.length, 0)).toBe(documentedChanges);
    expect(await prisma.actionTaken.count({ where: { requestKey: { startsWith: "seed-" } } })).toBe(documentedActions);
    expect(await prisma.user.count({ where: { email: { in: ACCOUNTS.map((a) => a.email) } } })).toBe(ACCOUNTS.length);
  });

  it("MIG-07 gives the dashboards and the gate the spread the specification lists", async () => {
    await runSeed(prisma);
    const all = await seededTickets();
    const withStatus = (status: string) => all.filter(({ ticket }) => ticket.currentStatus === status);

    // Every status, owned and unowned.
    for (const status of Object.keys(MATRIX)) expect(withStatus(status).length, status).toBeGreaterThan(0);
    expect(all.some(({ ticket }) => ticket.ownerId === null)).toBe(true);
    expect(all.some(({ ticket }) => ticket.ownerId !== null)).toBe(true);

    // Zero actions on NEW and CANCELLED, one on OPEN and CLOSED, several on IN_PROGRESS.
    for (const { ticket } of [...withStatus("NEW"), ...withStatus("CANCELLED")]) expect(ticket.actionsTaken, ticket.summary).toHaveLength(0);
    for (const { ticket } of [...withStatus("OPEN"), ...withStatus("CLOSED")]) expect(ticket.actionsTaken, ticket.summary).toHaveLength(1);
    for (const { ticket } of withStatus("IN_PROGRESS")) expect(ticket.actionsTaken.length, ticket.summary).toBeGreaterThanOrEqual(2);

    // BR-02: an action by an IT Staff member who is not the Owner. BR-45: one by an Administrator.
    expect(all.some(({ ticket }) => ticket.actionsTaken.some((a) => a.performedBy.email !== ticket.owner?.email && a.performedBy.role === "IT_STAFF"))).toBe(true);
    expect(all.some(({ ticket }) => ticket.actionsTaken.some((a) => a.performedBy.role === "ADMINISTRATOR"))).toBe(true);

    // Follow-up, both ways: a pending one the gate refuses, and RESOLVED tickets it would allow.
    expect(all.some(({ ticket }) => latestRecorded(ticket)?.followUpRequired === true)).toBe(true);
    for (const { ticket } of withStatus("RESOLVED")) expect(latestRecorded(ticket)?.followUpRequired, ticket.summary).toBe(false);
    for (const { ticket } of all) for (const a of ticket.actionsTaken) expect(a.followUpNote !== null, `${ticket.summary}: note only with follow-up`).toBe(a.followUpRequired);

    // Both reopened cases: one with no action since the reopen, one with a fresh action.
    const sinceReopen = (ticket: Seeded["ticket"]) => {
      const reopened = ticket.statusChanges.filter((c) => c.toStatus === "REOPENED").at(-1)!;
      return ticket.actionsTaken.filter((a) => a.createdAt > reopened.createdAt).length;
    };
    const reopened = withStatus("REOPENED").map(({ ticket }) => sinceReopen(ticket));
    expect(reopened.some((n) => n === 0)).toBe(true);
    expect(reopened.some((n) => n > 0)).toBe(true);

    // WF-19's data: the newest-recorded action is dated earlier than another one.
    expect(
      all.some(({ ticket }) => {
        const last = latestRecorded(ticket);
        return last !== undefined && ticket.actionsTaken.some((a) => a.id !== last.id && a.actionAt > last.actionAt);
      }),
    ).toBe(true);
  });

  it("MIG-07 keeps the seeded rows inside the contract's own rules (BR-06, BR-15, BR-21)", async () => {
    const now = Date.now();
    const seeded = await seededTickets();
    // Without these the loops below would pass on an empty database.
    expect(seeded.reduce((n, { ticket }) => n + ticket.actionsTaken.length, 0), "seeded actions to check").toBeGreaterThan(0);
    expect(seeded.reduce((n, { ticket }) => n + ticket.statusChanges.length, 0), "seeded history rows to check").toBeGreaterThan(0);
    for (const { ticket } of seeded) {
      for (const a of ticket.actionsTaken) {
        expect(a.actionAt.getTime(), `${ticket.summary}: actionAt not before the ticket`).toBeGreaterThanOrEqual(ticket.createdAt.getTime());
        expect(a.actionAt.getTime(), `${ticket.summary}: actionAt not in the future`).toBeLessThanOrEqual(now);
        expect(a.createdAt.getTime(), `${ticket.summary}: recorded after the ticket existed`).toBeGreaterThanOrEqual(ticket.createdAt.getTime());
        expect(a.description.length).toBeGreaterThanOrEqual(5);
        expect(a.result.length).toBeGreaterThanOrEqual(2);
        if (a.followUpRequired) expect(a.followUpNote!.length).toBeGreaterThanOrEqual(5);
      }
      // The chain starts at NEW, follows the matrix, and ends where the ticket is.
      let from = "NEW";
      for (const change of ticket.statusChanges) {
        expect(change.fromStatus, `${ticket.summary}: chain is unbroken`).toBe(from);
        expect(MATRIX[from], `${ticket.summary}: ${from} -> ${change.toStatus} is in the matrix`).toContain(change.toStatus);
        from = change.toStatus;
      }
      if (ticket.statusChanges.length > 0) expect(from, `${ticket.summary}: chain ends at the ticket's status`).toBe(ticket.currentStatus);
    }
  });

  it("MIG-07 adds the two accounts that show a dashboard with nothing in it", async () => {
    await runSeed(prisma);
    const noTickets = await prisma.user.findUniqueOrThrow({ where: { email: "no.tickets@toktickit.local" } });
    const idle = await prisma.user.findUniqueOrThrow({ where: { email: "idle.it@toktickit.local" } });

    expect(noTickets).toMatchObject({ role: "REQUESTER", isActive: true, mustChangePassword: false });
    expect(await prisma.ticket.count({ where: { requesterId: noTickets.id } })).toBe(0);

    expect(idle).toMatchObject({ role: "IT_STAFF", isActive: true, mustChangePassword: false });
    expect(await prisma.ticket.count({ where: { ownerId: idle.id } })).toBe(0);
    expect(await prisma.actionTaken.count({ where: { performedById: idle.id } })).toBe(0);
    expect(await prisma.publicComment.count({ where: { authorId: idle.id } })).toBe(0);
  });
});
