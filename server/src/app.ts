import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

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

export default app;
