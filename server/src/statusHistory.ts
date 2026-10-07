import express, { type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { requireSession } from "./auth.js";
import { visibleTicket } from "./conversation.js";
import { routeId } from "./routeId.js";

// Lab 4, Issue 6 — the Status History of a Ticket (api-spec §3.3; specification.md
// BR-21 to BR-23, D-03).
//
// It is written only by a change of status (staff.ts, in the same transaction as
// the change) and read here. This router defines no POST, PUT, PATCH, or DELETE,
// so a guessed URL to alter a row falls through to the unknown-route 404 (BR-22).

const TICKET_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That ticket could not be found." } } as const;
const INVALID_ID = { error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } } as const;
const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

export const statusHistoryRouter = express.Router();

// GET /api/tickets/:id/status-history — the owning Requester, any IT Staff
// member, any Administrator (BR-23). Another Requester's Ticket is answered
// exactly like one that does not exist (BR-44).
statusHistoryRouter.get("/:id/status-history", requireSession, async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  const prisma = getPrisma();
  try {
    if (!(await visibleTicket(prisma, req, id))) return res.status(404).json(TICKET_NOT_FOUND);
    // Oldest first; a tie on the instant is broken by id (BR-22). An actor is a name and a
    // role, never an email (api-spec §1.1), and nothing here is internal (BR-23).
    const history = await prisma.ticketStatusChange.findMany({
      where: { ticketId: id },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        changedBy: { select: { id: true, fullName: true, role: true } },
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ history });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
