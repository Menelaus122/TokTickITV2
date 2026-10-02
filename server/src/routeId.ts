/** Parses a positive integer route parameter, or null when malformed. */
export function routeId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
