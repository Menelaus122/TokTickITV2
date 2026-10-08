import { PERMITTED_PAGE_SIZES } from "./api.js";
import { TICKET_STATUSES } from "./components/Badge.js";

// Lab 4, Issue 7 — My Tickets' filters, as they are written in the address (ui-spec §7;
// specification.md FR-21, D-12).
//
// A dashboard card, a reload, and a bookmark all have to show the same list, so the address
// is the one place the filters live: the screen reads its state from it and writes every
// change back. These two functions are the whole of that, and they are pure, so every rule
// about what an address may say is tested without a screen.
//
//   * A parameter the screen does not know is ignored, never an error.
//   * A value it does not recognise for a parameter it knows drops to the default, and the
//     control shows the default. The list API refuses such values with a 400; the person
//     never gets there, because the address is cleaned before it is asked.
//   * A parameter given twice is read as its first.
//   * Only what is not the default is written, in one fixed order, so one list has one address.
//
// `status` is the route's name for the status filter (it is the Ticket Queue's as well); the
// list API calls it `currentStatus`, and the screen makes that translation when it asks.

export type ListSortField = "createdAt" | "updatedAt";
export type ListSortDirection = "asc" | "desc";

export interface TicketListState {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: string;
  status: string;
  group: "" | "open";
  sortBy: ListSortField;
  sortDir: ListSortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_LIST_STATE: TicketListState = {
  search: "",
  categoryId: "",
  relatedSystemId: "",
  requestedPriority: "",
  status: "",
  group: "",
  sortBy: "createdAt",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
/** The largest id or page the API accepts, so a number the URL carries is never one it would refuse. */
const MAX_INT = 2_147_483_647;

function positiveInteger(text: string | null): number | null {
  if (text === null || !/^[1-9]\d*$/.test(text)) return null;
  const value = Number(text);
  return value <= MAX_INT ? value : null;
}

/** Reads an address' query string, with or without its leading "?". Never throws. */
export function parseTicketListUrl(query: string): TicketListState {
  const params = new URLSearchParams(query);
  const pick = (name: string, allowed: readonly string[]) => {
    const value = params.get(name);
    return value !== null && allowed.includes(value) ? value : "";
  };
  const id = (name: string) => {
    const value = positiveInteger(params.get(name));
    return value === null ? "" : String(value);
  };

  const pageSize = positiveInteger(params.get("pageSize"));
  return {
    // A NUL character would be refused by the API, and trimming is what the API does as well.
    search: (params.get("search") ?? "").replace(/\u0000/g, "").trim(),
    categoryId: id("categoryId"),
    relatedSystemId: id("relatedSystemId"),
    requestedPriority: pick("requestedPriority", PRIORITIES),
    status: pick("status", TICKET_STATUSES),
    group: pick("group", ["open"]) as TicketListState["group"],
    sortBy: (pick("sortBy", ["createdAt", "updatedAt"]) || DEFAULT_LIST_STATE.sortBy) as ListSortField,
    sortDir: (pick("sortDir", ["asc", "desc"]) || DEFAULT_LIST_STATE.sortDir) as ListSortDirection,
    page: positiveInteger(params.get("page")) ?? DEFAULT_LIST_STATE.page,
    pageSize: pageSize !== null && (PERMITTED_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_LIST_STATE.pageSize,
  };
}

/** Writes a state as a query string without its "?": only what differs from the default, in a fixed order. */
export function toTicketListUrl(state: TicketListState): string {
  const params = new URLSearchParams();
  const write = (name: string, value: string | number, fallback: string | number) => {
    if (value !== fallback && value !== "") params.set(name, String(value));
  };
  write("group", state.group, DEFAULT_LIST_STATE.group);
  write("status", state.status, DEFAULT_LIST_STATE.status);
  write("search", state.search.trim(), DEFAULT_LIST_STATE.search);
  write("categoryId", state.categoryId, DEFAULT_LIST_STATE.categoryId);
  write("relatedSystemId", state.relatedSystemId, DEFAULT_LIST_STATE.relatedSystemId);
  write("requestedPriority", state.requestedPriority, DEFAULT_LIST_STATE.requestedPriority);
  write("sortBy", state.sortBy, DEFAULT_LIST_STATE.sortBy);
  write("sortDir", state.sortDir, DEFAULT_LIST_STATE.sortDir);
  write("page", state.page, DEFAULT_LIST_STATE.page);
  write("pageSize", state.pageSize, DEFAULT_LIST_STATE.pageSize);
  return params.toString();
}
