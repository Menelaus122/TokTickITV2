import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The API suites all talk to the same PostgreSQL database, and several of
    // them create and delete tickets for the same seeded requester. Run test
    // files one at a time so one suite's fixtures cannot shift another's counts
    // or ordering mid-assertion. Without this the suites pass alone and fail
    // together, which is the worst kind of flake to debug.
    fileParallelism: false,
  },
});
