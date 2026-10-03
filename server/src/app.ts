import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import { attachSession, authRouter, enforcePasswordChange, requireSession } from "./auth.js";
import { apiNotFound, rejectForeignOrigin, requireRole, resolveRequesterIdentity, safeErrors } from "./authorization.js";
import { validateTicketInput } from "./validation.js";
import { nextTicketNumber } from "./ticketNumber.js";
import { parseTicketListQuery, buildPageMeta } from "./listQuery.js";
import { conversationRouter } from "./conversation.js";
import { staffRouter } from "./staff.js";
import { adminRouter } from "./admin.js";
import { routeId } from "./routeId.js";
import { containsText } from "./queryParams.js";
import multer from "multer";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import {
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_BYTES,
  buildStoredFilename,
  checkRemovalReason,
  checkUpload,
} from "./attachments.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Disable ETags so responses are never revalidated into a 304 Not Modified.
// This API returns small, always-fresh JSON, so conditional caching only gets
// in the way (a browser reload of /api/health should be a clean 200, not 304).
app.set("etag", false);

// Lab 3 — the session lives in a cookie, and a browser only sends a cookie on a
// cross-origin request when the API names the origin and allows credentials;
// the wildcard Lab 2 used cannot be combined with credentials. The client runs
// on Vite's port by default; CLIENT_ORIGINS (comma-separated) replaces the
// default, for example for an E2E stack on non-default ports.
//
// Only localhost by default: a page on 127.0.0.1 calling the API on localhost
// is cross-site, so the SameSite=Lax cookie would never be sent and sign-in
// would silently fail even though CORS let the request through.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
// Lab 3, Issue 4 — BR-65: a state-changing request from a foreign Origin is
// refused before anything else reads it.
app.use(rejectForeignOrigin(CLIENT_ORIGINS));
app.use(express.json());
app.use(cookieParser());

// Lab 3, Issue 3 — who is asking (docs/lab-03/api-spec.md §1.1, §2). The order
// matters: the session is resolved first, then BR-14 decides whether this
// session may reach anything other than the auth endpoints.
app.use(attachSession);
app.use(enforcePasswordChange);
app.use("/api/auth", authRouter);

// Lab 3, Issue 4 — the BR-18 matrix by route family. Administrators are not
// IT Staff (BR-19), so each family admits exactly one role. Mounted here, the
// guard covers every route Issues 8 to 10 add under these prefixes.
app.use("/api/staff", requireRole("IT_STAFF"));
app.use("/api/admin", requireRole("ADMINISTRATOR"));

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  // A liveness check should never be cached/revalidated, otherwise a browser
  // reload can come back as 304 Not Modified instead of a fresh 200.
  res.set("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// GET /api/categories reads the supported request categories from PostgreSQL
// via Prisma and returns each { id, name } in a predictable id order.
// Lab 3: reference data is for signed-in users only (api-spec §3).
// ---------------------------------------------------------------------------
app.get("/api/categories", requireSession, async (_req: Request, res: Response) => {
  // Category data is small and always-fresh; skip conditional caching so a
  // browser reload comes back as a clean 200 rather than a 304 Not Modified.
  res.set("Cache-Control", "no-store");
  try {
    const categories = await getPrisma().category.findMany({
      // Lab 2 — a retired category stays on its old tickets but must not be
      // offered on the Create Ticket form (BR-28).
      where: { isActive: true },
      // Only expose id + name — createdAt is an internal detail.
      select: { id: true, name: true },
      // Predictable, stable ordering for the UI and the Supertest assertion.
      orderBy: { id: "asc" },
    });
    res.status(200).json(categories);
  } catch {
    // Never leak internal/database details to the client.
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2, Issue 5 — active Related Systems
// The specific service, application, device, or platform a ticket is about.
// Sorted by name because this list is long enough to be scanned alphabetically.
// ---------------------------------------------------------------------------
app.get("/api/related-systems", requireSession, async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(systems);
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to load related systems." },
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2, Issue 5 — create a Ticket
//
// The backend owns everything the Requester does not type: the official Ticket
// Number (BR-01), the Ticket Date (BR-05), the NEW status (BR-02), and the
// owning Requester, which comes from the session and never from the body
// (BR-06; Lab 3 BR-03).
// ---------------------------------------------------------------------------

// How many times a unique-constraint collision on ticketNumber is retried
// before the request is treated as a genuine failure.
const TICKET_NUMBER_ATTEMPTS = 3;

const TICKET_DETAIL_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  currentStatus: true,
  // Lab 3, Issue 7 — the Requester's own "appears resolved" signal (BR-29).
  requesterResolvedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, fullName: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
} as const;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

app.post("/api/tickets", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  // Any ticketNumber, requesterId, or currentStatus in the body is simply not
  // read — those are the server's to decide.
  const validation = validateTicketInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "One or more fields are invalid.",
        fields: validation.fields,
      },
    });
  }

  const input = validation.value;

  try {
    // BR-28 — the referenced rows must exist and still be active.
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { id: input.categoryId, isActive: true } }),
      prisma.relatedSystem.findFirst({ where: { id: input.relatedSystemId, isActive: true } }),
    ]);

    const fields: Record<string, string> = {};
    if (!category) fields.categoryId = "Category is required.";
    if (!relatedSystem) fields.relatedSystemId = "Related System is required.";
    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields },
      });
    }

    const year = new Date().getFullYear();

    for (let attempt = 1; attempt <= TICKET_NUMBER_ATTEMPTS; attempt++) {
      try {
        const ticket = await prisma.$transaction(async (tx) => {
          // Computed inside the transaction that inserts the row, so a
          // concurrent creation is caught by the unique index below.
          const ticketNumber = await nextTicketNumber(tx, year);

          return tx.ticket.create({
            data: {
              ticketNumber,
              requesterId: context.requesterId,
              categoryId: input.categoryId,
              relatedSystemId: input.relatedSystemId,
              summary: input.summary,
              description: input.description,
              requestedPriority: input.requestedPriority,
              // Lab 3 BR-28 — IT Priority starts as a copy of the Requester's
              // choice and is IT Staff's to change from then on.
              itPriority: input.requestedPriority,
              // currentStatus is left to its NEW default (BR-02).
            },
            select: TICKET_DETAIL_SELECT,
          });
        });

        return res.status(201).json({ ...ticket, ticketDate: ticket.createdAt, attachments: [] });
      } catch (error) {
        // Another request took this number first; recompute and try again.
        if (isUniqueViolation(error) && attempt < TICKET_NUMBER_ATTEMPTS) continue;
        throw error;
      }
    }

    throw new Error("Exhausted ticket number attempts");
  } catch {
    // Nothing partial is persisted: the create is the transaction (FR-33).
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to create the ticket." },
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2, Issue 6 — the signed-in Requester's Tickets
//
// Search, filter, sort, and paginate, always scoped to the requester from the
// session (Lab 3 BR-03). The owner filter is part of the database query itself
// rather than a check applied afterwards (BR-15), so there is no code path that
// can fetch another requester's rows and forget to discard them.
// ---------------------------------------------------------------------------

const TICKET_LIST_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  requestedPriority: true,
  currentStatus: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  // Only active attachments are counted (BR-34). Selecting ids and taking the
  // length keeps this to one query and avoids relying on a filtered relation
  // count, and a page holds at most 50 tickets.
  attachments: { where: { removedAt: null }, select: { id: true } },
} as const;

app.get("/api/tickets", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  const parsed = parseTicketListQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    // No ticket data accompanies a rejected query (BR-23).
    return res.status(400).json({ error: { code: "INVALID_QUERY", message: parsed.message } });
  }
  const query = parsed.value;

  try {
    const where = {
      requesterId: context.requesterId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.relatedSystemId ? { relatedSystemId: query.relatedSystemId } : {}),
      ...(query.requestedPriority ? { requestedPriority: query.requestedPriority } : {}),
      ...(query.currentStatus ? { currentStatus: query.currentStatus } : {}),
      // Search spans Ticket Number and Summary, case-insensitively (BR-18),
      // and combines with the filters above using AND (BR-19).
      ...(query.search
        ? {
            OR: [
              { ticketNumber: containsText(query.search) },
              { summary: containsText(query.search) },
            ],
          }
        : {}),
    };

    const [totalItems, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        // id desc is the secondary key on every sort, so ordering is stable and
        // pagination cannot repeat or skip a row when timestamps tie (BR-21).
        orderBy: [{ [query.sortBy]: query.sortDir }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: TICKET_LIST_SELECT,
      }),
    ]);

    return res.status(200).json({
      data: tickets.map(({ attachments, createdAt, ...ticket }) => ({
        ...ticket,
        // description is deliberately absent: it can be 4000 characters and no
        // list column shows it.
        ticketDate: createdAt,
        activeAttachmentCount: attachments.length,
      })),
      meta: buildPageMeta(query.page, query.pageSize, totalItems),
    });
  } catch {
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to load tickets." },
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2, Issue 7 — Ticket Detail and Attachments
//
// Ownership is re-checked on every route independently (BR-17). A ticket or
// attachment that belongs to another requester returns 404, identical to one
// that does not exist, so the API never discloses that it is there (BR-16).
// ---------------------------------------------------------------------------

export const UPLOAD_DIR = resolvePath(process.env.UPLOAD_DIR ?? "uploads");

// Files are held in memory and written only after they pass validation, so a
// rejected upload never touches the disk and no metadata row can outlive a
// failed write (BR-43).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const NOT_FOUND = {
  error: { code: "NOT_FOUND", message: "That ticket could not be found." },
} as const;

function attachmentView(row: {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
}) {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt,
    removedAt: row.removedAt,
    removalReason: row.removalReason,
    // A removed attachment reports no download URL, so a client cannot build a
    // working link out of the response (BR-40).
    downloadUrl: row.removedAt ? null : `/api/attachments/${row.id}/download`,
  };
}

const ATTACHMENT_SELECT = {
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  removedAt: true,
  removalReason: true,
} as const;

// --- GET /api/tickets/:id — one owned Ticket -------------------------------

app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  const id = routeId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } });
  }

  try {
    // The owner is part of the lookup, so another requester's ticket simply
    // does not match (BR-15).
    const ticket = await prisma.ticket.findFirst({
      where: { id, requesterId: context.requesterId },
      select: {
        ...TICKET_DETAIL_SELECT,
        attachments: { select: ATTACHMENT_SELECT, orderBy: { uploadedAt: "asc" } },
      },
    });

    if (!ticket) return res.status(404).json(NOT_FOUND);

    const { attachments, ...rest } = ticket;
    return res.status(200).json({
      ...rest,
      ticketDate: ticket.createdAt,
      attachments: attachments.map(attachmentView),
    });
  } catch {
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to load the ticket." } });
  }
});

// --- GET /api/tickets/:id/attachments — metadata ---------------------------

app.get("/api/tickets/:id/attachments", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  const id = routeId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } });
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id, requesterId: context.requesterId },
      select: { id: true },
    });
    if (!ticket) return res.status(404).json(NOT_FOUND);

    const attachments = await prisma.attachment.findMany({
      where: { ticketId: id },
      orderBy: { uploadedAt: "asc" },
      select: ATTACHMENT_SELECT,
    });

    // Removed attachments stay in the listing as metadata (BR-40).
    return res.status(200).json(attachments.map(attachmentView));
  } catch {
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to load attachments." } });
  }
});

// --- POST /api/tickets/:id/attachments — upload ----------------------------

app.post("/api/tickets/:id/attachments", (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");

  upload.single("file")(req, res, async (uploadError: unknown) => {
    if (uploadError) {
      const code = (uploadError as { code?: string }).code;
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: { code: "FILE_TOO_LARGE", message: "Each file must be 5 MB or smaller." },
        });
      }
      return res.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "The upload could not be read." },
      });
    }

    const prisma = getPrisma();

    const context = resolveRequesterIdentity(req);
    if (!context.ok) {
      return res
        .status(context.status)
        .json({ error: { code: context.code, message: context.message } });
    }

    const id = routeId(req.params.id);
    if (id === null) {
      return res
        .status(400)
        .json({ error: { code: "INVALID_QUERY", message: "The ticket id is not valid." } });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "No file was supplied.",
          fields: { file: "Choose a file to attach." },
        },
      });
    }

    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id, requesterId: context.requesterId },
        select: { id: true },
      });
      // Ownership is checked before the file is even looked at (BR-37).
      if (!ticket) return res.status(404).json(NOT_FOUND);

      const check = checkUpload(file.originalname, file.mimetype, file.size);
      if (!check.ok) {
        return res
          .status(check.reason.status)
          .json({ error: { code: check.reason.code, message: check.reason.message } });
      }

      // Only ACTIVE attachments count toward the limit, so removing one frees a
      // slot (BR-34).
      const activeCount = await prisma.attachment.count({
        where: { ticketId: id, removedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        return res.status(409).json({
          error: {
            code: "ATTACHMENT_LIMIT_REACHED",
            message: `A ticket may hold at most ${MAX_ACTIVE_ATTACHMENTS} active attachments.`,
          },
        });
      }

      const storedFilename = buildStoredFilename(file.originalname);
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, storedFilename), file.buffer);

      try {
        const attachment = await prisma.attachment.create({
          data: {
            ticketId: id,
            originalFilename: file.originalname,
            storedFilename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
          select: ATTACHMENT_SELECT,
        });

        // Touch the ticket so "Last Updated" reflects the change (BR-08).
        await prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });

        return res.status(201).json({ ...attachmentView(attachment), ticketId: id });
      } catch (dbError) {
        // The bytes are on disk but the row failed: remove the orphan so the
        // store never holds a file nothing references (BR-43).
        await unlink(join(UPLOAD_DIR, storedFilename)).catch(() => {});
        throw dbError;
      }
    } catch {
      return res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Failed to store the attachment." } });
    }
  });
});

// --- GET /api/attachments/:id/download -------------------------------------

app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  const id = routeId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_QUERY", message: "The attachment id is not valid." } });
  }

  try {
    // Ownership is enforced here independently: a direct link is not a bypass
    // (BR-17).
    const attachment = await prisma.attachment.findFirst({
      where: { id, ticket: { requesterId: context.requesterId } },
      select: { ...ATTACHMENT_SELECT, storedFilename: true },
    });

    if (!attachment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "That attachment could not be found." },
      });
    }

    // A removed attachment never streams bytes, whatever the UI shows (BR-41).
    if (attachment.removedAt) {
      return res.status(410).json({
        error: {
          code: "ATTACHMENT_REMOVED",
          message: "That attachment was removed and can no longer be downloaded.",
        },
      });
    }

    const path = join(UPLOAD_DIR, attachment.storedFilename);
    if (!existsSync(path)) {
      return res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "The stored file is unavailable." } });
    }

    res.status(200);
    res.set("Content-Type", attachment.mimeType);
    res.set("Content-Length", String(attachment.sizeBytes));
    // The original name is only ever used as a label, never as a path.
    res.set(
      "Content-Disposition",
      `attachment; filename="${attachment.originalFilename.replace(/"/g, "")}"`,
    );
    return createReadStream(path).pipe(res);
  } catch {
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to download the attachment." } });
  }
});

// --- PATCH /api/attachments/:id/remove — soft removal ----------------------

app.patch("/api/attachments/:id/remove", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const prisma = getPrisma();

  const context = resolveRequesterIdentity(req);
  if (!context.ok) {
    return res
      .status(context.status)
      .json({ error: { code: context.code, message: context.message } });
  }

  const id = routeId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_QUERY", message: "The attachment id is not valid." } });
  }

  const reason = checkRemovalReason((req.body as { removalReason?: unknown })?.removalReason);
  if (!reason.ok) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: "One or more fields are invalid.",
        fields: { removalReason: reason.message },
      },
    });
  }

  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id, ticket: { requesterId: context.requesterId } },
      select: { ...ATTACHMENT_SELECT, ticketId: true },
    });

    if (!attachment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "That attachment could not be found." },
      });
    }

    if (attachment.removedAt) {
      return res.status(409).json({
        error: {
          code: "ATTACHMENT_ALREADY_REMOVED",
          message: "That attachment has already been removed.",
        },
      });
    }

    // Soft removal: the row and the file both stay, stamped with when and why
    // (BR-38). Nothing is deleted.
    const updated = await prisma.attachment.update({
      where: { id },
      data: { removedAt: new Date(), removalReason: reason.value },
      select: ATTACHMENT_SELECT,
    });

    await prisma.ticket.update({
      where: { id: attachment.ticketId },
      data: { updatedAt: new Date() },
    });

    return res.status(200).json(attachmentView(updated));
  } catch {
    return res
      .status(500)
      .json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove the attachment." } });
  }
});

// Lab 3, Issue 4 — safe errors to the very end (FR-47, api-spec §6.2).
// Lab 3, Issue 7 — Public Comments, Internal Notes, and appears-resolved.
app.use("/api/tickets", conversationRouter);
// Lab 3, Issue 8 — the IT Staff queue, behind the /api/staff role guard above.
app.use("/api/staff", staffRouter);
// Lab 3, Issue 10 — user management, behind the /api/admin role guard above.
app.use("/api/admin", adminRouter);

app.use("/api", apiNotFound);
app.use(safeErrors);

export default app;
