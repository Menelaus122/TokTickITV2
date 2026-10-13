import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { RequesterDashboard } from "../../src/screens/RequesterDashboard.js";
import * as api from "../../src/api.js";
import { ApiError, type RequesterDashboard as Board } from "../../src/api.js";

// Lab 4, Issue 7 — UI-18 to UI-21 in docs/lab-04/tests.md §2.8 (ui-spec §1.1, §3.1, §3.5;
// specification.md FR-15, FR-18, FR-20, BR-39, BR-40; AC-18, AC-21, AC-22).
//
// The seam is the screen as a person meets it, inside a router so a link can be followed.
// The API client is the system boundary, so it is the only thing mocked: the server decides
// every number and every row (BR-30), and these tests hand the screen a dashboard and check
// that it shows exactly that, links to where the contract says, and copes with every way the
// request can end.

const BOARD: Board = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    openTickets: { value: 3, href: "/tickets?group=open" },
    waitingForYou: { value: 1, href: "/tickets?status=WAITING_FOR_REQUESTER" },
    resolved: { value: 5, href: "/tickets?status=RESOLVED" },
    closed: { value: 12, href: "/tickets?status=CLOSED" },
  },
  needsAttention: [
    { id: 31, ticketNumber: "TT-2026-00031", summary: "Grade upload rejects the whole file", currentStatus: "WAITING_FOR_REQUESTER", updatedAt: "2026-10-03T04:00:00.000Z" },
  ],
  recentTickets: [
    { id: 42, ticketNumber: "TT-2026-00042", summary: "Printer on floor 3 will not print", currentStatus: "IN_PROGRESS", updatedAt: "2026-10-05T03:12:00.000Z" },
    { id: 31, ticketNumber: "TT-2026-00031", summary: "Grade upload rejects the whole file", currentStatus: "WAITING_FOR_REQUESTER", updatedAt: "2026-10-03T04:00:00.000Z" },
  ],
};

const EMPTY: Board = {
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

let fetchBoard: MockInstance<typeof api.fetchRequesterDashboard>;

beforeEach(() => {
  fetchBoard = vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(BOARD);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Where a followed link landed, so a card's destination is a thing the test can read. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderDashboard(fullName = "Pornchai Thana") {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<RequesterDashboard fullName={fullName} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ready(fullName?: string) {
  const view = renderDashboard(fullName);
  await screen.findByRole("link", { name: /^Open Tickets: / });
  return view;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("UI-18 the four Requester cards (AC-18, AC-21, FR-15, ui-spec §1.1, §3.1)", () => {
  it("greets the Requester by first name, as the one page heading", async () => {
    await ready("Pornchai Thana");
    // Exactly the first name: a substring match would also pass for "Welcome, Pornchai Thana".
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, Pornchai");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("greets a person with one name by that name", async () => {
    await ready("Madonna");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, Madonna");
  });

  it("takes the first word of a name with extra spaces, and of a Thai name", async () => {
    await ready("  Somchai   Jaidee ");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome, Somchai");
  });

  it("shows Open Tickets, Waiting for You, Resolved, and Closed, in that order, each with its value", async () => {
    await ready();
    const cards = screen.getAllByRole("link", { name: /: \d+\. View all$/ });
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Open Tickets: 3. View all",
      "Waiting for You: 1. View all",
      "Resolved: 5. View all",
      "Closed: 12. View all",
    ]);
    const open = screen.getByRole("link", { name: "Open Tickets: 3. View all" });
    expect(within(open).getByText("Open Tickets")).toBeInTheDocument();
    expect(within(open).getByText("3")).toBeInTheDocument();
    expect(within(open).getByText(/View all/)).toBeInTheDocument();
  });

  it("makes each card one link, whose accessible name carries the number and the destination together", async () => {
    await ready();
    for (const [name, href] of [
      ["Open Tickets: 3. View all", "/tickets?group=open"],
      ["Waiting for You: 1. View all", "/tickets?status=WAITING_FOR_REQUESTER"],
      ["Resolved: 5. View all", "/tickets?status=RESOLVED"],
      ["Closed: 12. View all", "/tickets?status=CLOSED"],
    ]) {
      const card = screen.getByRole("link", { name });
      expect(card.tagName).toBe("A");
      expect(card).toHaveAttribute("href", href);
    }
  });

  it("follows the API's own href, not one the screen made up", async () => {
    fetchBoard.mockResolvedValue({
      ...BOARD,
      metrics: { ...BOARD.metrics, resolved: { value: 5, href: "/tickets?status=RESOLVED&elsewhere=1" } },
    });
    await ready();
    expect(screen.getByRole("link", { name: "Resolved: 5. View all" })).toHaveAttribute("href", "/tickets?status=RESOLVED&elsewhere=1");
  });

  it("opens My Tickets with the card's filter when it is clicked", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("link", { name: "Open Tickets: 3. View all" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/tickets?group=open");
  });

  it("opens it from the keyboard too: a card takes focus and Enter follows it", async () => {
    const user = userEvent.setup();
    await ready();
    screen.getByRole("link", { name: "Waiting for You: 1. View all" }).focus();
    expect(screen.getByRole("link", { name: "Waiting for You: 1. View all" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("where")).toHaveTextContent("/tickets?status=WAITING_FOR_REQUESTER");
  });

  it("reaches every card by Tab, in reading order", async () => {
    const user = userEvent.setup();
    await ready();
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      const label = document.activeElement?.getAttribute("aria-label");
      if (label) seen.push(label);
    }
    expect(seen.slice(0, 4)).toEqual(["Open Tickets: 3. View all", "Waiting for You: 1. View all", "Resolved: 5. View all", "Closed: 12. View all"]);
  });

  it("asks for the dashboard once on arrival, and never for the whole My Tickets list", async () => {
    const list = vi.spyOn(api, "fetchMyTickets");
    await ready();
    expect(fetchBoard).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });
});

describe("UI-19 the two Requester lists (AC-18, FR-15, ui-spec §3.1)", () => {
  it("shows Needs your attention with the Ticket Number, Summary, status, and date of each row", async () => {
    await ready();
    const attention = region("Needs your attention");
    const row = attention.getByRole("link", { name: /TT-2026-00031/ });
    expect(within(row).getByText("TT-2026-00031")).toBeInTheDocument();
    expect(within(row).getByText("Grade upload rejects the whole file")).toBeInTheDocument();
    expect(within(row).getByText("Waiting for Requester")).toBeInTheDocument();
    const time = row.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-03T04:00:00.000Z");
    expect(time.textContent).not.toBe("");
  });

  it("shows the time of day beside the date in Recently updated, and the date alone in Needs your attention (ui-spec §3.1)", async () => {
    await ready();
    // The same instant, written the way the browser writes a time in its own zone.
    const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const recent = region("Recently updated").getByRole("link", { name: /TT-2026-00042/ }).querySelector("time")!;
    expect(recent.textContent).toContain(time("2026-10-05T03:12:00.000Z"));
    const attention = region("Needs your attention").getByRole("link", { name: /TT-2026-00031/ }).querySelector("time")!;
    expect(attention.textContent).not.toContain(time("2026-10-03T04:00:00.000Z"));
    expect(attention.textContent).toMatch(/\d/);
  });

  it("writes the year only for a date that is not in this year (ui-spec §3.1)", async () => {
    const now = new Date().toISOString();
    fetchBoard.mockResolvedValue({
      ...BOARD,
      recentTickets: [
        { ...BOARD.recentTickets[0], id: 50, ticketNumber: "TT-2026-00050", updatedAt: now },
        { ...BOARD.recentTickets[0], id: 51, ticketNumber: "TT-2024-00051", updatedAt: "2024-03-02T04:00:00.000Z" },
      ],
    });
    await ready();
    const thisYear = String(new Date().getFullYear());
    const recent = region("Recently updated");
    expect(recent.getByRole("link", { name: /TT-2026-00050/ }).querySelector("time")!.textContent).not.toContain(thisYear);
    expect(recent.getByRole("link", { name: /TT-2024-00051/ }).querySelector("time")!.textContent).toContain("2024");
  });

  it("opens the Ticket Detail when a row of either list is followed, one link to the whole row", async () => {
    const user = userEvent.setup();
    await ready();
    const row = region("Recently updated").getByRole("link", { name: /TT-2026-00042/ });
    expect(row).toHaveAttribute("href", "/tickets/42");
    await user.click(row);
    expect(await screen.findByTestId("where")).toHaveTextContent("/tickets/42");
  });

  it("gives the attention list's row the same destination as in the other list", async () => {
    await ready();
    expect(region("Needs your attention").getByRole("link", { name: /TT-2026-00031/ })).toHaveAttribute("href", "/tickets/31");
  });

  it("shows Recently updated in the order the API gave, which is newest first", async () => {
    await ready();
    const rows = region("Recently updated").getAllByRole("link", { name: /^TT-/ });
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("TT-2026-00042"), expect.stringContaining("TT-2026-00031")]);
  });

  it("keeps the whole Summary in the title and leaves the cutting to the stylesheet", async () => {
    const long = "A very long summary that no single line of a dashboard row could ever hold, however wide the screen is";
    fetchBoard.mockResolvedValue({ ...BOARD, recentTickets: [{ ...BOARD.recentTickets[0], summary: long }] });
    await ready();
    const summary = region("Recently updated").getByText(long);
    expect(summary).toHaveAttribute("title", long);
  });

  it("offers View all in the Recently updated list, which opens My Tickets", async () => {
    const user = userEvent.setup();
    await ready();
    const viewAll = region("Recently updated").getByRole("link", { name: /^View all/ });
    expect(viewAll).toHaveAttribute("href", "/tickets");
    await user.click(viewAll);
    expect(await screen.findByTestId("where")).toHaveTextContent(/^\/tickets$/);
  });

  it("shows an explicit message, and no empty list, when a list has nothing", async () => {
    fetchBoard.mockResolvedValue({ ...BOARD, needsAttention: [] });
    await ready();
    const attention = region("Needs your attention");
    expect(attention.getByText("Nothing is waiting on you.")).toBeInTheDocument();
    expect(attention.queryByRole("list")).not.toBeInTheDocument();
    expect(region("Recently updated").queryByText("You have no tickets yet.")).not.toBeInTheDocument();
  });

  it("offers Create Ticket and View My Tickets as the quick actions, Create Ticket first", async () => {
    await ready();
    const actions = region("Quick actions").getAllByRole("link");
    expect(actions.map((link) => link.textContent)).toEqual(["Create Ticket", "View My Tickets"]);
    expect(actions[0]).toHaveAttribute("href", "/tickets/new");
    expect(actions[1]).toHaveAttribute("href", "/tickets");
  });

  it("does not repeat the whole My Tickets page: no search, filters, table, or pagination", async () => {
    await ready();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });
});

describe("UI-20 a Requester with no Tickets (AC-18, BR-39)", () => {
  beforeEach(() => {
    fetchBoard.mockResolvedValue(EMPTY);
  });

  it("shows 0 on every card, never a blank, and keeps every card a link", async () => {
    await ready();
    for (const label of ["Open Tickets", "Waiting for You", "Resolved", "Closed"]) {
      const card = screen.getByRole("link", { name: `${label}: 0. View all` });
      expect(within(card).getByText("0")).toBeInTheDocument();
      expect(card).toHaveAttribute("href");
    }
  });

  it("keeps both lists on the page, each with its own message, so the layout does not jump", async () => {
    await ready();
    expect(region("Needs your attention").getByText("Nothing is waiting on you.")).toBeInTheDocument();
    expect(region("Recently updated").getByText("You have no tickets yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(4);
  });

  it("puts Create Ticket beside the empty Recently updated message, and keeps the quick actions", async () => {
    await ready();
    expect(region("Recently updated").getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "/tickets/new");
    expect(region("Quick actions").getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(region("Quick actions").getByRole("link", { name: "View My Tickets" })).toBeInTheDocument();
  });

  it("is a valid dashboard and not an error: no alert, no failure copy", async () => {
    await ready();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded|Something went wrong/)).not.toBeInTheDocument();
  });
});

describe("UI-21 loading, forbidden, failure, and Refresh (AC-22, FR-20, ui-spec §3.5)", () => {
  it("shows skeletons shaped like the cards and the lists while it loads, and no number", async () => {
    const pending = deferred<Board>();
    fetchBoard.mockReturnValue(pending.promise);
    renderDashboard();
    expect(await screen.findByText("Loading your dashboard…")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-state="loading"] .tt-skeleton').length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByRole("link", { name: /^Open Tickets/ })).not.toBeInTheDocument();
    pending.resolve(BOARD);
    expect(await screen.findByRole("link", { name: "Open Tickets: 3. View all" })).toBeInTheDocument();
    expect(screen.queryByText("Loading your dashboard…")).not.toBeInTheDocument();
  });

  it("shows the forbidden callout, with no numbers and no retry, when the API answers 403", async () => {
    fetchBoard.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    renderDashboard();
    const callout = await screen.findByRole("alert");
    expect(callout).toHaveTextContent("You do not have access to this dashboard.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open Tickets/ })).not.toBeInTheDocument();
    expect(callout).not.toHaveTextContent("FORBIDDEN");
  });

  it("shows a safe failure callout with Try again for any other failure, and never the error itself", async () => {
    fetchBoard.mockRejectedValue(new TypeError("Failed to fetch: http://localhost:3000/api/dashboard/requester"));
    renderDashboard();
    const callout = await screen.findByRole("alert");
    expect(callout).toHaveTextContent("The dashboard could not be loaded.");
    expect(callout).not.toHaveTextContent(/localhost|Failed to fetch|TypeError/);
    expect(within(callout).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("loads again on Try again, and shows the numbers when that works", async () => {
    const user = userEvent.setup();
    fetchBoard.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "Something went wrong."));
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Open Tickets: 3. View all" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });

  it("offers Refresh, which asks again, is busy and disabled while it waits, and takes only one request", async () => {
    const user = userEvent.setup();
    await ready();
    const next = deferred<Board>();
    fetchBoard.mockReturnValue(next.promise);

    const refresh = screen.getByRole("button", { name: "Refresh" });
    await user.click(refresh);
    const busy = await screen.findByRole("button", { name: "Refreshing…" });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(fetchBoard).toHaveBeenCalledTimes(2);

    next.resolve(BOARD);
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("starts one request when Refresh is pressed twice in the same instant, before the button can disable itself", async () => {
    await ready();
    const next = deferred<Board>();
    fetchBoard.mockReturnValue(next.promise);
    const refresh = screen.getByRole("button", { name: "Refresh" });

    // Both clicks land before React has drawn the busy button, so only the screen's own guard
    // can stop the second.
    act(() => {
      refresh.click();
      refresh.click();
    });
    expect(fetchBoard).toHaveBeenCalledTimes(2);

    next.resolve(BOARD);
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("keeps the old numbers on screen while a refresh is in flight, then replaces them", async () => {
    const user = userEvent.setup();
    await ready();
    const next = deferred<Board>();
    fetchBoard.mockReturnValue(next.promise);
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    // Still the old board, and no skeleton in its place.
    expect(screen.getByRole("link", { name: "Open Tickets: 3. View all" })).toBeInTheDocument();
    expect(screen.queryByText("Loading your dashboard…")).not.toBeInTheDocument();

    next.resolve({ ...BOARD, metrics: { ...BOARD.metrics, openTickets: { value: 7, href: "/tickets?group=open" } } });
    expect(await screen.findByRole("link", { name: "Open Tickets: 7. View all" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Tickets: 3. View all" })).not.toBeInTheDocument();
  });

  it("keeps the old numbers and shows the failure above them when a refresh fails, and clears it when the next works", async () => {
    const user = userEvent.setup();
    await ready();
    fetchBoard.mockRejectedValueOnce(new TypeError("offline"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    const callout = await screen.findByRole("alert");
    expect(callout).toHaveTextContent("The dashboard could not be loaded.");
    expect(screen.getByRole("link", { name: "Open Tickets: 3. View all" })).toBeInTheDocument();
    // Above the numbers, not below them.
    const card = screen.getByRole("link", { name: "Open Tickets: 3. View all" });
    expect(callout.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fetchBoard.mockResolvedValue({ ...BOARD, metrics: { ...BOARD.metrics, closed: { value: 13, href: "/tickets?status=CLOSED" } } });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("link", { name: "Closed: 13. View all" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("keeps the old numbers when a refresh is refused, saying so, and does not show the 'no access' copy over a working page", async () => {
    const user = userEvent.setup();
    await ready();
    fetchBoard.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Tickets: 3. View all" })).toBeInTheDocument();
  });

  it("never shows the failure copy of an earlier load once a later load has worked", async () => {
    const user = userEvent.setup();
    fetchBoard.mockRejectedValueOnce(new TypeError("offline"));
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("link", { name: "Open Tickets: 3. View all" });
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  });
});
