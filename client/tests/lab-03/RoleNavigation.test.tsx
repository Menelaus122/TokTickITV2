import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import * as api from "../../src/api.js";
import type { AuthUser, Role } from "../../src/api.js";

// Lab 3, Issue 5 — UI-07 and UI-08 in docs/lab-03/tests.md (ui-spec §2,
// FR-13, FR-14, FR-07).

const USERS: Record<Role, AuthUser> = {
  REQUESTER: { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true, mustChangePassword: false },
  IT_STAFF: { id: 7, fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  ADMINISTRATOR: { id: 9, fullName: "Malee Sutthiwong", email: "malee.admin@toktickit.local", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
};

// Changed in Lab 4 (Issue 2, D-08, BR-42): an Administrator also has the Ticket
// Queue; and (Issue 7, D-09) a Requester's list starts with the Dashboard.
// docs/lab-04/tests.md §6.
const NAV: Record<Role, string[]> = {
  REQUESTER: ["Dashboard", "My Tickets", "Create Ticket"],
  IT_STAFF: ["Ticket Queue"],
  ADMINISTRATOR: ["Ticket Queue", "User Management"],
};

// The link that is the current page after landing. Until Lab 4 this was always
// the first link; an Administrator's first link is now the queue, but their
// landing page is still User Management (the Dashboard replaces it in Issue 8).
const HOME: Record<Role, string> = {
  REQUESTER: "Dashboard",
  IT_STAFF: "Ticket Queue",
  ADMINISTRATOR: "User Management",
};

beforeEach(() => {
  // Lab 4, Issue 7: a Requester's home is the Dashboard, which asks for its own data.
  vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
    generatedAt: "2026-10-05T09:00:00.000Z",
    metrics: {
      openTickets: { value: 0, href: "/tickets?group=open" },
      waitingForYou: { value: 0, href: "/tickets?status=WAITING_FOR_REQUESTER" },
      resolved: { value: 0, href: "/tickets?status=RESOLVED" },
      closed: { value: 0, href: "/tickets?status=CLOSED" },
    },
    needsAttention: [],
    recentTickets: [],
  });
  vi.spyOn(api, "fetchMyTickets").mockResolvedValue({
    data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
  });
  vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "fetchQueue").mockResolvedValue({ tickets: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([]);
  vi.spyOn(api, "fetchUsers").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signedInAs(role: Role) {
  vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(USERS[role]);
}

describe("UI-07 each role sees only its own destinations", () => {
  it.each(Object.keys(NAV) as Role[])("%s", async (role) => {
    signedInAs(role);
    render(<TokTickITApp initialEntries={["/"]} />);

    const nav = await screen.findByRole("navigation", { name: "Main" });
    const labels = within(nav).getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(NAV[role]);
    // Landed on the role's own home, marked as the current page.
    expect(within(nav).getByRole("link", { name: HOME[role] })).toHaveAttribute("aria-current", "page");
  });

  // The Lab 3 row for an Administrator typing /queue is gone: the queue is open
  // to them now, and the Lab 4 suite (client/tests/lab-04/RoleNavigation.test.tsx)
  // covers it.
  it.each([
    ["IT_STAFF", "/tickets", "Ticket Queue"],
    ["IT_STAFF", "/users", "Ticket Queue"],
    ["ADMINISTRATOR", "/tickets/new", "User Management"],
    ["REQUESTER", "/queue", "Dashboard"],
    ["REQUESTER", "/users", "Dashboard"],
  ] as [Role, string, string][])("a %s typing %s lands on their own home with a forbidden notice", async (role, path, home) => {
    signedInAs(role);
    render(<TokTickITApp initialEntries={[path]} />);

    expect(await screen.findByText("You do not have access to that page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: home })).toHaveAttribute("aria-current", "page");
  });
});

describe("UI-08 the shell shows who is signed in, and Logout ends it", () => {
  it("shows the user's name and role in place of the Lab 2 Development Requester", async () => {
    signedInAs("IT_STAFF");
    render(<TokTickITApp initialEntries={["/queue"]} />);

    expect(await screen.findByTestId("current-user")).toHaveTextContent("Nattapong Saelim");
    const header = screen.getByRole("banner");
    expect(within(header).getByText("IT Staff")).toHaveAttribute("data-badge", "role");
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
  });

  it("offers Change Password, which opens the voluntary form inside the shell", async () => {
    signedInAs("REQUESTER");
    render(<TokTickITApp initialEntries={["/tickets"]} />);

    await userEvent.click(within(await screen.findByRole("banner")).getByRole("link", { name: "Change Password" }));
    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.queryByText("Set your own password before continuing.")).not.toBeInTheDocument();
  });

  it("logs out, returns to Login, and a protected URL then needs sign-in again (FR-06, FR-07)", async () => {
    signedInAs("REQUESTER");
    const logout = vi.spyOn(api, "logout").mockResolvedValue(undefined);
    const { unmount } = render(<TokTickITApp initialEntries={["/tickets"]} />);

    await userEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: "Logout" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    unmount();

    // The session is gone server-side, so /me now answers 401.
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
    render(<TokTickITApp initialEntries={["/tickets/new"]} />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Ticket Summary/)).not.toBeInTheDocument();
  });

  it("keeps the user signed in, and says so, when the logout request fails (FR-06)", async () => {
    // The HttpOnly cookie can only be ended by the server. If that request
    // fails, the session is still alive, and the screen must not pretend.
    signedInAs("REQUESTER");
    const logout = vi.spyOn(api, "logout").mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(undefined);
    render(<TokTickITApp initialEntries={["/tickets"]} />);

    const banner = await screen.findByRole("banner");
    await userEvent.click(within(banner).getByRole("button", { name: "Logout" }));

    expect(await screen.findByText("Could not sign out. Please try again.")).toBeInTheDocument();
    expect(screen.getByTestId("current-user")).toHaveTextContent("Anucha Wongsawat");
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
    const retry = within(banner).getByRole("button", { name: "Logout" });
    expect(retry).toBeEnabled();

    // Trying again succeeds and only then leaves.
    await userEvent.click(retry);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it("returns to the page asked for after signing in", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
    vi.spyOn(api, "login").mockResolvedValue(USERS.REQUESTER);
    render(<TokTickITApp initialEntries={["/tickets/new"]} />);

    await userEvent.type(await screen.findByLabelText(/^Email/), USERS.REQUESTER.email);
    await userEvent.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });

  it("shows a safe failure with Try again when the API cannot be reached", async () => {
    const me = vi.spyOn(api, "fetchCurrentUser").mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(USERS.REQUESTER);
    render(<TokTickITApp initialEntries={["/tickets"]} />);

    expect(await screen.findByText(/Cannot reach TokTickIT right now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("current-user")).toHaveTextContent("Anucha Wongsawat");
    expect(me).toHaveBeenCalledTimes(2);
  });
});
