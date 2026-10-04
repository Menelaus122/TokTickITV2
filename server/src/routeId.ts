import { positiveId } from "./queryParams.js";

/** Parses a positive integer route parameter, or null when malformed or out of range. */
export function routeId(raw: string): number | null {
  return positiveId(raw);
}
