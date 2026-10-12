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
    // Lab 3's MIG-06 and Lab 4's MIG-06 run the whole seed twice, and the seed has grown across the labs: they
    // take 4 to 5 seconds, which is vitest's own limit for a test, so on a slower machine they fail by timing
    // out and by nothing else (the review of PR #88 and of PR #89). The client got the same budget in PR #88.
    // No assertion is touched (tests.md section 7).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
