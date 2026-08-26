import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { resolveRequester, REQUESTER_HEADER } from "./requesterContext.js";
import { validateTicketInput } from "./validation.js";
import { nextTicketNumber } from "./ticketNumber.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Disable ETags so responses are never revalidated into a 304 Not Modified.
// This API returns small, always-fresh JSON, so conditional caching only gets
// in the way (a browser reload of /api/health should be a clean 200, not 304).
app.set("etag", false);

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

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
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
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
// Lab 2, Issue 4 — active Development Requesters
// GET /api/requesters lists the temporary Lab 2 testing identities so the
// Development Requester Selection screen can offer them.
//
// This is NOT authentication (BR-03). The response carries no password, role,
// or token, because the model has none. Only isActive requesters are returned,
// so a deactivated one can never be selected (BR-09).
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      // Sorted by name because this list is read by a human scanning a dropdown.
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, department: true },
    });
    // An empty array is a valid answer; it drives the selection screen's empty
    // state rather than being an error (BR-13).
    res.status(200).json(requesters);
  } catch {
    // Never leak internal/database details to the client (FR-33).
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to load development requesters.",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2, Issue 5 — active Related Systems
// The specific service, application, device, or platform a ticket is about.
// Sorted by name because this list is long enough to be scanned alphabetically.
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
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
// owning Requester, which comes from the X-Requester-Id header and never from
// the body (BR-06, BR-14).
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

  const context = await resolveRequester(prisma, req.headers[REQUESTER_HEADER]);
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

export default app;
