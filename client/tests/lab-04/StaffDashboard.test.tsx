import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { StaffDashboard } from "../../src/screens/StaffDashboard.js";
import * as api from "../../src/api.js";
import { ApiError, type StaffDashboard as Board } from "../../src/api.js";

// Lab 4, Issue 8 — UI-22 to UI-26 in docs/lab-04/tests.md §2.8 (ui-spec §1.1, §3.2, §3.3, §3.5;
// specification.md FR-16, FR-17, FR-18, FR-20, BR-34 to BR-36, BR-38 to BR-40; AC-19 to AC-22).
//
// The seam is the screen as a person meets it, inside a router so a link can be followed. The
// API client is the system boundary, so it is the only thing mocked: the server decides every
// number and every row (BR-30), and these tests hand the screen a dashboard and check that it
// shows exactly that, links to where the contract says, and copes with every way the request can
// end. The Administrator's account counts are in the board or they are not; the screen has no
// idea which role is calling, only whether the server sent them.

const ME = 7;
const LONG_CUT = "Replaced the toner cartridge and ran a test page, then checked the paper tray, the fuser, and the rollers one after another. Replaced the toner cartr…";

const BOARD: Board = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    unassigned: { value: 2, href: "/queue?owner=unassigned&group=open" },
    assignedToMe: { value: 4, href: "/queue?owner=me&group=open" },
    waitingForRequester: { value: 3, href: "/queue?status=WAITING_FOR_REQUESTER" },
    urgent: { value: 5, href: "/queue?itPriority=URGENT&group=open" },
  },
  byStatus: [
    { status: "NEW", value: 11, href: "/queue?status=NEW" },
    { status: "OPEN", value: 12, href: "/queue?status=OPEN" },
    { status: "IN_PROGRESS", value: 13, href: "/queue?status=IN_PROGRESS" },
    { status: "WAITING_FOR_REQUESTER", value: 3, href: "/queue?status=WAITING_FOR_REQUESTER" },
    { status: "REOPENED", value: 0, href: "/queue?status=REOPENED" },
  ],
  myTickets: [
    { id: 12, ticketNumber: "TT-2026-00042", summary: "Printer on floor 3 will not print", currentStatus: "IN_PROGRESS", updatedAt: "2026-10-05T03:12:00.000Z", itPriority: "HIGH", owner: { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true } },
    { id: 14, ticketNumber: "TT-2026-00044", summary: "Cannot join the campus VPN", currentStatus: "OPEN", updatedAt: "2026-10-04T08:00:00.000Z", itPriority: "MEDIUM", owner: { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true } },
  ],
  urgentTickets: [
    { id: 20, ticketNumber: "TT-2026-00050", summary: "Grade upload rejects the whole file", currentStatus: "WAITING_FOR_REQUESTER", updatedAt: "2026-10-03T04:00:00.000Z", itPriority: "URGENT", owner: { id: 8, fullName: "Siriporn Kaewmanee", role: "IT_STAFF", isActive: true } },
    { id: 21, ticketNumber: "TT-2026-00051", summary: "Exam server is down", currentStatus: "NEW", updatedAt: "2026-10-04T04:00:00.000Z", itPriority: "URGENT", owner: null },
    { id: 22, ticketNumber: "TT-2026-00052", summary: "Library gate is stuck", currentStatus: "IN_PROGRESS", updatedAt: "2026-10-04T05:00:00.000Z", itPriority: "URGENT", owner: { id: 10, fullName: "Prasert Chaiyo", role: "IT_STAFF", isActive: false } },
  ],
  myRecentActions: [
    { id: 31, ticketId: 12, ticketNumber: "TT-2026-00042", actionAt: "2026-10-05T03:10:00.000Z", description: "Replaced the toner cartridge and ran a test page.", followUpRequired: true },
    { id: 30, ticketId: 14, ticketNumber: "TT-2026-00044", actionAt: "2026-10-04T07:30:00.000Z", description: LONG_CUT, followUpRequired: false },
  ],
};

const ADMIN_BOARD: Board = {
  ...BOARD,
  userCounts: { activeRequesters: { value: 6 }, activeItStaff: { value: 4 }, activeAdministrators: { value: 2 }, inactive: { value: 3 } },
};

const EMPTY: Board = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    unassigned: { value: 0, href: "/queue?owner=unassigned&group=open" },
    assignedToMe: { value: 0, href: "/queue?owner=me&group=open" },
    waitingForRequester: { value: 0, href: "/queue?status=WAITING_FOR_REQUESTER" },
    urgent: { value: 0, href: "/queue?itPriority=URGENT&group=open" },
  },
  byStatus: BOARD.byStatus.map((row) => ({ ...row, value: 0 })),
  myTickets: [],
  urgentTickets: [],
  myRecentActions: [],
};

let fetchBoard: MockInstance<typeof api.fetchStaffDashboard>;

beforeEach(() => {
  fetchBoard = vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(BOARD);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Where a followed link landed, so a destination is a thing the test can read. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderDashboard(fullName = "Nattapong Saelim") {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<StaffDashboard fullName={fullName} currentUserId={ME} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function ready(fullName?: string) {
  const view = renderDashboard(fullName);
  await screen.findByRole("link", { name: /^Unassigned: / });
  return view;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
}

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("UI-22 the four staff cards and the status row (AC-19, AC-21, FR-16, ui-spec §1.1, §3.2)", () => {
  it("greets the member by first name, with 'back', as the one page heading", async () => {
    await ready("Nattapong Saelim");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back, Nattapong");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("shows Unassigned, Assigned to Me, Waiting for Requester, and Urgent, in that order, each with its value", async () => {
    await ready();
    const cards = region("Your queue at a glance").getAllByRole("link");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Unassigned: 2. View all",
      "Assigned to Me: 4. View all",
      "Waiting for Requester: 3. View all",
      "Urgent: 5. View all",
    ]);
    const urgent = region("Your queue at a glance").getByRole("link", { name: "Urgent: 5. View all" });
    expect(within(urgent).getByText("Urgent")).toBeInTheDocument();
    expect(within(urgent).getByText("5")).toBeInTheDocument();
  });

  it("makes each card one link to the API's own href", async () => {
    await ready();
    const cards = region("Your queue at a glance");
    for (const [name, href] of [
      ["Unassigned: 2. View all", "/queue?owner=unassigned&group=open"],
      ["Assigned to Me: 4. View all", "/queue?owner=me&group=open"],
      ["Waiting for Requester: 3. View all", "/queue?status=WAITING_FOR_REQUESTER"],
      ["Urgent: 5. View all", "/queue?itPriority=URGENT&group=open"],
    ]) {
      const card = cards.getByRole("link", { name });
      expect(card.tagName).toBe("A");
      expect(card).toHaveAttribute("href", href);
    }
  });

  it("follows an href the API gives, not one the screen made up", async () => {
    fetchBoard.mockResolvedValue({ ...BOARD, metrics: { ...BOARD.metrics, urgent: { value: 5, href: "/queue?itPriority=URGENT&group=open&elsewhere=1" } } });
    await ready();
    expect(region("Your queue at a glance").getByRole("link", { name: "Urgent: 5. View all" })).toHaveAttribute("href", "/queue?itPriority=URGENT&group=open&elsewhere=1");
  });

  it("shows the five open statuses in order, each a link with its status badge and its count", async () => {
    await ready();
    const row = region("By status");
    const links = row.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "New: 11. View all",
      "Open: 12. View all",
      "In Progress: 13. View all",
      "Waiting for Requester: 3. View all",
      "Reopened: 0. View all",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/queue?status=NEW",
      "/queue?status=OPEN",
      "/queue?status=IN_PROGRESS",
      "/queue?status=WAITING_FOR_REQUESTER",
      "/queue?status=REOPENED",
    ]);
    expect(within(links[2]).getByText("In Progress")).toHaveAttribute("data-badge");
    expect(within(links[2]).getByText("13")).toBeInTheDocument();
  });

  it("draws a status with no Tickets as 0, never a blank, and keeps its link", async () => {
    await ready();
    const reopened = region("By status").getByRole("link", { name: "Reopened: 0. View all" });
    expect(within(reopened).getByText("0")).toBeInTheDocument();
  });

  it("has no Resolved, Closed, or Cancelled row: the row is the open group", async () => {
    await ready();
    const text = region("By status").getAllByRole("link").map((l) => l.getAttribute("aria-label")).join(" ");
    expect(text).not.toMatch(/Resolved|Closed|Cancelled/);
  });

  it.each([
    ["Unassigned card", "Your queue at a glance", "Unassigned: 2. View all", "/queue?owner=unassigned&group=open"],
    ["Assigned to Me card", "Your queue at a glance", "Assigned to Me: 4. View all", "/queue?owner=me&group=open"],
    ["Waiting for Requester card", "Your queue at a glance", "Waiting for Requester: 3. View all", "/queue?status=WAITING_FOR_REQUESTER"],
    ["Urgent card", "Your queue at a glance", "Urgent: 5. View all", "/queue?itPriority=URGENT&group=open"],
    ["New row", "By status", "New: 11. View all", "/queue?status=NEW"],
    ["Open row", "By status", "Open: 12. View all", "/queue?status=OPEN"],
    ["In Progress row", "By status", "In Progress: 13. View all", "/queue?status=IN_PROGRESS"],
    ["Waiting row", "By status", "Waiting for Requester: 3. View all", "/queue?status=WAITING_FOR_REQUESTER"],
    ["Reopened row", "By status", "Reopened: 0. View all", "/queue?status=REOPENED"],
  ])("opens the Ticket Queue exactly as the API said when the %s is followed", async (_name, regionName, linkName, href) => {
    const user = userEvent.setup();
    await ready();
    await user.click(region(regionName).getByRole("link", { name: linkName }));
    expect(await screen.findByTestId("where")).toHaveTextContent(href);
    expect(screen.getByTestId("where").textContent).toBe(href);
  });

  it("opens a card from the keyboard: it takes focus and Enter follows it", async () => {
    const user = userEvent.setup();
    await ready();
    region("Your queue at a glance").getByRole("link", { name: "Assigned to Me: 4. View all" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("where")).toHaveTextContent("/queue?owner=me&group=open");
  });

  it("reaches the four cards by Tab, in reading order", async () => {
    const user = userEvent.setup();
    await ready();
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      const label = document.activeElement?.getAttribute("aria-label");
      if (label) seen.push(label);
    }
    expect(seen.slice(0, 4)).toEqual(["Unassigned: 2. View all", "Assigned to Me: 4. View all", "Waiting for Requester: 3. View all", "Urgent: 5. View all"]);
  });

  it("asks for the dashboard once on arrival, and never for the whole queue", async () => {
    const queue = vi.spyOn(api, "fetchQueue");
    await ready();
    expect(fetchBoard).toHaveBeenCalledTimes(1);
    expect(queue).not.toHaveBeenCalled();
  });
});

describe("UI-23 the three staff lists (AC-19, FR-16, ui-spec §3.2)", () => {
  it("shows each Ticket row with its number, summary, status, IT Priority, owner, and date", async () => {
    await ready();
    const row = region("My Tickets").getByRole("link", { name: /TT-2026-00042/ });
    expect(within(row).getByText("TT-2026-00042")).toBeInTheDocument();
    expect(within(row).getByText("Printer on floor 3 will not print")).toBeInTheDocument();
    expect(within(row).getByText("In Progress")).toHaveAttribute("data-badge");
    expect(within(row).getByText("HIGH")).toHaveAttribute("data-badge");
    const time = row.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-05T03:12:00.000Z");
    expect(time.textContent).not.toBe("");
  });

  it("opens the Ticket's staff detail when a row of either Ticket list is followed", async () => {
    const user = userEvent.setup();
    await ready();
    const mine = region("My Tickets").getByRole("link", { name: /TT-2026-00042/ });
    expect(mine).toHaveAttribute("href", "/queue/12");
    expect(region("Urgent Tickets").getByRole("link", { name: /TT-2026-00050/ })).toHaveAttribute("href", "/queue/20");
    await user.click(mine);
    expect(await screen.findByTestId("where")).toHaveTextContent("/queue/12");
  });

  it("says who owns a Ticket as the Queue does: 'You' for the member, a name, Unassigned in words, and Inactive for a closed account", async () => {
    await ready();
    const mine = region("My Tickets").getByRole("link", { name: /TT-2026-00042/ });
    expect(within(mine).getByText("Nattapong Saelim")).toBeInTheDocument();
    expect(within(mine).getByText("You")).toHaveAttribute("data-badge", "owner-you");

    const urgent = region("Urgent Tickets");
    const theirs = urgent.getByRole("link", { name: /TT-2026-00050/ });
    expect(within(theirs).getByText("Siriporn Kaewmanee")).toBeInTheDocument();
    expect(within(theirs).queryByText("You")).not.toBeInTheDocument();
    expect(within(urgent.getByRole("link", { name: /TT-2026-00051/ })).getByText("Unassigned")).toBeInTheDocument();
    const gone = urgent.getByRole("link", { name: /TT-2026-00052/ });
    expect(within(gone).getByText("Prasert Chaiyo")).toBeInTheDocument();
    expect(within(gone).getByText("Inactive")).toHaveAttribute("data-badge", "owner-inactive");
  });

  it("shows the Urgent Tickets in the order the API gave, which is oldest first", async () => {
    await ready();
    const rows = region("Urgent Tickets").getAllByRole("link", { name: /^TT-/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("TT-2026-00050"),
      expect.stringContaining("TT-2026-00051"),
      expect.stringContaining("TT-2026-00052"),
    ]);
  });

  it("keeps the whole Summary in the title and leaves the cutting to the stylesheet", async () => {
    const long = "A very long summary that no single line of a dashboard row could ever hold, however wide the screen is";
    fetchBoard.mockResolvedValue({ ...BOARD, myTickets: [{ ...BOARD.myTickets[0], summary: long }] });
    await ready();
    expect(region("My Tickets").getByText(long)).toHaveAttribute("title", long);
  });

  it("offers View all beside each Ticket list, with the filter the API gave its card", async () => {
    const user = userEvent.setup();
    await ready();
    expect(region("My Tickets").getByRole("link", { name: /^View all/ })).toHaveAttribute("href", "/queue?owner=me&group=open");
    expect(region("Urgent Tickets").getByRole("link", { name: /^View all/ })).toHaveAttribute("href", "/queue?itPriority=URGENT&group=open");
    await user.click(region("Urgent Tickets").getByRole("link", { name: /^View all/ }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/queue?itPriority=URGENT&group=open");
  });

  it("shows each recent action with its Ticket's number, its date and time, its description, and a follow-up pill that says it in words", async () => {
    await ready();
    const actions = region("My Recent Actions");
    const first = actions.getByRole("link", { name: /TT-2026-00042/ });
    expect(first).toHaveAttribute("href", "/queue/12");
    expect(within(first).getByText("TT-2026-00042")).toBeInTheDocument();
    expect(within(first).getByText("Replaced the toner cartridge and ran a test page.")).toBeInTheDocument();
    expect(within(first).getByText("Follow-up needed")).toHaveAttribute("data-badge", "follow-up");
    const time = first.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-10-05T03:10:00.000Z");
    expect(within(actions.getByRole("link", { name: /TT-2026-00044/ })).getByText("No follow-up")).toHaveAttribute("data-badge", "follow-up");
  });

  it("shows a description as the API cut it, with its ellipsis, and does not cut it a second time", async () => {
    await ready();
    expect(region("My Recent Actions").getByText(LONG_CUT)).toBeInTheDocument();
  });

  it("opens the Ticket when an action row is followed", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(region("My Recent Actions").getByRole("link", { name: /TT-2026-00044/ }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/queue/14");
  });

  it("shows the date and the time on a Ticket row and an action row, in the browser's time zone", async () => {
    await ready();
    const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const row = region("My Tickets").getByRole("link", { name: /TT-2026-00042/ }).querySelector("time")!;
    expect(row.textContent).toContain(time("2026-10-05T03:12:00.000Z"));
    const action = region("My Recent Actions").getByRole("link", { name: /TT-2026-00042/ }).querySelector("time")!;
    expect(action.textContent).toContain(time("2026-10-05T03:10:00.000Z"));
  });
});

describe("UI-24 the Administrator's account counts, and IT Staff's lack of them (AC-20, FR-17, BR-38, BR-40, ui-spec §3.3)", () => {
  beforeEach(() => {
    fetchBoard.mockResolvedValue(ADMIN_BOARD);
  });

  it("shows the four counts as plain numbers: Requesters, IT Staff, Administrators, and Inactive", async () => {
    await ready();
    const accounts = region("Accounts");
    for (const [label, value] of [["Requesters", "6"], ["IT Staff", "4"], ["Administrators", "2"], ["Inactive", "3"]]) {
      const count = accounts.getByText(label).closest(".tt-metric")!;
      expect(count, label).not.toBeNull();
      expect(count.tagName, label).toBe("DIV");
      expect(within(count as HTMLElement).getByText(value), label).toBeInTheDocument();
    }
  });

  it("makes none of the four a link, and gives them no View all, because no list could match an active count", async () => {
    await ready();
    const accounts = region("Accounts");
    expect(accounts.queryByText(/View all/)).not.toBeInTheDocument();
    for (const count of document.querySelectorAll("[aria-label='Accounts'] .tt-metric, .tt-accounts .tt-metric")) expect(count.closest("a")).toBeNull();
  });

  it("says what the numbers are: active accounts by role, and inactive accounts counted separately", async () => {
    await ready();
    expect(region("Accounts").getByText("Active accounts by role, and inactive accounts counted separately.")).toBeInTheDocument();
  });

  it("offers one ordinary link, Open User Management, which opens /users with no filter", async () => {
    const user = userEvent.setup();
    await ready();
    const links = region("Accounts").getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Open User Management →"]);
    expect(links[0]).toHaveAttribute("href", "/users");
    await user.click(links[0]);
    expect(await screen.findByTestId("where")).toHaveTextContent(/^\/users$/);
  });

  it("puts the accounts after By status and before the lists", async () => {
    await ready();
    const order = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
    expect(order.indexOf("Accounts")).toBeGreaterThan(order.indexOf("By status"));
    expect(order.indexOf("Accounts")).toBeLessThan(order.indexOf("My Tickets"));
  });

  it("shows 0 for an account count of 0, never a blank", async () => {
    fetchBoard.mockResolvedValue({ ...ADMIN_BOARD, userCounts: { ...ADMIN_BOARD.userCounts!, inactive: { value: 0 } } });
    await ready();
    expect(within(region("Accounts").getByText("Inactive").closest(".tt-metric") as HTMLElement).getByText("0")).toBeInTheDocument();
  });

  it("shows IT Staff no accounts region and no link to User Management, because the server sent them no counts", async () => {
    fetchBoard.mockResolvedValue(BOARD);
    await ready();
    expect(screen.queryByRole("region", { name: "Accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /User Management/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Active accounts/)).not.toBeInTheDocument();
  });

  it("is otherwise the same screen for an Administrator as for IT Staff: the same cards, lists, and quick actions", async () => {
    await ready();
    expect(region("Your queue at a glance").getAllByRole("link")).toHaveLength(4);
    expect(region("Quick actions").getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "My Tickets" })).toBeInTheDocument();
  });
});

describe("UI-25 loading, zero data, forbidden, failure, and Refresh (AC-22, FR-20, ui-spec §3.5)", () => {
  it("shows skeletons shaped like the cards, the status row, and the lists while it loads, and no number", async () => {
    const pending = deferred<Board>();
    fetchBoard.mockReturnValue(pending.promise);
    renderDashboard();
    expect(await screen.findByText("Loading your dashboard…")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-state="loading"] .tt-skeleton').length).toBeGreaterThanOrEqual(8);
    expect(screen.queryByRole("link", { name: /^Unassigned/ })).not.toBeInTheDocument();
    pending.resolve(BOARD);
    expect(await screen.findByRole("link", { name: "Unassigned: 2. View all" })).toBeInTheDocument();
    expect(screen.queryByText("Loading your dashboard…")).not.toBeInTheDocument();
  });

  describe("a member with no work", () => {
    beforeEach(() => {
      fetchBoard.mockResolvedValue(EMPTY);
    });

    it("keeps the four cards and the status row, every one 0 and every one a link", async () => {
      await ready();
      for (const label of ["Unassigned", "Assigned to Me", "Waiting for Requester", "Urgent"]) {
        const card = region("Your queue at a glance").getByRole("link", { name: `${label}: 0. View all` });
        expect(within(card).getByText("0")).toBeInTheDocument();
      }
      expect(region("By status").getAllByRole("link")).toHaveLength(5);
      for (const link of region("By status").getAllByRole("link")) expect(link).toHaveAttribute("href");
    });

    it("says why each list is empty, in the specification's words, and keeps all three on the page", async () => {
      await ready();
      expect(region("My Tickets").getByText("No tickets are assigned to you.")).toBeInTheDocument();
      expect(region("Urgent Tickets").getByText("No urgent tickets right now.")).toBeInTheDocument();
      expect(region("My Recent Actions").getByText("You have not recorded any actions yet.")).toBeInTheDocument();
      expect(region("My Tickets").queryByRole("list")).not.toBeInTheDocument();
    });

    it("keeps the quick actions, and is a valid dashboard and not an error: no alert, no failure copy", async () => {
      await ready();
      expect(region("Quick actions").getAllByRole("link")).toHaveLength(3);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText(/could not be loaded|Something went wrong/)).not.toBeInTheDocument();
    });
  });

  it("shows the forbidden callout, with no numbers and no retry, when the API answers 403", async () => {
    fetchBoard.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    renderDashboard();
    const callout = await screen.findByRole("alert");
    expect(callout).toHaveTextContent("You do not have access to this dashboard.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Unassigned/ })).not.toBeInTheDocument();
    expect(callout).not.toHaveTextContent("FORBIDDEN");
  });

  it("shows a safe failure callout with Try again for any other failure, and never the error itself", async () => {
    fetchBoard.mockRejectedValue(new TypeError("Failed to fetch: http://localhost:3000/api/staff/dashboard"));
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
    expect(await screen.findByRole("link", { name: "Unassigned: 2. View all" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });

  it("offers Refresh, which is busy and disabled while it waits, and takes one request even when pressed twice at once", async () => {
    const user = userEvent.setup();
    await ready();
    const next = deferred<Board>();
    fetchBoard.mockReturnValue(next.promise);
    const refresh = screen.getByRole("button", { name: "Refresh" });
    act(() => {
      refresh.click();
      refresh.click();
    });
    expect(fetchBoard).toHaveBeenCalledTimes(2);
    const busy = await screen.findByRole("button", { name: "Refreshing…" });
    expect(busy).toBeDisabled();
    await user.click(busy);
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
    expect(screen.getByRole("link", { name: "Unassigned: 2. View all" })).toBeInTheDocument();
    expect(screen.queryByText("Loading your dashboard…")).not.toBeInTheDocument();
    next.resolve({ ...BOARD, metrics: { ...BOARD.metrics, unassigned: { value: 9, href: "/queue?owner=unassigned&group=open" } } });
    expect(await screen.findByRole("link", { name: "Unassigned: 9. View all" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unassigned: 2. View all" })).not.toBeInTheDocument();
  });

  it("keeps the old numbers and shows the failure above them when a refresh fails, and clears it when the next works", async () => {
    const user = userEvent.setup();
    await ready();
    fetchBoard.mockRejectedValueOnce(new TypeError("offline"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    const callout = await screen.findByRole("alert");
    expect(callout).toHaveTextContent("The dashboard could not be loaded.");
    const card = screen.getByRole("link", { name: "Unassigned: 2. View all" });
    expect(callout.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fetchBoard.mockResolvedValue({ ...BOARD, metrics: { ...BOARD.metrics, urgent: { value: 8, href: "/queue?itPriority=URGENT&group=open" } } });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("link", { name: "Urgent: 8. View all" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("adds an Administrator's counts on a refresh that has them, and takes them away on one that has not", async () => {
    const user = userEvent.setup();
    await ready();
    expect(screen.queryByRole("region", { name: "Accounts" })).not.toBeInTheDocument();
    fetchBoard.mockResolvedValue(ADMIN_BOARD);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("region", { name: "Accounts" })).toBeInTheDocument();
    fetchBoard.mockResolvedValue(BOARD);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Accounts" })).not.toBeInTheDocument());
  });
});

describe("UI-26 the quick actions are only what a member can do (D-11, ui-spec §3.2, §3.4)", () => {
  it("offers Open Ticket Queue, Unassigned Tickets, and My Queue, in that order, and nothing else", async () => {
    await ready();
    const links = region("Quick actions").getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Open Ticket Queue", "Unassigned Tickets", "My Queue"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/queue", "/queue?owner=unassigned&group=open", "/queue?owner=me&group=open"]);
  });

  it("opens the filtered queues the cards open, from the same hrefs the API gave", async () => {
    fetchBoard.mockResolvedValue({
      ...BOARD,
      metrics: {
        ...BOARD.metrics,
        unassigned: { value: 2, href: "/queue?owner=unassigned&group=open&sentinel=a" },
        assignedToMe: { value: 4, href: "/queue?owner=me&group=open&sentinel=b" },
      },
    });
    await ready();
    const actions = region("Quick actions");
    expect(actions.getByRole("link", { name: "Unassigned Tickets" })).toHaveAttribute("href", "/queue?owner=unassigned&group=open&sentinel=a");
    expect(actions.getByRole("link", { name: "My Queue" })).toHaveAttribute("href", "/queue?owner=me&group=open&sentinel=b");
  });

  it("has no Create Ticket shortcut, no Profile, and no 'from yesterday' line", async () => {
    fetchBoard.mockResolvedValue(ADMIN_BOARD);
    await ready();
    expect(screen.queryByRole("link", { name: /Create Ticket/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create Ticket/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/yesterday|last week|since/i)).not.toBeInTheDocument();
  });

  it("styles Open Ticket Queue as the primary action and the other two as secondary", async () => {
    await ready();
    const actions = region("Quick actions");
    expect(actions.getByRole("link", { name: "Open Ticket Queue" })).toHaveClass("tt-btn--primary");
    expect(actions.getByRole("link", { name: "Unassigned Tickets" })).toHaveClass("tt-btn--secondary");
    expect(actions.getByRole("link", { name: "My Queue" })).toHaveClass("tt-btn--secondary");
  });

  it("opens the Ticket Queue when its button is followed", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(region("Quick actions").getByRole("link", { name: "Open Ticket Queue" }));
    expect(await screen.findByTestId("where")).toHaveTextContent(/^\/queue$/);
  });
});
