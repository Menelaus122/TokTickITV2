import type { TicketStatus } from "./listQuery.js";

// Lab 3, Issue 9 — the status lifecycle (specification.md §5.5, BR-33 to BR-38).
// Lab 4, Issue 6 — the resolution gate and the options built on it (BR-15, BR-17,
// BR-18, BR-24; docs/lab-04/specification.md).
//
// Pure, so every pair in the matrix and every gate case is unit-tested without a
// database (Lab 3 UNIT-06 to UNIT-08; Lab 4 UNIT-07 to UNIT-10). The staff detail
// response and the PATCH route decide from the same functions, so the screen can
// never offer a move the API would refuse, nor the API refuse a move for a reason
// the screen did not give (FR-09, FR-10).

const MATRIX: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [], // terminal
};

/** The statuses reachable from `from`, in the matrix's order. Never includes `from` itself (BR-38). */
export function permittedTransitions(from: TicketStatus): TicketStatus[] {
  return [...MATRIX[from]];
}

export function isPermittedTransition(from: TicketStatus, to: TicketStatus): boolean {
  return MATRIX[from].includes(to);
}

/** Targets whose reason is posted as a Public Comment, so the Requester learns why (BR-36, BR-37). */
export const REASON_REQUIRED: readonly TicketStatus[] = ["RESOLVED", "CANCELLED", "REOPENED"];

/** Targets that need a Ticket Owner, so nothing is resolved or closed anonymously (BR-35). */
export const OWNER_REQUIRED: readonly TicketStatus[] = ["RESOLVED", "CLOSED"];

export function requiresReason(to: TicketStatus): boolean {
  return REASON_REQUIRED.includes(to);
}

export function requiresOwner(to: TicketStatus): boolean {
  return OWNER_REQUIRED.includes(to);
}

// ---------------------------------------------------------------------------
// Lab 4 — the resolution gate (BR-17, BR-18, D-07)
// ---------------------------------------------------------------------------

/** What the gate needs to know about an Action Taken. It deliberately has no Action Date/Time. */
export interface GateAction {
  id: number;
  /** When it was recorded: set by the server and never edited. */
  createdAt: Date;
  followUpRequired: boolean;
}

export type GateCode = "ACTION_REQUIRED" | "FOLLOW_UP_PENDING";
export type GateResult = { ok: true } | { ok: false; code: GateCode };

/**
 * BR-17. A move to RESOLVED needs at least one *relevant* Action Taken, and the
 * latest relevant one must not need follow-up.
 *
 * Relevant means recorded after the Ticket's most recent entry into REOPENED, or
 * at any time if it was never reopened (D-07). Latest means most recently
 * *recorded*: the highest `createdAt`, then the highest `id`. The Action Date/Time
 * a person types, and can edit, is not an input, so neither a backdated action
 * nor an edit to a date can hide a pending follow-up (BR-08 orders the list for
 * reading, not for this).
 */
export function resolutionGate(actions: readonly GateAction[], lastReopenedAt: Date | null): GateResult {
  let latest: GateAction | null = null;
  for (const action of actions) {
    if (lastReopenedAt !== null && action.createdAt.getTime() <= lastReopenedAt.getTime()) continue;
    const later =
      latest === null ||
      action.createdAt.getTime() > latest.createdAt.getTime() ||
      (action.createdAt.getTime() === latest.createdAt.getTime() && action.id > latest.id);
    if (later) latest = action;
  }
  if (latest === null) return { ok: false, code: "ACTION_REQUIRED" };
  return latest.followUpRequired ? { ok: false, code: "FOLLOW_UP_PENDING" } : { ok: true };
}

// ---------------------------------------------------------------------------
// Lab 4 — what a Ticket can do right now (FR-09, FR-10, BR-24)
// ---------------------------------------------------------------------------

export type BlockCode = "OWNER_REQUIRED" | GateCode;

/** One message per reason, words safe to show: the GET detail lists them and the PATCH answers with them. */
export const BLOCK_MESSAGES: Record<BlockCode, string> = {
  OWNER_REQUIRED: "Claim or assign the ticket before resolving or closing it.",
  ACTION_REQUIRED: "Record at least one action before resolving this ticket.",
  FOLLOW_UP_PENDING: "The most recently recorded action still needs follow-up. Record the follow-up as a new action first.",
};

export interface BlockedTransition {
  to: TicketStatus;
  code: BlockCode;
  message: string;
}

export interface TransitionContext {
  hasOwner: boolean;
  gate: GateResult;
}

/**
 * Why a move that the matrix allows is not available yet, or null. The owner rule
 * comes before the gate, so a request that is both unowned and ungated is told to
 * claim first (BR-24).
 */
export function blockedReason(to: TicketStatus, context: TransitionContext): BlockedTransition | null {
  if (requiresOwner(to) && !context.hasOwner) return { to, code: "OWNER_REQUIRED", message: BLOCK_MESSAGES.OWNER_REQUIRED };
  if (to === "RESOLVED" && !context.gate.ok) return { to, code: context.gate.code, message: BLOCK_MESSAGES[context.gate.code] };
  return null;
}

export interface TransitionOptions {
  /** The moves the Ticket can make right now. */
  permitted: TicketStatus[];
  /** The matrix's other moves, each with the reason it is not available yet. */
  blocked: BlockedTransition[];
}

/** Together, `permitted` and `blocked` are exactly the matrix row for `from`, in the matrix's order (api-spec §3.1). */
export function transitionOptions(from: TicketStatus, context: TransitionContext): TransitionOptions {
  const permitted: TicketStatus[] = [];
  const blocked: BlockedTransition[] = [];
  for (const to of MATRIX[from]) {
    const reason = blockedReason(to, context);
    if (reason) blocked.push(reason);
    else permitted.push(to);
  }
  return { permitted, blocked };
}
