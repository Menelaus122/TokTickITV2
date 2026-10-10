import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    // Process real CSS so the Zen Green stylesheet can be asserted on
    // (vitest stubs CSS imports to an empty string by default).
    css: true,
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.tsx"],
    // Lab 4, Issue 9 (specification D-22): the intermittent failures of Lab 3's navigation suites were
    // found to be the default time budgets running out when several suites compete for the CPU: five
    // seconds for a test, one second for a screen to appear. They fail only under that load, and only by
    // timing out (tests.md §7). The budgets are widened; no assertion is touched.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
