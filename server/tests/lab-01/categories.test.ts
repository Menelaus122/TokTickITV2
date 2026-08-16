import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Issue 4 — integration test (mirrors health.test.ts).
// Requires the DB to be migrated and seeded first:
//   docker compose up -d db
//   npm run prisma:migrate && npm run prisma:seed
// It asserts GET /api/categories returns 200 and the four seeded category
// names in id order, each shaped as { id, name }.
const EXPECTED_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(EXPECTED_NAMES.length);

    // Names arrive in the seeded id order.
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(EXPECTED_NAMES);

    // Ids are ascending and each row exposes only id + name.
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    for (const category of res.body) {
      expect(Object.keys(category).sort()).toEqual(["id", "name"]);
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    }
  });
});
