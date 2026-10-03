import type { TicketStatus } from "./listQuery.js";

// Lab 3, Issue 9 — the status lifecycle (specification.md §5.5, BR-33 to BR-38).
//
// Pure, so every pair in the matrix is unit-tested without a database
// (UNIT-06 to UNIT-08). The staff detail response computes
// permittedTransitions from the same table the PATCH route enforces, so the
// screen can never offer a move the API would refuse (FR-34).

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
