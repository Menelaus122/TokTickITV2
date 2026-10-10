import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { MyTickets, MyTicketsWithUrl } from "../../src/screens/MyTickets.js";
import { parseTicketListUrl, toTicketListUrl, DEFAULT_LIST_STATE } from "../../src/ticketListUrl.js";
import { StaffTicketQueue, StaffTicketQueueWithUrl } from "../../src/screens/StaffTicketQueue.js";
import { parseQueueUrl, toQueueUrl, DEFAULT_QUEUE_STATE } from "../../src/queueUrl.js";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import * as api from "../../src/api.js";
import type { AuthUser, QueueResponse, QueueTicket, TicketListItem, TicketListResponse } from "../../src/api.js";

// Lab 4, Issue 7 — UI-29 in docs/lab-04/tests.md §2.8 (ui-spec §7; specification.md FR-21,
// D-12; AC-21): My Tickets reads its filters from the URL on load and writes them back as
// the person changes them, so a dashboard link, a reload, and a bookmark all show the same
// list. The Ticket Queue's half arrives with Issue 8.
//
// The seam is the screen as the route mounts it, inside a router, with the URL on show. The
// API client is the system boundary, so it is the only thing mocked, and what each test
// reads is the request the screen made.

function ticket(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 1,
    ticketNumber: "TT-2026-00041",
    ticketDate: "2026-08-20T09:00:00.000Z",
    summary: "VPN drops every few minutes",
    requestedPriority: "HIGH",
    currentStatus: "WAITING_FOR_REQUESTER",
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 3, name: "VPN" },
    activeAttachmentCount: 0,
    updatedAt: "2026-08-21T10:00:00.000Z",
    ...overrides,
  };
}

function page(data: TicketListItem[], meta: Partial<TicketListResponse["meta"]> = {}): TicketListResponse {
  return {
    data,
    meta: { page: 1, pageSize: 10, totalItems: data.length, totalPages: Math.ceil(data.length / 10), hasPrev: false, hasNext: false, ...meta },
  };
}

let fetchList: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchList = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(page([ticket()])) as unknown as ReturnType<typeof vi.fn>;
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 4, name: "Network" }]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 3, name: "VPN" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** What a person could read in the address bar, and a way to change it as the browser's Back button does. */
function UrlProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="url">{location.pathname + location.search}</p>
      <button type="button" onClick={() => navigate("/tickets?status=CLOSED")}>
        Pretend Back
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Go back
      </button>
    </>
  );
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MyTicketsWithUrl />
      <UrlProbe />
    </MemoryRouter>,
  );
}

const url = () => screen.getByTestId("url").textContent;
const lastRequest = () => fetchList.mock.calls.at(-1)![0] as Record<string, unknown>;
const firstRequest = () => fetchList.mock.calls[0][0] as Record<string, unknown>;
const settled = () => screen.findByLabelText("Search tickets");

describe("UI-29 the filters are read from the URL on load (AC-21, FR-21, D-12)", () => {
  it("asks for the group and the status together, on the very first request, not after an unfiltered one", async () => {
    renderAt("/tickets?group=open&status=WAITING_FOR_REQUESTER");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ group: "open", currentStatus: "WAITING_FOR_REQUESTER" });
    expect(fetchList.mock.calls.every(([p]) => (p as Record<string, unknown>).group === "open")).toBe(true);
  });

  it("shows the status in its own control, so the list says what it is filtered by", async () => {
    renderAt("/tickets?status=RESOLVED");
    expect(await screen.findByLabelText("Filter by Current Status")).toHaveValue("RESOLVED");
  });

  it("reads every other filter the screen has: search, category, system, priority, sort, page, and page size", async () => {
    renderAt("/tickets?search=vpn&categoryId=4&relatedSystemId=3&requestedPriority=HIGH&sortBy=updatedAt&sortDir=asc&page=2&pageSize=20");
    expect(await settled()).toHaveValue("vpn");
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({
      search: "vpn",
      categoryId: 4,
      relatedSystemId: 3,
      requestedPriority: "HIGH",
      sortBy: "updatedAt",
      sortDir: "asc",
      page: 2,
      pageSize: 20,
    });
    expect(screen.getByLabelText("Filter by Requested Priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Sort tickets")).toHaveValue("updatedAt:asc");
  });

  it("asks for nothing the URL did not say: no group, no status, the Lab 2 defaults", async () => {
    renderAt("/tickets");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    const request = firstRequest();
    expect(request.group).toBeUndefined();
    expect(request.currentStatus).toBeUndefined();
    expect(request).toMatchObject({ sortBy: "createdAt", sortDir: "desc", page: 1, pageSize: 10 });
  });
});

describe("UI-29 the group shows as a chip, which Clear Filters and its own cross remove (ui-spec §7)", () => {
  it("shows 'Open tickets' as a chip next to the other filters when the group is open", async () => {
    renderAt("/tickets?group=open");
    expect(await screen.findByText("Open tickets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove the Open tickets filter" })).toBeInTheDocument();
  });

  it("shows no chip when there is no group", async () => {
    renderAt("/tickets?status=CLOSED");
    await settled();
    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
  });

  it("removes the group, and only the group, from its own cross, and writes that to the URL", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?group=open&status=WAITING_FOR_REQUESTER");
    await user.click(await screen.findByRole("button", { name: "Remove the Open tickets filter" }));

    await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
    expect(url()).toBe("/tickets?status=WAITING_FOR_REQUESTER");
    await waitFor(() => expect(lastRequest().group).toBeUndefined());
    expect(lastRequest().currentStatus).toBe("WAITING_FOR_REQUESTER");
  });

  it("is removed by Clear Filters along with every other filter, and the URL is the plain page again", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?group=open&status=WAITING_FOR_REQUESTER&requestedPriority=HIGH");
    await user.click(await screen.findByRole("button", { name: "Clear Filters" }));

    await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
    expect(url()).toBe("/tickets");
    await waitFor(() => {
      expect(lastRequest().group).toBeUndefined();
      expect(lastRequest().currentStatus).toBeUndefined();
      expect(lastRequest().requestedPriority).toBeUndefined();
    });
    expect(screen.getByLabelText("Filter by Current Status")).toHaveValue("");
  });

  it("offers Clear Filters for the group alone, since it narrows the list", async () => {
    renderAt("/tickets?group=open");
    expect(await screen.findByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
  });

  it("calls a list that the group left empty 'no tickets match', not 'you have no tickets yet'", async () => {
    fetchList.mockResolvedValue(page([]));
    renderAt("/tickets?group=open");
    expect(await screen.findByText("No tickets match your filters.")).toBeInTheDocument();
    expect(screen.queryByText("You have no tickets yet.")).not.toBeInTheDocument();
  });
});

describe("UI-29 a change is written back to the URL, so a reload shows the same list (FR-21)", () => {
  it("writes a chosen status, and keeps the group beside it", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?group=open");
    await user.selectOptions(await screen.findByLabelText("Filter by Current Status"), "WAITING_FOR_REQUESTER");

    await waitFor(() => expect(url()).toBe("/tickets?group=open&status=WAITING_FOR_REQUESTER"));
    await waitFor(() => expect(lastRequest()).toMatchObject({ group: "open", currentStatus: "WAITING_FOR_REQUESTER" }));
  });

  it("writes priority, category, system, sort, and page size when they change, and leaves the default out", async () => {
    const user = userEvent.setup();
    renderAt("/tickets");
    await user.selectOptions(await screen.findByLabelText("Filter by Requested Priority"), "URGENT");
    await waitFor(() => expect(url()).toBe("/tickets?requestedPriority=URGENT"));
    await user.selectOptions(screen.getByLabelText("Sort tickets"), "updatedAt:desc");
    await waitFor(() => expect(url()).toContain("sortBy=updatedAt"));
    expect(url()).not.toContain("sortDir");
    await user.selectOptions(screen.getByLabelText("Filter by Category"), "4");
    await waitFor(() => expect(url()).toContain("categoryId=4"));
  });

  it("goes back to the first page when a filter changes, and says so in the URL by having no page", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?page=3&pageSize=10");
    await user.selectOptions(await screen.findByLabelText("Filter by Current Status"), "CLOSED");
    await waitFor(() => expect(url()).toBe("/tickets?status=CLOSED"));
    await waitFor(() => expect(lastRequest().page).toBe(1));
  });

  it("writes the page when the person pages on, and a fresh load of that URL shows that page", async () => {
    const user = userEvent.setup();
    fetchList.mockResolvedValue(page([ticket()], { totalItems: 25, totalPages: 3, hasNext: true }));
    const first = renderAt("/tickets?group=open");
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(url()).toBe("/tickets?group=open&page=2"));
    first.unmount();

    fetchList.mockClear();
    renderAt("/tickets?group=open&page=2");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ group: "open", page: 2 });
  });

  it("writes a search term once the person has stopped typing, not on every key, and asks for it", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?status=CLOSED");
    const box = await screen.findByLabelText("Search tickets");
    await user.type(box, "vpn");

    expect(url()).toBe("/tickets?status=CLOSED");
    await waitFor(() => expect(url()).toBe("/tickets?status=CLOSED&search=vpn"), { timeout: 1500 });
    await waitFor(() => expect(lastRequest()).toMatchObject({ search: "vpn", currentStatus: "CLOSED", page: 1 }));
    expect(fetchList.mock.calls.filter(([p]) => (p as Record<string, unknown>).search === "v")).toHaveLength(0);
  });

  it("does not undo a filter chosen while a search is still being typed, when the search is written", async () => {
    const user = userEvent.setup();
    renderAt("/tickets");
    const box = await screen.findByLabelText("Search tickets");
    await user.type(box, "vpn");
    await user.selectOptions(screen.getByLabelText("Filter by Current Status"), "CLOSED");

    await waitFor(() => expect(url()).toBe("/tickets?status=CLOSED&search=vpn"), { timeout: 1500 });
    expect(box).toHaveValue("vpn");
    await waitFor(() => expect(lastRequest()).toMatchObject({ search: "vpn", currentStatus: "CLOSED" }));
  });

  it("does not lose what the person types after a debounced write lands in the middle of their typing", async () => {
    const user = userEvent.setup({ delay: 120 });
    renderAt("/tickets");
    const box = await screen.findByLabelText("Search tickets");
    // Slower than the debounce between some keys and faster between others.
    await user.type(box, "pri");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await user.type(box, "nter");
    expect(box).toHaveValue("printer");
    await waitFor(() => expect(url()).toBe("/tickets?search=printer"), { timeout: 2000 });
    expect(box).toHaveValue("printer");
  });

  it("uses the history entry it is on, so Back leaves the page instead of stepping back through each filter", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dashboard", "/tickets"]} initialIndex={1}>
        <MyTicketsWithUrl />
        <UrlProbe />
      </MemoryRouter>,
    );
    await user.selectOptions(await screen.findByLabelText("Filter by Current Status"), "CLOSED");
    await user.selectOptions(screen.getByLabelText("Filter by Requested Priority"), "HIGH");
    await waitFor(() => expect(url()).toBe("/tickets?status=CLOSED&requestedPriority=HIGH"));

    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(url()).toBe("/dashboard");
  });

  it("keeps what the person typed when the address catches up a moment after the write", async () => {
    // The address changes 200 ms after the write is asked for, so the person has typed on by then.
    const user = userEvent.setup();
    const asked = vi.fn();
    function Slow() {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <MyTickets
          query={location.search}
          onQueryChange={(query) => {
            asked(query);
            setTimeout(() => navigate({ pathname: "/tickets", search: query ? `?${query}` : "" }, { replace: true }), 200);
          }}
        />
      );
    }
    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <Slow />
        <UrlProbe />
      </MemoryRouter>,
    );
    const box = await screen.findByLabelText("Search tickets");
    await user.type(box, "pri");
    await waitFor(() => expect(asked).toHaveBeenCalledWith("search=pri"), { timeout: 1500 });
    await user.type(box, "n");
    await waitFor(() => expect(url()).toBe("/tickets?search=pri"), { timeout: 1500 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(box).toHaveValue("prin");
  });
});

describe("UI-29 a URL the screen does not understand never breaks it (ui-spec §7)", () => {
  it("ignores a parameter it does not know, and does not send it on", async () => {
    renderAt("/tickets?nothing=at-all&status=CLOSED&utm_source=email");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ currentStatus: "CLOSED" });
    expect(Object.keys(firstRequest())).not.toContain("nothing");
    expect(Object.keys(firstRequest())).not.toContain("utm_source");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops an unrecognised value to the default, and the control shows the default", async () => {
    renderAt("/tickets?status=BOGUS&group=everything&requestedPriority=EXTREME&categoryId=abc&relatedSystemId=-3&sortBy=title&sortDir=sideways&page=0&pageSize=7");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    const request = firstRequest();
    expect(request.currentStatus).toBeUndefined();
    expect(request.group).toBeUndefined();
    expect(request.requestedPriority).toBeUndefined();
    expect(request.categoryId).toBeUndefined();
    expect(request.relatedSystemId).toBeUndefined();
    expect(request).toMatchObject({ sortBy: "createdAt", sortDir: "desc", page: 1, pageSize: 10 });
    expect(screen.getByLabelText("Filter by Current Status")).toHaveValue("");
    expect(screen.getByLabelText("Filter by Requested Priority")).toHaveValue("");
    expect(screen.getByLabelText("Sort tickets")).toHaveValue("createdAt:desc");
    expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
  });

  it("takes the first of a parameter that is repeated, and does not fail", async () => {
    renderAt("/tickets?status=CLOSED&status=RESOLVED&group=open&group=open");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ currentStatus: "CLOSED", group: "open" });
  });

  it("does not take a group in any other case or spelling", async () => {
    renderAt("/tickets?group=OPEN");
    await settled();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest().group).toBeUndefined();
  });
});

describe("UI-29 the list follows the URL when the URL changes under it, as Back and Forward do", () => {
  it("asks for the new list, and shows the new filter, when the address changes", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?group=open");
    await screen.findByText("Open tickets");

    await user.click(screen.getByRole("button", { name: "Pretend Back" }));
    await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
    await waitFor(() => expect(lastRequest()).toMatchObject({ currentStatus: "CLOSED" }));
    expect(lastRequest().group).toBeUndefined();
    expect(screen.getByLabelText("Filter by Current Status")).toHaveValue("CLOSED");
  });

  it("shows the search term of the new address in the search box", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?search=vpn");
    expect(await screen.findByLabelText("Search tickets")).toHaveValue("vpn");
    await user.click(screen.getByRole("button", { name: "Pretend Back" }));
    await waitFor(() => expect(screen.getByLabelText("Search tickets")).toHaveValue(""));
  });
});

describe("UI-29 the pure reading and writing of the address (ui-spec §7)", () => {
  it("reads nothing as the defaults", () => {
    expect(parseTicketListUrl("")).toEqual(DEFAULT_LIST_STATE);
    expect(parseTicketListUrl("?")).toEqual(DEFAULT_LIST_STATE);
  });

  it("reads with or without the question mark", () => {
    expect(parseTicketListUrl("?status=CLOSED")).toEqual(parseTicketListUrl("status=CLOSED"));
  });

  it("writes only what is not the default, in a fixed order, so one list has one address", () => {
    expect(toTicketListUrl(DEFAULT_LIST_STATE)).toBe("");
    expect(toTicketListUrl({ ...DEFAULT_LIST_STATE, status: "CLOSED", group: "open", page: 2 })).toBe("group=open&status=CLOSED&page=2");
    expect(toTicketListUrl(parseTicketListUrl("page=2&status=CLOSED&group=open"))).toBe("group=open&status=CLOSED&page=2");
  });

  it("writes what it reads: every state it can read comes back as the same state", () => {
    const query = "search=a%20b&categoryId=4&relatedSystemId=3&requestedPriority=LOW&status=REOPENED&group=open&sortBy=updatedAt&sortDir=asc&page=3&pageSize=50";
    expect(parseTicketListUrl(toTicketListUrl(parseTicketListUrl(query)))).toEqual(parseTicketListUrl(query));
    expect(parseTicketListUrl(query).search).toBe("a b");
  });

  it("trims a search term, and an empty one is no search", () => {
    expect(parseTicketListUrl("search=%20%20").search).toBe("");
    expect(parseTicketListUrl("search=%20vpn%20").search).toBe("vpn");
  });

  it("takes a NUL character out of a search term, which the API would refuse with a 400, so a hand-edited address cannot break the list", () => {
    expect(parseTicketListUrl("search=a%00b").search).toBe("ab");
    expect(parseTicketListUrl("search=%00").search).toBe("");
    expect(toTicketListUrl(parseTicketListUrl("search=%00vpn%00"))).toBe("search=vpn");
  });

  it("holds each of the eight statuses and no other", () => {
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]) {
      expect(parseTicketListUrl(`status=${status}`).status).toBe(status);
    }
    expect(parseTicketListUrl("status=open").status).toBe("");
  });
});

describe("UI-29 a dashboard card leads to the list it counts, through the whole application (AC-21, BR-40)", () => {
  const REQUESTER: AuthUser = { id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", role: "REQUESTER", isActive: true, mustChangePassword: false };

  beforeEach(() => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(REQUESTER);
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      generatedAt: "2026-10-05T09:00:00.000Z",
      metrics: {
        openTickets: { value: 3, href: "/tickets?group=open" },
        waitingForYou: { value: 1, href: "/tickets?status=WAITING_FOR_REQUESTER" },
        resolved: { value: 5, href: "/tickets?status=RESOLVED" },
        closed: { value: 12, href: "/tickets?status=CLOSED" },
      },
      needsAttention: [],
      recentTickets: [],
    });
  });

  it.each([
    ["Open Tickets: 3. View all", { group: "open" }],
    ["Waiting for You: 1. View all", { currentStatus: "WAITING_FOR_REQUESTER" }],
    ["Resolved: 5. View all", { currentStatus: "RESOLVED" }],
    ["Closed: 12. View all", { currentStatus: "CLOSED" }],
  ] as const)("opens My Tickets for %s with exactly that filter, on the first request", async (name, expected) => {
    const user = userEvent.setup();
    render(<TokTickITApp initialEntries={["/dashboard"]} />);
    await user.click(await screen.findByRole("link", { name }));

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject(expected);
    // The filter is visible on the page it opened, not only in the request.
    if ("group" in expected) expect(screen.getByText("Open tickets")).toBeInTheDocument();
    else expect(screen.getByLabelText("Filter by Current Status")).toHaveValue(expected.currentStatus);
  });

  it("opens the same list for a Requester who types the address, or comes back to it after signing in", async () => {
    render(<TokTickITApp initialEntries={["/tickets?group=open"]} />);
    expect(await screen.findByText("Open tickets")).toBeInTheDocument();
    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ group: "open" });
  });

  it("keeps the query string through a sign-in on the way to the list", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
    vi.spyOn(api, "login").mockResolvedValue(REQUESTER);
    render(<TokTickITApp initialEntries={["/tickets?status=CLOSED"]} />);
    await userEvent.type(await screen.findByLabelText(/^Email/), REQUESTER.email);
    await userEvent.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetchList).toHaveBeenCalled());
    expect(firstRequest()).toMatchObject({ currentStatus: "CLOSED" });
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  });
});

// ---------------------------------------------------------------------------------------------
// Lab 4, Issue 8 — UI-38: the Ticket Queue reads its filters from the URL (ui-spec §7; FR-21, D-12)
// ---------------------------------------------------------------------------------------------

describe("UI-38 the Ticket Queue", () => {
  const ME = 7;

  function queued(overrides: Partial<QueueTicket> = {}): QueueTicket {
    return {
      id: 12,
      ticketNumber: "TT-2026-00042",
      summary: "Printer on floor 3 will not print",
      categoryName: "Hardware",
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "IN_PROGRESS",
      owner: { id: ME, fullName: "Nattapong Saelim", isActive: true },
      requesterResolvedAt: null,
      createdAt: "2026-09-28T02:10:00.000Z",
      updatedAt: "2026-09-29T09:14:22.310Z",
      ...overrides,
    };
  }

  const queuePage = (tickets: QueueTicket[], meta: Partial<QueueResponse> = {}): QueueResponse => ({
    tickets,
    page: 1,
    pageSize: 10,
    totalItems: tickets.length,
    totalPages: Math.ceil(tickets.length / 10),
    ...meta,
  });

  let fetchQueue: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchQueue = vi.spyOn(api, "fetchQueue").mockResolvedValue(queuePage([queued()])) as unknown as ReturnType<typeof vi.fn>;
    vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
      { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
      { id: 8, fullName: "Siriporn Kaewmanee", role: "IT_STAFF", isActive: true },
    ]);
  });

  function QueueProbe() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <p data-testid="queue-url">{location.pathname + location.search}</p>
        <button type="button" onClick={() => navigate("/queue?status=CLOSED")}>
          Pretend Back
        </button>
        <button type="button" onClick={() => navigate(-1)}>
          Go back
        </button>
      </>
    );
  }

  function renderQueue(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <StaffTicketQueueWithUrl currentUserId={ME} />
        <QueueProbe />
      </MemoryRouter>,
    );
  }

  const queueUrl = () => screen.getByTestId("queue-url").textContent;
  const lastAsked = () => fetchQueue.mock.calls.at(-1)![0] as Record<string, unknown>;
  const firstAsked = () => fetchQueue.mock.calls[0][0] as Record<string, unknown>;
  const queueReady = () => screen.findByLabelText("Search number or summary");

  describe("reads its filters from the address on load", () => {
    it("asks for the group, the owner, and the IT priority together, on the very first request", async () => {
      renderQueue("/queue?owner=unassigned&group=open&itPriority=URGENT");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ group: "open", owner: "unassigned", itPriority: "URGENT" });
      expect(fetchQueue.mock.calls.every(([p]) => (p as Record<string, unknown>).group === "open")).toBe(true);
    });

    it("shows what it was asked for in its own controls", async () => {
      renderQueue("/queue?owner=me&status=WAITING_FOR_REQUESTER&itPriority=HIGH");
      expect(await screen.findByLabelText("Owner")).toHaveValue("me");
      expect(screen.getByLabelText("Status")).toHaveValue("WAITING_FOR_REQUESTER");
      expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH");
    });

    it("reads every other filter the queue has: search, category, a named owner, sort, direction, page, and page size", async () => {
      renderQueue("/queue?q=printer&categoryId=4&owner=8&sort=updatedAt&direction=asc&page=2&pageSize=20");
      expect(await queueReady()).toHaveValue("printer");
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ q: "printer", categoryId: 4, owner: "8", sort: "updatedAt", direction: "asc", page: 2, pageSize: 20 });
      expect(screen.getByLabelText("Sort by")).toHaveValue("updatedAt");
      expect(screen.getByLabelText("Direction")).toHaveValue("asc");
    });

    it("asks for the documented defaults when the address says nothing, and for no group", async () => {
      renderQueue("/queue");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked().group).toBeUndefined();
      expect(firstAsked().owner).toBeUndefined();
      expect(firstAsked()).toMatchObject({ sort: "itPriority", direction: "desc", page: 1, pageSize: 10 });
    });
  });

  describe("shows the group as a chip, which Clear Filters and its own cross remove", () => {
    it("shows 'Open tickets' as a chip when the group is open, and not otherwise", async () => {
      renderQueue("/queue?group=open");
      expect(await screen.findByText("Open tickets")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove the Open tickets filter" })).toBeInTheDocument();
    });

    it("shows no chip when there is no group", async () => {
      renderQueue("/queue?owner=unassigned");
      await queueReady();
      expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
    });

    it("keeps the chip on the page when the filters are folded away behind their toggle on a phone", async () => {
      renderQueue("/queue?group=open");
      const chip = await screen.findByText("Open tickets");
      expect(chip.closest(".tt-queue__filters")).toBeNull();
    });

    it("removes the group, and only the group, from its cross, and writes that to the address", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?group=open&owner=unassigned");
      await user.click(await screen.findByRole("button", { name: "Remove the Open tickets filter" }));
      await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
      expect(queueUrl()).toBe("/queue?owner=unassigned");
      await waitFor(() => expect(lastAsked().group).toBeUndefined());
      expect(lastAsked().owner).toBe("unassigned");
    });

    it("is removed by Clear Filters along with every other filter, and the address is the plain queue again", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?group=open&owner=unassigned&itPriority=URGENT");
      await user.click(await screen.findByRole("button", { name: "Clear Filters" }));
      await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
      expect(queueUrl()).toBe("/queue");
      await waitFor(() => {
        expect(lastAsked().group).toBeUndefined();
        expect(lastAsked().owner).toBeUndefined();
        expect(lastAsked().itPriority).toBeUndefined();
      });
      expect(screen.getByLabelText("Owner")).toHaveValue("any");
    });

    it("offers Clear Filters for the group alone, and calls an empty list 'no tickets match', not 'no tickets yet'", async () => {
      fetchQueue.mockResolvedValue(queuePage([]));
      renderQueue("/queue?group=open");
      expect(await screen.findByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
      expect(await screen.findByText("No tickets match your filters")).toBeInTheDocument();
      expect(screen.queryByText("No tickets in the queue yet.")).not.toBeInTheDocument();
    });
  });

  describe("writes a change back to the address, so a reload shows the same queue", () => {
    it("writes a chosen owner and status beside the group, in the order the address always has", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?group=open");
      await user.selectOptions(await screen.findByLabelText("Owner"), "unassigned");
      await waitFor(() => expect(queueUrl()).toBe("/queue?group=open&owner=unassigned"));
      await user.selectOptions(screen.getByLabelText("Status"), "NEW");
      await waitFor(() => expect(queueUrl()).toBe("/queue?group=open&status=NEW&owner=unassigned"));
      await waitFor(() => expect(lastAsked()).toMatchObject({ group: "open", status: "NEW", owner: "unassigned" }));
    });

    it("writes IT priority, category, sort, and direction when they change, and leaves each default out", async () => {
      const user = userEvent.setup();
      renderQueue("/queue");
      await user.selectOptions(await screen.findByLabelText("IT Priority"), "URGENT");
      await waitFor(() => expect(queueUrl()).toBe("/queue?itPriority=URGENT"));
      await user.selectOptions(screen.getByLabelText("Sort by"), "createdAt");
      await waitFor(() => expect(queueUrl()).toContain("sort=createdAt"));
      expect(queueUrl()).not.toContain("direction");
      await user.selectOptions(screen.getByLabelText("Direction"), "asc");
      await waitFor(() => expect(queueUrl()).toContain("direction=asc"));
    });

    it("goes back to the first page when a filter changes", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?page=3");
      await user.selectOptions(await screen.findByLabelText("Status"), "CLOSED");
      await waitFor(() => expect(queueUrl()).toBe("/queue?status=CLOSED"));
      await waitFor(() => expect(lastAsked().page).toBe(1));
    });

    it("writes the page when the person pages on, and a fresh load of that address shows that page", async () => {
      const user = userEvent.setup();
      fetchQueue.mockResolvedValue(queuePage([queued()], { totalItems: 25, totalPages: 3 }));
      const first = renderQueue("/queue?group=open");
      await user.click(await screen.findByRole("button", { name: "Next" }));
      await waitFor(() => expect(queueUrl()).toBe("/queue?group=open&page=2"));
      first.unmount();
      fetchQueue.mockClear();
      renderQueue("/queue?group=open&page=2");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ group: "open", page: 2 });
    });

    it("writes a search once the person has stopped typing, not on every key, and asks for it", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?status=CLOSED");
      await user.type(await queueReady(), "vpn");
      expect(queueUrl()).toBe("/queue?status=CLOSED");
      await waitFor(() => expect(queueUrl()).toBe("/queue?status=CLOSED&q=vpn"), { timeout: 1500 });
      await waitFor(() => expect(lastAsked()).toMatchObject({ q: "vpn", status: "CLOSED", page: 1 }));
      expect(fetchQueue.mock.calls.filter(([p]) => (p as Record<string, unknown>).q === "v")).toHaveLength(0);
    });

    it("does not undo a filter chosen while a search is still being typed, when the search is written", async () => {
      const user = userEvent.setup();
      renderQueue("/queue");
      const box = await queueReady();
      await user.type(box, "vpn");
      await user.selectOptions(screen.getByLabelText("Status"), "CLOSED");
      await waitFor(() => expect(queueUrl()).toBe("/queue?status=CLOSED&q=vpn"), { timeout: 1500 });
      expect(box).toHaveValue("vpn");
    });

    it("keeps what the person typed when the address catches up a moment after the write", async () => {
      const user = userEvent.setup();
      const asked = vi.fn();
      function Slow() {
        const location = useLocation();
        const navigate = useNavigate();
        return (
          <StaffTicketQueue
            currentUserId={ME}
            query={location.search}
            onQueryChange={(query) => {
              asked(query);
              setTimeout(() => navigate({ pathname: "/queue", search: query ? `?${query}` : "" }, { replace: true }), 200);
            }}
          />
        );
      }
      render(
        <MemoryRouter initialEntries={["/queue"]}>
          <Slow />
          <QueueProbe />
        </MemoryRouter>,
      );
      const box = await queueReady();
      await user.type(box, "pri");
      await waitFor(() => expect(asked).toHaveBeenCalledWith("q=pri"), { timeout: 1500 });
      await user.type(box, "n");
      await waitFor(() => expect(queueUrl()).toBe("/queue?q=pri"), { timeout: 1500 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(box).toHaveValue("prin");
    });

    it("replaces the history entry, so Back leaves the queue instead of stepping back through each filter", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/dashboard", "/queue"]} initialIndex={1}>
          <StaffTicketQueueWithUrl currentUserId={ME} />
          <QueueProbe />
        </MemoryRouter>,
      );
      await user.selectOptions(await screen.findByLabelText("Status"), "CLOSED");
      await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
      await waitFor(() => expect(queueUrl()).toBe("/queue?status=CLOSED&itPriority=HIGH"));
      await user.click(screen.getByRole("button", { name: "Go back" }));
      expect(queueUrl()).toBe("/dashboard");
    });
  });

  describe("never breaks on an address it does not understand", () => {
    it("ignores a parameter it does not know, and does not send it on", async () => {
      renderQueue("/queue?nothing=at-all&status=CLOSED&utm_source=email");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ status: "CLOSED" });
      expect(Object.keys(firstAsked())).not.toContain("nothing");
      expect(Object.keys(firstAsked())).not.toContain("utm_source");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("drops an unrecognised value to its default, and the control shows the default", async () => {
      renderQueue("/queue?status=BOGUS&group=everything&itPriority=EXTREME&owner=nobody&categoryId=abc&sort=title&direction=sideways&page=0&pageSize=7");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      const asked = firstAsked();
      expect(asked.status).toBeUndefined();
      expect(asked.group).toBeUndefined();
      expect(asked.itPriority).toBeUndefined();
      expect(asked.owner).toBeUndefined();
      expect(asked.categoryId).toBeUndefined();
      expect(asked).toMatchObject({ sort: "itPriority", direction: "desc", page: 1, pageSize: 10 });
      expect(screen.getByLabelText("Status")).toHaveValue("");
      expect(screen.getByLabelText("Owner")).toHaveValue("any");
      expect(screen.queryByText("Open tickets")).not.toBeInTheDocument();
    });

    it("takes the first of a parameter that is repeated, and does not fail", async () => {
      renderQueue("/queue?status=CLOSED&status=RESOLVED&group=open&group=open");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ status: "CLOSED", group: "open" });
    });

    it("does not take a group in any other case, and does not take a user id of 0 or a negative one as an owner", async () => {
      renderQueue("/queue?group=OPEN&owner=0");
      await queueReady();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked().group).toBeUndefined();
      expect(firstAsked().owner).toBeUndefined();
    });
  });

  describe("follows the address when it changes under it, as Back and Forward do", () => {
    it("asks for the new queue, and shows the new filter, when the address changes", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?group=open&owner=me");
      await screen.findByText("Open tickets");
      await user.click(screen.getByRole("button", { name: "Pretend Back" }));
      await waitFor(() => expect(screen.queryByText("Open tickets")).not.toBeInTheDocument());
      await waitFor(() => expect(lastAsked()).toMatchObject({ status: "CLOSED" }));
      expect(lastAsked().group).toBeUndefined();
      expect(lastAsked().owner).toBeUndefined();
      expect(screen.getByLabelText("Status")).toHaveValue("CLOSED");
      expect(screen.getByLabelText("Owner")).toHaveValue("any");
    });

    it("shows the search term of the new address in the search box", async () => {
      const user = userEvent.setup();
      renderQueue("/queue?q=vpn");
      expect(await queueReady()).toHaveValue("vpn");
      await user.click(screen.getByRole("button", { name: "Pretend Back" }));
      await waitFor(() => expect(screen.getByLabelText("Search number or summary")).toHaveValue(""));
    });
  });

  describe("the pure reading and writing of the address (ui-spec §7)", () => {
    it("reads nothing as the defaults, with or without the question mark", () => {
      expect(parseQueueUrl("")).toEqual(DEFAULT_QUEUE_STATE);
      expect(parseQueueUrl("?")).toEqual(DEFAULT_QUEUE_STATE);
      expect(parseQueueUrl("?status=CLOSED")).toEqual(parseQueueUrl("status=CLOSED"));
    });

    it("writes only what is not the default, in a fixed order, so one queue has one address", () => {
      expect(toQueueUrl(DEFAULT_QUEUE_STATE)).toBe("");
      expect(toQueueUrl({ ...DEFAULT_QUEUE_STATE, owner: "unassigned", group: "open", itPriority: "URGENT", page: 2 })).toBe(
        "group=open&itPriority=URGENT&owner=unassigned&page=2",
      );
      expect(toQueueUrl(parseQueueUrl("page=2&owner=unassigned&itPriority=URGENT&group=open"))).toBe("group=open&itPriority=URGENT&owner=unassigned&page=2");
    });

    it("writes what it reads: every state it can read comes back as the same state", () => {
      const query = "group=open&status=NEW&itPriority=LOW&owner=12&q=a%20b&categoryId=4&sort=createdAt&direction=asc&page=3&pageSize=50";
      expect(parseQueueUrl(toQueueUrl(parseQueueUrl(query)))).toEqual(parseQueueUrl(query));
      expect(parseQueueUrl(query).search).toBe("a b");
      expect(parseQueueUrl(query).owner).toBe("12");
    });

    it("holds an owner of any, unassigned, me, or a positive user id, and no other", () => {
      for (const owner of ["any", "unassigned", "me", "7", "2147483647"]) expect(parseQueueUrl(`owner=${owner}`).owner).toBe(owner);
      for (const owner of ["nobody", "0", "-1", "1.5", "2147483648", "ME", ""]) expect(parseQueueUrl(`owner=${owner}`).owner, owner).toBe("any");
    });

    it("trims a search term, takes a NUL out of it, and an empty one is no search", () => {
      expect(parseQueueUrl("q=%20%20").search).toBe("");
      expect(parseQueueUrl("q=%20vpn%20").search).toBe("vpn");
      expect(parseQueueUrl("q=a%00b").search).toBe("ab");
    });

    it("holds each sort and direction the queue has, and no other", () => {
      for (const sort of ["itPriority", "createdAt", "updatedAt"]) expect(parseQueueUrl(`sort=${sort}`).sort).toBe(sort);
      expect(parseQueueUrl("sort=title").sort).toBe("itPriority");
      expect(parseQueueUrl("direction=asc").direction).toBe("asc");
      expect(parseQueueUrl("direction=up").direction).toBe("desc");
    });
  });

  describe("a dashboard card leads to the queue it counts, through the whole application (AC-21, BR-40)", () => {
    const STAFF: AuthUser = { id: ME, fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", role: "IT_STAFF", isActive: true, mustChangePassword: false };

    beforeEach(() => {
      vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(STAFF);
      vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({
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
        myTickets: [],
        urgentTickets: [],
        myRecentActions: [],
      });
    });

    it.each([
      ["Unassigned: 2. View all", { group: "open", owner: "unassigned" }],
      ["Assigned to Me: 4. View all", { group: "open", owner: "me" }],
      ["Waiting for Requester: 3. View all", { status: "WAITING_FOR_REQUESTER" }],
      ["Urgent: 5. View all", { group: "open", itPriority: "URGENT" }],
    ] as const)("opens the Ticket Queue for %s with exactly that filter, on the first request", async (name, expected) => {
      const user = userEvent.setup();
      render(<TokTickITApp initialEntries={["/dashboard"]} />);
      const cards = await screen.findByRole("region", { name: "Your queue at a glance" });
      await user.click(within(cards).getByRole("link", { name }));

      expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject(expected);
      if ("group" in expected) expect(screen.getByText("Open tickets")).toBeInTheDocument();
    });

    it.each([["New", "NEW"], ["In Progress", "IN_PROGRESS"], ["Reopened", "REOPENED"]])("opens the Ticket Queue for the %s status row with that status alone", async (label, status) => {
      const user = userEvent.setup();
      render(<TokTickITApp initialEntries={["/dashboard"]} />);
      const row = await screen.findByRole("region", { name: "By status" });
      await user.click(within(row).getByRole("link", { name: new RegExp(`^${label}: `) }));
      expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ status });
      expect(firstAsked().group).toBeUndefined();
      expect(screen.getByLabelText("Status")).toHaveValue(status);
    });

    it("keeps the query string through a sign-in on the way to the queue", async () => {
      vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
      vi.spyOn(api, "login").mockResolvedValue(STAFF);
      render(<TokTickITApp initialEntries={["/queue?owner=unassigned&group=open"]} />);
      await userEvent.type(await screen.findByLabelText(/^Email/), STAFF.email);
      await userEvent.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
      await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
      expect(firstAsked()).toMatchObject({ group: "open", owner: "unassigned" });
    });
  });
});
