import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import {
  RequesterProvider,
  STORAGE_KEY,
  useRequester,
} from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import { AttachmentError } from "../../src/api.js";
import type { Attachment, Requester, TicketDetail } from "../../src/api.js";

// Issue 7 AC-1, AC-2, AC-6 — the read-only Ticket Detail screen.

const REQUESTER: Requester = {
  id: 3,
  fullName: "Pornchai Thana",
  email: "pornchai.than@kmutt.ac.th",
  department: "Library",
};

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 90,
    originalFilename: "battery-report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 184320,
    uploadedAt: "2026-08-25T09:20:00.000Z",
    removedAt: null,
    removalReason: null,
    downloadUrl: "/api/attachments/90/download",
    ...overrides,
  };
}

function ticket(attachments: Attachment[] = []): TicketDetail {
  return {
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
    attachments,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function Gate({ children }: { children: React.ReactNode }) {
  const { requester } = useRequester();
  return requester ? <>{children}</> : null;
}

function renderScreen(props: Partial<Parameters<typeof RequesterTicketDetail>[0]> = {}) {
  window.localStorage.setItem(STORAGE_KEY, String(REQUESTER.id));
  return render(
    <RequesterProvider available={[REQUESTER]}>
      <Gate>
        <RequesterTicketDetail ticketId={42} {...props} />
      </Gate>
    </RequesterProvider>,
  );
}

describe("read-only ticket information", () => {
  it("loads and shows the ticket", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    renderScreen();

    expect(await screen.findByTestId("detail-ticket-number")).toHaveTextContent("TT-2026-00042");
    expect(screen.getByTestId("detail-summary")).toHaveTextContent(
      "Laptop battery drains within 30 minutes",
    );
  });

  it("renders every ticket field", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    renderScreen();

    await screen.findByTestId("detail-ticket-number");
    for (const label of [
      "Ticket Date",
      "Requester",
      "Category",
      "Related System",
      "Requested Priority",
      "Current Status",
      "Summary",
      "Description",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Corporate Laptop")).toBeInTheDocument();
  });

  it("has no editable control anywhere in the ticket information", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    const { container } = renderScreen();

    await screen.findByTestId("detail-ticket-number");
    const detail = container.querySelector(".tt-detail")!;

    // Plain text, not disabled inputs: there is nothing to accidentally enable.
    expect(detail.querySelectorAll("input, textarea, select")).toHaveLength(0);
  });

  it("scopes the request to the current requester", async () => {
    const spy = vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    renderScreen();

    await screen.findByTestId("detail-ticket-number");
    expect(spy).toHaveBeenCalledWith(REQUESTER.id, 42);
  });
});

describe("ownership and failure states", () => {
  it("shows a not-found state for a ticket owned by someone else", async () => {
    // The API answers 404 for both cases, so the screen cannot tell them apart
    // and its copy says so.
    vi.spyOn(api, "fetchTicketDetail").mockRejectedValue(
      new AttachmentError("NOT_FOUND", "That ticket could not be found."),
    );
    renderScreen();

    expect(await screen.findByText("Ticket not found.")).toBeInTheDocument();
    expect(
      screen.getByText(/It may not exist, or it belongs to a different Requester\./),
    ).toBeInTheDocument();
  });

  it("shows no ticket data in the not-found state", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockRejectedValue(
      new AttachmentError("NOT_FOUND", "That ticket could not be found."),
    );
    renderScreen();

    await screen.findByText("Ticket not found.");
    expect(screen.queryByTestId("detail-ticket-number")).not.toBeInTheDocument();
  });

  it("offers a way back from the not-found state", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockRejectedValue(
      new AttachmentError("NOT_FOUND", "That ticket could not be found."),
    );
    const onBack = vi.fn();
    renderScreen({ onBack });

    await userEvent.click(await screen.findByRole("button", { name: "Back to My Tickets" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows a safe error with retry when the API is unreachable", async () => {
    const spy = vi.spyOn(api, "fetchTicketDetail").mockRejectedValue(new Error("network down"));
    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Cannot load this ticket/i);
    expect(alert.textContent).not.toMatch(/http|500|stack|prisma|network down/i);

    spy.mockResolvedValue(ticket());
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("detail-ticket-number")).toBeInTheDocument();
  });

  it("shows a loading state first", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockReturnValue(new Promise(() => {}));
    const { container } = renderScreen();

    await waitFor(() =>
      expect(container.querySelector('[data-state="loading"]')).not.toBeNull(),
    );
  });
});

describe("attachment lifecycle on the detail screen", () => {
  it("uploads a permitted file and adds it to the list", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    const uploadSpy = vi
      .spyOn(api, "uploadAttachment")
      .mockResolvedValue(attachment({ id: 91, originalFilename: "new.pdf" }));

    renderScreen();
    await screen.findByTestId("detail-ticket-number");

    const file = new File([new Uint8Array([1, 2, 3])], "new.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Choose a file to attach"), file);

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledWith(REQUESTER.id, 42, file));
    expect(await screen.findByText("new.pdf")).toBeInTheDocument();
  });

  it("rejects an unsupported file locally without calling the API", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
    const uploadSpy = vi.spyOn(api, "uploadAttachment");

    renderScreen();
    await screen.findByTestId("detail-ticket-number");

    const file = new File([new Uint8Array([1])], "virus.exe", { type: "application/octet-stream" });
    // applyAccept:false bypasses the input's accept filter, which would
    // otherwise drop the file before the component ever saw it. The guard being
    // tested here is the second line of defence for drag-drop and for browsers
    // that treat accept as advisory.
    await userEvent.upload(screen.getByLabelText("Choose a file to attach"), file, {
      applyAccept: false,
    });

    expect(await screen.findByText(/Only .*files are permitted/)).toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("reports a server rejection on its own row, leaving the ticket intact", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket([attachment()]));
    vi.spyOn(api, "uploadAttachment").mockRejectedValue(
      new AttachmentError("ATTACHMENT_LIMIT_REACHED", "A ticket may hold at most 5 active attachments."),
    );

    renderScreen();
    await screen.findByTestId("detail-ticket-number");

    const file = new File([new Uint8Array([1])], "sixth.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Choose a file to attach"), file);

    expect(await screen.findByText(/at most 5 active attachments/)).toBeInTheDocument();
    // The ticket and its existing attachment are untouched.
    expect(screen.getByTestId("detail-ticket-number")).toBeInTheDocument();
    expect(screen.getByText("battery-report.pdf")).toBeInTheDocument();
  });

  it("downloads an active attachment", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket([attachment()]));
    const onDownload = vi.fn();
    renderScreen({ onDownload });

    await screen.findByTestId("detail-ticket-number");
    await userEvent.click(
      screen.getByRole("button", { name: "Download battery-report.pdf" }),
    );

    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 90 }));
  });

  it("soft-removes an attachment with a reason and keeps its metadata", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket([attachment()]));
    const removeSpy = vi.spyOn(api, "removeAttachment").mockResolvedValue(
      attachment({
        removedAt: "2026-08-25T10:02:11.004Z",
        removalReason: "Uploaded the wrong screenshot",
        downloadUrl: null,
      }),
    );

    renderScreen();
    await screen.findByTestId("detail-ticket-number");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.type(
      screen.getByLabelText(/Removal reason/),
      "Uploaded the wrong screenshot",
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    await waitFor(() =>
      expect(removeSpy).toHaveBeenCalledWith(REQUESTER.id, 90, "Uploaded the wrong screenshot"),
    );

    // Metadata is retained and the reason is shown (BR-40).
    expect(await screen.findByText(/Uploaded the wrong screenshot/)).toBeInTheDocument();
    expect(screen.getByText("battery-report.pdf")).toBeInTheDocument();
  });
});
