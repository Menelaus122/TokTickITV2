import express, { type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { requireSession } from "./auth.js";
import { requireRole, resolveRequesterIdentity } from "./authorization.js";
import { routeId } from "./routeId.js";
import { lockTicketRow } from "./ticketLock.js";
import { nulFailure } from "./bodyGuards.js";

// Lab 3, Issue 7 — Public Comments, Internal Notes, and "Problem Appears
// Resolved" (docs/lab-03/api-spec.md §3.1, §4; specification.md §5.6).
//
// Comments and notes live in two tables (BR-39), so a Requester's thread is a
// read of PublicComment alone: there is no visibility flag a missing WHERE
// clause could forget. Both are append-only (BR-42): this router defines no
// PATCH or DELETE, so a guessed edit URL falls through to the JSON 404.
//
// Guard order follows api-spec §7: session → role → ownership → validation.

export const COMMENT_MAX = 2000; // BR-41
export const APPEARS_RESOLVED_MIN = 5; // BR-29

const TICKET_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That ticket could not be found." } } as const;
const INVALID_ID = { error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } } as const;
const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;

export const ENTRY_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, fullName: true, role: true } },
} as const;

// Ordered oldest first, ties broken by id, so a thread reads the same on every
// screen (api-spec §4.1).
const THREAD_ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

function invalid(res: Response, field: string, message: string) {
  return res.status(400).json({
    error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields: { [field]: message } },
  });
}

/**
 * The trimmed body when it is 1–2000 characters (or `min`–2000), otherwise the
 * message to show beside the field (BR-41, BR-29). Only a string is a body: a
 * number or an object is refused rather than stringified.
 */
export function checkBody(value: unknown, min = 1, label = "Comment"): { ok: true; body: string } | { ok: false; message: string } {
  const body = typeof value === "string" ? value.trim() : "";
  if (body.length === 0) return { ok: false, message: `${label} is required.` };
  if (body.length < min || body.length > COMMENT_MAX) {
    return { ok: false, message: `${label} must be between ${min} and ${COMMENT_MAX} characters.` };
  }
  return { ok: true, body };
}

/**
 * Whether this session may see the ticket's conversation. A Requester sees only
 * their own ticket, and another Requester's ticket is answered exactly like one
 * that does not exist (FR-12, AC-11). IT Staff and Administrators see any.
 */
export async function visibleTicket(prisma: PrismaClient, req: Request, id: number): Promise<boolean> {
  const user = req.auth!.user;
  const where = user.role === "REQUESTER" ? { id, requesterId: user.id } : { id };
  return (await prisma.ticket.findFirst({ where, select: { id: true } })) !== null;
}

type Thread = "publicComment" | "internalNote";

function readThread(thread: Thread, key: "comments" | "notes") {
  return async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const id = routeId(req.params.id);
    if (id === null) return res.status(400).json(INVALID_ID);
    const prisma = getPrisma();
    try {
      if (!(await visibleTicket(prisma, req, id))) return res.status(404).json(TICKET_NOT_FOUND);
      const rows =
        thread === "publicComment"
          ? await prisma.publicComment.findMany({ where: { ticketId: id }, select: ENTRY_SELECT, orderBy: THREAD_ORDER })
          : await prisma.internalNote.findMany({ where: { ticketId: id }, select: ENTRY_SELECT, orderBy: THREAD_ORDER });
      return res.status(200).json({ [key]: rows });
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  };
}

function postToThread(thread: Thread, label: string) {
  return async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const id = routeId(req.params.id);
    if (id === null) return res.status(400).json(INVALID_ID);
    const prisma = getPrisma();
    try {
      if (!(await visibleTicket(prisma, req, id))) return res.status(404).json(TICKET_NOT_FOUND);

      // Lab 4 (BR-52): after the ownership check, and before the body is read.
      const nul = nulFailure(req.body);
      if (nul) return res.status(400).json(nul);

      const checked = checkBody((req.body as { body?: unknown } | undefined)?.body, 1, label);
      if (!checked.ok) return invalid(res, "body", checked.message);

      // Author and time are the server's (BR-40): any authorId or createdAt in
      // the request is never read. The ticket is touched in the same
      // transaction so Last Updated reflects the conversation (BR-44).
      const data = { ticketId: id, authorId: req.auth!.user.id, body: checked.body };
      const [entry] = await prisma.$transaction([
        thread === "publicComment"
          ? prisma.publicComment.create({ data, select: ENTRY_SELECT })
          : prisma.internalNote.create({ data, select: ENTRY_SELECT }),
        prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } }),
      ]);
      return res.status(201).json(entry);
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  };
}

export const conversationRouter = express.Router();

// Public Comments — the owning Requester, any IT Staff, any Administrator (BR-04).
conversationRouter.get("/:id/comments", requireSession, readThread("publicComment", "comments"));
conversationRouter.post("/:id/comments", requireSession, postToThread("publicComment", "Comment"));

// Internal Notes — IT Staff and Administrators only. The role is checked before
// the ticket is looked up, so a Requester's 403 is the same whether the ticket
// exists or has notes: nothing about notes is learned from it (BR-23, AC-08).
const staffOrAdmin = requireRole("IT_STAFF", "ADMINISTRATOR");
conversationRouter.get("/:id/notes", staffOrAdmin, readThread("internalNote", "notes"));
conversationRouter.post("/:id/notes", staffOrAdmin, postToThread("internalNote", "Note"));

// PATCH /api/tickets/:id/appears-resolved — the Requester's opinion that the
// problem is gone (BR-29, BR-30, api-spec §3.1). It records a timestamp and a
// Public Comment and never touches currentStatus (BR-05): no field of the
// request is read except appearsResolved and comment.
conversationRouter.patch("/:id/appears-resolved", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const context = resolveRequesterIdentity(req);
  if (!context.ok) return res.status(context.status).json({ error: { code: context.code, message: context.message } });

  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  const prisma = getPrisma();

  try {
    const owned = await prisma.ticket.findFirst({ where: { id, requesterId: context.requesterId }, select: { id: true } });
    if (!owned) return res.status(404).json(TICKET_NOT_FOUND);

    // Lab 4 (BR-52): after the ownership check, and before the body is read.
    const nul = nulFailure(req.body);
    if (nul) return res.status(400).json(nul);

    const raw = (req.body ?? {}) as { appearsResolved?: unknown; comment?: unknown };
    if (typeof raw.appearsResolved !== "boolean") {
      return invalid(res, "appearsResolved", "Say whether the problem appears resolved.");
    }

    const ticketSelect = { id: true, requesterResolvedAt: true, currentStatus: true } as const;

    // Lab 4 (BR-25, BR-29): the signal is one of the fields that moves the Ticket's version, so
    // it is written under the Ticket's lock like every other write to it. A staff save made from a
    // screen loaded before it is then refused as stale, which is how the advisory gets seen.
    if (!raw.appearsResolved) {
      // BR-30 — the Requester may withdraw the signal; no comment is needed.
      const ticket = await prisma.$transaction(async (tx) => {
        await lockTicketRow(tx, id);
        const now = await tx.ticket.findUniqueOrThrow({ where: { id }, select: ticketSelect });
        // Withdrawing a signal that is not there changes nothing, so the version stays (BR-25).
        if (now.requesterResolvedAt === null) return now;
        return tx.ticket.update({ where: { id }, data: { requesterResolvedAt: null, version: { increment: 1 } }, select: ticketSelect });
      });
      return res.status(200).json({ ticket, comment: null });
    }

    const checked = checkBody(raw.comment, APPEARS_RESOLVED_MIN, "Comment");
    if (!checked.ok) return invalid(res, "comment", checked.message);

    const now = new Date();
    const { comment, ticket } = await prisma.$transaction(async (tx) => {
      await lockTicketRow(tx, id);
      const posted = await tx.publicComment.create({
        data: { ticketId: id, authorId: context.requesterId, body: checked.body, createdAt: now },
        select: ENTRY_SELECT,
      });
      // Marking again moves the timestamp, so it is a change like the first mark (BR-25).
      const marked = await tx.ticket.update({
        where: { id },
        data: { requesterResolvedAt: now, version: { increment: 1 } },
        select: ticketSelect,
      });
      return { comment: posted, ticket: marked };
    });
    return res.status(200).json({ ticket, comment });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
