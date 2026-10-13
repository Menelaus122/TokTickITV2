import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePassword, PASSWORD_RULES } from "../../src/screens/ChangePassword.js";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import * as api from "../../src/api.js";
import { ApiError, type AuthUser } from "../../src/api.js";

// Lab 3, Issue 5 — UI-05 and UI-06 in docs/lab-03/tests.md (ui-spec §4).

const EMAIL = "first.login@toktickit.local";

afterEach(() => {
  vi.restoreAllMocks();
});

async function fill(current: string, next: string, confirm = next) {
  if (current) await userEvent.type(screen.getByLabelText(/^Current password/), current);
  if (next) await userEvent.type(screen.getByLabelText(/^New password/), next);
  if (confirm) await userEvent.type(screen.getByLabelText(/^Confirm new password/), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
}

describe("UI-05 the rules, field by field", () => {
  it("states the rules above the fields, where a validation message cannot hide them", async () => {
    render(<ChangePassword email={EMAIL} mandatory={false} onChange={vi.fn()} />);
    const rules = screen.getByText(PASSWORD_RULES);
    const firstField = screen.getByLabelText(/^Current password/);
    // DOCUMENT_POSITION_FOLLOWING: the first field comes after the rules.
    expect(rules.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Still visible with every field in error.
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(screen.getByText(PASSWORD_RULES)).toBeVisible();
  });

  it.each([
    ["too short", "Toktickit#2026", "short-7", undefined, /^New password/, /at least 8/],
    ["too long", "Toktickit#2026", "a".repeat(73), undefined, /^New password/, /at most 72/],
    ["over 72 bytes in Thai", "Toktickit#2026", "ก".repeat(25), undefined, /^New password/, /too long/],
    ["equal to the email", "Toktickit#2026", EMAIL, undefined, /^New password/, /^Password must not be your email/],
    ["equal to the current one", "Toktickit#2026", "Toktickit#2026", undefined, /^New password/, /different/],
    ["a mismatched confirmation", "Toktickit#2026", "Brand-new-horse-9", "Brand-new-horse-8", /^Confirm new password/, /do not match/],
  ])("rejects %s beneath its field and sends nothing", async (_label, current, next, confirm, field, message) => {
    const onChange = vi.fn();
    render(<ChangePassword email={EMAIL} mandatory={false} onChange={onChange} />);
    await fill(current, next, confirm);

    const control = screen.getByLabelText(field);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sends a valid change and confirms it", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<ChangePassword email={EMAIL} mandatory={false} onChange={onChange} />);
    await fill("Toktickit#2026", "Brand-new-horse-9");

    expect(onChange).toHaveBeenCalledWith({
      currentPassword: "Toktickit#2026",
      newPassword: "Brand-new-horse-9",
      confirmPassword: "Brand-new-horse-9",
    });
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });

  it("clears only the current password when it was wrong", async () => {
    const onChange = vi.fn().mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "Your current password is incorrect."));
    render(<ChangePassword email={EMAIL} mandatory={false} onChange={onChange} />);
    await fill("Wrong-horse-1", "Brand-new-horse-9");

    expect(await screen.findByRole("alert")).toHaveTextContent("Your current password is incorrect.");
    expect(screen.getByLabelText(/^Current password/)).toHaveValue("");
    expect(screen.getByLabelText(/^New password/)).toHaveValue("Brand-new-horse-9");
  });
});

describe("UI-06 a mandatory change blocks the application (BR-02)", () => {
  const firstLogin: AuthUser = {
    id: 99, fullName: "Somchai Jaidee", email: EMAIL, role: "REQUESTER", isActive: true, mustChangePassword: true,
  };

  beforeEach(() => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(firstLogin);
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false },
    });
    vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
    // Lab 4, Issue 7 (D-09): once the password is saved, a Requester lands on the Dashboard.
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
  });

  it.each(["/tickets", "/tickets/new", "/tickets/5", "/queue", "/nowhere"])(
    "sends %s to the change screen, with no shell to escape through",
    async (path) => {
      render(<TokTickITApp initialEntries={[path]} />);

      expect(await screen.findByText("Set your own password before continuing.")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();
    },
  );

  it("moves focus to the heading, so the redirect is announced", async () => {
    render(<TokTickITApp initialEntries={["/tickets"]} />);
    const heading = await screen.findByRole("heading", { name: "Change password" });
    expect(heading).toHaveFocus();
  });

  it("offers Logout, for someone who signed in to the wrong account", async () => {
    const logout = vi.spyOn(api, "logout").mockResolvedValue(undefined);
    render(<TokTickITApp initialEntries={["/tickets"]} />);
    await screen.findByText("Set your own password before continuing.");

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("lets the user into the application once the password is saved", async () => {
    vi.spyOn(api, "changePassword").mockResolvedValue(undefined);
    render(<TokTickITApp initialEntries={["/tickets"]} />);
    await screen.findByText("Set your own password before continuing.");

    await fill("Toktickit#2026", "Brand-new-horse-9");

    // Changed in Lab 4, Issue 7 (D-09): the application they enter is the Dashboard.
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome, Somchai" })).toBeInTheDocument();
    expect(screen.getByTestId("current-user")).toHaveTextContent("Somchai Jaidee");
  });
});
