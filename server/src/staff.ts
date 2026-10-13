import express, { type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { allowedStatuses, buildPageMeta } from "./listQuery.js";
import { containsText } from "./queryParams.js";
import { parseQueueQuery, queueOrderBy, type OwnerFilter } from "./queueQuery.js";
import type { Prisma } from "@prisma/client";
import { bodyId, nulFailure } from "./bodyGuards.js";
import { routeId } from "./routeId.js";
import { REQUESTED_PRIORITIES, type RequestedPriority } from "./validation.js";
import { TICKET_STATUSES, type TicketStatus } from "./listQuery.js";
import { ENTRY_SELECT, checkBody } from "./conversation.js";
import { ATTACHMENT_SELECT, attachmentView, sendAttachment } from "./attachmentResponse.js";
import { BLOCK_MESSAGES, blockedReason, isPermittedTransition, requiresOwner, requiresReason, resolutionGate, transitionOptions, type GateResult } from "./transitions.js";
import { lockTicketRow } from "./ticketLock.js";

// Lab 3, Issues 8 and 9 — IT Staff ticket operations (api-spec §5); Lab 4, Issue 6 adds
// the resolution gate, versions, status history, and locks to them (api-spec §3).
//
// Mounted under /api/staff, behind app.ts's requireRole("IT_STAFF",
// "ADMINISTRATOR"), so every route here is for IT Staff and Administrators only
// before it runs (Lab 4 BR-42, BR-43; a Requester is refused). Nothing in this
// router repeats that check. An Administrator acts as themself here (BR-45).

const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

/**
 * The owner in every staff shape (Lab 4 BR-55, api-spec §1.4): `isActive` says the account is deactivated
 * (Lab 3 BR-26), and `role` says it is active but no longer IT Staff or an Administrator, so the screen can
 * tell "Inactive" from "No longer IT Staff". No email, and nothing of the password or the session.
 */
export const OWNER_SELECT = { select: { id: true, fullName: true, role: true, isActive: true } } as const;

const QUEUE_ROW_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  category: { select: { name: true } },
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  owner: OWNER_SELECT,
  requesterResolvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function ownerWhere(owner: OwnerFilter, me: number) {
  switch (owner.kind) {
    case "any":
      return {};
    case "unassigned":
      return { ownerId: null };
    case "me":
      return { ownerId: me };
    case "user":
      return { ownerId: owner.id };
  }
}

export const staffRouter = express.Router();

// GET /api/staff/tickets — the queue: every Requester's tickets (FR-26, AC-20).
staffRouter.get("/tickets", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const parsed = parseQueueQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return res.status(400).json({ error: { code: "INVALID_QUERY", message: parsed.message } });
  const query = parsed.value;

  // Lab 4 (D-12): `group` and `status` narrow the same column, and combine by AND, through
  // the function the Requester's list uses.
  const statuses = allowedStatuses(query.group, query.status);

  // Filters and search combine with AND (BR-54).
  const where = {
    ...(statuses ? { currentStatus: { in: statuses } } : {}),
    ...(query.itPriority ? { itPriority: query.itPriority } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...ownerWhere(query.owner, req.auth!.user.id),
    ...(query.q
      ? {
          OR: [
            { ticketNumber: containsText(query.q) },
            { summary: containsText(query.q) },
          ],
        }
      : {}),
  };

  const prisma = getPrisma();
  try {
    const [totalItems, rows] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: queueOrderBy(query.sort, query.direction),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: QUEUE_ROW_SELECT,
      }),
    ]);
    // A page past the end is a 200 with no rows and true metadata (BR-59).
    const { page, pageSize, totalPages } = buildPageMeta(query.page, query.pageSize, totalItems);
    return res.status(200).json({
      tickets: rows.map(({ category, ...row }) => ({ ...row, categoryName: category.name })),
      page,
      pageSize,
      totalItems,
      totalPages,
    });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// GET /api/staff/assignable-users — active IT Staff and Administrators by name
// (api-spec §5.6, BR-24). The queue's Owner filter lists them (D-18); Issue 9's
// reassignment picker reads the same list.
staffRouter.get("/assignable-users", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const users = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: { id: true, fullName: true, role: true, isActive: true },
    });
    return res.status(200).json({ users });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// ---------------------------------------------------------------------------
// Lab 3, Issue 9 — IT Staff Ticket Detail operations (api-spec §5.2 to §5.5;
// specification.md §4.7, BR-24 to BR-38).
//
// Every write locks the ticket's row for its transaction (SELECT … FOR
// UPDATE), then decides from what it read under the lock. Two IT Staff acting
// on one ticket at once are therefore serialised: the second sees the first's
// result and is refused or applied against it, never against a stale read.
// ---------------------------------------------------------------------------

/** BR-36 — a reason posted with a transition is 5–2000 characters. */
export const REASON_MIN = 5;

const TICKET_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That ticket could not be found." } } as const;
const INVALID_ID = { error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } } as const;

const DETAIL_SELECT = {
  ...QUEUE_ROW_SELECT,
  // BR-25, BR-26 — what the screen sends back as expectedVersion.
  version: true,
  description: true,
  relatedSystem: { select: { name: true } },
  // The permitted user shape (api-spec §1.6), nothing wider.
  requester: { select: { id: true, fullName: true, email: true, role: true, isActive: true } },
  attachments: { select: ATTACHMENT_SELECT, orderBy: { uploadedAt: "asc" as const } },
} as const;

type Db = Prisma.TransactionClient;

/**
 * What the resolution gate reads (BR-17): the Ticket's actions as they were
 * recorded, and the instant it last entered REOPENED, which the history dates
 * exactly (D-03). A Ticket with no such row is treated as never reopened (D-07).
 */
async function gateFor(db: Db, ticketId: number): Promise<GateResult> {
  const actions = await db.actionTaken.findMany({ where: { ticketId }, select: { id: true, createdAt: true, followUpRequired: true } });
  const reopened = await db.ticketStatusChange.findFirst({
    where: { ticketId, toStatus: "REOPENED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  return resolutionGate(actions, reopened?.createdAt ?? null);
}

/**
 * The detail response's `ticket` (api-spec §3.1): every Lab 3 field, plus the version,
 * the moves the Ticket can make now, and the ones it cannot yet with the reason (FR-09).
 */
async function loadDetail(db: Db, id: number) {
  const row = await db.ticket.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!row) return null;
  const { category, relatedSystem, attachments, ...rest } = row;
  const options = transitionOptions(row.currentStatus, { hasOwner: row.owner !== null, gate: await gateFor(db, id) });
  return {
    ...rest,
    categoryName: category.name,
    relatedSystemName: relatedSystem.name,
    // Downloads go through the staff route, which the role guard covers.
    attachments: attachments.map((attachment) => attachmentView(attachment, "/api/staff/attachments")),
    permittedTransitions: options.permitted,
    blockedTransitions: options.blocked,
  };
}

/** Locks the ticket's row until the transaction ends, and reads what the decision needs (BR-29). */
async function lockTicket(tx: Db, id: number) {
  await lockTicketRow(tx, id);
  return tx.ticket.findUnique({ where: { id }, select: { ownerId: true, currentStatus: true, version: true, itPriority: true } });
}

function invalid(res: Response, field: string, message: string) {
  return res.status(400).json({
    error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields: { [field]: message } },
  });
}

type Outcome = { status: 200 | 404 | 409; body: unknown };

function conflict(code: string, message: string): Outcome {
  return { status: 409, body: { error: { code, message } } };
}

/** A JSON id: an integer from 1 to MAX_ID, or null; undefined when it is neither. */
function jsonId(value: unknown): number | null | undefined {
  if (value === null) return null;
  return bodyId(value) ?? undefined;
}

/**
 * The optional expectedVersion of BR-26: `undefined` when it is absent, `null` when it
 * is present but is not a version (a 400), otherwise the number.
 */
function expectedVersionOf(body: { expectedVersion?: unknown }): number | null | undefined {
  if (!("expectedVersion" in body) || body.expectedVersion === undefined) return undefined;
  return bodyId(body.expectedVersion);
}

const BAD_VERSION = "Send the version of the ticket you are working on.";

/** BR-26 — the Ticket changed since the screen loaded it. The answer carries the Ticket as it is now. */
async function staleOutcome(tx: Db, id: number): Promise<Outcome> {
  return {
    status: 409,
    body: {
      error: {
        code: "STALE_UPDATE",
        message: "This ticket changed while you were working on it. Review the latest version and try again.",
        current: await loadDetail(tx, id),
      },
    },
  };
}

// GET /api/staff/tickets/:id — one ticket for operations (api-spec §3.1).
staffRouter.get("/tickets/:id", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  try {
    const ticket = await loadDetail(getPrisma(), id);
    if (!ticket) return res.status(404).json(TICKET_NOT_FOUND);
    return res.status(200).json({ ticket });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/owner — claim, assign, reassign, unassign
// (api-spec §3.2; BR-24, BR-25, BR-26, BR-29, BR-34).
staffRouter.patch("/tickets/:id/owner", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  // Lab 4 (BR-52): a NUL character anywhere in the body is a 400 on its field, before the body is read.
  const nul = nulFailure(req.body);
  if (nul) return res.status(400).json(nul);

  const raw = (req.body ?? {}) as { ownerId?: unknown; expectedOwnerId?: unknown; expectedVersion?: unknown };
  // Omitting ownerId is a validation error, never an implicit claim.
  if (!("ownerId" in raw)) return invalid(res, "ownerId", "Choose an owner, or null to unassign.");
  const ownerId = jsonId(raw.ownerId);
  if (ownerId === undefined) return invalid(res, "ownerId", "The owner must be a user id or null.");
  // The owner the screen was showing (null for a claim). When it no longer
  // matches, someone else changed the owner first (BR-25, AC-23).
  const checksExpected = "expectedOwnerId" in raw;
  const expectedOwnerId = jsonId(raw.expectedOwnerId);
  if (checksExpected && expectedOwnerId === undefined) {
    return invalid(res, "expectedOwnerId", "The expected owner must be a user id or null.");
  }
  const expectedVersion = expectedVersionOf(raw);
  if (expectedVersion === null) return invalid(res, "expectedVersion", BAD_VERSION);

  const prisma = getPrisma();
  const actorId = req.auth!.user.id;
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome | { status: 400; body: unknown }> => {
      const current = await lockTicket(tx, id);
      if (!current) return { status: 404, body: TICKET_NOT_FOUND };

      if (ownerId !== null) {
        // Read after the Ticket's lock, and held with FOR SHARE, so a deactivation racing this
        // assignment is judged one way or the other and never slips between the read and the
        // write (BR-29, AC-14). Ticket first, then User: the order every path takes.
        const rows = await tx.$queryRaw<Array<{ role: string; isActive: boolean }>>`
          SELECT role::text AS role, "isActive" FROM "User" WHERE id = ${ownerId} FOR SHARE`;
        const user = rows[0];
        if (!user) {
          return { status: 400, body: { error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields: { ownerId: "That user does not exist." } } } };
        }
        // Active at the time of assignment; a later deactivation keeps them (BR-24, BR-26).
        if (!user.isActive || (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR")) {
          return conflict("OWNER_NOT_ASSIGNABLE", "Only an active IT Staff member or Administrator can own a ticket.");
        }
      }

      if (current.currentStatus === "CANCELLED") {
        return conflict("INVALID_TRANSITION", "A cancelled ticket is closed for good and cannot change owner.");
      }
      // expectedOwnerId keeps its own answer, and is checked first (BR-26, Lab 3 D-26).
      if (checksExpected && current.ownerId !== expectedOwnerId) {
        return conflict(
          "TICKET_ALREADY_OWNED",
          expectedOwnerId === null
            ? "Someone else claimed this ticket first."
            : "The owner changed while you were working on this ticket. Reload to see who owns it now.",
        );
      }
      if (expectedVersion !== undefined && current.version !== expectedVersion) return staleOutcome(tx, id);
      // Nothing is resolved or closed anonymously, so it is not unassigned
      // there either (BR-35).
      if (ownerId === null && requiresOwner(current.currentStatus)) {
        return conflict("OWNER_REQUIRED", BLOCK_MESSAGES.OWNER_REQUIRED);
      }

      if (current.ownerId !== ownerId) {
        if (current.ownerId === null) {
          // The claim is a conditional update, so it cannot overwrite an owner
          // even without the lock (api-spec §5.3). A NEW ticket moves to OPEN
          // in the same update (BR-34); that is a status change, so it clears
          // the Requester's signal too (BR-30) and writes its history row (BR-21).
          const moved = current.currentStatus === "NEW";
          const { count } = await tx.ticket.updateMany({
            where: { id, ownerId: null },
            data: { ownerId, version: { increment: 1 }, ...(moved ? { currentStatus: "OPEN" as const, requesterResolvedAt: null } : {}) },
          });
          if (count === 0) return conflict("TICKET_ALREADY_OWNED", "Someone else claimed this ticket first.");
          if (moved) await tx.ticketStatusChange.create({ data: { ticketId: id, fromStatus: "NEW", toStatus: "OPEN", changedById: actorId } });
        } else {
          await tx.ticket.update({ where: { id }, data: { ownerId, version: { increment: 1 } } });
        }
      }
      return { status: 200, body: { ticket: await loadDetail(tx, id) } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/it-priority (api-spec §3.2; BR-25, BR-26, BR-27, BR-28, BR-29).
staffRouter.patch("/tickets/:id/it-priority", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  // Lab 4 (BR-52): a NUL character anywhere in the body is a 400 on its field, before the body is read.
  const nul = nulFailure(req.body);
  if (nul) return res.status(400).json(nul);

  const raw = (req.body ?? {}) as { itPriority?: unknown; expectedVersion?: unknown };
  const value = raw.itPriority;
  if (typeof value !== "string" || !REQUESTED_PRIORITIES.includes(value as RequestedPriority)) {
    return invalid(res, "itPriority", `IT Priority must be one of ${REQUESTED_PRIORITIES.join(", ")}.`);
  }
  const itPriority = value as RequestedPriority;
  const expectedVersion = expectedVersionOf(raw);
  if (expectedVersion === null) return invalid(res, "expectedVersion", BAD_VERSION);

  const prisma = getPrisma();
  try {
    // Locked like the other two (BR-29), where Lab 3 wrote it unlocked.
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const current = await lockTicket(tx, id);
      if (!current) return { status: 404, body: TICKET_NOT_FOUND };
      if (expectedVersion !== undefined && current.version !== expectedVersion) return staleOutcome(tx, id);
      // Resending the value the Ticket already has is not a change: it writes nothing and
      // leaves the version where it was (BR-25). Only itPriority is ever written:
      // requestedPriority is never in the update, whatever the body carries (BR-27, AC-24).
      if (current.itPriority !== itPriority) {
        await tx.ticket.update({ where: { id }, data: { itPriority, version: { increment: 1 } } });
      }
      return { status: 200, body: { ticket: await loadDetail(tx, id) } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/status (api-spec §3.2; BR-15 to BR-26, BR-29, BR-30, BR-33 to BR-38).
//
// The checks run in the order BR-24 sets, so the caller is told the most
// fundamental reason first: validation, then whether the Ticket exists, then
// whether the version is stale, then the matrix, then the owner, then the gate.
staffRouter.patch("/tickets/:id/status", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  // Lab 4 (BR-52): a NUL character anywhere in the body is a 400 on its field, before the body is read.
  const nul = nulFailure(req.body);
  if (nul) return res.status(400).json(nul);

  const raw = (req.body ?? {}) as { currentStatus?: unknown; reason?: unknown; expectedVersion?: unknown };
  if (typeof raw.currentStatus !== "string" || !TICKET_STATUSES.includes(raw.currentStatus as TicketStatus)) {
    return invalid(res, "currentStatus", "Choose a status to move the ticket to.");
  }
  const to = raw.currentStatus as TicketStatus;
  const expectedVersion = expectedVersionOf(raw);
  if (expectedVersion === null) return invalid(res, "expectedVersion", BAD_VERSION);

  // The reason is read only where it is required, and is posted as a Public
  // Comment so the Requester learns why (BR-36, BR-37).
  let reason: string | null = null;
  if (requiresReason(to)) {
    const checked = checkBody(raw.reason, REASON_MIN, "Reason");
    if (!checked.ok) return invalid(res, "reason", checked.message);
    reason = checked.body;
  }

  const prisma = getPrisma();
  const actorId = req.auth!.user.id;
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const current = await lockTicket(tx, id);
      if (!current) return { status: 404, body: TICKET_NOT_FOUND };
      const from = current.currentStatus;

      if (expectedVersion !== undefined && current.version !== expectedVersion) return staleOutcome(tx, id);

      // Repeating the current status is a conflict, so a double-click cannot
      // look like progress (BR-38).
      if (from === to) return conflict("INVALID_TRANSITION", `The ticket is already ${to}.`);
      if (!isPermittedTransition(from, to)) return conflict("INVALID_TRANSITION", `A ${from} ticket cannot move to ${to}.`);

      // The owner rule, then the gate, from the same function that builds blockedTransitions,
      // so the screen's explanation and the API's refusal can never differ (BR-17, BR-18, BR-24).
      const gate = to === "RESOLVED" ? await gateFor(tx, id) : ({ ok: true } as const);
      const blocked = blockedReason(to, { hasOwner: current.ownerId !== null, gate });
      if (blocked) return conflict(blocked.code, blocked.message);

      // Any status change clears the Requester's "appears resolved" signal (BR-30).
      await tx.ticket.update({ where: { id }, data: { currentStatus: to, requesterResolvedAt: null, version: { increment: 1 } } });
      // The history row, and the reason, commit with the move or not at all (BR-21, D-08).
      await tx.ticketStatusChange.create({ data: { ticketId: id, fromStatus: from, toStatus: to, changedById: actorId } });
      const comment = reason
        ? await tx.publicComment.create({ data: { ticketId: id, authorId: actorId, body: reason }, select: ENTRY_SELECT })
        : null;
      return { status: 200, body: { ticket: await loadDetail(tx, id), comment } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// GET /api/staff/attachments/:id/download — the staff screen's download of a
// Lab 2 attachment on any ticket (FR-36, AC-27). Download only: IT Staff still
// cannot add or remove attachments (BR-18).
staffRouter.get("/attachments/:id/download", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: { code: "INVALID_QUERY", message: "The attachment id is not valid." } });
  }
  try {
    const attachment = await getPrisma().attachment.findUnique({
      where: { id },
      select: { ...ATTACHMENT_SELECT, storedFilename: true },
    });
    if (!attachment) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "That attachment could not be found." } });
    }
    return sendAttachment(res, attachment);
  } catch {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to download the attachment." } });
  }
});
