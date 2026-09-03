import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Issue 4 — GET /api/requesters (API-01, API-02 in docs/lab-02/tests.md).
//
// Requires a migrated and seeded database:
//   docker compose up -d db server
//   docker exec toktickit-server npx prisma migrate deploy
//   docker exec toktickit-server npm run prisma:seed

const prisma = getPrisma();

interface RequesterRow {
  id: number;
  fullName: string;
  email: string;
  department: string | null;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/requesters", () => {
  it("returns 200 with the active development requesters", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it("excludes inactive requesters so they can never be selected", async () => {
    const inactive = await prisma.requesterUser.findMany({
      where: { isActive: false },
      select: { id: true, fullName: true },
    });
    // The seed guarantees at least one, which is the point of this test.
    expect(inactive.length).toBeGreaterThanOrEqual(1);

    const res = await request(app).get("/api/requesters");
    const returnedIds = res.body.map((row: RequesterRow) => row.id);

    for (const row of inactive) {
      expect(returnedIds).not.toContain(row.id);
    }
  });

  it("returns exactly the requesters marked active in the database", async () => {
    const active = await prisma.requesterUser.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const res = await request(app).get("/api/requesters");
    expect(res.body.map((row: RequesterRow) => row.id).sort()).toEqual(
      active.map((row) => row.id).sort(),
    );
  });

  it("sorts by full name so the dropdown reads alphabetically", async () => {
    const res = await request(app).get("/api/requesters");
    const names = res.body.map((row: RequesterRow) => row.fullName);

    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
  });

  it("exposes only the selector's fields and never a credential", async () => {
    const res = await request(app).get("/api/requesters");

    for (const row of res.body as RequesterRow[]) {
      // BR-03: this model has no password, role, or token, and the API must
      // not grow one by accident.
      expect(Object.keys(row).sort()).toEqual(["department", "email", "fullName", "id"]);
      expect(typeof row.id).toBe("number");
      expect(typeof row.fullName).toBe("string");
      expect(typeof row.email).toBe("string");
    }

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toMatch(/password|passwordHash|role|token|session/i);
  });

  it("returns an empty array when no requester is active", async () => {
    // Drives the selection screen's empty state (BR-13). The active flags are
    // restored in the finally block so the suite leaves the seed untouched.
    const active = await prisma.requesterUser.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    try {
      await prisma.requesterUser.updateMany({
        where: { id: { in: active.map((row) => row.id) } },
        data: { isActive: false },
      });

      const res = await request(app).get("/api/requesters");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await prisma.requesterUser.updateMany({
        where: { id: { in: active.map((row) => row.id) } },
        data: { isActive: true },
      });
    }

    // The restore actually worked — otherwise every later run starts empty.
    const restored = await request(app).get("/api/requesters");
    expect(restored.body).toHaveLength(active.length);
  });
});
