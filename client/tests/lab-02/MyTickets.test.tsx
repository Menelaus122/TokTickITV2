import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyTickets } from "../../src/screens/MyTickets.js";
import {
  RequesterProvider,
  STORAGE_KEY,
  useRequester,
} from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import type { Requester, TicketListItem, TicketListResponse } from "../../src/api.js";

// Issue 6 AC-1 to AC-3 — My Tickets.

const REQUESTER: Requester = {
  id: 3,
  fullName: "Pornchai Thana",
  email: "pornchai.than@kmutt.ac.th",
  department: "Library",
};

function ticket(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 1,
    ticketNumber: "TT-2026-00041",
    ticketDate: "2026-08-20T09:00:00.000Z",
    summary: "VPN drops every few minutes",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    category: { id: 4, name: "Network" },
    relatedSystem: { id: 3, name: "VPN" },
    activeAttachmentCount: 0,
    updatedAt: "2026-08-21T10:00:00.000Z",
    ...overrides,
  };
}

function response(data: TicketListItem[], meta: Partial<TicketListResponse["meta"]> = {}) {
  return {
    data,
    meta: {
      page: 1,
      pageSize: 10,
      totalItems: data.length,
      totalPages: Math.ceil(data.length / 10),
      hasPrev: false,
      hasNext: false,
      ...meta,
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 4, name: "Network" }]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 3, name: "VPN" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

// Mirrors how the app mounts the screen: behind the requester gate.
function Gate({ children }: { children: React.ReactNode }) {
  const { requester } = useRequester();
  return requester ? <>{children}</> : null;
}

function renderScreen(props: Parameters<typeof MyTickets>[0] = {}) {
  window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
  return render(
    <RequesterProvider available={[REQUESTER]}>
      <Gate>
        <MyTickets {...props} />
      </Gate>
    </RequesterProvider>,
  );
}

/** Waits for the initial load to settle so later assertions are not racing it. */
async function settled() {
  await screen.findByLabelText("Search tickets");
  await waitFor(() => expect(api.fetchMyTickets).toHaveBeenCalled());
}

describe("requester scoping", () => {
  it("asks the API only for the current requester's tickets", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    expect(fetchSpy.mock.calls[0][0]).toBe(REQUESTER.id);
  });

  it("renders only what the API returned for that requester", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(
      response([ticket({ summary: "VPN drops every few minutes" })]),
    );
    renderScreen();

    expect(await screen.findAllByText("VPN drops every few minutes")).not.toHaveLength(0);
    expect(screen.queryByText(/Requester B private ticket/)).not.toBeInTheDocument();
  });
});

describe("list rendering", () => {
  it("shows the columns a requester needs to identify a ticket", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();

    await screen.findAllByText("TT-2026-00041");
    for (const column of ["Ticket Number", "Summary", "Category", "Priority", "Status", "Last Updated"]) {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
  });

  it("renders priority and status as text badges", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    const { container } = renderScreen();

    await screen.findAllByText("TT-2026-00041");
    const table = container.querySelector("table")!;
    expect(within(table as HTMLElement).getByText("HIGH")).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("NEW")).toBeInTheDocument();
  });

  it("renders both a desktop table and mobile cards from one data set", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    const { container } = renderScreen();

    await screen.findAllByText("TT-2026-00041");
    expect(container.querySelector("table.tt-table")).not.toBeNull();
    expect(container.querySelectorAll(".tt-card-row")).toHaveLength(1);
  });

  it("opens a ticket when its number is activated", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    const onOpenTicket = vi.fn();
    renderScreen({ onOpenTicket });

    const buttons = await screen.findAllByRole("button", { name: "TT-2026-00041" });
    await userEvent.click(buttons[0]);

    expect(onOpenTicket).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe("search", () => {
  it("sends the trimmed term and returns to page 1", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    await userEvent.type(screen.getByLabelText("Search tickets"), "  laptop  ");

    await waitFor(() => {
      const last = fetchSpy.mock.calls.at(-1)![1];
      expect(last).toMatchObject({ search: "laptop", page: 1 });
    });
  });

  it("debounces rather than firing a request per keystroke", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();
    const before = fetchSpy.mock.calls.length;

    await userEvent.type(screen.getByLabelText("Search tickets"), "laptop");

    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
    // Six keystrokes must not mean six requests.
    expect(fetchSpy.mock.calls.length - before).toBeLessThan(6);
  });
});

describe("filters and sorting", () => {
  it("sends the chosen category", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    await userEvent.selectOptions(await screen.findByLabelText("Filter by Category"), "4");

    await waitFor(() =>
      expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({ categoryId: 4, page: 1 }),
    );
  });

  it("sends the chosen priority", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    await userEvent.selectOptions(screen.getByLabelText("Filter by Requested Priority"), "HIGH");

    await waitFor(() =>
      expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({ requestedPriority: "HIGH" }),
    );
  });

  it("translates the sort choice into sortBy and sortDir", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    await userEvent.selectOptions(screen.getByLabelText("Sort tickets"), "updatedAt:desc");

    await waitFor(() =>
      expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({
        sortBy: "updatedAt",
        sortDir: "desc",
      }),
    );
  });

  it("loads filter options from the database", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();

    expect(await screen.findByRole("option", { name: "Network" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VPN" })).toBeInTheDocument();
  });

  it("offers Clear Filters only while something is filtering", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await settled();

    expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Filter by Category"), "4");
    expect(await screen.findByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
  });
});

describe("pagination", () => {
  it("reports the page position", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(
      response([ticket()], { totalItems: 25, totalPages: 3, hasNext: true }),
    );
    renderScreen();

    expect(await screen.findByTestId("page-status")).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("result-count")).toHaveTextContent("of 25");
  });

  it("disables Previous on the first page and Next on the last", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(
      response([ticket()], { totalItems: 25, totalPages: 3, hasPrev: false, hasNext: true }),
    );
    renderScreen();

    await screen.findByTestId("page-status");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("requests the next page when Next is used", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(
      response([ticket()], { totalItems: 25, totalPages: 3, hasNext: true }),
    );
    renderScreen();
    await screen.findByTestId("page-status");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({ page: 2 }));
  });

  it("sends only a permitted page size", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(
      response([ticket()], { totalItems: 25, totalPages: 3, hasNext: true }),
    );
    renderScreen();
    await screen.findByTestId("page-status");

    await userEvent.selectOptions(screen.getByLabelText("Tickets per page"), "20");

    await waitFor(() => expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({ pageSize: 20 }));
  });
});

describe("states", () => {
  it("shows a loading state before the first response", async () => {
    vi.spyOn(api, "fetchMyTickets").mockReturnValue(new Promise(() => {}));
    const { container } = renderScreen();

    await waitFor(() =>
      expect(container.querySelector('[data-state="loading"]')).not.toBeNull(),
    );
  });

  it("shows the empty state when the requester owns nothing", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([]));
    const { container } = renderScreen();

    expect(await screen.findByText("You have no tickets yet.")).toBeInTheDocument();
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(container.querySelector('[data-state="no-results"]')).toBeNull();
  });

  it("shows the no-results state when filters match nothing", async () => {
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([]));
    const { container } = renderScreen();
    await settled();

    await userEvent.selectOptions(await screen.findByLabelText("Filter by Category"), "4");

    await waitFor(() =>
      expect(container.querySelector('[data-state="no-results"]')).not.toBeNull(),
    );
    // Distinct from empty: different copy, and a way back (BR-44).
    expect(screen.getByText("No tickets match your filters.")).toBeInTheDocument();
    expect(container.querySelector('[data-state="empty"]')).toBeNull();
  });

  it("restores the full list when Clear Filters is used", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([]));
    renderScreen();
    await settled();

    await userEvent.selectOptions(await screen.findByLabelText("Filter by Category"), "4");

    // Two Clear Filters controls are correct here: one in the toolbar and one
    // inside the no-results state (ui-spec.md 10.2 and 10.3). Either restores
    // the list, so this uses the toolbar's.
    const clearButtons = await screen.findAllByRole("button", { name: "Clear Filters" });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(clearButtons[0]);

    await waitFor(() =>
      expect(fetchSpy.mock.calls.at(-1)![1]).toMatchObject({ categoryId: undefined, page: 1 }),
    );
  });

  it("shows a safe error with retry when the list cannot load", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockRejectedValue(new Error("network down"));
    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Cannot load your tickets/i);
    expect(alert.textContent).not.toMatch(/http|500|stack|prisma|network down/i);

    fetchSpy.mockResolvedValue(response([ticket()]));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findAllByText("TT-2026-00041")).not.toHaveLength(0);
  });

  it("shows no stale rows after a failed reload", async () => {
    const fetchSpy = vi.spyOn(api, "fetchMyTickets").mockResolvedValue(response([ticket()]));
    renderScreen();
    await screen.findAllByText("TT-2026-00041");

    fetchSpy.mockRejectedValue(new Error("network down"));
    await userEvent.selectOptions(await screen.findByLabelText("Filter by Category"), "4");

    await screen.findByRole("alert");
    expect(screen.queryByText("TT-2026-00041")).not.toBeInTheDocument();
  });
});
