import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StaffTicketQueue, formatLastUpdated } from "../../src/screens/StaffTicketQueue.js";
import * as api from "../../src/api.js";
import type { QueueResponse, QueueTicket } from "../../src/api.js";

// Lab 3, Issue 8 — UI-12 to UI-14 in docs/lab-03/tests.md (ui-spec §6;
// FR-26 to FR-30).

const ME = 7;

function ticket(overrides: Partial<QueueTicket> = {}): QueueTicket {
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

function page(tickets: QueueTicket[], meta: Partial<QueueResponse> = {}): QueueResponse {
  return { tickets, page: 1, pageSize: 10, totalItems: tickets.length, totalPages: Math.ceil(tickets.length / 10), ...meta };
}

let fetchSpy: MockInstance<typeof api.fetchQueue>;

beforeEach(() => {
  vi.spyOn(api, "fetchCategories").mockResolvedValue([
    { id: 1, name: "Hardware" },
    { id: 4, name: "Network" },
  ]);
  vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
    { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
    { id: 8, fullName: "Siriporn Kaewmanee", role: "IT_STAFF", isActive: true },
  ]);
  fetchSpy = vi.spyOn(api, "fetchQueue").mockResolvedValue(page([ticket()]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderQueue() {
  return render(
    <MemoryRouter>
      <StaffTicketQueue currentUserId={ME} />
    </MemoryRouter>,
  );
}

const lastParams = () => fetchSpy.mock.calls.at(-1)![0] as api.QueueParams;

async function ready() {
  renderQueue();
  await screen.findByRole("table");
}

describe("UI-12 each control issues the documented request", () => {
  it("asks for the documented defaults first: IT Priority descending, page 1 of 10", async () => {
    await ready();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastParams()).toEqual({
      q: undefined,
      status: undefined,
      itPriority: undefined,
      categoryId: undefined,
      owner: undefined,
      sort: "itPriority",
      direction: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("labels every control visibly", async () => {
    await ready();
    for (const label of ["Search number or summary", "Status", "IT Priority", "Category", "Owner", "Sort by", "Direction"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("sends a trimmed search after the debounce", async () => {
    const user = userEvent.setup();
    await ready();
    await user.type(screen.getByLabelText("Search number or summary"), "  printer ");
    await waitFor(() => expect(lastParams()).toMatchObject({ q: "printer", page: 1 }));
  });

  it("sends each filter", async () => {
    const user = userEvent.setup();
    await ready();

    await user.selectOptions(screen.getByLabelText("Status"), "WAITING_FOR_REQUESTER");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "WAITING_FOR_REQUESTER" }));

    await user.selectOptions(screen.getByLabelText("IT Priority"), "URGENT");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "WAITING_FOR_REQUESTER", itPriority: "URGENT" }));

    await screen.findByRole("option", { name: "Network" });
    await user.selectOptions(screen.getByLabelText("Category"), "Network");
    await waitFor(() => expect(lastParams()).toMatchObject({ categoryId: 4 }));
  });

  it("offers Any, Unassigned, Assigned to me, and each IT Staff member as Owner (D-18)", async () => {
    const user = userEvent.setup();
    await ready();
    const owner = screen.getByLabelText("Owner");
    await screen.findByRole("option", { name: "Siriporn Kaewmanee" });
    expect(within(owner).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Any",
      "Unassigned",
      "Assigned to me",
      "Nattapong Saelim",
      "Siriporn Kaewmanee",
    ]);

    await user.selectOptions(owner, "unassigned");
    await waitFor(() => expect(lastParams()).toMatchObject({ owner: "unassigned" }));
    await user.selectOptions(owner, "me");
    await waitFor(() => expect(lastParams()).toMatchObject({ owner: "me" }));
    await user.selectOptions(owner, "8");
    await waitFor(() => expect(lastParams()).toMatchObject({ owner: "8" }));
  });

  it("sends the sort field, direction, and page size", async () => {
    const user = userEvent.setup();
    await ready();
    await user.selectOptions(screen.getByLabelText("Sort by"), "updatedAt");
    await user.selectOptions(screen.getByLabelText("Direction"), "asc");
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: "updatedAt", direction: "asc" }));

    await user.selectOptions(screen.getByLabelText("Tickets per page"), "50");
    await waitFor(() => expect(lastParams()).toMatchObject({ pageSize: 50, page: 1 }));
  });

  it("pages forward and back, and a new filter returns to page 1", async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async (params: api.QueueParams = {}) =>
      page([ticket({ id: params.page ?? 1 })], { page: params.page ?? 1, totalItems: 25, totalPages: 3 }),
    );
    await ready();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(await screen.findByTestId("page-status")).toHaveTextContent("Page 2 of 3");

    await user.selectOptions(screen.getByLabelText("Status"), "NEW");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "NEW", page: 1 }));
  });

  it("never asks for a new filter on the old page", async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async (params: api.QueueParams = {}) =>
      page([ticket({ id: params.page ?? 1 })], { page: params.page ?? 1, totalItems: 25, totalPages: 3 }),
    );
    await ready();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByTestId("page-status")).toHaveTextContent("Page 2 of 3");

    await user.selectOptions(screen.getByLabelText("Status"), "NEW");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "NEW", page: 1 }));
    const filtered = fetchSpy.mock.calls.map(([params]) => params!).filter((params) => params.status === "NEW");
    expect(filtered.map((params) => params.page)).toEqual([1]);
  });

  it("shows the latest request's answer even when an earlier one arrives after it", async () => {
    const user = userEvent.setup();
    let answerSlow!: () => void;
    fetchSpy.mockImplementation((params: api.QueueParams = {}) => {
      if (params.status === "OPEN") {
        // The superseded request: it answers only after the newer one has.
        return new Promise((resolve) => {
          answerSlow = () => resolve(page([ticket({ id: 99, ticketNumber: "TT-2026-00099" })]));
        });
      }
      return Promise.resolve(page([ticket({ id: params.status === "NEW" ? 1 : 12, ticketNumber: params.status === "NEW" ? "TT-2026-00001" : "TT-2026-00042" })]));
    });
    await ready();

    await user.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "OPEN" }));
    await user.selectOptions(screen.getByLabelText("Status"), "NEW");
    expect((await screen.findAllByText("TT-2026-00001")).length).toBeGreaterThan(0);

    answerSlow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryAllByText("TT-2026-00099")).toHaveLength(0);
    expect(screen.getAllByText("TT-2026-00001").length).toBeGreaterThan(0);
  });

  it("Clear Filters returns every control to its default", async () => {
    const user = userEvent.setup();
    await ready();
    expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "NEW");
    await user.selectOptions(screen.getByLabelText("Owner"), "unassigned");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "NEW", owner: "unassigned" }));

    await user.click(await screen.findByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ status: undefined, owner: undefined, page: 1 }));
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(screen.getByLabelText("Owner")).toHaveValue("any");
  });
});

describe("UI-13 the seven columns and each row", () => {
  it("renders the seven columns in order as real column headers", async () => {
    await ready();
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual([
      "Ticket Number",
      "Summary",
      "Requested Priority",
      "IT Priority",
      "Current Status",
      "Ticket Owner",
      "Last Updated",
    ]);
  });

  it("renders the badges, a link to the detail screen, and the full summary in title", async () => {
    await ready();
    const [row] = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const cells = within(row).getAllByRole("cell");

    expect(within(cells[0]).getByRole("link", { name: "TT-2026-00042" })).toHaveAttribute("href", "/queue/12");
    expect(within(cells[1]).getByTitle("Printer on floor 3 will not print")).toBeInTheDocument();
    expect(within(cells[2]).getByText("MEDIUM")).toHaveAttribute("data-badge", "priority");
    expect(within(cells[3]).getByText("HIGH")).toHaveAttribute("data-badge", "priority");
    expect(within(cells[4]).getByText("In Progress")).toHaveAttribute("data-badge", "status");
    expect(cells[5]).toHaveTextContent("Nattapong Saelim");
    expect(within(cells[5]).getByText("You")).toBeInTheDocument();
    expect(within(cells[6]).getByRole("time")).toHaveAttribute("datetime", "2026-09-29T09:14:22.310Z");
  });

  it("renders Unassigned as the word, a deactivated owner as Inactive, and the Requester's signal", async () => {
    fetchSpy.mockResolvedValue(
      page([
        ticket({ id: 1, ticketNumber: "TT-2026-00001", owner: null }),
        ticket({ id: 2, ticketNumber: "TT-2026-00002", owner: { id: 30, fullName: "Prasert Chaiyo", isActive: false } }),
        ticket({ id: 3, ticketNumber: "TT-2026-00003", requesterResolvedAt: "2026-09-30T00:00:00.000Z" }),
      ]),
    );
    await ready();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const ownerCell = (row: HTMLElement) => within(row).getAllByRole("cell")[5];

    expect(ownerCell(rows[0])).toHaveTextContent(/^Unassigned$/);
    expect(ownerCell(rows[1])).toHaveTextContent("Prasert Chaiyo");
    expect(within(ownerCell(rows[1])).getByText("Inactive")).toBeInTheDocument();
    expect(within(ownerCell(rows[1])).queryByText("You")).not.toBeInTheDocument();
    expect(within(rows[2]).getByText("Requester says resolved")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("Requester says resolved")).not.toBeInTheDocument();
  });

  it("gives each mobile card a definition list with the same facts", async () => {
    await ready();
    const card = within(screen.getByTestId("queue-cards")).getByRole("article");
    expect(card.querySelector("dl")).not.toBeNull();
    expect(within(card).getByRole("link", { name: "TT-2026-00042" })).toHaveAttribute("href", "/queue/12");
    expect(within(card).getByText("In Progress")).toBeInTheDocument();
    expect(card).toHaveTextContent("Nattapong Saelim");
  });

  it("shows Last Updated relatively under a day and as a date beyond", () => {
    const now = Date.parse("2026-10-01T12:00:00.000Z");
    expect(formatLastUpdated("2026-10-01T11:59:30.000Z", now)).toBe("Just now");
    expect(formatLastUpdated("2026-10-01T11:15:00.000Z", now)).toBe("45 minutes ago");
    expect(formatLastUpdated("2026-10-01T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(formatLastUpdated("2026-09-30T12:00:01.000Z", now)).toBe("23 hours ago");
    expect(formatLastUpdated("2026-09-29T12:00:00.000Z", now)).not.toMatch(/ago/);
  });
});

describe("UI-14 states", () => {
  it("shows the loading skeleton while the request is in flight", async () => {
    fetchSpy.mockReturnValue(new Promise(() => {}));
    renderQueue();
    expect(await screen.findByRole("status")).toHaveAttribute("data-state", "loading");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the empty state when the queue has nothing and nothing is filtered", async () => {
    fetchSpy.mockResolvedValue(page([]));
    renderQueue();
    expect(await screen.findByText("No tickets in the queue yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();
  });

  it("shows no-results with Clear Filters when a filter matches nothing (FR-30)", async () => {
    const user = userEvent.setup();
    await ready();
    fetchSpy.mockResolvedValue(page([]));
    await user.selectOptions(screen.getByLabelText("Status"), "CANCELLED");

    expect(await screen.findByText("No tickets match your filters")).toBeInTheDocument();
    expect(screen.queryByText("No tickets in the queue yet.")).not.toBeInTheDocument();
    const clear = screen.getAllByRole("button", { name: "Clear Filters" });
    fetchSpy.mockResolvedValue(page([ticket()]));
    await user.click(clear[clear.length - 1]);
    await waitFor(() => expect(lastParams()).toMatchObject({ status: undefined }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows the forbidden callout on a 403", async () => {
    fetchSpy.mockRejectedValue(new api.ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    renderQueue();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-state", "forbidden");
    expect(alert).toHaveTextContent("You do not have access to the ticket queue.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows a safe failure with Try again, which retries", async () => {
    const user = userEvent.setup();
    fetchSpy.mockRejectedValueOnce(new api.ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    renderQueue();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-state", "error");
    expect(alert).not.toHaveTextContent("INTERNAL_ERROR");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("keeps the queue usable when the filter options fail to load", async () => {
    vi.mocked(api.fetchCategories).mockRejectedValue(new Error("down"));
    vi.mocked(api.fetchAssignableUsers).mockRejectedValue(new Error("down"));
    await ready();
    expect(within(screen.getByLabelText("Owner")).getAllByRole("option")).toHaveLength(3);
  });
});
