import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TokTickITApp, ROUTES } from "../../src/TokTickITApp.js";
import { AppShell, NAV_ITEMS } from "../../src/components/AppShell.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";
import type { AuthUser, TicketListResponse } from "../../src/api.js";

// Issue 8 AC-2, AC-3, AC-4 — application shell navigation, active-page
// indication, and the mobile menu. AC-1 (reference-data APIs) is covered by
// the backend suite.
//
// Lab 3, Issue 5: the application is entered by signing in, not through the
// Development Requester selector, so these tests start from a signed-in
// Requester. What they check about navigation is unchanged.

const REQUESTER: AuthUser = {
  id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", role: "REQUESTER", isActive: true, mustChangePassword: false,
};

const EMPTY_LIST: TicketListResponse = {
  data: [],
  meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
};

beforeEach(() => {
  vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(REQUESTER);
  vi.spyOn(api, "fetchMyTickets").mockResolvedValue(EMPTY_LIST);
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Email" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mounts the app at a route with a Requester signed in. */
function renderAt(path: string) {
  return render(<TokTickITApp initialEntries={[path]} />);
}

/** Mounts the app at a route with nobody signed in. */
function renderSignedOut(path: string) {
  vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
  return render(<TokTickITApp initialEntries={[path]} />);
}

describe("application identity and navigation", () => {
  it("shows the TokTickIT identity in the shell", async () => {
    renderAt(ROUTES.list);
    expect(await screen.findByText("TokTickIT")).toBeInTheDocument();
  });

  it("offers My Tickets and Create Ticket navigation", async () => {
    renderAt(ROUTES.list);

    for (const item of NAV_ITEMS) {
      expect(await screen.findByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("labels the navigation landmark", async () => {
    renderAt(ROUTES.list);
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("navigates from My Tickets to Create Ticket", async () => {
    renderAt(ROUTES.list);

    await userEvent.click(await screen.findByRole("link", { name: "Create Ticket" }));
    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });

  it("navigates from Create Ticket back to My Tickets", async () => {
    renderAt(ROUTES.create);
    await screen.findByLabelText(/^Ticket Summary/);

    await userEvent.click(screen.getByRole("link", { name: "My Tickets" }));
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("keeps the shell on every application screen", async () => {
    renderAt(ROUTES.create);

    expect(await screen.findByTestId("current-user")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Logout" }).length).toBeGreaterThan(0);
  });
});

describe("active-page indication", () => {
  it("marks My Tickets as the current page on the list route", async () => {
    renderAt(ROUTES.list);

    const active = await screen.findByRole("link", { name: "My Tickets" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("tt-shell__link--active");
  });

  it("marks Create Ticket as the current page on the create route", async () => {
    renderAt(ROUTES.create);

    const active = await screen.findByRole("link", { name: "Create Ticket" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("tt-shell__link--active");
  });

  it("marks exactly one link as current at a time", async () => {
    renderAt(ROUTES.create);
    await screen.findByLabelText(/^Ticket Summary/);

    const inactive = screen.getByRole("link", { name: "My Tickets" });
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive.className).not.toContain("--active");
  });

  it("does not mark My Tickets active on the create route", async () => {
    // /tickets is a prefix of /tickets/new, so without an exact match both
    // links would light up at once.
    renderAt(ROUTES.create);

    const myTickets = await screen.findByRole("link", { name: "My Tickets" });
    expect(myTickets).not.toHaveAttribute("aria-current");
  });

  it("updates the indication as the user navigates", async () => {
    renderAt(ROUTES.list);
    expect(await screen.findByRole("link", { name: "My Tickets" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(screen.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
  });

  it("conveys the current page by more than colour", async () => {
    // aria-current for assistive technology, plus an underline class for sight.
    renderAt(ROUTES.list);
    const active = await screen.findByRole("link", { name: "My Tickets" });

    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("tt-shell__link--active");
  });
});

describe("mobile navigation", () => {
  it("offers a menu toggle", async () => {
    renderAt(ROUTES.list);

    const toggle = await screen.findByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls");
  });

  it("opens and closes the menu", async () => {
    renderAt(ROUTES.list);
    const toggle = await screen.findByRole("button", { name: "Menu" });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Both navigations are mounted; CSS decides which is visible.
    expect(screen.getAllByRole("link", { name: "My Tickets" })).toHaveLength(2);

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the menu after navigating", async () => {
    renderAt(ROUTES.list);
    const toggle = await screen.findByRole("button", { name: "Menu" });

    await userEvent.click(toggle);
    const links = screen.getAllByRole("link", { name: "Create Ticket" });
    await userEvent.click(links[links.length - 1]);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
  });

  it("carries the same links as the desktop navigation", async () => {
    renderAt(ROUTES.list);
    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    for (const item of NAV_ITEMS) {
      expect(screen.getAllByRole("link", { name: item.label })).toHaveLength(2);
    }
  });
});

describe("route guarding", () => {
  it("redirects to Login when nobody is signed in", async () => {
    renderSignedOut(ROUTES.list);

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();
  });

  it("guards the create route too", async () => {
    renderSignedOut(ROUTES.create);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("guards the detail route too", async () => {
    renderSignedOut("/tickets/42");
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends an unknown route to My Tickets", async () => {
    renderAt("/nowhere");
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("sends a malformed ticket id back to the list", async () => {
    renderAt("/tickets/not-a-number");
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("skips Login when someone is already signed in", async () => {
    renderAt(ROUTES.login);
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("honours a deep link once the session is known", async () => {
    // Loading the session takes a request, so for one frame the guard does not
    // know who is signed in. It must not act on that: the user asked for Create
    // Ticket and must arrive at Create Ticket, not the list.
    renderAt(ROUTES.create);
    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });

  it("returns to the requested page after signing in", async () => {
    vi.spyOn(api, "login").mockResolvedValue(REQUESTER);
    renderSignedOut(ROUTES.create);

    await userEvent.type(await screen.findByLabelText(/^Email/), REQUESTER.email);
    await userEvent.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });
});

describe("shell layout at mobile size", () => {
  it("renders the menu toggle and the desktop nav as separate regions", async () => {
    const { container } = renderAt(ROUTES.list);
    await screen.findByTestId("current-user");

    // CSS hides one or the other per breakpoint; both exist in the DOM so
    // there is no viewport measurement in JavaScript.
    expect(container.querySelector(".tt-shell__desktop-nav")).not.toBeNull();
    expect(container.querySelector(".tt-shell__menu-toggle")).not.toBeNull();
  });

  it("renders the shell without a user block when nobody is signed in", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(null);
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppShell>content</AppShell>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("content")).toBeInTheDocument();
    expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
