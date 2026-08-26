import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicket } from "../../src/screens/CreateTicket.js";
import { RequesterProvider, STORAGE_KEY, useRequester } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import { TicketValidationError } from "../../src/api.js";
import type { Requester, Ticket } from "../../src/api.js";

// Issue 5 AC-1 to AC-7 — the Create Ticket screen.

const REQUESTER: Requester = {
  id: 3,
  fullName: "Pornchai Thana",
  email: "pornchai.than@kmutt.ac.th",
  department: "Library",
};

const CATEGORIES = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];

const SYSTEMS = [
  { id: 2, name: "Corporate Laptop" },
  { id: 1, name: "Email" },
];

const CREATED: Ticket = {
  id: 42,
  ticketNumber: "TT-2026-00042",
  ticketDate: "2026-08-25T09:14:22.310Z",
  summary: "Laptop battery drains within 30 minutes",
  description: "Since Monday the corporate laptop battery falls from 100% to 5%.",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  requester: { id: 3, fullName: "Pornchai Thana" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  createdAt: "2026-08-25T09:14:22.310Z",
  updatedAt: "2026-08-25T09:14:22.310Z",
};

const GOOD_SUMMARY = "Laptop battery drains within 30 minutes";
const GOOD_DESCRIPTION =
  "Since Monday the corporate laptop battery falls from 100% to 5% in about half an hour.";

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "fetchCategories").mockResolvedValue(CATEGORIES);
  vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue(SYSTEMS);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

// Mirrors how the application mounts this screen: the requester gate renders
// nothing until a Development Requester is in context, so the screen never sees
// a null requester. The selection is restored from localStorage exactly as it
// is for a returning user.
function Gate({ children }: { children: React.ReactNode }) {
  const { requester } = useRequester();
  return requester ? <>{children}</> : null;
}

function renderScreen() {
  window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
  return render(
    <RequesterProvider available={[REQUESTER]}>
      <Gate>
        <CreateTicket />
      </Gate>
    </RequesterProvider>,
  );
}

async function fillValidForm() {
  await userEvent.selectOptions(await screen.findByLabelText(/^Category/), "2");
  await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "2");
  await userEvent.selectOptions(screen.getByLabelText(/^Requested Priority/), "MEDIUM");
  await userEvent.type(screen.getByLabelText(/^Ticket Summary/), GOOD_SUMMARY);
  await userEvent.type(screen.getByLabelText(/^Description/), GOOD_DESCRIPTION);
}

describe("reference data comes from the database", () => {
  it("loads Category and Related System options from the API", async () => {
    renderScreen();

    expect(await screen.findByRole("option", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Account and Access" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Corporate Laptop" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Email" })).toBeInTheDocument();

    expect(api.fetchCategories).toHaveBeenCalledTimes(1);
    expect(api.fetchRelatedSystems).toHaveBeenCalledTimes(1);
  });

  it("shows a safe error with retry when reference data cannot load", async () => {
    vi.spyOn(api, "fetchCategories").mockRejectedValue(new Error("down"));
    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Cannot load Categories and Related Systems/i);
    expect(alert.textContent).not.toMatch(/http|500|stack|prisma/i);
  });
});

describe("read-only versus editable fields", () => {
  it("marks the system-generated fields read-only", async () => {
    renderScreen();

    for (const label of ["Ticket Number", "Ticket Date", "Requester"]) {
      const field = await screen.findByLabelText(label);
      expect(field).toHaveAttribute("readonly");
      expect(field.className).toContain("tt-field__control--readonly");
    }
  });

  it("populates the Requester field from the selected Development Requester", async () => {
    renderScreen();
    expect(await screen.findByLabelText("Requester")).toHaveValue("Pornchai Thana");
  });

  it("shows no ticket number before the backend generates one", async () => {
    renderScreen();
    expect(await screen.findByLabelText("Ticket Number")).toHaveValue("Generated on submit");
  });

  it("leaves the Requester-owned fields editable", async () => {
    renderScreen();

    for (const label of [/^Ticket Summary/, /^Description/, /^Category/]) {
      const field = await screen.findByLabelText(label);
      expect(field).not.toHaveAttribute("readonly");
    }
  });
});

describe("validation before submit", () => {
  it("shows field messages and issues no request when the form is empty", async () => {
    const create = vi.spyOn(api, "createTicket");
    renderScreen();

    await userEvent.click(await screen.findByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Summary is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByText("Category is required.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a summary that is too short without calling the API", async () => {
    const create = vi.spyOn(api, "createTicket");
    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText(/^Category/), "2");
    await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "2");
    await userEvent.selectOptions(screen.getByLabelText(/^Requested Priority/), "MEDIUM");
    await userEvent.type(screen.getByLabelText(/^Ticket Summary/), "abc");
    await userEvent.type(screen.getByLabelText(/^Description/), GOOD_DESCRIPTION);
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText(/Summary must be between 5 and 120/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("renders a server field rejection in the same place as a client one", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new TicketValidationError({ summary: "Summary must be between 5 and 120 characters." }),
    );
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText(/Summary must be between 5 and 120/)).toBeInTheDocument();
  });
});

describe("submission", () => {
  it("sends the requester id and the trimmed payload", async () => {
    const create = vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(3, {
      categoryId: 2,
      relatedSystemId: 2,
      summary: GOOD_SUMMARY,
      description: GOOD_DESCRIPTION,
      requestedPriority: "MEDIUM",
    });
  });

  it("sends no ticket number, date, or status of its own", async () => {
    const create = vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "categoryId",
      "description",
      "relatedSystemId",
      "requestedPriority",
      "summary",
    ]);
  });

  it("shows a busy, disabled Submit while the request is in flight", async () => {
    let release!: (ticket: Ticket) => void;
    vi.spyOn(api, "createTicket").mockReturnValue(
      new Promise<Ticket>((resolve) => {
        release = resolve;
      }),
    );
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    const busy = await screen.findByRole("button", { name: /Submitting/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    release(CREATED);
    await screen.findByTestId("created-ticket-number");
  });

  it("issues exactly one request when Submit is clicked twice", async () => {
    let release!: (ticket: Ticket) => void;
    const create = vi.spyOn(api, "createTicket").mockReturnValue(
      new Promise<Ticket>((resolve) => {
        release = resolve;
      }),
    );
    renderScreen();

    await fillValidForm();
    const submit = screen.getByRole("button", { name: "Submit Ticket" });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(create).toHaveBeenCalledTimes(1);

    release(CREATED);
    await screen.findByTestId("created-ticket-number");
  });
});

describe("success state", () => {
  it("shows the ticket number returned by the backend", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByTestId("created-ticket-number")).toHaveTextContent("TT-2026-00042");
    expect(screen.getByRole("status")).toHaveTextContent(/created/i);
  });

  it("offers Create another, which returns to an empty form", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create another" }));

    expect(await screen.findByLabelText(/^Ticket Summary/)).toHaveValue("");
  });
});

describe("API failure preserves what the requester typed", () => {
  it("shows a safe error and keeps every entered value", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("network down"));
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Cannot reach the TokTickIT API/i);
    expect(alert.textContent).not.toMatch(/http|500|stack|prisma|network down/i);

    // Nothing the Requester typed is lost (FR-17, BR-31).
    expect(screen.getByLabelText(/^Ticket Summary/)).toHaveValue(GOOD_SUMMARY);
    expect(screen.getByLabelText(/^Description/)).toHaveValue(GOOD_DESCRIPTION);
    expect(screen.getByLabelText(/^Category/)).toHaveValue("2");
    expect(screen.getByLabelText(/^Related System/)).toHaveValue("2");
    expect(screen.getByLabelText(/^Requested Priority/)).toHaveValue("MEDIUM");
  });

  it("re-enables Submit so the requester can retry", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("network down"));
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toBeEnabled();
  });

  it("shows no success state when creation failed", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("network down"));
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await screen.findByRole("alert");
    expect(screen.queryByTestId("created-ticket-number")).not.toBeInTheDocument();
  });
});
