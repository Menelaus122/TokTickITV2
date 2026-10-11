import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// How long findBy and waitFor wait for a screen to appear. The default is one second, which a loaded machine
// does not always give the first render of the whole application; see vite.config.ts and tests.md §7 (D-22).
configure({ asyncUtilTimeout: 5_000 });

// No test reaches the real network (Lab 4, Issue 9, the review of PR #88).
//
// The client's API address is http://localhost:3000, which on a developer's machine is where the real API
// runs. A screen whose call a test forgot to mock then sent a real request, and the real API answered 401,
// because no cookie went with it. The client takes a 401 outside /api/auth to mean the session ended, tells
// every mounted AuthProvider, and the screen of whichever test was running at that moment became the Login
// screen. That is the intermittent failure of Lab 3's navigation suites: with the API stopped, eight runs of
// those three files passed; with it up, two of six failed (tests.md §7).
//
// So every test starts with a fetch that is offline, and a test that reaches for it fails, naming the call.
const reached: string[] = [];

beforeEach(() => {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    reached.push(`${init?.method ?? "GET"} ${url} (called in: ${expect.getState().currentTestName})`);
    return Promise.reject(new TypeError("Failed to fetch"));
  }) as typeof fetch;
});

afterEach(() => {
  if (reached.length === 0) return;
  const calls = reached.splice(0);
  throw new Error(
    `A test reached for the real network, which no test may do (a running API answers 401, and the app takes that for a session that ended): ${calls.join("; ")}. Mock the api function that makes the call.`,
  );
});
