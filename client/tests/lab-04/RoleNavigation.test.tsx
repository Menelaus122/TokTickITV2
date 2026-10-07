import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import * as api from "../../src/api.js";
import type { AuthUser, Role, StaffTicketDetail as Detail } from "../../src/api.js";

// Lab 4, Issue 2 — UI-27 and UI-28 in docs/lab-04/tests.md (ui-spec §2;
// specification.md FR-23, FR-24, BR-42, BR-45, D-08).
//
// The seam is the rendered application: the router, the shell, and the screens
// as a person in each role would meet them. The API client is the system
// boundary, so it is the only thing mocked.
//
// UI-27's "lands on their Dashboard" and the Dashboard navigation item arrive
// with Issues 7 and 8 (UI-37); until then a role bounced from a page lands on
// its own Lab 3 home. UI-28's Actions Taken controls arrived with Issue 5.

const USERS: Record<Role, AuthUser> = {
  REQUESTER: { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true, mustChangePassword: false },
  IT_STAFF: { id: 7, fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  ADMINISTRATOR: { id: 9, fullName: "Malee Sutthiwong", email: "malee.admin@toktickit.local", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
};
const ADMIN = USERS.ADMINISTRATOR;

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
    currentStatus: "NEW",
    owner: null,
    requester: { id: 3, fullName: "Pornchai Thana", email: "pornchai@toktickit.local", role: "REQUESTER", isActive: true },
    requesterResolvedAt: null,
    createdAt: "2026-09-28T02:10:00.000Z",
    updatedAt: "2026-09-29T09:14:22.310Z",
    attachments: [],
    version: 1,
    permittedTransitions: ["OPEN", "CANCELLED"],
    blockedTransitions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(api, "fetchMyTickets").mockResolvedValue({
    data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
  });
  vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "fetchQueue").mockResolvedValue({ tickets: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
    { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
    { id: 9, fullName: "Malee Sutthiwong", role: "ADMINISTRATOR", isActive: true },
  ]);
  vi.spyOn(api, "fetchUsers").mockResolvedValue([]);
  vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(detail());
  vi.spyOn(api, "fetchComments").mockResolvedValue([]);
  vi.spyOn(api, "fetchNotes").mockResolvedValue([]);
  vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
  vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signedInAs(role: Role) {
  vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(USERS[role]);
}

const FORBIDDEN = "You do not have access to that page.";

describe("UI-27 an Administrator works from the Ticket Queue (FR-23, FR-24, D-08)", () => {
  it("offers Ticket Queue as well as User Management", async () => {
    signedInAs("ADMINISTRATOR");
    render(<TokTickITApp initialEntries={["/users"]} />);

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Ticket Queue", "User Management"]);
  });

  it("opens the Ticket Queue, with the queue's own data and no forbidden notice", async () => {
    signedInAs("ADMINISTRATOR");
    render(<TokTickITApp initialEntries={["/queue"]} />);

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    // The heading is the card's title and renders on the first paint; the request
    // comes from an effect a moment later, so wait for it instead of assuming it.
    await waitFor(() => expect(api.fetchQueue).toHaveBeenCalled());
    expect(screen.queryByText(FORBIDDEN)).not.toBeInTheDocument();
    // Marked as the current page, as it is for IT Staff.
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
  });

  it("opens a ticket's staff detail screen", async () => {
    signedInAs("ADMINISTRATOR");
    render(<TokTickITApp initialEntries={["/queue/12"]} />);

    expect(await screen.findByTestId("detail-ticket-number")).toHaveTextContent("TT-2026-00042");
    expect(api.fetchStaffTicket).toHaveBeenCalledWith(12);
    expect(screen.queryByText(FORBIDDEN)).not.toBeInTheDocument();
  });

  it("takes an Administrator back to the ticket they asked for once they have signed in", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
    vi.spyOn(api, "login").mockResolvedValue(ADMIN);
    render(<TokTickITApp initialEntries={["/queue/12"]} />);

    await userEvent.type(await screen.findByLabelText(/^Email/), ADMIN.email);
    await userEvent.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // Not their landing page: the page they asked for, which is now theirs to open.
    expect(await screen.findByTestId("detail-ticket-number")).toHaveTextContent("TT-2026-00042");
  });

  // [role, path typed, link that is current at home, the request the refused
  // screen would have made]. The last column is never the home screen's own
  // request: IT Staff are sent to the queue, so their row names a different one.
  it.each([
    ["REQUESTER", "/queue", "My Tickets", "fetchQueue"],
    ["REQUESTER", "/queue/12", "My Tickets", "fetchStaffTicket"],
    ["REQUESTER", "/users", "My Tickets", "fetchUsers"],
    ["IT_STAFF", "/users", "Ticket Queue", "fetchUsers"],
    ["IT_STAFF", "/tickets", "Ticket Queue", "fetchMyTickets"],
    ["ADMINISTRATOR", "/tickets/new", "User Management", "fetchCategories"],
  ] as [Role, string, string, "fetchQueue" | "fetchStaffTicket" | "fetchUsers" | "fetchMyTickets" | "fetchCategories"][])(
    "a %s typing %s is still sent home with a forbidden notice",
    async (role, path, home, refusedRequest) => {
      signedInAs(role);
      render(<TokTickITApp initialEntries={[path]} />);

      expect(await screen.findByText(FORBIDDEN)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: home })).toHaveAttribute("aria-current", "page");
      // The screen they were refused never asked the server for its data.
      expect(api[refusedRequest]).not.toHaveBeenCalled();
    },
  );
});

describe("UI-28 an Administrator on the ticket detail acts as themself (BR-45)", () => {
  async function openAsAdmin(overrides: Partial<Detail> = {}) {
    signedInAs("ADMINISTRATOR");
    vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(detail(overrides));
    render(<TokTickITApp initialEntries={["/queue/12"]} />);
    await screen.findByTestId("detail-ticket-number");
    return within(screen.getByRole("region", { name: "Operational" }));
  }

  it("claims the ticket as the signed-in Administrator, never as someone else", async () => {
    const user = userEvent.setup();
    const claim = vi.spyOn(api, "setTicketOwner").mockResolvedValue(
      detail({ owner: { id: ADMIN.id, fullName: ADMIN.fullName, role: "ADMINISTRATOR", isActive: true }, currentStatus: "OPEN" }),
    );
    const operational = await openAsAdmin();

    await user.click(operational.getByRole("button", { name: "Claim" }));
    await user.click(screen.getByRole("button", { name: "Confirm claim" }));

    // expectedOwnerId null: a claim, so a colleague's earlier claim still wins.
    expect(claim).toHaveBeenCalledWith(12, ADMIN.id, null, 1);
    expect(await screen.findByText("You claimed TT-2026-00042, and it moved to Open.")).toBeInTheDocument();
  });

  it("changes IT Priority, leaving Requested Priority as it was", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(api, "setItPriority").mockResolvedValue(detail({ itPriority: "URGENT" }));
    const operational = await openAsAdmin();

    expect(operational.getByLabelText("Requested Priority")).toHaveAttribute("readonly");
    await user.selectOptions(operational.getByLabelText("IT Priority"), "URGENT");
    await user.click(operational.getByRole("button", { name: "Update IT Priority" }));

    expect(save).toHaveBeenCalledWith(12, "URGENT", 1);
    expect(await screen.findByText("IT Priority is now URGENT.")).toBeInTheDocument();
    expect(operational.getByLabelText("Requested Priority")).toHaveValue("MEDIUM");
  });

  it("offers the status control with exactly the moves the server permits", async () => {
    const operational = await openAsAdmin({
      currentStatus: "OPEN",
      owner: { id: ADMIN.id, fullName: ADMIN.fullName, role: "ADMINISTRATOR", isActive: true },
      permittedTransitions: ["IN_PROGRESS", "CANCELLED"],
    });

    const select = operational.getByLabelText("Move to");
    expect(select).toBeEnabled();
    const offered = within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value).filter(Boolean);
    expect(offered).toEqual(["IN_PROGRESS", "CANCELLED"]);
  });

  it("reads and posts an Internal Note, which an Administrator may do (Lab 3 D-23 no longer applies)", async () => {
    const user = userEvent.setup();
    const existing: api.ThreadEntry = {
      id: 2, body: "Toner order placed.", createdAt: "2026-09-29T09:00:00.000Z",
      author: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF" },
    };
    const mine: api.ThreadEntry = {
      id: 3, body: "Checked the switch.", createdAt: "2026-09-29T10:00:00.000Z",
      author: { id: ADMIN.id, fullName: ADMIN.fullName, role: "ADMINISTRATOR" },
    };
    vi.spyOn(api, "fetchNotes").mockResolvedValue([existing]);
    const note = vi.spyOn(api, "postNote").mockResolvedValue(mine);
    const comment = vi.spyOn(api, "postComment");
    await openAsAdmin();

    const internal = within(screen.getByRole("region", { name: /^Internal Notes/ }));
    expect(await internal.findByText("Toner order placed.")).toBeInTheDocument();
    await user.type(internal.getByLabelText(/Add an internal note/), "Checked the switch.");
    await user.click(internal.getByRole("button", { name: "Post internal note" }));

    // It went to the notes thread and only there; the Requester's thread is untouched.
    expect(note).toHaveBeenCalledWith(12, "Checked the switch.");
    expect(comment).not.toHaveBeenCalled();
    expect(await internal.findByText("Checked the switch.")).toBeInTheDocument();
  });

  // Issue 5 completes UI-28 with the Actions Taken controls (tests.md §3.1).
  describe("Actions Taken", () => {
    const byStaff: api.ActionTaken = {
      id: 31,
      ticketId: 12,
      actionAt: "2026-09-29T03:10:00.000Z",
      description: "Replaced the toner cartridge and ran a test page.",
      result: "Test page printed cleanly.",
      performedBy: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF" },
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
      version: 1,
      createdAt: "2026-09-29T03:12:41.000Z",
      updatedAt: "2026-09-29T03:12:41.000Z",
      updatedBy: null,
    };

    it("records an action as the signed-in Administrator: Performed by is them, and nothing names anyone else", async () => {
      const user = userEvent.setup();
      vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
      const record = vi.spyOn(api, "createActionTaken").mockResolvedValue({
        ...byStaff,
        id: 40,
        performedBy: { id: ADMIN.id, fullName: ADMIN.fullName, role: "ADMINISTRATOR" },
      });
      await openAsAdmin();

      const actions = within(await screen.findByRole("region", { name: /^Actions Taken/ }));
      await user.click(await actions.findByRole("button", { name: "+ Add action" }));
      const form = within(screen.getByRole("form", { name: "Record an action" }));
      expect(form.getByLabelText(/^Performed by/)).toHaveValue(ADMIN.fullName);
      expect(form.getByText("Administrator")).toBeInTheDocument();
      await user.type(form.getByLabelText(/^Action Description/), "Checked the switch on the third floor.");
      await user.type(form.getByLabelText(/^Result/), "The port was off; it is on now.");
      await user.click(form.getByRole("button", { name: "Save action" }));

      expect(await screen.findByText("Action recorded.")).toBeInTheDocument();
      expect(record).toHaveBeenCalledTimes(1);
      const [ticketId, input] = record.mock.calls[0];
      expect(ticketId).toBe(12);
      // The body carries what was typed, never who did it: the session says that.
      expect(Object.keys(input).sort()).toEqual(["actionAt", "description", "followUpRequired", "result"]);
      expect(within(actions.getByRole("list")).getByText(ADMIN.fullName)).toBeInTheDocument();
    });

    it("edits an action that IT Staff recorded, which stays theirs, and is named as the editor", async () => {
      const user = userEvent.setup();
      vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([byStaff]);
      const change = vi.spyOn(api, "editActionTaken").mockResolvedValue({
        ...byStaff,
        result: "Test page printed cleanly; toner at 100%.",
        version: 2,
        updatedAt: "2026-09-29T05:00:00.000Z",
        updatedBy: { id: ADMIN.id, fullName: ADMIN.fullName, role: "ADMINISTRATOR" },
      });
      await openAsAdmin();

      const actions = within(await screen.findByRole("region", { name: /^Actions Taken/ }));
      await user.click(await actions.findByRole("button", { name: /^Edit/ }));
      const form = within(screen.getByRole("form", { name: "Edit action" }));
      // The performer is still the IT Staff member, not the Administrator.
      expect(form.getByLabelText(/^Performed by/)).toHaveValue("Nattapong Saelim");
      const result = form.getByLabelText(/^Result/);
      await user.clear(result);
      await user.type(result, "Test page printed cleanly; toner at 100%.");
      await user.click(form.getByRole("button", { name: "Save changes" }));

      expect(await actions.findByText(/Edited by Malee Sutthiwong/)).toBeInTheDocument();
      expect(change).toHaveBeenCalledWith(12, 31, 1, expect.objectContaining({ result: "Test page printed cleanly; toner at 100%." }));
      expect(actions.getByText("Nattapong Saelim")).toBeInTheDocument();
    });
  });
});
