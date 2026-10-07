import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/screens/StaffTicketDetail.js";
import * as api from "../../src/api.js";
import { ApiError, type StaffTicketDetail as Detail, type ThreadEntry } from "../../src/api.js";
import { INTERNAL_CAPTION } from "../../src/components/ConversationThread.js";
import type { TicketStatus } from "../../src/components/index.js";

// Lab 3, Issue 9 — UI-15 to UI-19 in docs/lab-03/tests.md (ui-spec §7;
// FR-31 to FR-37).

const ME = 7;
const COLLEAGUE = 8;

const MATRIX: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

function detail(overrides: Partial<Detail> = {}): Detail {
  const currentStatus = overrides.currentStatus ?? "NEW";
  return {
    id: 12,
    ticketNumber: "TT-2026-00042",
    summary: "Printer on floor 3 will not print",
    description: "It shows a paper jam, but there is no paper stuck.",
    categoryName: "Hardware",
    relatedSystemName: "Campus Printers",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus,
    owner: null,
    requester: { id: 3, fullName: "Pornchai Thana", email: "pornchai@toktickit.local", role: "REQUESTER", isActive: true },
    requesterResolvedAt: null,
    createdAt: "2026-09-28T02:10:00.000Z",
    updatedAt: "2026-09-29T09:14:22.310Z",
    attachments: [],
    permittedTransitions: MATRIX[currentStatus],
    ...overrides,
  };
}

const mine = { id: ME, fullName: "Nattapong Saelim", isActive: true };
const theirs = { id: COLLEAGUE, fullName: "Siriporn Kaewmanee", isActive: true };

function entry(id: number, body: string, role: api.Role = "IT_STAFF"): ThreadEntry {
  return { id, body, createdAt: "2026-09-29T09:00:00.000Z", author: { id: ME, fullName: "Nattapong Saelim", role } };
}

let fetchSpy: MockInstance<typeof api.fetchStaffTicket>;

beforeEach(() => {
  fetchSpy = vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(detail());
  vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
    { id: ME, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
    { id: COLLEAGUE, fullName: "Siriporn Kaewmanee", role: "IT_STAFF", isActive: true },
    { id: 9, fullName: "Admin Ploy", role: "ADMINISTRATOR", isActive: true },
  ]);
  vi.spyOn(api, "fetchComments").mockResolvedValue([entry(1, "We are looking at it.")]);
  vi.spyOn(api, "fetchNotes").mockResolvedValue([entry(2, "Toner order placed.")]);
  // Lab 4, Issue 5: the screen now loads the Actions Taken region too. These tests
  // are about other things, so it has none.
  vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function ready(ticket: Detail = detail()) {
  fetchSpy.mockResolvedValue(ticket);
  const view = render(<StaffTicketDetail ticketId={ticket.id} currentUserId={ME} />);
  await screen.findByTestId("detail-ticket-number");
  return view;
}

const operational = () => within(screen.getByRole("region", { name: "Operational" }));
const submitted = () => within(screen.getByRole("region", { name: "What the Requester submitted" }));

describe("regions (FR-31)", () => {
  // Lab 4, Issue 5 added Actions Taken between Operational and Attachments (ui-spec §4).
  it("groups the ticket into the five regions, in order", async () => {
    await ready();
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
    expect(regions).toEqual([
      "What the Requester submitted",
      "Operational",
      expect.stringMatching(/^Actions Taken/),
      expect.stringMatching(/^Attachments/),
      "Public Comments",
      `Internal Notes — ${INTERNAL_CAPTION}`,
    ]);
  });

  it("shows the submitted values as text with no control to edit them", async () => {
    await ready();
    expect(submitted().getByText("Printer on floor 3 will not print")).toBeInTheDocument();
    expect(submitted().getByText("Pornchai Thana")).toBeInTheDocument();
    expect(submitted().getByText("Campus Printers")).toBeInTheDocument();
    expect(submitted().queryAllByRole("textbox")).toHaveLength(0);
    expect(submitted().queryAllByRole("combobox")).toHaveLength(0);
    expect(submitted().queryAllByRole("button")).toHaveLength(0);
  });
});

describe("UI-15 Claim (AC-22)", () => {
  it("is shown only when the ticket is unassigned", async () => {
    const { unmount } = await ready(detail({ owner: null }));
    expect(operational().getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(operational().getByText("Unassigned")).toBeInTheDocument();
    unmount();

    await ready(detail({ owner: theirs, currentStatus: "OPEN" }));
    expect(operational().queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(operational().getByRole("button", { name: "Reassign" })).toBeInTheDocument();
  });

  it("confirms first, saying a NEW ticket also moves to Open, then claims as the current user", async () => {
    const user = userEvent.setup();
    const claim = vi.spyOn(api, "setTicketOwner").mockResolvedValue(detail({ owner: mine, currentStatus: "OPEN" }));
    await ready();

    await user.click(operational().getByRole("button", { name: "Claim" }));
    const confirm = within(screen.getByRole("group", { name: "Confirm claim" }));
    expect(confirm.getByText(/move to Open/)).toBeInTheDocument();
    expect(claim).not.toHaveBeenCalled();

    await user.click(confirm.getByRole("button", { name: "Confirm claim" }));
    // expectedOwnerId null: this is a claim, so a colleague's earlier claim wins (BR-25).
    expect(claim).toHaveBeenCalledWith(12, ME, null);
    expect(await screen.findByText("You claimed TT-2026-00042, and it moved to Open.")).toBeInTheDocument();
    expect(operational().getByText("You")).toBeInTheDocument();
    expect(operational().queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("does not mention Open when the unassigned ticket is past NEW", async () => {
    const user = userEvent.setup();
    await ready(detail({ currentStatus: "REOPENED" }));
    await user.click(operational().getByRole("button", { name: "Claim" }));
    expect(screen.getByRole("group", { name: "Confirm claim" })).not.toHaveTextContent(/Open/);
  });

  it("explains a lost claim race and shows who owns the ticket now (AC-23)", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "setTicketOwner").mockRejectedValue(new ApiError(409, "TICKET_ALREADY_OWNED", "Someone else claimed this ticket first."));
    await ready();
    fetchSpy.mockResolvedValue(detail({ owner: theirs, currentStatus: "OPEN" }));

    await user.click(operational().getByRole("button", { name: "Claim" }));
    await user.click(screen.getByRole("button", { name: "Confirm claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else claimed this ticket first.");
    await waitFor(() => expect(operational().getByText("Siriporn Kaewmanee", { selector: ".tt-owner" })).toBeInTheDocument());
    expect(operational().queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });
});

describe("reassignment (FR-32)", () => {
  it("reassigns through the picker of active IT Staff and Administrators, sending the owner it showed", async () => {
    const user = userEvent.setup();
    const setOwner = vi.spyOn(api, "setTicketOwner").mockResolvedValue(detail({ owner: theirs, currentStatus: "OPEN" }));
    await ready(detail({ owner: mine, currentStatus: "OPEN" }));

    const picker = operational().getByLabelText("Reassign to");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Unassign (no owner)",
      "Nattapong Saelim",
      "Siriporn Kaewmanee",
      "Admin Ploy (Administrator)",
    ]);
    await user.selectOptions(picker, String(COLLEAGUE));
    await user.click(operational().getByRole("button", { name: "Reassign" }));

    expect(setOwner).toHaveBeenCalledWith(12, COLLEAGUE, ME);
    expect(await screen.findByText("TT-2026-00042 is now owned by Siriporn Kaewmanee.")).toBeInTheDocument();
  });

  it("unassigns", async () => {
    const user = userEvent.setup();
    const setOwner = vi.spyOn(api, "setTicketOwner").mockResolvedValue(detail({ owner: null, currentStatus: "OPEN" }));
    await ready(detail({ owner: mine, currentStatus: "OPEN" }));
    await user.selectOptions(operational().getByLabelText("Reassign to"), "");
    await user.click(operational().getByRole("button", { name: "Unassign" }));
    expect(setOwner).toHaveBeenCalledWith(12, null, ME);
  });

  it("keeps an inactive current owner visible in the picker (BR-26)", async () => {
    await ready(detail({ owner: { id: 44, fullName: "Prasert Chaiyo", isActive: false }, currentStatus: "OPEN" }));
    expect(operational().getByText("Inactive")).toBeInTheDocument();
    expect(operational().getByLabelText("Reassign to")).toHaveDisplayValue("Prasert Chaiyo (inactive)");
  });
});

describe("UI-16 priorities (AC-24)", () => {
  it("shows Requested Priority read-only and IT Priority editable, both visible", async () => {
    await ready(detail({ requestedPriority: "MEDIUM", itPriority: "HIGH", owner: mine, currentStatus: "OPEN" }));
    const requested = operational().getByLabelText("Requested Priority");
    expect(requested).toHaveAttribute("readonly");
    expect(requested).not.toBeDisabled();
    expect(requested).toHaveValue("MEDIUM");
    expect(operational().getByLabelText("IT Priority")).toHaveValue("HIGH");
    expect(operational().getByLabelText("IT Priority")).toBeEnabled();
  });

  it("saves a new IT Priority and leaves Requested Priority as it was", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(api, "setItPriority").mockResolvedValue(detail({ itPriority: "URGENT", owner: mine, currentStatus: "OPEN" }));
    await ready(detail({ owner: mine, currentStatus: "OPEN" }));

    const button = operational().getByRole("button", { name: "Update IT Priority" });
    expect(button).toBeDisabled();
    await user.selectOptions(operational().getByLabelText("IT Priority"), "URGENT");
    await user.click(button);

    expect(save).toHaveBeenCalledWith(12, "URGENT");
    expect(await screen.findByText("IT Priority is now URGENT.")).toBeInTheDocument();
    expect(operational().getByLabelText("Requested Priority")).toHaveValue("MEDIUM");
  });
});

describe("UI-17 status offers only permittedTransitions (AC-25)", () => {
  it.each(Object.keys(MATRIX) as TicketStatus[])("from %s", async (status) => {
    await ready(detail({ currentStatus: status, owner: mine }));
    if (MATRIX[status].length === 0) {
      expect(operational().queryByLabelText("Move to")).not.toBeInTheDocument();
      expect(operational().getByText(/is final/)).toBeInTheDocument();
      return;
    }
    const options = within(operational().getByLabelText("Move to")).getAllByRole("option").map((o) => o.getAttribute("value"));
    expect(options).toEqual(["", ...MATRIX[status]]);
  });

  it("offers exactly what the server sent, not the full enum", async () => {
    await ready(detail({ currentStatus: "IN_PROGRESS", owner: mine, permittedTransitions: ["RESOLVED"] }));
    const options = within(operational().getByLabelText("Move to")).getAllByRole("option").map((o) => o.getAttribute("value"));
    expect(options).toEqual(["", "RESOLVED"]);
  });

  it("applies a move that needs no reason and reports it", async () => {
    const user = userEvent.setup();
    const change = vi
      .spyOn(api, "changeTicketStatus")
      .mockResolvedValue({ ticket: detail({ currentStatus: "IN_PROGRESS", owner: mine }), comment: null });
    await ready(detail({ currentStatus: "OPEN", owner: mine }));

    await user.selectOptions(operational().getByLabelText("Move to"), "IN_PROGRESS");
    expect(operational().queryByLabelText(/Reason/)).not.toBeInTheDocument();
    await user.click(operational().getByRole("button", { name: "Apply" }));

    expect(change).toHaveBeenCalledWith(12, "IN_PROGRESS", undefined);
    expect(await screen.findByText("TT-2026-00042 moved to In Progress.")).toBeInTheDocument();
  });

  it("keeps Resolve and Close unavailable until the ticket has an owner (BR-35)", async () => {
    const user = userEvent.setup();
    await ready(detail({ currentStatus: "RESOLVED", owner: null }));
    await user.selectOptions(operational().getByLabelText("Move to"), "CLOSED");
    expect(operational().getByText(/Claim or assign the ticket before moving it to Closed/)).toBeInTheDocument();
    expect(operational().getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("shows the server's refusal and reloads, so the screen matches the ticket", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "changeTicketStatus").mockRejectedValue(new ApiError(409, "INVALID_TRANSITION", "A CANCELLED ticket cannot move to IN_PROGRESS."));
    await ready(detail({ currentStatus: "OPEN", owner: mine }));
    fetchSpy.mockResolvedValue(detail({ currentStatus: "CANCELLED", owner: mine }));

    await user.selectOptions(operational().getByLabelText("Move to"), "IN_PROGRESS");
    await user.click(operational().getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A CANCELLED ticket cannot move to IN_PROGRESS.");
    expect(await operational().findByText(/is final/)).toBeInTheDocument();
  });
});

describe("UI-18 a reason before Apply for Resolved, Cancelled, and Reopened (AC-26)", () => {
  it.each([
    ["IN_PROGRESS", "RESOLVED"],
    ["OPEN", "CANCELLED"],
    ["CLOSED", "REOPENED"],
  ] as Array<[TicketStatus, TicketStatus]>)("%s → %s", async (from, to) => {
    const user = userEvent.setup();
    const change = vi
      .spyOn(api, "changeTicketStatus")
      .mockResolvedValue({ ticket: detail({ currentStatus: to, owner: mine }), comment: entry(50, "Toner replaced and test page printed.") });
    await ready(detail({ currentStatus: from, owner: mine }));

    await user.selectOptions(operational().getByLabelText("Move to"), to);
    const reason = operational().getByLabelText(/Reason/);
    expect(reason).toBeRequired();
    expect(operational().getByText(/Posted as a Public Comment/)).toBeInTheDocument();
    const apply = operational().getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();

    await user.type(reason, "abcd");
    expect(apply).toBeDisabled();
    await user.type(reason, "  Toner replaced and test page printed.  ");
    expect(apply).toBeEnabled();
    await user.click(apply);

    expect(change).toHaveBeenCalledWith(12, to, "abcd  Toner replaced and test page printed.");
    // The reason joins the public thread straight away.
    const thread = within(screen.getByRole("region", { name: "Public Comments" }));
    expect(await thread.findByText("Toner replaced and test page printed.")).toBeInTheDocument();
  });

  it("shows the server's field message beneath the reason", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "changeTicketStatus").mockRejectedValue(
      new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", { reason: "Reason must be between 5 and 2000 characters." }),
    );
    await ready(detail({ currentStatus: "IN_PROGRESS", owner: mine }));
    await user.selectOptions(operational().getByLabelText("Move to"), "RESOLVED");
    await user.type(operational().getByLabelText(/Reason/), "Fixed it today.");
    await user.click(operational().getByRole("button", { name: "Apply" }));
    expect(await operational().findByText("Reason must be between 5 and 2000 characters.")).toBeInTheDocument();
  });
});

describe("UI-19 the two threads (AC-39)", () => {
  it("are distinct regions with distinct button wording and the internal caption", async () => {
    await ready();
    const publicThread = screen.getByRole("region", { name: "Public Comments" });
    const internalThread = screen.getByRole("region", { name: `Internal Notes — ${INTERNAL_CAPTION}` });
    expect(publicThread).not.toBe(internalThread);
    expect(await within(publicThread).findByText("We are looking at it.")).toBeInTheDocument();
    expect(await within(internalThread).findByText("Toner order placed.")).toBeInTheDocument();
    expect(within(internalThread).getByText(INTERNAL_CAPTION)).toBeInTheDocument();
    expect(within(publicThread).getByRole("button", { name: "Post comment" })).toBeInTheDocument();
    expect(within(internalThread).getByRole("button", { name: "Post internal note" })).toBeInTheDocument();
    expect(within(publicThread).queryByText(INTERNAL_CAPTION)).not.toBeInTheDocument();
  });

  it("posts a note to the notes endpoint only", async () => {
    const user = userEvent.setup();
    const note = vi.spyOn(api, "postNote").mockResolvedValue(entry(3, "Called the vendor."));
    const comment = vi.spyOn(api, "postComment");
    await ready();
    const internalThread = within(screen.getByRole("region", { name: `Internal Notes — ${INTERNAL_CAPTION}` }));
    await user.type(await internalThread.findByLabelText(/Add an internal note/), "Called the vendor.");
    await user.click(internalThread.getByRole("button", { name: "Post internal note" }));
    expect(note).toHaveBeenCalledWith(12, "Called the vendor.");
    expect(comment).not.toHaveBeenCalled();
    expect(await internalThread.findByText("Called the vendor.")).toBeInTheDocument();
  });
});

describe("attachments (FR-36, AC-27)", () => {
  const attachments: api.Attachment[] = [
    { id: 1, originalFilename: "error.png", mimeType: "image/png", sizeBytes: 2048, uploadedAt: "2026-09-28T02:12:00.000Z", removedAt: null, removalReason: null, downloadUrl: "/api/staff/attachments/1/download" },
    { id: 2, originalFilename: "old.pdf", mimeType: "application/pdf", sizeBytes: 4096, uploadedAt: "2026-09-28T02:13:00.000Z", removedAt: "2026-09-28T03:00:00.000Z", removalReason: "Wrong file uploaded.", downloadUrl: null },
  ];

  it("lists Lab 2 attachments, downloadable when active and marked when removed, with no add or remove control", async () => {
    const download = vi.spyOn(api, "downloadAttachment").mockResolvedValue();
    const user = userEvent.setup();
    await ready(detail({ attachments }));

    const active = screen.getByTestId("attachment-1");
    const removed = screen.getByTestId("attachment-2");
    expect(within(removed).getByText(/Wrong file uploaded/)).toBeInTheDocument();
    expect(within(removed).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add attachment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    await user.click(within(active).getByRole("button", { name: "Download error.png" }));
    expect(download).toHaveBeenCalledWith(attachments[0], "/api/staff/attachments");
  });

  it("reports a failed download on its row", async () => {
    vi.spyOn(api, "downloadAttachment").mockRejectedValue(new ApiError(410, "ATTACHMENT_REMOVED", "That attachment was removed and can no longer be downloaded."));
    const user = userEvent.setup();
    await ready(detail({ attachments }));
    await user.click(screen.getByRole("button", { name: "Download error.png" }));
    expect(await screen.findByText(/That attachment was removed/)).toBeInTheDocument();
  });
});

describe("busy, forbidden, not found, and failure (FR-37)", () => {
  it("shows the busy control and disables the others while one request is in flight", async () => {
    const user = userEvent.setup();
    let finish!: (value: Detail) => void;
    vi.spyOn(api, "setItPriority").mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await ready(detail({ owner: mine, currentStatus: "OPEN" }));

    await user.selectOptions(operational().getByLabelText("IT Priority"), "HIGH");
    await user.click(operational().getByRole("button", { name: "Update IT Priority" }));

    const busyButton = operational().getByRole("button", { name: "Saving…" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(operational().getByLabelText("Reassign to")).toBeDisabled();
    expect(operational().getByLabelText("Move to")).toBeDisabled();

    finish(detail({ owner: mine, currentStatus: "OPEN", itPriority: "HIGH" }));
    expect(await screen.findByText("IT Priority is now HIGH.")).toBeInTheDocument();
    expect(operational().getByLabelText("Move to")).toBeEnabled();
  });

  it("shows a safe message, not the server's, for an unexpected failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "setItPriority").mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    await ready(detail({ owner: mine, currentStatus: "OPEN" }));
    await user.selectOptions(operational().getByLabelText("IT Priority"), "LOW");
    await user.click(operational().getByRole("button", { name: "Update IT Priority" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not work. Please try again.");
  });

  it.each([
    [403, /do not have permission/],
    [404, /Ticket not found/],
    [500, /Cannot load this ticket/],
  ])("renders the %s state", async (status, text) => {
    fetchSpy.mockRejectedValue(new ApiError(status, "X", "x"));
    render(<StaffTicketDetail ticketId={12} currentUserId={ME} />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId("detail-ticket-number")).not.toBeInTheDocument();
  });

  it("shows the Requester's appears-resolved signal", async () => {
    await ready(detail({ owner: mine, currentStatus: "IN_PROGRESS", requesterResolvedAt: "2026-09-30T08:00:00.000Z" }));
    expect(operational().getByText(/appears resolved/)).toBeInTheDocument();
  });
});
