import { PERMITTED_PAGE_SIZES } from "./api.js";
import type { QueueSort } from "./api.js";
import { TICKET_STATUSES } from "./components/Badge.js";

// Lab 4, Issue 8 — the Ticket Queue's filters, as they are written in the address (ui-spec §7;
// specification.md FR-21, D-12). The same idea as My Tickets' (ticketListUrl.ts), and the same
// rules, because a dashboard card, a reload, and a bookmark have to show the same queue:
//
//   * A parameter the screen does not know is ignored, never an error.
//   * A value it does not recognise for a parameter it knows drops to the default, and the
//     control shows the default. The queue API refuses such values with a 400; the person never
//     gets there, because the address is cleaned before it is asked.
//   * A parameter given twice is read as its first.
//   * Only what is not the default is written, in one fixed order, so one queue has one address.
//
// The names are the queue API's own (`q`, `status`, `itPriority`, `owner`, `sort`, `direction`),
// so unlike My Tickets there is nothing to translate when the screen asks.

export type QueueDirection = "asc" | "desc";

export interface QueueState {
  search: string;
  status: string;
  group: "" | "open";
  itPriority: string;
  categoryId: string;
  /** `any`, `unassigned`, `me`, or a user id (D-18). */
  owner: string;
  sort: QueueSort;
  direction: QueueDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUEUE_STATE: QueueState = {
  search: "",
  status: "",
  group: "",
  itPriority: "",
  categoryId: "",
  owner: "any",
  sort: "itPriority",
  direction: "desc",
  page: 1,
  pageSize: 10,
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
/** The largest id or page the API accepts, so a number the address carries is never one it would refuse. */
const MAX_INT = 2_147_483_647;

function positiveInteger(text: string | null): number | null {
  if (text === null || !/^[1-9]\d*$/.test(text)) return null;
  const value = Number(text);
  return value <= MAX_INT ? value : null;
}

/** Reads an address' query string, with or without its leading "?". Never throws. */
export function parseQueueUrl(query: string): QueueState {
  const params = new URLSearchParams(query);
  const pick = (name: string, allowed: readonly string[]) => {
    const value = params.get(name);
    return value !== null && allowed.includes(value) ? value : "";
  };
  const id = (name: string) => {
    const value = positiveInteger(params.get(name));
    return value === null ? "" : String(value);
  };

  const owner = params.get("owner");
  const ownerId = positiveInteger(owner);
  const pageSize = positiveInteger(params.get("pageSize"));
  return {
    // A NUL character would be refused by the API, and trimming is what the API does as well.
    search: (params.get("q") ?? "").replace(/\u0000/g, "").trim(),
    status: pick("status", TICKET_STATUSES),
    group: pick("group", ["open"]) as QueueState["group"],
    itPriority: pick("itPriority", PRIORITIES),
    categoryId: id("categoryId"),
    owner: owner === "any" || owner === "unassigned" || owner === "me" ? owner : ownerId !== null ? String(ownerId) : DEFAULT_QUEUE_STATE.owner,
    sort: (pick("sort", ["itPriority", "createdAt", "updatedAt"]) || DEFAULT_QUEUE_STATE.sort) as QueueSort,
    direction: (pick("direction", ["asc", "desc"]) || DEFAULT_QUEUE_STATE.direction) as QueueDirection,
    page: positiveInteger(params.get("page")) ?? DEFAULT_QUEUE_STATE.page,
    pageSize: pageSize !== null && (PERMITTED_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_QUEUE_STATE.pageSize,
  };
}

/** Writes a state as a query string without its "?": only what differs from the default, in a fixed order. */
export function toQueueUrl(state: QueueState): string {
  const params = new URLSearchParams();
  const write = (name: string, value: string | number, fallback: string | number) => {
    if (value !== fallback && value !== "") params.set(name, String(value));
  };
  write("group", state.group, DEFAULT_QUEUE_STATE.group);
  write("status", state.status, DEFAULT_QUEUE_STATE.status);
  write("itPriority", state.itPriority, DEFAULT_QUEUE_STATE.itPriority);
  write("owner", state.owner, DEFAULT_QUEUE_STATE.owner);
  write("q", state.search.trim(), DEFAULT_QUEUE_STATE.search);
  write("categoryId", state.categoryId, DEFAULT_QUEUE_STATE.categoryId);
  write("sort", state.sort, DEFAULT_QUEUE_STATE.sort);
  write("direction", state.direction, DEFAULT_QUEUE_STATE.direction);
  write("page", state.page, DEFAULT_QUEUE_STATE.page);
  write("pageSize", state.pageSize, DEFAULT_QUEUE_STATE.pageSize);
  return params.toString();
}
