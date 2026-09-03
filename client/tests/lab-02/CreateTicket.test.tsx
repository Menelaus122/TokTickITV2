import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicket } from "../../src/screens/CreateTicket.js";
import { RequesterProvider, STORAGE_KEY, useRequester } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import { AttachmentError, TicketValidationError } from "../../src/api.js";
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

describe("attachments on the Create Ticket form", () => {
  function makeFile(name: string, type: string, size = 1024) {
    const file = new File([new Uint8Array([1, 2, 3])], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  }

  async function choose(file: File) {
    await userEvent.upload(screen.getByLabelText("Choose a file to attach"), file, {
      applyAccept: false,
    });
  }

  it("offers an attachment picker on the form", async () => {
    renderScreen();

    expect(await screen.findByRole("button", { name: "Choose file" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a file to attach")).toBeInTheDocument();
    expect(screen.getByText("No files chosen.")).toBeInTheDocument();
  });

  it("lists a chosen file before the ticket exists", async () => {
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });

    await choose(makeFile("evidence.pdf", "application/pdf"));

    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.queryByText("No files chosen.")).not.toBeInTheDocument();
  });

  it("lets a chosen file be removed again before submitting", async () => {
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });
    await choose(makeFile("evidence.pdf", "application/pdf"));
    await screen.findByText("evidence.pdf");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("evidence.pdf")).not.toBeInTheDocument();
  });

  it("rejects an unsupported file and never uploads it", async () => {
    const upload = vi.spyOn(api, "uploadAttachment");
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });

    await choose(makeFile("virus.exe", "application/octet-stream"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/files are permitted/);
    expect(screen.getByRole("alert")).toHaveTextContent("virus.exe");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file over 5 MB", async () => {
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });

    await choose(makeFile("big.pdf", "application/pdf", 6 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent(/5 MB/);
  });

  it("shows a valid and an invalid file side by side", async () => {
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });

    await choose(makeFile("evidence.pdf", "application/pdf"));
    await choose(makeFile("virus.exe", "application/octet-stream"));

    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("virus.exe");
  });

  it("stops accepting files at the limit of five", async () => {
    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });

    for (let i = 1; i <= 5; i++) {
      await choose(makeFile(`file${i}.pdf`, "application/pdf"));
      await screen.findByText(`file${i}.pdf`);
    }

    expect(screen.getByRole("button", { name: "Choose file" })).toBeDisabled();

    // The picker is unreachable through the disabled button; forcing a sixth
    // file onto the hidden input is refused by the guard rather than accepted.
    await choose(makeFile("file6.pdf", "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at most 5 attachments/);
    expect(screen.getAllByRole("listitem").filter((li) => li.dataset.state === "selected")).toHaveLength(5);
  });

  it("uploads the chosen files against the new ticket after it is created", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    const upload = vi.spyOn(api, "uploadAttachment").mockResolvedValue({
      id: 90,
      originalFilename: "evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedAt: "2026-08-25T09:20:00.000Z",
      removedAt: null,
      removalReason: null,
      downloadUrl: "/api/attachments/90/download",
    });

    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });
    const file = makeFile("evidence.pdf", "application/pdf");
    await choose(file);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    // The ticket has to exist first, so its id is what the upload targets.
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledWith(3, CREATED.id, file);
  });

  it("keeps the ticket and reports the files that failed", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(
      new AttachmentError("FILE_TOO_LARGE", "Each file must be 5 MB or smaller."),
    );

    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });
    await choose(makeFile("evidence.pdf", "application/pdf"));
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    // The ticket is never rolled back for a failed upload (BR-42).
    expect(await screen.findByTestId("created-ticket-number")).toHaveTextContent("TT-2026-00042");
    expect(screen.getByText(/could not be uploaded/)).toBeInTheDocument();
    expect(screen.getByText("evidence.pdf")).toBeInTheDocument();
  });

  it("does not route away when an upload failed, so the news is visible", async () => {
    const onCreated = vi.fn();
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(
      new AttachmentError("UPLOAD_FAILED", "The file could not be attached."),
    );

    // Stored before rendering, exactly as renderScreen does: the gate renders
    // nothing until the selection has been restored.
    window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
    render(
      <RequesterProvider available={[REQUESTER]}>
        <Gate>
          <CreateTicket onCreated={onCreated} />
        </Gate>
      </RequesterProvider>,
    );

    await screen.findByRole("button", { name: "Choose file" });
    await choose(makeFile("evidence.pdf", "application/pdf"));
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await screen.findByTestId("created-ticket-number");
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "View ticket" })).toBeInTheDocument();
  });

  it("clears the chosen files once the ticket is created", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(
      new AttachmentError("UPLOAD_FAILED", "The file could not be attached."),
    );

    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });
    await choose(makeFile("evidence.pdf", "application/pdf"));
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await screen.findByTestId("created-ticket-number");
    await userEvent.click(screen.getByRole("button", { name: "Create another" }));

    expect(await screen.findByText("No files chosen.")).toBeInTheDocument();
  });

  it("keeps the chosen files when creation itself fails", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("network down"));

    renderScreen();
    await screen.findByRole("button", { name: "Choose file" });
    await choose(makeFile("evidence.pdf", "application/pdf"));
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await screen.findByRole("alert");
    // Nothing the Requester assembled is lost (FR-17, BR-31).
    expect(screen.getByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Ticket Summary/)).toHaveValue(GOOD_SUMMARY);
  });
});

describe("the success state is reachable and complete", () => {
  function renderWith(onCreated?: (t: Ticket) => void, onCancel?: () => void) {
    window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
    return render(
      <RequesterProvider available={[REQUESTER]}>
        <Gate>
          <CreateTicket onCreated={onCreated} onCancel={onCancel} />
        </Gate>
      </RequesterProvider>,
    );
  }

  it("never navigates away by itself, so the confirmation is always seen", async () => {
    // labsheet 8.3 — the success state has to display the Ticket Number and a
    // next action. Routing to the detail screen on success would skip it.
    const onCreated = vi.fn();
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderWith(onCreated);

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByTestId("created-ticket-number")).toHaveTextContent("TT-2026-00042");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the official Ticket Number returned by the backend", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderWith();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent("TT-2026-00042");
    expect(confirmation).toHaveTextContent(/created/i);
  });

  it("offers View ticket as the next action, which opens the new ticket", async () => {
    const onCreated = vi.fn();
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderWith(onCreated);

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await userEvent.click(await screen.findByRole("button", { name: "View ticket" }));

    expect(onCreated).toHaveBeenCalledWith(CREATED);
  });

  it("shows the ticket date and requester alongside the number", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(CREATED);
    renderWith();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await screen.findByTestId("created-ticket-number");

    expect(screen.getByText("Pornchai Thana")).toBeInTheDocument();
    expect(screen.getByText(GOOD_SUMMARY)).toBeInTheDocument();
  });
});

describe("secondary action", () => {
  it("offers Cancel beside Submit Ticket", async () => {
    window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
    const onCancel = vi.fn();
    render(
      <RequesterProvider available={[REQUESTER]}>
        <Gate>
          <CreateTicket onCancel={onCancel} />
        </Gate>
      </RequesterProvider>,
    );

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    expect(cancel.className).toContain("tt-btn--secondary");
    expect(screen.getByRole("button", { name: "Submit Ticket" }).className).toContain(
      "tt-btn--primary",
    );

    await userEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not submit the form when Cancel is used", async () => {
    window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
    const create = vi.spyOn(api, "createTicket");
    render(
      <RequesterProvider available={[REQUESTER]}>
        <Gate>
          <CreateTicket onCancel={() => {}} />
        </Gate>
      </RequesterProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(create).not.toHaveBeenCalled();
  });
});
