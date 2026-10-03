import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NEW_PASSWORD_WARNING,
  OWN_ACCOUNT_HELP,
  PASSWORD_HELP,
  SEARCH_DEBOUNCE_MS,
  UserManagement,
} from "../../src/screens/UserManagement.js";
import * as api from "../../src/api.js";
import { ApiError, type AdminUser } from "../../src/api.js";

// Lab 3, Issue 10 — UI-20 to UI-25 in docs/lab-03/tests.md (ui-spec §8;
// FR-38 to FR-45).

const ME = 1;

function account(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 3,
    fullName: "Pornchai Thana",
    email: "pornchai@toktickit.local",
    role: "REQUESTER",
    isActive: true,
    department: "Library",
    mustChangePassword: false,
    lastLoginAt: null,
    ...overrides,
  };
}

const MALEE = account({ id: ME, fullName: "Malee Sutthiwong", email: "malee.admin@toktickit.local", role: "ADMINISTRATOR", department: "IT Administration" });
const PORNCHAI = account();
const PRASERT = account({ id: 7, fullName: "Prasert Chaiyo", email: "prasert.it@toktickit.local", role: "IT_STAFF", isActive: false });

let fetchSpy: MockInstance<typeof api.fetchUsers>;

beforeEach(() => {
  fetchSpy = vi.spyOn(api, "fetchUsers").mockResolvedValue([MALEE, PORNCHAI, PRASERT]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function ready() {
  render(<UserManagement currentUserId={ME} />);
  await screen.findByRole("table");
}

const table = () => within(screen.getByRole("table"));
const panel = () => within(screen.getByRole("dialog"));
const lastParams = () => fetchSpy.mock.calls.at(-1)![0];

async function openEdit(name: string) {
  const user = userEvent.setup();
  await user.click(table().getByRole("button", { name: `Edit ${name}` }));
  return user;
}

describe("UI-20 the list (AC-28, AC-29)", () => {
  it("shows Name, Email, Role, and Status columns with an Edit action, and no delete control (BR-50)", async () => {
    await ready();
    expect(table().getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Name", "Email", "Role", "Status", "Actions"]);
    const row = table().getByText("Prasert Chaiyo").closest("tr")!;
    expect(within(row).getByText("prasert.it@toktickit.local")).toBeInTheDocument();
    expect(within(row).getByText("IT Staff")).toBeInTheDocument();
    expect(within(row).getByText("Inactive")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit Prasert Chaiyo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
    // The signed-in Administrator's own row is marked.
    expect(within(table().getByText("Malee Sutthiwong").closest("tr")!).getByText("You")).toBeInTheDocument();
  });

  it("offers no pagination and no sortable headers (labsheet §8.5)", async () => {
    await ready();
    expect(screen.queryByRole("button", { name: /next|previous/i })).not.toBeInTheDocument();
    for (const header of table().getAllByRole("columnheader")) expect(within(header).queryByRole("button")).not.toBeInTheDocument();
  });

  it("searches by name or email after the debounce, and filters by one role", async () => {
    const user = userEvent.setup();
    await ready();
    expect(lastParams()).toEqual({ q: undefined, role: undefined });

    await user.type(screen.getByLabelText("Search name or email"), "  prasert ");
    await waitFor(() => expect(lastParams()).toEqual({ q: "prasert", role: undefined }), { timeout: SEARCH_DEBOUNCE_MS * 4 });

    await user.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");
    await waitFor(() => expect(lastParams()).toEqual({ q: "prasert", role: "IT_STAFF" }));
    expect(within(screen.getByLabelText("Role")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Any", "Requester", "IT Staff", "Administrator"]);
  });

  it("shows no-results with Clear search, which clears both the search and the role", async () => {
    const user = userEvent.setup();
    await ready();
    fetchSpy.mockResolvedValue([]);
    await user.selectOptions(screen.getByLabelText("Role"), "ADMINISTRATOR");
    expect(await screen.findByText("No users match this search")).toBeInTheDocument();

    fetchSpy.mockResolvedValue([MALEE, PORNCHAI, PRASERT]);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await screen.findByRole("table");
    expect(lastParams()).toEqual({ q: undefined, role: undefined });
    expect(screen.getByLabelText("Role")).toHaveValue("");
  });

  it("shows the empty, loading, failure, and forbidden states", async () => {
    let finish!: (users: AdminUser[]) => void;
    fetchSpy.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { unmount } = render(<UserManagement currentUserId={ME} />);
    expect(screen.getByText("Loading users…")).toBeInTheDocument();
    finish([]);
    expect(await screen.findByText("No users yet.")).toBeInTheDocument();
    unmount();

    fetchSpy.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "x")).mockResolvedValue([PORNCHAI]);
    const second = render(<UserManagement currentUserId={ME} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    second.unmount();

    fetchSpy.mockRejectedValue(new ApiError(403, "FORBIDDEN", "x"));
    render(<UserManagement currentUserId={ME} />);
    expect(await screen.findByText(/do not have permission to manage users/)).toBeInTheDocument();
  });
});

describe("UI-21 the create panel (AC-30)", () => {
  it("uses radio buttons for the one role, defaults Active on, and requires the initial password with its helper text", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("button", { name: "+ Create user" }));

    expect(panel().getByRole("heading", { name: "Create user" })).toBeInTheDocument();
    const radios = panel().getAllByRole("radio");
    expect(radios.map((r) => r.parentElement!.textContent!.trim())).toEqual(["Requester", "IT Staff", "Administrator"]);
    expect(panel().queryByRole("listbox")).not.toBeInTheDocument();
    expect(panel().getByRole("switch", { name: "Active" })).toBeChecked();
    expect(panel().getByLabelText(/Initial password/)).toBeRequired();
    expect(panel().getByText(PASSWORD_HELP)).toBeInTheDocument();
  });

  it("shows each missing field beneath itself before sending anything", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createUser");
    await ready();
    await user.click(screen.getByRole("button", { name: "+ Create user" }));
    await user.click(panel().getByRole("button", { name: "Create user" }));

    expect(create).not.toHaveBeenCalled();
    expect(panel().getByText("Enter the user's full name.")).toBeInTheDocument();
    expect(panel().getByText("Enter an email address.")).toBeInTheDocument();
    expect(panel().getByText("Choose one role: Requester, IT Staff, or Administrator.")).toBeInTheDocument();
    expect(panel().getByText("Enter an initial password.")).toBeInTheDocument();
  });

  it("creates the user, closes the panel, reports success, and reloads the list", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createUser").mockResolvedValue(account({ id: 40, fullName: "New Person", role: "IT_STAFF", mustChangePassword: true }));
    await ready();
    const before = fetchSpy.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "+ Create user" }));
    await user.type(panel().getByLabelText(/Full name/), "New Person");
    await user.type(panel().getByLabelText(/Email/), "new.person@toktickit.local");
    await user.click(panel().getByRole("radio", { name: "IT Staff" }));
    await user.type(panel().getByLabelText(/Initial password/), "Welcome#2026");
    await user.click(panel().getByRole("button", { name: "Create user" }));

    expect(create).toHaveBeenCalledWith({ fullName: "New Person", email: "new.person@toktickit.local", role: "IT_STAFF", isActive: true, initialPassword: "Welcome#2026" });
    expect(await screen.findByText(/Created New Person\. They must change the initial password/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("UI-22 a duplicate email (AC-31)", () => {
  it("renders on the email field", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "updateUser").mockRejectedValue(
      new ApiError(409, "EMAIL_IN_USE", "That email is already in use.", { email: "Another user already has this email." }),
    );
    await ready();
    await openEdit("Pornchai Thana");
    const email = panel().getByLabelText(/Email/);
    await user.clear(email);
    await user.type(email, "malee.admin@toktickit.local");
    await user.click(panel().getByRole("button", { name: "Save changes" }));

    const message = await panel().findByText("Another user already has this email.");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("UI-23 the Administrator's own account (AC-32)", () => {
  it("disables Role and Active with the explanatory helper text, and offers no new initial password", async () => {
    await ready();
    await openEdit("Malee Sutthiwong");
    for (const radio of panel().getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(panel().getByRole("switch", { name: "Active" })).toBeDisabled();
    expect(panel().getByText(OWN_ACCOUNT_HELP)).toBeInTheDocument();
    expect(panel().getByLabelText(/Full name/)).toBeEnabled();
    expect(panel().queryByRole("button", { name: "Set new initial password" })).not.toBeInTheDocument();
  });

  it("sends only the fields that changed, so a name edit never carries role or activation", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(api, "updateUser").mockResolvedValue({ ...MALEE, fullName: "Malee S." });
    await ready();
    await openEdit("Malee Sutthiwong");
    const name = panel().getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, "Malee S.");
    await user.click(panel().getByRole("button", { name: "Save changes" }));
    expect(update).toHaveBeenCalledWith(ME, { fullName: "Malee S." });
    expect(await screen.findByText("Saved Malee S..")).toBeInTheDocument();
  });

  it("leaves other users' Role and Active editable", async () => {
    await ready();
    await openEdit("Pornchai Thana");
    for (const radio of panel().getAllByRole("radio")) expect(radio).toBeEnabled();
    expect(panel().getByRole("switch", { name: "Active" })).toBeEnabled();
    expect(panel().queryByText(OWN_ACCOUNT_HELP)).not.toBeInTheDocument();
  });
});

describe("UI-24 the last Administrator (AC-33)", () => {
  it("renders the refusal as its own callout and keeps the panel open", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "updateUser").mockRejectedValue(new ApiError(409, "LAST_ADMINISTRATOR", "At least one active Administrator is required."));
    fetchSpy.mockResolvedValue([MALEE, account({ id: 2, fullName: "Kittisak Phromma", role: "ADMINISTRATOR" })]);
    await ready();
    await openEdit("Kittisak Phromma");
    await user.click(panel().getByRole("switch", { name: "Active" }));
    await user.click(panel().getByRole("button", { name: "Save changes" }));

    const callout = await panel().findByRole("alert");
    expect(callout).toHaveTextContent("At least one active Administrator is required.");
    expect(callout).toHaveAttribute("data-state", "refused");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("UI-25 a new initial password (AC-34)", () => {
  it("confirms with the sign-out consequence before sending, then reports success", async () => {
    const user = userEvent.setup();
    const issue = vi.spyOn(api, "issueInitialPassword").mockResolvedValue();
    await ready();
    await openEdit("Pornchai Thana");
    await user.click(panel().getByRole("button", { name: "Set new initial password" }));

    const confirm = within(screen.getByRole("group", { name: "Set new initial password" }));
    expect(confirm.getByText(NEW_PASSWORD_WARNING)).toBeInTheDocument();
    await user.click(confirm.getByRole("button", { name: "Set password and sign out" }));
    expect(issue).not.toHaveBeenCalled();
    expect(confirm.getByText("Enter an initial password.")).toBeInTheDocument();

    await user.type(confirm.getByLabelText(/New initial password/), "Fresh-start#2026");
    await user.click(confirm.getByRole("button", { name: "Set password and sign out" }));
    expect(issue).toHaveBeenCalledWith(3, "Fresh-start#2026");
    expect(await screen.findByText(/Set a new initial password for Pornchai Thana\. They were signed out everywhere\./)).toBeInTheDocument();
  });

  it("shows the server's field message beneath the password", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "issueInitialPassword").mockRejectedValue(
      new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", { initialPassword: "Password must not be your email address." }),
    );
    await ready();
    await openEdit("Pornchai Thana");
    await user.click(panel().getByRole("button", { name: "Set new initial password" }));
    const confirm = within(screen.getByRole("group", { name: "Set new initial password" }));
    await user.type(confirm.getByLabelText(/New initial password/), "pornchai@toktickit.local");
    await user.click(confirm.getByRole("button", { name: "Set password and sign out" }));
    expect(await confirm.findByText("Password must not be your email address.")).toBeInTheDocument();
  });
});

describe("busy and failure", () => {
  it("disables the form and labels the button while saving, so one request is sent", async () => {
    const user = userEvent.setup();
    let finish!: (value: AdminUser) => void;
    const update = vi.spyOn(api, "updateUser").mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await ready();
    await openEdit("Pornchai Thana");
    await user.click(panel().getByRole("radio", { name: "IT Staff" }));
    await user.click(panel().getByRole("button", { name: "Save changes" }));

    const busy = panel().getByRole("button", { name: "Saving…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(panel().getByLabelText(/Full name/)).toBeDisabled();
    await user.click(busy);
    expect(update).toHaveBeenCalledTimes(1);

    finish({ ...PORNCHAI, role: "IT_STAFF" });
    expect(await screen.findByText("Saved Pornchai Thana.")).toBeInTheDocument();
  });

  it("shows a safe message for an unexpected failure and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "updateUser").mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    await ready();
    await openEdit("Pornchai Thana");
    const name = panel().getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, "Pornchai T.");
    await user.click(panel().getByRole("button", { name: "Save changes" }));
    expect(await panel().findByRole("alert")).toHaveTextContent("That did not work. Please try again.");
    expect(name).toHaveValue("Pornchai T.");
  });

  it("says that deactivating signs the user out", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "updateUser").mockResolvedValue({ ...PORNCHAI, isActive: false });
    await ready();
    await openEdit("Pornchai Thana");
    await user.click(panel().getByRole("switch", { name: "Active" }));
    await user.click(panel().getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Saved Pornchai Thana. They were signed out everywhere.")).toBeInTheDocument();
  });

  it("closes the panel with Cancel and with Escape", async () => {
    const user = await openAndReturn();
    await user.click(panel().getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(table().getByRole("button", { name: "Edit Pornchai Thana" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

async function openAndReturn() {
  await ready();
  return openEdit("Pornchai Thana");
}
