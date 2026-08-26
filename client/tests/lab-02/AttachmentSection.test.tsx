import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AttachmentSection,
  checkFileBeforeUpload,
  REMOVAL_REASON_MIN,
  REMOVAL_REASON_MAX,
} from "../../src/components/AttachmentSection.js";
import { MAX_ACTIVE_ATTACHMENTS, MAX_FILE_BYTES } from "../../src/api.js";
import type { Attachment } from "../../src/api.js";

// Issue 7 AC-3, AC-4, AC-6 — the attachment list, its limits, and soft removal.

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

const removed = attachment({
  id: 91,
  originalFilename: "screenshot.png",
  removedAt: "2026-08-25T10:02:11.004Z",
  removalReason: "Uploaded the wrong screenshot",
  downloadUrl: null,
});

function renderSection(props: Partial<Parameters<typeof AttachmentSection>[0]> = {}) {
  const onUpload = vi.fn();
  const onDownload = vi.fn();
  const onRemove = vi.fn();
  const view = render(
    <AttachmentSection
      attachments={[]}
      onUpload={onUpload}
      onDownload={onDownload}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { onUpload, onDownload, onRemove, container: view.container };
}

describe("file rules before upload", () => {
  function file(name: string, type: string, size: number) {
    const f = new File([new Uint8Array([1])], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  }

  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["shot.png", "image/png"],
    ["art.webp", "image/webp"],
    ["report.pdf", "application/pdf"],
  ])("accepts %s", (name, type) => {
    expect(checkFileBeforeUpload(file(name, type, 1024))).toBeNull();
  });

  it.each(["virus.exe", "notes.txt", "archive.zip", "noextension"])("rejects %s", (name) => {
    expect(checkFileBeforeUpload(file(name, "application/octet-stream", 1024))).toMatch(
      /permitted/i,
    );
  });

  it("accepts exactly 5 MB and rejects one byte more", () => {
    expect(checkFileBeforeUpload(file("a.pdf", "application/pdf", MAX_FILE_BYTES))).toBeNull();
    expect(
      checkFileBeforeUpload(file("a.pdf", "application/pdf", MAX_FILE_BYTES + 1)),
    ).toMatch(/5 MB/);
  });
});

describe("active attachment limit", () => {
  it("reports how many active attachments the ticket holds", () => {
    renderSection({ attachments: [attachment(), removed] });
    expect(
      screen.getByRole("heading", { name: `Attachments (1 of ${MAX_ACTIVE_ATTACHMENTS} active)` }),
    ).toBeInTheDocument();
  });

  it("disables Add attachment at the limit, with an explanation", () => {
    const five = Array.from({ length: MAX_ACTIVE_ATTACHMENTS }, (_, i) =>
      attachment({ id: i + 1, originalFilename: `file${i + 1}.pdf` }),
    );
    renderSection({ attachments: five });

    const button = screen.getByRole("button", { name: "Add attachment" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", `Maximum ${MAX_ACTIVE_ATTACHMENTS} active attachments`);
  });

  it("does not count removed attachments toward the limit", () => {
    const four = Array.from({ length: 4 }, (_, i) =>
      attachment({ id: i + 1, originalFilename: `file${i + 1}.pdf` }),
    );
    renderSection({ attachments: [...four, removed] });

    expect(screen.getByRole("button", { name: "Add attachment" })).toBeEnabled();
  });
});

describe("active attachment rows", () => {
  it("offers download and remove controls with accessible labels", () => {
    renderSection({ attachments: [attachment()] });

    const download = screen.getByRole("button", { name: "Download battery-report.pdf" });
    expect(download).toHaveAttribute("aria-label", "Download battery-report.pdf");
    expect(download).toHaveAttribute("title", "Download battery-report.pdf");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("passes the attachment to the download handler", async () => {
    const { onDownload } = renderSection({ attachments: [attachment()] });

    await userEvent.click(screen.getByRole("button", { name: "Download battery-report.pdf" }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 90 }));
  });

  it("marks an active row as Active", () => {
    const { container } = renderSection({ attachments: [attachment()] });
    expect(container.querySelector('[data-state="active"]')).not.toBeNull();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});

describe("removed attachment rows", () => {
  it("keeps the filename and shows the removal reason", () => {
    renderSection({ attachments: [removed] });

    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded the wrong screenshot/)).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
  });

  it("offers no download and no remove control", () => {
    renderSection({ attachments: [removed] });

    expect(
      screen.queryByRole("button", { name: /Download screenshot\.png/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("marks the row as removed for styling and assertions", () => {
    const { container } = renderSection({ attachments: [removed] });

    const row = container.querySelector('[data-state="removed"]')!;
    expect(row).not.toBeNull();
    expect(row.className).toContain("tt-attachment--removed");
  });

  it("shows active and removed rows side by side", () => {
    renderSection({ attachments: [attachment(), removed] });

    expect(screen.getByText("battery-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    // Exactly one row still offers a download.
    expect(screen.getAllByRole("button", { name: /^Download / })).toHaveLength(1);
  });
});

describe("removal confirmation", () => {
  it("asks for confirmation rather than removing immediately", async () => {
    const { onRemove } = renderSection({ attachments: [attachment()] });

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("keeps the confirm disabled until the reason is long enough", async () => {
    renderSection({ attachments: [attachment()] });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    const confirm = screen.getByRole("button", { name: "Remove attachment" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Removal reason/), "a".repeat(REMOVAL_REASON_MIN - 1));
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Removal reason/), "a");
    expect(confirm).toBeEnabled();
  });

  it("marks the reason as required with an asterisk", async () => {
    const { container } = renderSection({ attachments: [attachment()] });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    const dialog = container.querySelector(".tt-dialog")!;
    expect(dialog.querySelector(".tt-field__required")).not.toBeNull();
  });

  it("passes the trimmed reason to the handler", async () => {
    const { onRemove } = renderSection({ attachments: [attachment()] });

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.type(screen.getByLabelText(/Removal reason/), "   Wrong file attached   ");
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 90 }),
      "Wrong file attached",
    );
  });

  it("rejects a reason longer than the maximum", async () => {
    const { onRemove } = renderSection({ attachments: [attachment()] });

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    const field = screen.getByLabelText(/Removal reason/);
    await userEvent.click(field);
    await userEvent.paste("a".repeat(REMOVAL_REASON_MAX + 1));
    await userEvent.click(screen.getByRole("button", { name: "Remove attachment" }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(await screen.findByText(/must be between/)).toBeInTheDocument();
  });

  it("cancels without removing anything", async () => {
    const { onRemove } = renderSection({ attachments: [attachment()] });

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("explains that the file is retained as a record", async () => {
    renderSection({ attachments: [attachment()] });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(
      screen.getByText(/stay on the ticket as a record but can no longer be downloaded/i),
    ).toBeInTheDocument();
  });
});

describe("rejected file rows", () => {
  it("shows a rejection as its own row with the reason", () => {
    renderSection({
      rejected: [{ filename: "virus.exe", message: "Only .pdf files are permitted." }],
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("virus.exe");
    expect(alert).toHaveTextContent("Only .pdf files are permitted.");
  });

  it("can be dismissed", async () => {
    const onDismissRejection = vi.fn();
    renderSection({
      rejected: [{ filename: "virus.exe", message: "Not permitted." }],
      onDismissRejection,
    });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissRejection).toHaveBeenCalledWith("virus.exe");
  });
});

describe("empty state", () => {
  it("says the ticket has no attachments yet", () => {
    const { container } = renderSection({ attachments: [] });

    expect(screen.getByText("No attachments on this ticket yet.")).toBeInTheDocument();
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
  });
});
