import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import { StatusBadge, STATUS_LABEL, TICKET_STATUSES } from "../../src/components/index.js";
import * as api from "../../src/api.js";
import type { AuthUser } from "../../src/api.js";

// Lab 3, Issue 6 — UI-09 in docs/lab-03/tests.md (AC-12, FR-16, FR-17).
//
// The Lab 2 Requester screens now run on the signed-in user. Most cases here
// stub `fetch` itself rather than the api module, so the real request code —
// headers, credentials, and the 401 handling — is what gets exercised.

const REQUESTER: AuthUser = {
  id: 1,
  fullName: "Anucha Wongsawat",
  email: "anucha.wong@kmutt.ac.th",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

const EMPTY_PAGE = {
  data: [],
  meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
};

const EMPTY_BOARD = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    openTickets: { value: 0, href: "/tickets?group=open" },
    waitingForYou: { value: 0, href: "/tickets?status=WAITING_FOR_REQUESTER" },
    resolved: { value: 0, href: "/tickets?status=RESOLVED" },
    closed: { value: 0, href: "/tickets?status=CLOSED" },
  },
  needsAttention: [],
  recentTickets: [],
};

function json(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Route = (url: URL, init: RequestInit) => Response | undefined;

/** Stubs fetch with the given routes, falling back to a signed-in Requester. */
function stubApi(...routes: Route[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    for (const route of routes) {
      const answer = route(url, init);
      if (answer) return answer;
    }
    if (url.pathname === "/api/auth/me") return json(200, { user: REQUESTER });
    if (url.pathname === "/api/categories" || url.pathname === "/api/related-systems") return json(200, []);
    if (url.pathname === "/api/tickets") return json(200, EMPTY_PAGE);
    // Lab 4, Issue 7: a Requester lands on the Dashboard, which has its own request.
    if (url.pathname === "/api/dashboard/requester") return json(200, EMPTY_BOARD);
    return json(404, { error: { code: "NOT_FOUND", message: "That resource does not exist." } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI-09 no Development Requester selector anywhere", () => {
  it.each(["/tickets", "/tickets/new"])("%s has no selector and no Change Requester control", async (path) => {
    stubApi();
    render(<TokTickITApp initialEntries={[path]} />);
    await screen.findByTestId("current-user");

    expect(screen.queryByText(/Change Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /requester/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-user")).toHaveTextContent(REQUESTER.fullName);
  });

  // Changed in Lab 4, Issue 7 (D-09): the Requester's landing page is the Dashboard.
  it("the old selector URL is gone: a signed-in Requester lands on the Dashboard", async () => {
    stubApi();
    render(<TokTickITApp initialEntries={["/select-requester"]} />);
    expect(await screen.findByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText(/Select a Development Requester/i)).not.toBeInTheDocument();
  });

  it("the old selector URL sends a visitor with no session to Login", async () => {
    stubApi((url) => (url.pathname === "/api/auth/me" ? json(401, { error: { code: "AUTH_REQUIRED", message: "Sign in to continue." } }) : undefined));
    render(<TokTickITApp initialEntries={["/select-requester"]} />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps no Requester identity in localStorage", async () => {
    stubApi();
    render(<TokTickITApp initialEntries={["/tickets"]} />);
    await screen.findByTestId("current-user");
    expect(window.localStorage.length).toBe(0);
  });
});

describe("UI-09 the Requester screens act through the session only", () => {
  it("never sends X-Requester-Id, and always sends the session cookie", async () => {
    const fetchMock = stubApi(
      (url) => (url.pathname === "/api/tickets/42" ? json(200, {
        id: 42, ticketNumber: "TT-2026-00042", summary: "Printer jam", description: "Paper jams on every page.",
        requestedPriority: "LOW", currentStatus: "OPEN", ticketDate: "2026-10-01T09:00:00.000Z", updatedAt: "2026-10-01T09:00:00.000Z",
        requester: { id: 1, fullName: REQUESTER.fullName }, category: { id: 1, name: "Hardware" }, relatedSystem: { id: 1, name: "Printer" },
        attachments: [],
      }) : undefined),
    );
    const user = userEvent.setup();
    render(<TokTickITApp initialEntries={["/tickets/42"]} />);
    await screen.findByText("TT-2026-00042");
    await user.click(screen.getByRole("link", { name: "My Tickets" }));
    await screen.findByLabelText("Search tickets");
    await user.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });

    const calls = fetchMock.mock.calls.map(([input, init = {}]) => ({ url: String(input), init: init as RequestInit }));
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(
      expect.arrayContaining(["/api/auth/me", "/api/tickets/42", "/api/tickets", "/api/categories"]),
    );
    for (const { url, init } of calls) {
      expect(init.credentials, url).toBe("include");
      const headers = new Headers(init.headers);
      expect(headers.has("X-Requester-Id"), url).toBe(false);
      expect(String(init.body ?? "")).not.toMatch(/requesterId/);
    }
  });

  it("sends the user to Login when the session has ended, then back to the same page", async () => {
    let sessionAlive = true;
    let listCalls = 0;
    stubApi(
      (url) => (url.pathname === "/api/auth/me" && !sessionAlive ? json(401, { error: { code: "AUTH_REQUIRED", message: "Sign in to continue." } }) : undefined),
      (url) => {
        if (url.pathname !== "/api/tickets") return undefined;
        // The session expires between the shell loading and the list loading.
        listCalls += 1;
        if (listCalls === 1) {
          sessionAlive = false;
          return json(401, { error: { code: "AUTH_REQUIRED", message: "Sign in to continue." } });
        }
        return json(200, EMPTY_PAGE);
      },
      (url, init) => {
        if (url.pathname !== "/api/auth/login" || init.method !== "POST") return undefined;
        sessionAlive = true;
        return json(201, { user: REQUESTER });
      },
    );
    const user = userEvent.setup();
    render(<TokTickITApp initialEntries={["/tickets"]} />);

    // On Login, not on a broken My Tickets with a generic error.
    const signIn = await screen.findByRole("button", { name: "Sign in" });
    expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Email/), REQUESTER.email);
    await user.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await user.click(signIn);

    // Back on My Tickets, which now loads.
    expect(await screen.findByText("You have no tickets yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("current-user")).toHaveTextContent(REQUESTER.fullName);
    expect(listCalls).toBe(2);
  });

  it("a wrong password on Login is an answer, not an ended session", async () => {
    const ended = vi.fn();
    const unsubscribe = api.onSessionEnded(ended);
    stubApi((url) => (url.pathname === "/api/auth/login" ? json(401, { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }) : undefined));
    await expect(api.login(REQUESTER.email, "wrong-password")).rejects.toThrow("Email or password is incorrect.");
    await api.fetchCurrentUser();
    expect(ended).not.toHaveBeenCalled();

    await api.fetchMyTickets().catch(() => {});
    expect(ended).not.toHaveBeenCalled(); // 200 here
    unsubscribe();
  });
});

describe("Lab 3 statuses on the Requester screens (ui-spec §1.3)", () => {
  it("labels each of the eight statuses in title case, with its own tone", () => {
    const tones = new Map<string, string>();
    for (const status of TICKET_STATUSES) {
      const { container, unmount } = render(<StatusBadge value={status} />);
      const badge = container.querySelector(".tt-badge")!;
      expect(badge).toHaveTextContent(STATUS_LABEL[status]);
      expect(badge.textContent).not.toMatch(/_/);
      tones.set(status, badge.className);
      unmount();
    }
    expect(STATUS_LABEL.WAITING_FOR_REQUESTER).toBe("Waiting for Requester");
    expect(tones.get("OPEN")).toBe(tones.get("IN_PROGRESS"));
    expect(tones.get("RESOLVED")).toBe(tones.get("CLOSED"));
    expect(new Set(tones.values()).size).toBe(6);
  });

  it("My Tickets offers all eight statuses as filters and sends the chosen one", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<TokTickITApp initialEntries={["/tickets"]} />);

    const filter = await screen.findByLabelText("Filter by Current Status");
    const options = within(filter).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(options).toEqual(["", ...TICKET_STATUSES]);

    await user.selectOptions(filter, "WAITING_FOR_REQUESTER");
    await waitFor(() => {
      const last = new URL(String(fetchMock.mock.calls.at(-1)![0]));
      expect(last.pathname).toBe("/api/tickets");
      expect(last.searchParams.get("currentStatus")).toBe("WAITING_FOR_REQUESTER");
    });
  });
});
