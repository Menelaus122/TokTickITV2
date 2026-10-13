import { REQUESTED_PRIORITIES, type RequestedPriority } from "./validation.js";
import { parseSearch, positiveId } from "./queryParams.js";

// Query contract for GET /api/tickets (BR-18 to BR-24).
//
// Pure parsing, so every boundary can be unit-tested without a database. The
// rule that shapes this module: an invalid parameter is a client error, never
// silently corrected to a default (BR-23). Silent correction hides client bugs
// and would make the invalid-query acceptance criterion untestable.

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const PERMITTED_PAGE_SIZES = [10, 20, 50] as const;

export const SORTABLE_FIELDS = ["createdAt", "updatedAt"] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// Lab 3 tickets move through eight statuses, and a Requester's own list shows
// every one of them, so the filter accepts them all (api-spec §1.5).
export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Lab 4, Issue 7 — the open group (specification.md BR-31, D-12; api-spec §5.1): the five
// statuses nobody has resolved, closed, or cancelled. A single `status` value cannot say
// that, so the lists gain `group=open`, which a dashboard card's link carries. The Ticket
// Queue of Issue 8 uses the same two functions below.
export const OPEN_GROUP = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const satisfies readonly TicketStatus[];

export const STATUS_GROUPS = ["open"] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export interface TicketListQuery {
  search: string | null;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: RequestedPriority | null;
  currentStatus: TicketStatus | null;
  group: StatusGroup | null;
  sortBy: SortField;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}

export type ParseResult =
  | { ok: true; value: TicketListQuery }
  | { ok: false; message: string };

type RawQuery = Record<string, unknown>;

/** Express gives repeated params as arrays; only a lone string is meaningful. */
export function single(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") return value[0];
  return undefined;
}

export function absent(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export type GroupResult = { ok: true; value: StatusGroup | null } | { ok: false; message: string };

/** `group`: absent is no group; anything but a lone `open` is rejected, never corrected (BR-23). */
export function parseGroup(raw: unknown): GroupResult {
  if (absent(raw)) return { ok: true, value: null };
  const text = single(raw);
  if (text === undefined || !STATUS_GROUPS.includes(text as StatusGroup)) {
    return { ok: false, message: `group must be ${STATUS_GROUPS.join(", ")}.` };
  }
  return { ok: true, value: text as StatusGroup };
}

/**
 * The statuses a list may show once `group` and `status` are both applied, or null when neither
 * narrows it. They combine by AND (api-spec §5.1): a status outside the group leaves nothing,
 * which is an empty list and not an error.
 */
export function allowedStatuses(group: StatusGroup | null, status: TicketStatus | null): TicketStatus[] | null {
  const inGroup: readonly TicketStatus[] | null = group === "open" ? OPEN_GROUP : null;
  if (inGroup && status) return inGroup.includes(status) ? [status] : [];
  if (inGroup) return [...inGroup];
  if (status) return [status];
  return null;
}

export function parseTicketListQuery(raw: RawQuery): ParseResult {
  // --- search -------------------------------------------------------------
  // Trimmed; a term that is empty after trimming is ignored rather than
  // treated as a filter that matches nothing (BR-18).
  const parsedSearch = parseSearch("search", single(raw.search));
  if (!parsedSearch.ok) return parsedSearch;
  const search = parsedSearch.value;

  // --- id filters ---------------------------------------------------------
  function idFilter(name: string, value: unknown): number | null | { error: string } {
    if (absent(value)) return null;
    const text = single(value);
    if (text === undefined) return { error: `${name} must be a single value.` };
    return positiveId(text) ?? { error: `${name} must be a positive integer.` };
  }

  const categoryId = idFilter("categoryId", raw.categoryId);
  if (categoryId !== null && typeof categoryId === "object") {
    return { ok: false, message: categoryId.error };
  }

  const relatedSystemId = idFilter("relatedSystemId", raw.relatedSystemId);
  if (relatedSystemId !== null && typeof relatedSystemId === "object") {
    return { ok: false, message: relatedSystemId.error };
  }

  // --- enum filters -------------------------------------------------------
  let requestedPriority: RequestedPriority | null = null;
  if (!absent(raw.requestedPriority)) {
    const text = single(raw.requestedPriority);
    if (text === undefined || !REQUESTED_PRIORITIES.includes(text as RequestedPriority)) {
      return {
        ok: false,
        message: `requestedPriority must be one of ${REQUESTED_PRIORITIES.join(", ")}.`,
      };
    }
    requestedPriority = text as RequestedPriority;
  }

  let currentStatus: TicketStatus | null = null;
  if (!absent(raw.currentStatus)) {
    const text = single(raw.currentStatus);
    if (text === undefined || !TICKET_STATUSES.includes(text as TicketStatus)) {
      return { ok: false, message: `currentStatus must be one of ${TICKET_STATUSES.join(", ")}.` };
    }
    currentStatus = text as TicketStatus;
  }

  const group = parseGroup(raw.group);
  if (!group.ok) return group;

  // --- sorting ------------------------------------------------------------
  let sortBy: SortField = "createdAt";
  if (!absent(raw.sortBy)) {
    const text = single(raw.sortBy);
    if (text === undefined || !SORTABLE_FIELDS.includes(text as SortField)) {
      return { ok: false, message: `sortBy must be one of ${SORTABLE_FIELDS.join(", ")}.` };
    }
    sortBy = text as SortField;
  }

  let sortDir: SortDirection = "desc";
  if (!absent(raw.sortDir)) {
    const text = single(raw.sortDir);
    if (text === undefined || !SORT_DIRECTIONS.includes(text as SortDirection)) {
      return { ok: false, message: `sortDir must be one of ${SORT_DIRECTIONS.join(", ")}.` };
    }
    sortDir = text as SortDirection;
  }

  // --- pagination ---------------------------------------------------------
  let page = DEFAULT_PAGE;
  if (!absent(raw.page)) {
    const parsed = positiveId(single(raw.page));
    if (parsed === null) {
      return { ok: false, message: "page must be an integer of 1 or more." };
    }
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
      search,
      categoryId: categoryId as number | null,
      relatedSystemId: relatedSystemId as number | null,
      requestedPriority,
      currentStatus,
      group: group.value,
      sortBy,
      sortDir,
      page,
      pageSize,
    },
  };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function buildPageMeta(page: number, pageSize: number, totalItems: number): PageMeta {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPrev: page > 1,
    // A page past the end is valid input and simply has nothing after it.
    hasNext: page < totalPages,
  };
}
