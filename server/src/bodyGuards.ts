import { MAX_ID } from "./queryParams.js";

// Lab 4, Issue 9 — the two guards of BR-52 for a request BODY (api-spec §7).
//
// Lab 3 closed both holes for query and path parameters (queryParams.ts, routeId.ts) and left the
// body open: a NUL character in a string, and an id above Int32, both reach PostgreSQL, which
// cannot hold either, and came back as a 500. They are a client's mistake, so they are a 400 on
// the field, answered before anything is written.
//
// Pure, so every boundary is unit-tested without a server (UNIT-12).

/** What the person sees beneath the field. It says that the text is refused, and nothing about why. */
export const NUL_MESSAGE = "This text contains a character that is not allowed.";

const NUL = "\u0000";

/**
 * The path of the first string in a JSON value that contains a NUL character, or null.
 *
 * Every string counts: a value, an element of an array, and a key. Paths read `a.b[1].c`, and a
 * value that is itself the string has the path `""`. The walk is iterative and remembers what it
 * has seen, because a hostile body can nest far deeper than the call stack allows.
 */
export function findNul(value: unknown): string | null {
  const seen = new Set<object>();
  // Children are pushed in reverse so the first one written is the first one read.
  const pending: Array<{ value: unknown; path: string }> = [{ value, path: "" }];
  while (pending.length > 0) {
    const { value: current, path } = pending.pop()!;
    if (typeof current === "string") {
      if (current.includes(NUL)) return path;
      continue;
    }
    if (typeof current !== "object" || current === null || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        pending.push({ value: current[index], path: `${path}[${index}]` });
      }
      continue;
    }
    const keys = Object.keys(current);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      const child = path === "" ? key : `${path}.${key}`;
      pending.push({ value: (current as Record<string, unknown>)[key], path: child });
      // A key is a string of the body as well. It is checked before its value is, being pushed last.
      if (key.includes(NUL)) pending.push({ value: key, path: child });
    }
  }
  return null;
}

export interface NulFailure {
  error: { code: "VALIDATION_FAILED"; message: string; fields: Record<string, string> };
}

/**
 * The Lab 3 envelope for a body with a NUL in it, naming the offending field; null when there is none.
 * A handler sends it with a 400 at the point where it validates the body, so the order of the guards
 * (session, role, ownership, then validation) is the one api-spec §8 sets.
 */
export function nulFailure(body: unknown): NulFailure | null {
  const path = findNul(body);
  if (path === null) return null;
  return {
    error: {
      code: "VALIDATION_FAILED",
      message: "One or more fields are invalid.",
      fields: { [path === "" ? "body" : path]: NUL_MESSAGE },
    },
  };
}

/**
 * An id in a request body: a JSON integer from 1 to 2147483647, otherwise null. A string is not an
 * id here (`"1"` is null), and a number the column cannot hold is refused before it can reach it.
 */
export function bodyId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID ? value : null;
}
