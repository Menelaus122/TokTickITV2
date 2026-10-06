import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";

// Lab 4, Issue 3 — a throwaway PostgreSQL schema to replay migrations in, so a
// migration test can build the database exactly as the previous sprint left it,
// fill it with data, apply the new migration, and look at the result, without
// touching the development database's own tables.
//
// Lab 3's migration test did this inside one transaction. That cannot work once
// a migration adds an enum value: PostgreSQL does not let a value added in a
// transaction be used before that transaction commits, so the scratch database
// could never hold a ticket in a status the migration added. Here the schema is
// real (committed) and is dropped afterwards, on its own single-connection
// client, so each statement commits and every enum value is usable at once.
//
// Nothing survives a run: the schema is dropped in a `finally`, and any
// `lab4_scratch_*` schema left by a run that was killed is dropped first.

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, "../../prisma/migrations");
export const ROLLBACK_DIR = join(HERE, "../../prisma/rollback");

const SCRATCH_PREFIX = "lab4_scratch_";

/** The migration folders in the order Prisma applies them. */
export function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
}

/**
 * Splits one SQL file into statements. Prisma sends each raw query as a single
 * prepared statement, and PostgreSQL runs one at a time, so a file is split on a
 * semicolon at the end of a line. The migration and rollback files contain no
 * function bodies or quoted semicolons, so that split is exact for them.
 */
export function statementsOf(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export const migrationSql = (name: string) => statementsOf(readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
export const rollbackSql = (file: string) => statementsOf(readFileSync(join(ROLLBACK_DIR, file), "utf8"));

export interface Scratch {
  /** Runs one statement. */
  run: (sql: string) => Promise<unknown>;
  /** Runs a query and returns its rows. */
  query: <R = Record<string, unknown>>(sql: string) => Promise<R[]>;
  /** Replays the named migrations, in order, as the real `migrate deploy` would. */
  replay: (names: string[]) => Promise<void>;
  schema: string;
}

/** Runs `body` against an empty scratch schema, then drops the schema. */
export async function withScratchSchema<T>(body: (scratch: Scratch) => Promise<T>): Promise<T> {
  const admin = getPrisma();

  const stale = await admin.$queryRawUnsafe<{ nspname: string }[]>(
    `SELECT nspname FROM pg_namespace WHERE nspname LIKE '${SCRATCH_PREFIX}%'`,
  );
  for (const { nspname } of stale) await admin.$executeRawUnsafe(`DROP SCHEMA "${nspname}" CASCADE`);

  const schema = `${SCRATCH_PREFIX}${Date.now().toString(36)}`;
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);

  // `schema=` makes this client's search_path the scratch schema, so the
  // migrations' unqualified names land there; one connection keeps it that way.
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("schema", schema);
  url.searchParams.set("connection_limit", "1");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  const run = (sql: string) => db.$executeRawUnsafe(sql);
  const query = <R = Record<string, unknown>>(sql: string) => db.$queryRawUnsafe<R[]>(sql);
  const replay = async (names: string[]) => {
    for (const name of names) for (const statement of migrationSql(name)) await run(statement);
  };

  try {
    return await body({ run, query, replay, schema });
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
