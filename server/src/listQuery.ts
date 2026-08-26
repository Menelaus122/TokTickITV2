import { REQUESTED_PRIORITIES, type RequestedPriority } from "./validation.js";

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

export const TICKET_STATUSES = ["NEW"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface TicketListQuery {
  search: string | null;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: RequestedPriority | null;
  currentStatus: TicketStatus | null;
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
function single(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") return value[0];
  return undefined;
}

function absent(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function parseTicketListQuery(raw: RawQuery): ParseResult {
  // --- search -------------------------------------------------------------
  // Trimmed; a term that is empty after trimming is ignored rather than
  // treated as a filter that matches nothing (BR-18).
  const rawSearch = single(raw.search);
  const trimmedSearch = rawSearch?.trim() ?? "";
  const search = trimmedSearch.length > 0 ? trimmedSearch : null;

  // --- id filters ---------------------------------------------------------
  function idFilter(name: string, value: unknown): number | null | { error: string } {
    if (absent(value)) return null;
    const text = single(value);
    if (text === undefined) return { error: `${name} must be a single value.` };
    const parsed = Number(text);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: `${name} must be a positive integer.` };
    }
    return parsed;
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
    const text = single(raw.page);
    const parsed = text === undefined ? NaN : Number(text);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, message: "page must be an integer of 1 or more." };
    }
    page = parsed;
  }

  let pageSize: number = DEFAULT_PAGE_SIZE;
  if (!absent(raw.pageSize)) {
    const text = single(raw.pageSize);
    const parsed = text === undefined ? NaN : Number(text);
    if (!PERMITTED_PAGE_SIZES.includes(parsed as (typeof PERMITTED_PAGE_SIZES)[number])) {
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
