import express, { type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { buildPageMeta } from "./listQuery.js";
import { containsText } from "./queryParams.js";
import { parseQueueQuery, queueOrderBy, type OwnerFilter } from "./queueQuery.js";
import type { Prisma } from "@prisma/client";
import { MAX_ID } from "./queryParams.js";
import { routeId } from "./routeId.js";
import { REQUESTED_PRIORITIES, type RequestedPriority } from "./validation.js";
import { TICKET_STATUSES, type TicketStatus } from "./listQuery.js";
import { ENTRY_SELECT, checkBody } from "./conversation.js";
import { ATTACHMENT_SELECT, attachmentView, sendAttachment } from "./attachmentResponse.js";
import { isPermittedTransition, permittedTransitions, requiresOwner, requiresReason } from "./transitions.js";

// Lab 3, Issues 8 and 9 — IT Staff ticket operations (api-spec §5).
//
// Mounted under /api/staff, behind app.ts's requireRole("IT_STAFF",
// "ADMINISTRATOR"), so every route here is for IT Staff and Administrators only
// before it runs (Lab 4 BR-42, BR-43; a Requester is refused). Nothing in this
// router repeats that check. An Administrator acts as themself here (BR-45).

const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

const QUEUE_ROW_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  category: { select: { name: true } },
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  // isActive lets the screen mark work held by a deactivated account (BR-26).
  owner: { select: { id: true, fullName: true, isActive: true } },
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

  // Filters and search combine with AND (BR-54).
  const where = {
    ...(query.status ? { currentStatus: query.status } : {}),
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
  description: true,
  relatedSystem: { select: { name: true } },
  // The permitted user shape (api-spec §1.6), nothing wider.
  requester: { select: { id: true, fullName: true, email: true, role: true, isActive: true } },
  attachments: { select: ATTACHMENT_SELECT, orderBy: { uploadedAt: "asc" as const } },
} as const;

type Db = Prisma.TransactionClient;

/** The detail response's `ticket`, with permittedTransitions from the BR-33 matrix (FR-34). */
async function loadDetail(db: Db, id: number) {
  const row = await db.ticket.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!row) return null;
  const { category, relatedSystem, attachments, ...rest } = row;
  return {
    ...rest,
    categoryName: category.name,
    relatedSystemName: relatedSystem.name,
    // Downloads go through the staff route, which the role guard covers.
    attachments: attachments.map((attachment) => attachmentView(attachment, "/api/staff/attachments")),
    permittedTransitions: permittedTransitions(row.currentStatus),
  };
}

/** Locks the ticket's row until the transaction ends, and reads what the decision needs. */
async function lockTicket(tx: Db, id: number) {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
  return tx.ticket.findUnique({ where: { id }, select: { ownerId: true, currentStatus: true } });
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
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID ? value : undefined;
}

// GET /api/staff/tickets/:id — one ticket for operations (api-spec §5.2).
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
// (api-spec §5.3; BR-24, BR-25, BR-34).
staffRouter.patch("/tickets/:id/owner", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  const raw = (req.body ?? {}) as { ownerId?: unknown; expectedOwnerId?: unknown };
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

  const prisma = getPrisma();
  try {
    if (ownerId !== null) {
      const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
      if (!user) return invalid(res, "ownerId", "That user does not exist.");
      // Active at the time of assignment; a later deactivation keeps them (BR-24, BR-26).
      if (!user.isActive || (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR")) {
        return res.status(409).json({
          error: { code: "OWNER_NOT_ASSIGNABLE", message: "Only an active IT Staff member or Administrator can own a ticket." },
        });
      }
    }

    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const current = await lockTicket(tx, id);
      if (!current) return { status: 404, body: TICKET_NOT_FOUND };
      if (current.currentStatus === "CANCELLED") {
        return conflict("INVALID_TRANSITION", "A cancelled ticket is closed for good and cannot change owner.");
      }
      if (checksExpected && current.ownerId !== expectedOwnerId) {
        return conflict(
          "TICKET_ALREADY_OWNED",
          expectedOwnerId === null
            ? "Someone else claimed this ticket first."
            : "The owner changed while you were working on this ticket. Reload to see who owns it now.",
        );
      }
      // Nothing is resolved or closed anonymously, so it is not unassigned
      // there either (BR-35).
      if (ownerId === null && requiresOwner(current.currentStatus)) {
        return conflict("OWNER_REQUIRED", "A resolved or closed ticket must keep an owner.");
      }

      if (current.ownerId !== ownerId) {
        if (current.ownerId === null) {
          // The claim is a conditional update, so it cannot overwrite an owner
          // even without the lock (api-spec §5.3). A NEW ticket moves to OPEN
          // in the same update (BR-34); that is a status change, so it clears
          // the Requester's signal too (BR-30).
          const moved = current.currentStatus === "NEW";
          const { count } = await tx.ticket.updateMany({
            where: { id, ownerId: null },
            data: { ownerId, ...(moved ? { currentStatus: "OPEN" as const, requesterResolvedAt: null } : {}) },
          });
          if (count === 0) return conflict("TICKET_ALREADY_OWNED", "Someone else claimed this ticket first.");
        } else {
          await tx.ticket.update({ where: { id }, data: { ownerId } });
        }
      }
      return { status: 200, body: { ticket: await loadDetail(tx, id) } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/it-priority (api-spec §5.4; BR-27, BR-28).
staffRouter.patch("/tickets/:id/it-priority", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  const value = ((req.body ?? {}) as { itPriority?: unknown }).itPriority;
  if (typeof value !== "string" || !REQUESTED_PRIORITIES.includes(value as RequestedPriority)) {
    return invalid(res, "itPriority", `IT Priority must be one of ${REQUESTED_PRIORITIES.join(", ")}.`);
  }
  const itPriority = value as RequestedPriority;

  const prisma = getPrisma();
  try {
    // Only itPriority is written: requestedPriority is never in the update,
    // whatever the body carries (BR-27, AC-24).
    const { count } = await prisma.ticket.updateMany({ where: { id }, data: { itPriority } });
    if (count === 0) return res.status(404).json(TICKET_NOT_FOUND);
    return res.status(200).json({ ticket: await loadDetail(prisma, id) });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/status (api-spec §5.5; BR-30, BR-33 to BR-38).
staffRouter.patch("/tickets/:id/status", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  const raw = (req.body ?? {}) as { currentStatus?: unknown; reason?: unknown };
  if (typeof raw.currentStatus !== "string" || !TICKET_STATUSES.includes(raw.currentStatus as TicketStatus)) {
    return invalid(res, "currentStatus", "Choose a status to move the ticket to.");
  }
  const to = raw.currentStatus as TicketStatus;

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

      // Repeating the current status is a conflict, so a double-click cannot
      // look like progress (BR-38).
      if (from === to) return conflict("INVALID_TRANSITION", `The ticket is already ${to}.`);
      if (!isPermittedTransition(from, to)) return conflict("INVALID_TRANSITION", `A ${from} ticket cannot move to ${to}.`);
      if (requiresOwner(to) && current.ownerId === null) {
        return conflict("OWNER_REQUIRED", "Claim or assign the ticket before resolving or closing it.");
      }

      // Any status change clears the Requester's "appears resolved" signal (BR-30).
      await tx.ticket.update({ where: { id }, data: { currentStatus: to, requesterResolvedAt: null } });
      // The reason and the move commit together or not at all (D-08).
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
