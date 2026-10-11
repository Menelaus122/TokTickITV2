import express, { type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { OPEN_GROUP } from "./listQuery.js";
import { OWNER_SELECT } from "./staff.js";

// Lab 4, Issue 8 — the IT Staff and Administrator dashboard (api-spec §4.2, §6; specification.md
// FR-16, FR-17, FR-19, BR-30, BR-31, BR-34 to BR-41).
//
// Every number and list is computed from the tables on each request (BR-30): nothing is
// cached, kept, or counted in the browser. It takes no query parameters and ignores any it is
// sent, and "me" is the session user and nothing else (BR-37), so two members calling it get
// two answers and nothing a client names can change whose they are. None of it uses a date, so
// no day boundary or time zone can change a number (BR-41). It sits under /api/staff, so the
// prefix guard has already refused a Requester (403) and a caller with no session (401)
// before this handler runs (BR-43).

const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

/** At most this many rows in each list (BR-36). */
const LIST_SIZE = 5;

/** A description in the list of recent actions is cut to this many characters (api-spec §4.2). */
export const DESCRIPTION_LIMIT = 120;

/** The client routes the cards open. Each opens a Ticket Queue list whose total is the card's value (BR-40). */
const LINKS = {
  unassigned: "/queue?owner=unassigned&group=open",
  assignedToMe: "/queue?owner=me&group=open",
  waitingForRequester: "/queue?status=WAITING_FOR_REQUESTER",
  urgent: "/queue?itPriority=URGENT&group=open",
} as const;

/**
 * The first 120 characters and an ellipsis, when there are more than that. It counts characters,
 * not UTF-16 code units, so an emoji at the boundary is kept whole or left out and never split;
 * and it keeps the text's own whitespace, so the screen decides how a line break is drawn.
 */
export function cutDescription(text: string): string {
  const characters = Array.from(text);
  return characters.length > DESCRIPTION_LIMIT ? characters.slice(0, DESCRIPTION_LIMIT).join("") + "…" : text;
}

/** The five open statuses, always in this order, `0` where no Ticket has one (BR-35). */
export function byStatusRows(counts: Record<string, number>): Array<{ status: string; value: number; href: string }> {
  return OPEN_GROUP.map((status) => ({ status, value: counts[status] ?? 0, href: `/queue?status=${status}` }));
}

/** The concise row of api-spec §1.4, plus the IT Priority and the owner a staff list shows. */
const TICKET_ROW = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  updatedAt: true,
  itPriority: true,
  owner: OWNER_SELECT,
} as const;

export const staffDashboardRouter = express.Router();

// GET /api/staff/dashboard — IT Staff and Administrators.
staffDashboardRouter.get("/dashboard", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const me = req.auth!.user.id;
  const isAdministrator = req.auth!.user.role === "ADMINISTRATOR";
  const prisma = getPrisma();
  const open = { in: [...OPEN_GROUP] };

  try {
    // One snapshot, so a card and the list under it describe the same moment.
    const answer = await prisma.$transaction(
      async (tx) => {
        const [unassigned, assignedToMe, waitingForRequester, urgent] = await Promise.all([
          tx.ticket.count({ where: { ownerId: null, currentStatus: open } }),
          tx.ticket.count({ where: { ownerId: me, currentStatus: open } }),
          tx.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
          tx.ticket.count({ where: { itPriority: "URGENT", currentStatus: open } }),
        ]);
        const grouped = await tx.ticket.groupBy({ by: ["currentStatus"], where: { currentStatus: open }, _count: { _all: true } });
        // Newest change first; the id settles a tie (BR-36).
        const myTickets = await tx.ticket.findMany({
          where: { ownerId: me, currentStatus: open },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_SIZE,
          select: TICKET_ROW,
        });
        // The one that has waited longest first; the id settles a tie (BR-36).
        const urgentTickets = await tx.ticket.findMany({
          where: { itPriority: "URGENT", currentStatus: open },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: LIST_SIZE,
          select: TICKET_ROW,
        });
        // In the order they were recorded, which is not the order of their dates (BR-36).
        const actions = await tx.actionTaken.findMany({
          where: { performedById: me },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: LIST_SIZE,
          select: { id: true, ticketId: true, actionAt: true, description: true, followUpRequired: true, ticket: { select: { ticketNumber: true } } },
        });

        const userCounts = isAdministrator
          ? {
              activeRequesters: { value: await tx.user.count({ where: { isActive: true, role: "REQUESTER" } }) },
              activeItStaff: { value: await tx.user.count({ where: { isActive: true, role: "IT_STAFF" } }) },
              activeAdministrators: { value: await tx.user.count({ where: { isActive: true, role: "ADMINISTRATOR" } }) },
              inactive: { value: await tx.user.count({ where: { isActive: false } }) },
            }
          : null;

        return { unassigned, assignedToMe, waitingForRequester, urgent, grouped, myTickets, urgentTickets, actions, userCounts };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const counts: Record<string, number> = {};
    for (const row of answer.grouped) counts[row.currentStatus] = row._count._all;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      metrics: {
        unassigned: { value: answer.unassigned, href: LINKS.unassigned },
        assignedToMe: { value: answer.assignedToMe, href: LINKS.assignedToMe },
        waitingForRequester: { value: answer.waitingForRequester, href: LINKS.waitingForRequester },
        urgent: { value: answer.urgent, href: LINKS.urgent },
      },
      byStatus: byStatusRows(counts),
      myTickets: answer.myTickets,
      urgentTickets: answer.urgentTickets,
      myRecentActions: answer.actions.map(({ ticket, description, ...action }) => ({
        ...action,
        ticketNumber: ticket.ticketNumber,
        description: cutDescription(description),
      })),
      // Only an Administrator has the key at all, so IT Staff never see even an empty one (BR-38).
      ...(answer.userCounts ? { userCounts: answer.userCounts } : {}),
    });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
