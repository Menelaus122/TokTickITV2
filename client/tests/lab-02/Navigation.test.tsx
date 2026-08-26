import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TokTickITApp, ROUTES } from "../../src/TokTickITApp.js";
import { AppShell, NAV_ITEMS } from "../../src/components/AppShell.js";
import { RequesterProvider, STORAGE_KEY } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import type { Requester, TicketListResponse } from "../../src/api.js";

// Issue 8 AC-2, AC-3, AC-4 — application shell navigation, active-page
// indication, and the mobile menu. AC-1 (reference-data APIs) is covered by
// the backend suite.

const REQUESTERS: Requester[] = [
  { id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", department: "Library" },
];

const EMPTY_LIST: TicketListResponse = {
  data: [],
  meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "fetchRequesters").mockResolvedValue(REQUESTERS);
  vi.spyOn(api, "fetchMyTickets").mockResolvedValue(EMPTY_LIST);
  vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 1, name: "Email" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/** Mounts the app at a route with a Requester already selected. */
function renderAt(path: string) {
  window.localStorage.setItem(STORAGE_KEY, String(REQUESTERS[0].id));
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

    expect(await screen.findByTestId("current-requester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
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
  it("redirects to the selector when no Requester is chosen", async () => {
    render(<TokTickITApp initialEntries={[ROUTES.list]} />);

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    expect(screen.queryByTestId("current-requester")).not.toBeInTheDocument();
  });

  it("guards the create route too", async () => {
    render(<TokTickITApp initialEntries={[ROUTES.create]} />);
    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
  });

  it("guards the detail route too", async () => {
    render(<TokTickITApp initialEntries={["/tickets/42"]} />);
    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
  });

  it("sends an unknown route to My Tickets", async () => {
    renderAt("/nowhere");
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("sends a malformed ticket id back to the list", async () => {
    renderAt("/tickets/not-a-number");
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("skips the selector when a Requester is already chosen", async () => {
    renderAt(ROUTES.select);
    expect(await screen.findByLabelText("Search tickets")).toBeInTheDocument();
  });

  it("honours a deep link once the stored selection is restored", async () => {
    // Restoring the selection takes an effect, so for one frame the guard sees
    // no requester. It must not act on that: the user asked for Create Ticket
    // and must arrive at Create Ticket, not the list.
    renderAt(ROUTES.create);
    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });

  it("returns to the requested page after choosing a Requester", async () => {
    // Deep link with nothing stored: selector first, then the intended page.
    render(<TokTickITApp initialEntries={[ROUTES.create]} />);

    await userEvent.selectOptions(
      await screen.findByLabelText(/Development Requester/),
      String(REQUESTERS[0].id),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByLabelText(/^Ticket Summary/)).toBeInTheDocument();
  });
});

describe("shell layout at mobile size", () => {
  it("renders the menu toggle and the desktop nav as separate regions", async () => {
    const { container } = renderAt(ROUTES.list);
    await screen.findByTestId("current-requester");

    // CSS hides one or the other per breakpoint; both exist in the DOM so
    // there is no viewport measurement in JavaScript.
    expect(container.querySelector(".tt-shell__desktop-nav")).not.toBeNull();
    expect(container.querySelector(".tt-shell__menu-toggle")).not.toBeNull();
  });

  it("renders the shell without a Requester block before selection", () => {
    render(
      <MemoryRouter>
        <RequesterProvider available={REQUESTERS}>
          <AppShell>content</AppShell>
        </RequesterProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("current-requester")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
