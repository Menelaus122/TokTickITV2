import express, { type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { resolveRequesterIdentity } from "./authorization.js";
import { OPEN_GROUP } from "./listQuery.js";

// Lab 4, Issue 7 — the Requester dashboard (api-spec §4.1, §6; specification.md FR-15,
// FR-18, FR-19, BR-30 to BR-33, BR-37, BR-39 to BR-41).
//
// Every number and list is computed from the Ticket table on each request (BR-30): nothing is
// cached, kept, or counted in the browser. It takes no query parameters and ignores any it is
// sent, and "me" is the session user and nothing else (BR-37), so there is nothing a client
// could name that would change whose figures these are. A Requester with no Tickets gets four
// zeros and two empty lists (BR-39). None of it uses a date, so no day boundary or time zone
// can change a number (BR-41).

const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

/** The client routes the cards open. Each opens a My Tickets list whose total is the card's value (BR-40). */
const LINKS = {
  openTickets: "/tickets?group=open",
  waitingForYou: "/tickets?status=WAITING_FOR_REQUESTER",
  resolved: "/tickets?status=RESOLVED",
  closed: "/tickets?status=CLOSED",
} as const;

/** The concise row of api-spec §1.4: enough to identify a Ticket and open it, never its description. */
const ROW_SELECT = { id: true, ticketNumber: true, summary: true, currentStatus: true, updatedAt: true } as const;

/** At most this many rows in each list (BR-33). */
const LIST_SIZE = 5;

export const dashboardRouter = express.Router();

// GET /api/dashboard/requester — Requester only. IT Staff and Administrators are 403, no
// session is 401 (the guard order of api-spec §8), as for every Requester-scoped route.
dashboardRouter.get("/requester", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res.status(context.status).json({ error: { code: context.code, message: context.message } });
  }
  const requesterId = context.requesterId;
  const prisma = getPrisma();

  try {
    // One snapshot, so a card and the list under it describe the same moment.
    const [open, waiting, resolved, closed, needsAttention, recentTickets] = await prisma.$transaction(
      [
        prisma.ticket.count({ where: { requesterId, currentStatus: { in: [...OPEN_GROUP] } } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "RESOLVED" } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "CLOSED" } }),
        // Longest-waiting first; the id settles a tie on the instant (BR-33).
        prisma.ticket.findMany({
          where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          take: LIST_SIZE,
          select: ROW_SELECT,
        }),
        // Newest change first, any status; the id settles a tie (BR-33).
        prisma.ticket.findMany({
          where: { requesterId },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_SIZE,
          select: ROW_SELECT,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      metrics: {
        openTickets: { value: open, href: LINKS.openTickets },
        waitingForYou: { value: waiting, href: LINKS.waitingForYou },
        resolved: { value: resolved, href: LINKS.resolved },
        closed: { value: closed, href: LINKS.closed },
      },
      needsAttention,
      recentTickets,
    });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
