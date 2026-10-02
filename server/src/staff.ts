import express, { type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { buildPageMeta } from "./listQuery.js";
import { parseQueueQuery, queueOrderBy, type OwnerFilter } from "./queueQuery.js";

// Lab 3, Issues 8 and 9 — IT Staff ticket operations (api-spec §5).
//
// Mounted under /api/staff, behind app.ts's requireRole("IT_STAFF"), so every
// route here is IT Staff only before it runs (BR-19, AC-09). Nothing in this
// router repeats that check.

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
            { ticketNumber: { contains: query.q, mode: "insensitive" as const } },
            { summary: { contains: query.q, mode: "insensitive" as const } },
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
