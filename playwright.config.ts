import { defineConfig, devices } from "@playwright/test";

// End-to-end and responsive tests (docs/lab-02/tests.md sections 2.5 and 2.6).
//
// These run against a real stack: PostgreSQL, the Express API, and the Vite
// dev server. Start them first — see docs/lab-02/tests.md section 5 — or set
// E2E_BASE_URL and E2E_API_URL to point at wherever they are running.

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000";

// The three viewports the specification names (ui-spec.md section 13).
export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 900, height: 1000 },
  mobile: { width: 375, height: 812 },
} as const;

export default defineConfig({
  testDir: "./e2e",
  // The suites share one database, so they run in order rather than racing
  // each other's fixtures — the same reason server/vitest.config.ts sets
  // fileParallelism to false.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./artifacts/lab-02/playwright-output",

  use: {
    baseURL: BASE_URL,
    // Screenshots are captured explicitly by the responsive suite; these two
    // only fire when something goes wrong.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORTS.desktop },
    },
  ],
});
