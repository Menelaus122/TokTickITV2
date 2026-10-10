import express, { type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { requireSession } from "./auth.js";
import { visibleTicket } from "./conversation.js";
import { checkActionEdit, checkNewAction, compareReadingOrder, isActiveStatus, readRequestKey, type FieldErrors } from "./actionTakenRules.js";
import { routeId } from "./routeId.js";
import { nulFailure } from "./bodyGuards.js";

// Lab 4, Issue 4 — the Actions Taken API (docs/lab-04/api-spec.md §2;
// specification.md BR-01 to BR-14, BR-27 to BR-29, BR-42 to BR-44, BR-52).
//
// Guard order follows api-spec §7 as Lab 4 restates it: Origin → session →
// must-change-password → role → ownership → validation → Ticket state →
// version → business rules. The first three run for every request in app.ts.

const TICKET_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That ticket could not be found." } } as const;
const INVALID_ID = { error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } } as const;
const INVALID_ACTION_ID = { error: { code: "INVALID_QUERY", message: "The action id is not valid." } } as const;
const ACTION_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That action could not be found." } } as const;
const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

// The performer and the editor are shown as an author: a name and a role, no email (api-spec §1.1).
const AUTHOR = { select: { id: true, fullName: true, role: true } } as const;

// api-spec §1.3 — and nothing wider: the request key is the client's, not the record's.
export const ACTION_SELECT = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  performedBy: AUTHOR,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: AUTHOR,
} as const;

// ---------------------------------------------------------------------------
// Reading — the owning Requester, any IT Staff member, any Administrator (BR-42).
// ---------------------------------------------------------------------------

export const actionsTakenReadRouter = express.Router();

// GET /api/tickets/:id/actions-taken (api-spec §2.1)
actionsTakenReadRouter.get("/:id/actions-taken", requireSession, async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  const prisma = getPrisma();
  try {
    // Another Requester's Ticket is answered exactly like one that does not exist (BR-44).
    if (!(await visibleTicket(prisma, req, id))) return res.status(404).json(TICKET_NOT_FOUND);
    const rows = await prisma.actionTaken.findMany({ where: { ticketId: id }, select: ACTION_SELECT });
    // BR-08 — the reading order. It is not the order the resolution gate reads (BR-17).
    return res.status(200).json({ actions: rows.sort(compareReadingOrder) });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// ---------------------------------------------------------------------------
// Writing — IT Staff and Administrators (BR-02, BR-42). The role guard is the
// one app.ts mounts on /api/staff, so a Requester never reaches these handlers.
//
// Every write runs in one transaction that first locks the Ticket's row (BR-29),
// then decides from what it reads under the lock. Two submissions for one Ticket
// are therefore serialised: the second sees the first, never a stale read.
// ---------------------------------------------------------------------------

type Db = Prisma.TransactionClient;
type Outcome = { status: 200 | 201 | 400 | 404 | 409; body: unknown };

const TICKET_NOT_ACTIVE: Outcome = {
  status: 409,
  body: { error: { code: "TICKET_NOT_ACTIVE", message: "This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed." } },
};

/** Locks the Ticket's row until the transaction ends, and reads what the decisions need. */
async function lockTicket(tx: Db, id: number) {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
  return tx.ticket.findUnique({ where: { id }, select: { currentStatus: true, createdAt: true } });
}

function validationFailed(fields: FieldErrors): Outcome {
  return { status: 400, body: { error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields } } };
}

export const actionsTakenStaffRouter = express.Router();

// POST /api/staff/tickets/:id/actions-taken (api-spec §2.2)
actionsTakenStaffRouter.post("/tickets/:id/actions-taken", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  const prisma = getPrisma();
  const actorId = req.auth!.user.id;
  const requestKey = readRequestKey(req.body);

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const ticket = await lockTicket(tx, id);
      if (!ticket) return { status: 404, body: TICKET_NOT_FOUND };

      // BR-28 — a key this user already used on this Ticket names a submission
      // that happened. It is answered with that action before the body or the
      // Ticket's state is looked at, so a retry never becomes an error because
      // the world moved on (AC-07).
      if (requestKey.ok && requestKey.key !== null) {
        const replay = await tx.actionTaken.findUnique({
          where: { ticketId_performedById_requestKey: { ticketId: id, performedById: actorId, requestKey: requestKey.key } },
          select: ACTION_SELECT,
        });
        if (replay) return { status: 200, body: { action: replay } };
      }

      // BR-05, BR-06 — the performer is the session user, and the clock is the server's.
      const checked = checkNewAction(req.body, { now: new Date(), ticketCreatedAt: ticket.createdAt });
      const fields: FieldErrors = { ...(checked.ok ? {} : checked.fields), ...(requestKey.ok ? {} : { requestKey: requestKey.message }) };
      if (Object.keys(fields).length > 0 || !checked.ok) return validationFailed(fields);

      // Lab 4 (BR-52): the rules above refuse a NUL in the fields they read; any other string of the body is refused here.
      const nul = nulFailure(req.body);
      if (nul) return { status: 400, body: nul };

      if (!isActiveStatus(ticket.currentStatus)) return TICKET_NOT_ACTIVE;

      const action = await tx.actionTaken.create({
        data: { ...checked.value, ticketId: id, performedById: actorId, requestKey: requestKey.ok ? requestKey.key : null },
        select: ACTION_SELECT,
      });
      // BR-11 — Last Updated moves; the Ticket's version does not.
      await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } });
      return { status: 201, body: { action } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/staff/tickets/:id/actions-taken/:actionId (api-spec §2.3)
//
// Any IT Staff member or Administrator may edit any action of the Ticket, whoever
// performed it (BR-09, D-13). The checks run in the order api-spec §2.3 gives:
// the action exists, the body is valid, the Ticket is active, the version is
// current, and only then is anything written.
actionsTakenStaffRouter.patch("/tickets/:id/actions-taken/:actionId", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  const actionId = routeId(req.params.actionId);
  if (actionId === null) return res.status(400).json(INVALID_ACTION_ID);

  const prisma = getPrisma();
  const actorId = req.auth!.user.id;

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const ticket = await lockTicket(tx, id);
      if (!ticket) return { status: 404, body: TICKET_NOT_FOUND };

      // BR-01 — an action of a different Ticket is not found through this one.
      const stored = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId: id }, select: ACTION_SELECT });
      if (!stored) return { status: 404, body: ACTION_NOT_FOUND };

      // BR-05, BR-09 — only the six editable fields are read; the rest of the body is ignored.
      const checked = checkActionEdit(stored, req.body, { now: new Date(), ticketCreatedAt: ticket.createdAt });
      if (!checked.ok) return validationFailed(checked.fields);
      const nul = nulFailure(req.body);
      if (nul) return { status: 400, body: nul };

      // BR-10 comes before the version, so a stale edit of a closed Ticket is told it is closed.
      if (!isActiveStatus(ticket.currentStatus)) return TICKET_NOT_ACTIVE;

      // BR-27 — the edit was made against a version that is no longer the record's.
      if (checked.expectedVersion !== stored.version) {
        return {
          status: 409,
          body: {
            error: {
              code: "STALE_UPDATE",
              message: "This action changed while you were working on it. Review the latest version and try again.",
              current: stored,
            },
          },
        };
      }

      // A body that changes nothing is a success that writes nothing, so the
      // version and both Last Updated times stay where they were.
      if (!checked.changed) return { status: 200, body: { action: stored } };

      const action = await tx.actionTaken.update({
        where: { id: actionId },
        data: { ...checked.value, version: { increment: 1 }, updatedById: actorId },
        select: ACTION_SELECT,
      });
      // BR-11 — Last Updated moves; the Ticket's version does not.
      await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } });
      return { status: 200, body: { action } };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
