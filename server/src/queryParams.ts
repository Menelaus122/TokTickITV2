// Shared parsing for ids and search text, used by every query and route
// parameter (listQuery.ts, queueQuery.ts, routeId.ts).
//
// The rule it enforces: a value the database cannot hold is a client error,
// never a 500. An id column is a PostgreSQL integer, so a number above Int32
// would make Prisma throw; a NUL byte cannot be stored in, or compared with,
// text at all.

/** The largest value an `Int` column holds (PostgreSQL integer). */
export const MAX_ID = 2_147_483_647;

/**
 * A positive integer from 1 to MAX_ID written as plain digits, or null.
 * "1.0", "1e0", "+1", " 1" and "0x1" are all null: Number() would accept them,
 * but none is the way an id is written.
 */
export function positiveId(text: string | undefined): number | null {
  if (text === undefined || !/^\d+$/.test(text)) return null;
  const id = Number(text);
  return id >= 1 && id <= MAX_ID ? id : null;
}

export type SearchResult = { ok: true; value: string | null } | { ok: false; message: string };

/** Trimmed search text; blank after trimming means no search. */
export function parseSearch(name: string, text: string | undefined): SearchResult {
  const term = text?.trim() ?? "";
  if (term.includes("\u0000")) return { ok: false, message: `${name} must not contain a NUL character.` };
  return { ok: true, value: term.length > 0 ? term : null };
}

/**
 * A case-insensitive substring match for Prisma. Prisma's `contains` becomes
 * ILIKE without escaping, so `%` and `_` in the term would act as wildcards;
 * escaping them (and the escape character itself) makes the term literal.
 */
export function containsText(term: string) {
  return { contains: term.replace(/[\\%_]/g, (char) => `\\${char}`), mode: "insensitive" as const };
}
