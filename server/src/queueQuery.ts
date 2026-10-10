import { REQUESTED_PRIORITIES, type RequestedPriority } from "./validation.js";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, PERMITTED_PAGE_SIZES, SORT_DIRECTIONS, TICKET_STATUSES, absent, parseGroup, single } from "./listQuery.js";
import type { SortDirection, StatusGroup, TicketStatus } from "./listQuery.js";
import { parseSearch, positiveId } from "./queryParams.js";

// Lab 3, Issue 8 — query contract for GET /api/staff/tickets (api-spec §5.1;
// specification.md BR-53 to BR-59).
//
// Pure parsing, like Lab 2's listQuery.ts, so every boundary is unit-tested
// without a database. The same rule holds: an invalid parameter is a 400, never
// silently corrected to a default (BR-58).

export const QUEUE_SORT_FIELDS = ["itPriority", "createdAt", "updatedAt"] as const;
export type QueueSortField = (typeof QUEUE_SORT_FIELDS)[number];

/** Who owns the tickets to show (D-18). `me` is resolved against the session by the route. */
export type OwnerFilter = { kind: "any" } | { kind: "unassigned" } | { kind: "me" } | { kind: "user"; id: number };

export interface QueueQuery {
  q: string | null;
  status: TicketStatus | null;
  /** Lab 4 (D-12): the open group, which combines with `status` by AND. Parsed by the same function as the Requester's list. */
  group: StatusGroup | null;
  itPriority: RequestedPriority | null;
  categoryId: number | null;
  owner: OwnerFilter;
  sort: QueueSortField;
  direction: SortDirection;
  page: number;
  pageSize: number;
}

export type QueueParseResult = { ok: true; value: QueueQuery } | { ok: false; message: string };

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): T | null | { error: string } {
  if (absent(value)) return null;
  const text = single(value);
  if (text === undefined || !allowed.includes(text as T)) {
    return { error: `${name} must be one of ${allowed.join(", ")}.` };
  }
  return text as T;
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

export function parseQueueQuery(raw: Record<string, unknown>): QueueParseResult {
  // Trimmed; blank after trimming means no search, not a search matching
  // nothing (BR-53).
  const search = parseSearch("q", single(raw.q));
  if (!search.ok) return search;
  const q = search.value;

  const status = oneOf("status", raw.status, TICKET_STATUSES);
  if (isError(status)) return { ok: false, message: status.error };

  const group = parseGroup(raw.group);
  if (!group.ok) return group;

  const itPriority = oneOf("itPriority", raw.itPriority, REQUESTED_PRIORITIES);
  if (isError(itPriority)) return { ok: false, message: itPriority.error };

  let categoryId: number | null = null;
  if (!absent(raw.categoryId)) {
    categoryId = positiveId(single(raw.categoryId));
    if (categoryId === null) return { ok: false, message: "categoryId must be a positive integer." };
  }

  let owner: OwnerFilter = { kind: "any" };
  if (!absent(raw.owner)) {
    const text = single(raw.owner);
    if (text === "any" || text === "unassigned" || text === "me") {
      owner = { kind: text };
    } else {
      const id = positiveId(text);
      if (id === null) return { ok: false, message: "owner must be any, unassigned, me, or a user id." };
      owner = { kind: "user", id };
    }
  }

  const sort = oneOf("sort", raw.sort, QUEUE_SORT_FIELDS);
  if (isError(sort)) return { ok: false, message: sort.error };

  const direction = oneOf("direction", raw.direction, SORT_DIRECTIONS);
  if (isError(direction)) return { ok: false, message: direction.error };

  let page = DEFAULT_PAGE;
  if (!absent(raw.page)) {
    const parsed = positiveId(single(raw.page));
    if (parsed === null) return { ok: false, message: "page must be an integer of 1 or more." };
    page = parsed;
  }

  let pageSize: number = DEFAULT_PAGE_SIZE;
  if (!absent(raw.pageSize)) {
    const parsed = positiveId(single(raw.pageSize));
    if (parsed === null || !PERMITTED_PAGE_SIZES.includes(parsed as (typeof PERMITTED_PAGE_SIZES)[number])) {
      return { ok: false, message: `pageSize must be one of ${PERMITTED_PAGE_SIZES.join(", ")}.` };
    }
    pageSize = parsed;
  }

  return {
    ok: true,
    value: {
      q,
      status,
      group: group.value,
      itPriority,
      categoryId,
      owner,
      sort: sort ?? "itPriority",
      direction: direction ?? "desc",
      page,
      pageSize,
    },
  };
}

type OrderBy = Array<Partial<Record<QueueSortField | "id", SortDirection>>>;

/**
 * The Prisma orderBy for a queue sort. IT Priority keeps the oldest ticket
 * first within one priority, the thing that has waited longest (BR-55), and
 * every sort ends with id descending so a page never repeats or skips a row
 * when values tie (BR-56). The Priority enum is declared LOW → URGENT, so
 * PostgreSQL orders it by urgency, not alphabetically.
 */
export function queueOrderBy(sort: QueueSortField, direction: SortDirection): OrderBy {
  if (sort === "itPriority") return [{ itPriority: direction }, { createdAt: "asc" }, { id: "desc" }];
  return [{ [sort]: direction }, { id: "desc" }];
}
