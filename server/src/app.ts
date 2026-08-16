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

export default app;
