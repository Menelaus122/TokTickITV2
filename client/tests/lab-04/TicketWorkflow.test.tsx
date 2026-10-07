import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/screens/StaffTicketDetail.js";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import * as api from "../../src/api.js";
import { ApiError, type BlockedTransition, type StaffTicketDetail as Detail, type StatusChange } from "../../src/api.js";
import type { TicketStatus } from "../../src/components/index.js";

// Lab 4, Issue 6 — UI-10 to UI-16 in docs/lab-04/tests.md §2.8 (ui-spec §1.4, §1.5,
// §5, §6; specification.md FR-09 to FR-14, BR-17, BR-18, BR-19, BR-24, BR-26).
//
// The seam is the screens as a person meets them. The API client is the system
// boundary, so it is the only thing mocked. The server decides which moves a
// Ticket can make; every test here hands the screen a Ticket and checks that it
// shows exactly that, and that what the person does goes back to the API as
// api-spec §3 says.

const ME = 7;
const COLLEAGUE = 8;
const NATTAPONG = { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF" as const, isActive: true };
const SIRIPORN = { id: COLLEAGUE, fullName: "Siriporn Kaewmanee", role: "IT_STAFF" as const, isActive: true };

const ACTION_REQUIRED: BlockedTransition = { to: "RESOLVED", code: "ACTION_REQUIRED", message: "Record at least one action before resolving this ticket." };
const FOLLOW_UP_PENDING: BlockedTransition = {
  to: "RESOLVED",
  code: "FOLLOW_UP_PENDING",
  message: "The most recently recorded action still needs follow-up. Record the follow-up as a new action first.",
};
const OWNER_REQUIRED: BlockedTransition = { to: "RESOLVED", code: "OWNER_REQUIRED", message: "Claim or assign the ticket before resolving or closing it." };

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    id: 12,
    ticketNumber: "TT-2026-00042",
    summary: "Printer on floor 3 will not print",
    description: "It shows a paper jam, but there is no paper stuck.",
    categoryName: "Hardware",
    relatedSystemName: "Campus Printers",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "IN_PROGRESS",
    owner: NATTAPONG,
    requesterResolvedAt: null,
    version: 4,
    requester: { id: 3, fullName: "Pornchai Thana", email: "pornchai@toktickit.local", role: "REQUESTER", isActive: true },
    createdAt: "2026-09-28T02:10:00.000Z",
    updatedAt: "2026-09-29T09:14:22.310Z",
    attachments: [],
    permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
    blockedTransitions: [ACTION_REQUIRED],
    ...overrides,
  };
}

function change(id: number, fromStatus: TicketStatus, toStatus: TicketStatus, at: string, by = NATTAPONG): StatusChange {
  return { id, fromStatus, toStatus, changedBy: { id: by.id, fullName: by.fullName, role: by.role }, createdAt: at };
}

let fetchTicket: MockInstance<typeof api.fetchStaffTicket>;
let fetchHistory: MockInstance<typeof api.fetchStatusHistory>;

beforeEach(() => {
  fetchTicket = vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(detail());
  fetchHistory = vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([]);
  vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
    { id: ME, fullName: NATTAPONG.fullName, role: "IT_STAFF", isActive: true },
    { id: COLLEAGUE, fullName: SIRIPORN.fullName, role: "IT_STAFF", isActive: true },
  ]);
  vi.spyOn(api, "fetchComments").mockResolvedValue([]);
  vi.spyOn(api, "fetchNotes").mockResolvedValue([]);
  vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function ready(ticket: Detail = detail()) {
  fetchTicket.mockResolvedValue(ticket);
  const view = render(<StaffTicketDetail ticketId={ticket.id} currentUserId={ME} currentUser={{ fullName: NATTAPONG.fullName, role: "IT_STAFF" }} />);
  await screen.findByTestId("detail-ticket-number");
  return view;
}

const operational = () => within(screen.getByRole("region", { name: "Operational" }));
const statusControl = () => within(operational().getByRole("heading", { name: "Status" }).closest("form") as HTMLElement);
const offered = () =>
  within(statusControl().getByLabelText("Move to"))
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value)
    .filter(Boolean);

describe("UI-10 the status select and the 'Not available now' list (AC-16, FR-09, BR-17)", () => {
  it("offers only the moves the server says the ticket can make, never the whole list", async () => {
    await ready(detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"] }));
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(statusControl().queryByRole("option", { name: "Resolved" })).not.toBeInTheDocument();
  });

  it("lists each move that is not available yet, with its status, an em dash, and the API's own message", async () => {
    await ready();
    const list = statusControl().getByRole("list", { name: "Not available now" });
    const [item] = within(list).getAllByRole("listitem");
    expect(item).toHaveTextContent("Resolved — Record at least one action before resolving this ticket.");
  });

  it("offers Resolved in the select, and no explanation, when the gate is open", async () => {
    await ready(detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], blockedTransitions: [] }));
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    expect(statusControl().queryByText("Not available now")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to Actions Taken" })).not.toBeInTheDocument();
  });

  it("says why a resolve is held by a follow-up that is still pending, in the API's words", async () => {
    await ready(detail({ blockedTransitions: [FOLLOW_UP_PENDING] }));
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent(`Resolved — ${FOLLOW_UP_PENDING.message}`);
  });

  it("gives a Go to Actions Taken button for the two gate reasons, and it focuses the Actions Taken region's heading", async () => {
    const user = userEvent.setup();
    await ready();
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (0)" });
    await user.click(statusControl().getByRole("button", { name: "Go to Actions Taken" }));
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken (0)" })).toHaveFocus();
  });

  it("gives Claim this ticket for the owner reason, which moves focus to the owner control", async () => {
    const user = userEvent.setup();
    await ready(detail({ owner: null, permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"], blockedTransitions: [OWNER_REQUIRED] }));
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent(`Resolved — ${OWNER_REQUIRED.message}`);
    expect(statusControl().queryByRole("button", { name: "Go to Actions Taken" })).not.toBeInTheDocument();

    await user.click(statusControl().getByRole("button", { name: "Claim this ticket" }));
    expect(operational().getByRole("button", { name: "Claim" })).toHaveFocus();
  });

  it("takes the person to the assignment picker instead when the ticket is owned but the move still needs an owner (a resolved ticket kept without one)", async () => {
    const user = userEvent.setup();
    await ready(
      detail({
        currentStatus: "RESOLVED",
        owner: null,
        permittedTransitions: ["REOPENED"],
        blockedTransitions: [{ to: "CLOSED", code: "OWNER_REQUIRED", message: OWNER_REQUIRED.message }],
      }),
    );
    await user.click(statusControl().getByRole("button", { name: "Claim this ticket" }));
    expect(operational().getByRole("button", { name: "Claim" })).toHaveFocus();
  });

  it("explains a cancelled ticket in one line, with no select and nothing to apply", async () => {
    await ready(detail({ currentStatus: "CANCELLED", permittedTransitions: [], blockedTransitions: [] }));
    expect(statusControl().getByText("This ticket is cancelled and cannot change.")).toBeInTheDocument();
    expect(statusControl().queryByLabelText("Move to")).not.toBeInTheDocument();
    expect(statusControl().queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("says no move is available yet, and still explains why, when the matrix allows moves but none is permitted", async () => {
    await ready(detail({ permittedTransitions: [], blockedTransitions: [ACTION_REQUIRED] }));
    expect(statusControl().queryByLabelText("Move to")).not.toBeInTheDocument();
    expect(statusControl().getByText("No move is available yet.")).toBeInTheDocument();
    expect(statusControl().queryByText(/cannot change/)).not.toBeInTheDocument();
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent("Resolved — Record at least one action");
  });

  it("shows the same control to an Administrator as to IT Staff, because the API permits it (BR-42)", async () => {
    vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(detail());
    render(<StaffTicketDetail ticketId={12} currentUserId={9} currentUser={{ fullName: "Malee Sutthiwong", role: "ADMINISTRATOR" }} />);
    await screen.findByTestId("detail-ticket-number");
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(statusControl().getByRole("list", { name: "Not available now" })).toBeInTheDocument();
  });
});

describe("UI-11 the reason for Resolved, Cancelled, and Reopened (AC-16, BR-19)", () => {
  const open = detail({
    permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    blockedTransitions: [],
  });

  it.each([["RESOLVED", "Resolved"], ["CANCELLED", "Cancelled"]] as const)("requires a reason before Apply is enabled for %s, and sends it", async (value, label) => {
    const user = userEvent.setup();
    const change = vi.spyOn(api, "changeTicketStatus").mockResolvedValue({ ticket: detail({ currentStatus: value, permittedTransitions: [], blockedTransitions: [] }), comment: null });
    await ready(open);
    await user.selectOptions(statusControl().getByLabelText("Move to"), value);

    const reason = statusControl().getByLabelText(/^Reason/);
    expect(reason).toBeRequired();
    expect(statusControl().getByRole("button", { name: "Apply" })).toBeDisabled();
    await user.type(reason, "abcd");
    expect(statusControl().getByRole("button", { name: "Apply" })).toBeDisabled();
    await user.type(reason, "e");
    expect(statusControl().getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(statusControl().getByText(/Posted as a Public Comment/)).toBeInTheDocument();

    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    expect(change).toHaveBeenCalledWith(12, value, "abcde", 4);
    expect(await screen.findByText(`Status changed to ${label}.`)).toBeInTheDocument();
  });

  it("requires a reason for Reopened, too", async () => {
    const user = userEvent.setup();
    await ready(detail({ currentStatus: "CLOSED", permittedTransitions: ["REOPENED"], blockedTransitions: [] }));
    await user.selectOptions(statusControl().getByLabelText("Move to"), "REOPENED");
    expect(statusControl().getByLabelText(/^Reason/)).toBeRequired();
    expect(statusControl().getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("asks for no reason for a move that does not need one, and sends none", async () => {
    const user = userEvent.setup();
    const change = vi.spyOn(api, "changeTicketStatus").mockResolvedValue({ ticket: detail({ currentStatus: "WAITING_FOR_REQUESTER" }), comment: null });
    await ready(open);
    await user.selectOptions(statusControl().getByLabelText("Move to"), "WAITING_FOR_REQUESTER");
    expect(statusControl().queryByLabelText(/^Reason/)).not.toBeInTheDocument();
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    expect(change).toHaveBeenCalledWith(12, "WAITING_FOR_REQUESTER", undefined, 4);
  });
});

describe("UI-12 a gate refusal that reaches the server (AC-03, AC-16, BR-18)", () => {
  async function refused(error: ApiError) {
    const user = userEvent.setup();
    vi.spyOn(api, "changeTicketStatus").mockRejectedValue(error);
    // The screen thought the gate was open; the server knows better. The reload shows what is true now.
    const afterwards = detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"], blockedTransitions: [error.code === "ACTION_REQUIRED" ? ACTION_REQUIRED : FOLLOW_UP_PENDING] });
    await ready(detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], blockedTransitions: [] }));
    fetchTicket.mockResolvedValue(afterwards);
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (0)" });
    await user.selectOptions(statusControl().getByLabelText("Move to"), "RESOLVED");
    await user.type(statusControl().getByLabelText(/^Reason/), "Toner replaced and tested.");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    return user;
  }

  it.each([
    [new ApiError(409, "ACTION_REQUIRED", ACTION_REQUIRED.message)],
    [new ApiError(409, "FOLLOW_UP_PENDING", FOLLOW_UP_PENDING.message)],
  ])("shows %s as its own callout with the API's sentence, never as a generic failure", async (error) => {
    await refused(error);
    const callout = await operational().findByRole("alert");
    expect(callout).toHaveTextContent(error.message);
    expect(callout).toHaveAttribute("data-state", "warning");
    expect(callout).not.toHaveTextContent(/That did not work|Something went wrong|ACTION_REQUIRED|FOLLOW_UP_PENDING/);
  });

  it("keeps the reason that was typed through the refusal: it is still in the form when a move that needs one is chosen (BR-54)", async () => {
    const user = await refused(new ApiError(409, "ACTION_REQUIRED", ACTION_REQUIRED.message));
    await operational().findByRole("alert");
    await waitFor(() => expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]));
    await user.selectOptions(statusControl().getByLabelText("Move to"), "CANCELLED");
    expect(statusControl().getByLabelText(/^Reason/)).toHaveValue("Toner replaced and tested.");
  });

  it("offers Go to Actions Taken in the callout, which focuses the region, and the blocked list now explains it", async () => {
    const error = new ApiError(409, "ACTION_REQUIRED", ACTION_REQUIRED.message);
    const user = await refused(error);
    const callout = await operational().findByRole("alert");
    await user.click(within(callout).getByRole("button", { name: "Go to Actions Taken" }));
    expect(screen.getByRole("heading", { level: 2, name: /^Actions Taken/ })).toHaveFocus();

    // The screen reloaded: Resolved left the select and arrived in the list.
    await waitFor(() => expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]));
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent("Resolved — Record at least one action");
  });
});

describe("UI-13 a successful change refreshes the screen without a reload (AC-16, FR-14)", () => {
  it("updates the summary, the badge, the select, the blocked list, and the timeline from the response, and says so", async () => {
    const user = userEvent.setup();
    const before = detail({ currentStatus: "OPEN", permittedTransitions: ["IN_PROGRESS", "CANCELLED"], blockedTransitions: [], version: 4 });
    const after = detail({ currentStatus: "IN_PROGRESS", permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"], blockedTransitions: [ACTION_REQUIRED], version: 5 });
    const change = vi.spyOn(api, "changeTicketStatus").mockResolvedValue({ ticket: after, comment: null });
    await ready(before);
    fetchHistory.mockResolvedValue([changeRow(1)]);

    expect(offered()).toEqual(["IN_PROGRESS", "CANCELLED"]);
    await user.selectOptions(statusControl().getByLabelText("Move to"), "IN_PROGRESS");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Status changed to In Progress.")).toBeInTheDocument();
    expect(change).toHaveBeenCalledWith(12, "IN_PROGRESS", undefined, 4);
    // The header badge, the Current badge, the select, and the blocked list all show the new state.
    expect(within(screen.getByRole("region", { name: "What the Requester submitted" })).getByText("In Progress")).toBeInTheDocument();
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent("Resolved — Record at least one action");
    // And the timeline asked again, so the new step is there.
    const timeline = within(await screen.findByRole("region", { name: "Status History" }));
    await waitFor(() => expect(timeline.getByText("Open")).toBeInTheDocument());
    expect(fetchHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
    // No reload of the ticket was needed.
    expect(fetchTicket).toHaveBeenCalledTimes(1);
  });

  it("sends the version it was showing with the next change, which is the new one", async () => {
    const user = userEvent.setup();
    const first = detail({ currentStatus: "OPEN", permittedTransitions: ["IN_PROGRESS", "CANCELLED"], blockedTransitions: [], version: 4 });
    const second = detail({ currentStatus: "IN_PROGRESS", permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"], blockedTransitions: [], version: 5 });
    const change = vi.spyOn(api, "changeTicketStatus");
    change.mockResolvedValueOnce({ ticket: second, comment: null });
    change.mockResolvedValueOnce({ ticket: detail({ currentStatus: "WAITING_FOR_REQUESTER", version: 6 }), comment: null });
    await ready(first);
    await user.selectOptions(statusControl().getByLabelText("Move to"), "IN_PROGRESS");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    await screen.findByText("Status changed to In Progress.");
    await user.selectOptions(statusControl().getByLabelText("Move to"), "WAITING_FOR_REQUESTER");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2));
    expect(change.mock.calls.map((call) => call[3])).toEqual([4, 5]);
  });

  it("sends the version with a change of owner and of IT Priority as well, and takes the new one back", async () => {
    const user = userEvent.setup();
    const priority = vi.spyOn(api, "setItPriority").mockResolvedValue(detail({ itPriority: "HIGH", version: 5 }));
    const owner = vi.spyOn(api, "setTicketOwner").mockResolvedValue(detail({ owner: SIRIPORN, version: 6 }));
    await ready(detail({ version: 4 }));
    await user.selectOptions(operational().getByLabelText("IT Priority"), "HIGH");
    await user.click(operational().getByRole("button", { name: "Update IT Priority" }));
    await screen.findByText("IT Priority is now HIGH.");
    expect(priority).toHaveBeenCalledWith(12, "HIGH", 4);

    await user.selectOptions(operational().getByLabelText("Reassign to"), String(COLLEAGUE));
    await user.click(operational().getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(owner).toHaveBeenCalledTimes(1));
    expect(owner).toHaveBeenCalledWith(12, COLLEAGUE, ME, 5);
  });
});

function changeRow(id: number): StatusChange {
  return change(id, "NEW", "OPEN", "2026-09-28T03:00:00.000Z");
}

describe("UI-14 a 409 STALE_UPDATE (AC-14, BR-26, ui-spec §1.5)", () => {
  const latest = detail({
    currentStatus: "IN_PROGRESS",
    owner: SIRIPORN,
    version: 6,
    permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
    blockedTransitions: [ACTION_REQUIRED],
  });
  const stale = () =>
    new ApiError(409, "STALE_UPDATE", "This ticket changed while you were working on it. Review the latest version and try again.", {}, latest);

  async function conflictOnStatus() {
    const user = userEvent.setup();
    vi.spyOn(api, "changeTicketStatus").mockRejectedValue(stale());
    await ready(detail({ currentStatus: "OPEN", permittedTransitions: ["IN_PROGRESS", "CANCELLED"], blockedTransitions: [], version: 4 }));
    fetchTicket.mockResolvedValue(latest);
    await user.selectOptions(statusControl().getByLabelText("Move to"), "CANCELLED");
    await user.type(statusControl().getByLabelText(/^Reason/), "Duplicate of another ticket.");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    return { user, callout: await operational().findByRole("alert") };
  }

  it("shows the conflict callout naming the current status and owner, as its own message", async () => {
    const { callout } = await conflictOnStatus();
    expect(callout).toHaveAttribute("data-state", "warning");
    expect(callout).toHaveTextContent("This ticket changed while you were working on it");
    expect(callout).toHaveTextContent("for example a colleague moved it, or the Requester marked the problem as appearing resolved");
    expect(callout).toHaveTextContent("It is now In Progress, owned by Siriporn Kaewmanee.");
    expect(callout).toHaveTextContent("Review it and try again.");
    expect(callout).not.toHaveTextContent(/STALE_UPDATE|Something went wrong|That did not work/);
  });

  it("keeps the reason that was typed, and does not reload by itself", async () => {
    const { callout } = await conflictOnStatus();
    expect(statusControl().getByLabelText(/^Reason/)).toHaveValue("Duplicate of another ticket.");
    expect(within(callout).getByRole("button", { name: "Show latest" })).toBeEnabled();
    expect(fetchTicket).toHaveBeenCalledTimes(1);
  });

  it("reloads the ticket on Show latest, shows what is true now, and still keeps the reason", async () => {
    const { user, callout } = await conflictOnStatus();
    await user.click(within(callout).getByRole("button", { name: "Show latest" }));

    await waitFor(() => expect(fetchTicket).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(operational().queryByRole("alert")).not.toBeInTheDocument());
    // The owner control now shows the owner the server reported.
    expect(operational().getByLabelText("Reassign to")).toHaveValue(String(COLLEAGUE));
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(within(screen.getByRole("region", { name: "What the Requester submitted" })).getByText("In Progress")).toBeInTheDocument();
    // CANCELLED is still offered, so what the person chose and typed is still there.
    expect(statusControl().getByLabelText("Move to")).toHaveValue("CANCELLED");
    expect(statusControl().getByLabelText(/^Reason/)).toHaveValue("Duplicate of another ticket.");
  });

  it("says so, and keeps the form, when Show latest cannot read the ticket", async () => {
    const { user, callout } = await conflictOnStatus();
    fetchTicket.mockRejectedValue(new TypeError("offline"));
    await user.click(within(callout).getByRole("button", { name: "Show latest" }));
    expect(await operational().findByRole("alert")).toHaveTextContent("The latest version could not be loaded. Please try again.");
    expect(statusControl().getByLabelText(/^Reason/)).toHaveValue("Duplicate of another ticket.");
  });

  it("answers a stale change of IT Priority or owner the same way", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "setItPriority").mockRejectedValue(stale());
    await ready(detail({ version: 4 }));
    fetchTicket.mockResolvedValue(latest);
    await user.selectOptions(operational().getByLabelText("IT Priority"), "URGENT");
    await user.click(operational().getByRole("button", { name: "Update IT Priority" }));
    const callout = await operational().findByRole("alert");
    expect(callout).toHaveTextContent("It is now In Progress, owned by Siriporn Kaewmanee.");
    expect(operational().getByLabelText("IT Priority")).toHaveValue("URGENT");
  });

  it("says a ticket with no owner has none", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "changeTicketStatus").mockRejectedValue(
      new ApiError(409, "STALE_UPDATE", "stale", {}, detail({ owner: null, currentStatus: "NEW", version: 6, permittedTransitions: ["OPEN", "CANCELLED"], blockedTransitions: [] })),
    );
    await ready(detail({ version: 4 }));
    await user.selectOptions(statusControl().getByLabelText("Move to"), "CANCELLED");
    await user.type(statusControl().getByLabelText(/^Reason/), "Duplicate of another ticket.");
    await user.click(statusControl().getByRole("button", { name: "Apply" }));
    expect(await operational().findByRole("alert")).toHaveTextContent("It is now New, with no owner.");
  });
});

describe("UI-15 the Status History on the staff and Requester screens (AC-13, FR-13, ui-spec §1.4, §6)", () => {
  const steps = [
    change(1, "NEW", "OPEN", "2026-09-28T03:00:00.000Z"),
    change(2, "OPEN", "IN_PROGRESS", "2026-09-28T04:00:00.000Z", SIRIPORN),
    change(3, "IN_PROGRESS", "WAITING_FOR_REQUESTER", "2026-09-29T09:00:00.000Z"),
  ];

  it("lists, on the staff screen, an ordered timeline that starts with Ticket created, in the last region", async () => {
    fetchHistory.mockResolvedValue(steps);
    await ready();
    const region = await screen.findByRole("region", { name: "Status History" });
    const list = await within(region).findByRole("list");
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Ticket created");
    expect(items[0].querySelector("time")).toHaveAttribute("datetime", "2026-09-28T02:10:00.000Z");

    // The last region of the screen (ui-spec §6.1).
    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
    expect(names.at(-1)).toBe("Status History");
  });

  it("spells each status out with its badge, and shows who changed it, with their role, and when", async () => {
    fetchHistory.mockResolvedValue(steps);
    await ready();
    const region = within(await screen.findByRole("region", { name: "Status History" }));
    const second = within((await region.findAllByRole("listitem"))[2]);
    expect(second.getByText("Open")).toBeInTheDocument();
    expect(second.getByText("In Progress")).toBeInTheDocument();
    expect(second.getByText("Siriporn Kaewmanee")).toBeInTheDocument();
    expect(second.getByText("IT Staff")).toBeInTheDocument();
    expect(second.getByRole("time")).toHaveAttribute("datetime", "2026-09-28T04:00:00.000Z");
    // Never the raw enum.
    expect(region.queryByText(/IN_PROGRESS|WAITING_FOR_REQUESTER/)).not.toBeInTheDocument();
    expect(within((await region.findAllByRole("listitem"))[3]).getByText("Waiting for Requester")).toBeInTheDocument();
  });

  it("shows only Ticket created for a ticket that has never changed, a legacy ticket included", async () => {
    fetchHistory.mockResolvedValue([]);
    await ready();
    const region = within(await screen.findByRole("region", { name: "Status History" }));
    const items = await region.findAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Ticket created");
  });

  it("keeps its loading and its failure inside the region, with Try again, and leaves the rest of the screen working", async () => {
    const user = userEvent.setup();
    fetchHistory.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "Something went wrong."));
    await ready();
    const region = within(await screen.findByRole("region", { name: "Status History" }));
    const callout = await region.findByRole("alert");
    expect(callout).toHaveTextContent("Cannot load the status history right now.");
    expect(callout).not.toHaveTextContent(/500|INTERNAL_ERROR/);
    // The status control is untouched.
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);

    fetchHistory.mockResolvedValue(steps);
    await user.click(region.getByRole("button", { name: "Try again" }));
    expect(await region.findAllByRole("listitem")).toHaveLength(4);
  });

  it("shows a skeleton while it loads", async () => {
    fetchHistory.mockReturnValue(new Promise(() => {}));
    await ready();
    const region = within(await screen.findByRole("region", { name: "Status History" }));
    expect(region.getByRole("status")).toHaveAttribute("data-state", "loading");
  });

  describe("on the Requester's screen", () => {
    function requesterTicket(): api.TicketDetail {
      return {
        id: 12,
        ticketNumber: "TT-2026-00042",
        ticketDate: "2026-09-28T02:10:00.000Z",
        summary: "Printer on floor 3 will not print",
        description: "It shows a paper jam, but there is no paper stuck.",
        requestedPriority: "MEDIUM",
        currentStatus: "WAITING_FOR_REQUESTER",
        requester: { id: 3, fullName: "Pornchai Thana" },
        category: { id: 1, name: "Hardware" },
        relatedSystem: { id: 1, name: "Campus Printers" },
        createdAt: "2026-09-28T02:10:00.000Z",
        updatedAt: "2026-09-29T09:14:22.310Z",
        requesterResolvedAt: null,
        attachments: [],
      } as api.TicketDetail;
    }

    it("shows the same timeline, after Actions Taken and before the attachments, read-only", async () => {
      vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(requesterTicket());
      fetchHistory.mockResolvedValue(steps);
      render(<RequesterTicketDetail ticketId={12} />);
      await screen.findByTestId("detail-ticket-number");
      const region = within(await screen.findByRole("region", { name: "Status History" }));
      const items = await region.findAllByRole("listitem");
      expect(items).toHaveLength(4);
      expect(items[0]).toHaveTextContent("Ticket created");
      expect(region.queryAllByRole("button")).toHaveLength(0);

      const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent ?? "");
      expect(names.findIndex((n) => /^Actions Taken/.test(n))).toBeLessThan(names.indexOf("Status History"));
      expect(names.indexOf("Status History")).toBeLessThan(names.findIndex((n) => /^Attachments/.test(n)));
      // Nothing that hints at an Internal Note (Lab 3 AC-17).
      expect(names.some((n) => /Internal/.test(n))).toBe(false);
    });

    it("keeps its own empty, failure, and Try again, without touching the rest of the screen", async () => {
      const user = userEvent.setup();
      vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(requesterTicket());
      fetchHistory.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "Something went wrong."));
      render(<RequesterTicketDetail ticketId={12} />);
      await screen.findByTestId("detail-ticket-number");
      const region = within(await screen.findByRole("region", { name: "Status History" }));
      expect(await region.findByText("Cannot load the status history right now.")).toBeInTheDocument();
      expect(screen.getByTestId("detail-summary")).toBeInTheDocument();
      fetchHistory.mockResolvedValue([]);
      await user.click(region.getByRole("button", { name: "Try again" }));
      expect(await region.findAllByRole("listitem")).toHaveLength(1);
    });
  });
});

describe("UI-16 the Requester's panel and the absence of any status control (AC-15, BR-20)", () => {
  it("says only IT Staff can resolve a ticket, and that the mark is only a signal", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({
      id: 12,
      ticketNumber: "TT-2026-00042",
      ticketDate: "2026-09-28T02:10:00.000Z",
      summary: "Printer on floor 3 will not print",
      description: "It shows a paper jam.",
      requestedPriority: "MEDIUM",
      currentStatus: "IN_PROGRESS",
      requester: { id: 3, fullName: "Pornchai Thana" },
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 1, name: "Campus Printers" },
      createdAt: "2026-09-28T02:10:00.000Z",
      updatedAt: "2026-09-29T09:14:22.310Z",
      requesterResolvedAt: null,
      attachments: [],
    } as api.TicketDetail);
    render(<RequesterTicketDetail ticketId={12} />);
    await screen.findByTestId("detail-ticket-number");

    const panel = within(screen.getByTestId("appears-resolved"));
    expect(panel.getByText("Only IT Staff can resolve a ticket. This tells them you think it is fixed.")).toBeInTheDocument();

    // No status control of any kind: no "Move to", no Apply, no select, on the whole screen.
    expect(screen.queryByLabelText("Move to")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText("Not available now")).not.toBeInTheDocument();
  });
});

describe("UI-10 (continued) the status control follows the gate as actions are recorded and edited (AC-03, AC-16, FR-09)", () => {
  const closing = (overrides: Partial<api.ActionTaken> = {}): api.ActionTaken => ({
    id: 90,
    ticketId: 12,
    actionAt: new Date().toISOString(),
    description: "Replaced the toner cartridge and ran a test page.",
    result: "Test page printed cleanly.",
    performedBy: { id: ME, fullName: NATTAPONG.fullName, role: "IT_STAFF" },
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    ...overrides,
  });
  const gateOpen = () =>
    detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], blockedTransitions: [] });

  it("offers Resolved, and drops the explanation, as soon as an action with no follow-up is recorded, without a reload", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createActionTaken").mockResolvedValue(closing());
    await ready(detail({ version: 4 }));
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (0)" });
    expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(statusControl().getByRole("list", { name: "Not available now" })).toBeInTheDocument();

    // Recording the action opens the gate on the server; the screen has to ask again to know.
    fetchTicket.mockResolvedValue(gateOpen());
    await user.click(screen.getByRole("button", { name: "+ Add action" }));
    const form = within(screen.getByRole("form", { name: "Record an action" }));
    await user.type(form.getByLabelText(/^Action Description/), "Replaced the toner cartridge.");
    await user.type(form.getByLabelText(/^Result/), "Printed cleanly.");
    await user.click(form.getByRole("button", { name: "Save action" }));

    await waitFor(() => expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]));
    expect(statusControl().queryByText("Not available now")).not.toBeInTheDocument();
    expect(fetchTicket).toHaveBeenCalledTimes(2);
  });

  it("takes Resolved away again when an edit leaves the latest action needing follow-up", async () => {
    const user = userEvent.setup();
    fetchActions().mockResolvedValue([closing()]);
    vi.spyOn(api, "editActionTaken").mockResolvedValue(closing({ followUpRequired: true, followUpNote: "Check on Thursday.", version: 2 }));
    await ready(gateOpen());
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (1)" });
    expect(offered()).toContain("RESOLVED");

    fetchTicket.mockResolvedValue(detail({ blockedTransitions: [FOLLOW_UP_PENDING] }));
    await user.click(screen.getByRole("button", { name: /^Edit action/ }));
    const form = within(screen.getByRole("form", { name: "Edit action" }));
    await user.click(form.getByRole("radio", { name: "Yes" }));
    await user.type(form.getByLabelText(/^Follow-up Note/), "Check on Thursday.");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(offered()).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]));
    expect(statusControl().getByRole("list", { name: "Not available now" })).toHaveTextContent(`Resolved — ${FOLLOW_UP_PENDING.message}`);
  });

  it("keeps the move and the reason the person had chosen when it refreshes, so recording an action does not cost them what they typed", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createActionTaken").mockResolvedValue(closing());
    await ready(detail({ permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"], blockedTransitions: [ACTION_REQUIRED], version: 4 }));
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (0)" });
    await user.selectOptions(statusControl().getByLabelText("Move to"), "CANCELLED");
    await user.type(statusControl().getByLabelText(/^Reason/), "Duplicate of another ticket.");

    fetchTicket.mockResolvedValue(gateOpen());
    await user.click(screen.getByRole("button", { name: "+ Add action" }));
    const form = within(screen.getByRole("form", { name: "Record an action" }));
    await user.type(form.getByLabelText(/^Action Description/), "Compared with the other ticket.");
    await user.type(form.getByLabelText(/^Result/), "It is the same fault.");
    await user.click(form.getByRole("button", { name: "Save action" }));

    await waitFor(() => expect(offered()).toContain("RESOLVED"));
    expect(statusControl().getByLabelText("Move to")).toHaveValue("CANCELLED");
    expect(statusControl().getByLabelText(/^Reason/)).toHaveValue("Duplicate of another ticket.");
  });

  it("does not drop the saved action when the refresh of the ticket fails: the failure is the control's, not the region's", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createActionTaken").mockResolvedValue(closing());
    await ready(detail({ version: 4 }));
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (0)" });
    fetchTicket.mockRejectedValue(new TypeError("offline"));
    await user.click(screen.getByRole("button", { name: "+ Add action" }));
    const form = within(screen.getByRole("form", { name: "Record an action" }));
    await user.type(form.getByLabelText(/^Action Description/), "Replaced the toner cartridge.");
    await user.type(form.getByLabelText(/^Result/), "Printed cleanly.");
    await user.click(form.getByRole("button", { name: "Save action" }));

    expect(await screen.findByText("Action recorded.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^Actions Taken/ })).getAllByRole("listitem")).toHaveLength(1);
  });
});

function fetchActions() {
  return vi.mocked(api.fetchActionsTaken);
}
