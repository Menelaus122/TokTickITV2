import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { ConversationThread, INTERNAL_CAPTION } from "../../src/components/ConversationThread.js";
import * as api from "../../src/api.js";
import { ApiError, type ThreadEntry, type TicketDetail } from "../../src/api.js";

// Lab 3, Issue 7 — UI-10 and UI-11 in docs/lab-03/tests.md (ui-spec §5.1,
// §5.2, §1.4; AC-15, AC-17, AC-39).

const REQUESTER = { id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", department: null };

function ticket(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 42,
    ticketNumber: "TT-2026-00042",
    ticketDate: "2026-09-20T09:00:00.000Z",
    summary: "Printer jams on every page",
    description: "The second-floor printer jams on every page since Monday.",
    requestedPriority: "MEDIUM",
    currentStatus: "IN_PROGRESS",
    requester: { id: 3, fullName: REQUESTER.fullName },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 6, name: "Printer" },
    createdAt: "2026-09-20T09:00:00.000Z",
    updatedAt: "2026-09-21T09:00:00.000Z",
    requesterResolvedAt: null,
    attachments: [],
    ...overrides,
  };
}

function entry(id: number, body: string, role: api.Role = "IT_STAFF", fullName = "Nattapong Saelim"): ThreadEntry {
  return { id, body, createdAt: `2026-09-2${id}T10:00:00.000Z`, author: { id: id + 100, fullName, role } };
}

function renderScreen() {
  return render(
    <RequesterProvider requester={REQUESTER}>
      <RequesterTicketDetail ticketId={42} />
    </RequesterProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket());
  // Lab 4, Issue 5: the screen now loads the Actions Taken region too. These tests
  // are about other things, so it has none.
  vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UI-10 Public Comments thread", () => {
  it("shows each comment with its author, role badge, and time, oldest first", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([
      entry(1, "We are checking the fuser unit."),
      entry(2, "It still jams on page two.", "REQUESTER", REQUESTER.fullName),
    ]);
    renderScreen();

    const thread = await screen.findByRole("region", { name: "Public Comments" });
    const items = await within(thread).findAllByRole("listitem");
    expect(items.map((li) => within(li).getByText(/fuser|jams/).textContent)).toEqual([
      "We are checking the fuser unit.",
      "It still jams on page two.",
    ]);
    expect(within(items[0]).getByText("Nattapong Saelim")).toBeInTheDocument();
    expect(within(items[0]).getByText("IT Staff")).toBeInTheDocument();
    expect(within(items[1]).getByText("Requester")).toBeInTheDocument();
    expect(items[0].querySelector("time")).toHaveAttribute("dateTime", "2026-09-21T10:00:00.000Z");
  });

  it("shows the empty state for a ticket with no comments", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders markup in a comment as text, never as HTML (BR-43)", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([entry(1, `<img src=x onerror="alert(1)"><b>bold</b>`)]);
    const { container } = renderScreen();
    expect(await screen.findByText(`<img src=x onerror="alert(1)"><b>bold</b>`)).toBeInTheDocument();
    expect(container.querySelector(".tt-thread img, .tt-thread b")).toBeNull();
  });

  it("refuses an empty or whitespace-only comment without calling the API", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    const post = vi.spyOn(api, "postComment");
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("No comments yet.");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Comment is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Add a comment/), "    ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(screen.getByText("Comment is required.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a comment over 2000 characters without calling the API", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    const post = vi.spyOn(api, "postComment");
    const user = userEvent.setup();
    renderScreen();

    const box = await screen.findByLabelText(/^Add a comment/);
    await user.click(box);
    await user.paste("a".repeat(2001));
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText(/at most 2000 characters/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts a trimmed comment, shows it busy, appends it, and clears the box", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    let release!: (value: ThreadEntry) => void;
    const post = vi.spyOn(api, "postComment").mockReturnValue(new Promise((resolve) => (release = resolve)));
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText(/^Add a comment/), "  Still jamming today.  ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    const busy = screen.getByRole("button", { name: /Posting/ });
    expect(busy).toBeDisabled();
    await user.click(busy); // a double click sends nothing more
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(42, "Still jamming today.");

    release(entry(5, "Still jamming today.", "REQUESTER", REQUESTER.fullName));
    expect(await screen.findByText("Still jamming today.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Add a comment/)).toHaveValue("");
  });

  it("keeps the draft and shows the server's reason when posting fails", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    vi.spyOn(api, "postComment").mockRejectedValue(
      new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", { body: "Comment is required." }),
    );
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText(/^Add a comment/), "Hello there");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Comment is required.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Add a comment/)).toHaveValue("Hello there");
  });

  it("a thread that fails to load leaves the ticket usable and can be retried", async () => {
    const fetch = vi.spyOn(api, "fetchComments").mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText(/Cannot load the public comments/)).toBeInTheDocument();
    expect(screen.getByTestId("detail-ticket-number")).toHaveTextContent("TT-2026-00042");
    await user.click(within(screen.getByRole("region", { name: "Public Comments" })).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("UI-10 Problem Appears Resolved", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
  });

  it("offers a comment and one button, and says only IT Staff resolve — no status control", async () => {
    renderScreen();
    const panel = await screen.findByTestId("appears-resolved");
    expect(within(panel).getByRole("heading", { name: "Does this look resolved to you?" })).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^Comment/)).toBeRequired();
    expect(within(panel).getByRole("button", { name: "Mark as appears resolved" })).toBeInTheDocument();
    expect(within(panel).getByText("Only IT Staff can resolve or close a ticket.")).toBeInTheDocument();
    // Nowhere on the screen can a Requester pick a status (BR-05).
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Resolve|Close)/ })).not.toBeInTheDocument();
  });

  it("requires a comment of at least 5 characters before calling the API", async () => {
    const mark = vi.spyOn(api, "setAppearsResolved");
    const user = userEvent.setup();
    renderScreen();
    const panel = await screen.findByTestId("appears-resolved");

    await user.click(within(panel).getByRole("button", { name: "Mark as appears resolved" }));
    expect(within(panel).getByText("Comment is required.")).toBeInTheDocument();
    await user.type(within(panel).getByLabelText(/^Comment/), "Fine");
    await user.click(within(panel).getByRole("button", { name: "Mark as appears resolved" }));
    expect(within(panel).getByText("Comment must be between 5 and 2000 characters.")).toBeInTheDocument();
    expect(mark).not.toHaveBeenCalled();
  });

  it("marks it, shows the dated callout with Undo, and adds the comment to the thread", async () => {
    const mark = vi.spyOn(api, "setAppearsResolved").mockResolvedValue({
      ticket: { id: 42, requesterResolvedAt: "2026-10-01T09:14:22.310Z", currentStatus: "IN_PROGRESS" },
      comment: entry(7, "Works again since this morning.", "REQUESTER", REQUESTER.fullName),
    });
    const user = userEvent.setup();
    renderScreen();
    const panel = await screen.findByTestId("appears-resolved");

    await user.type(within(panel).getByLabelText(/^Comment/), "  Works again since this morning. ");
    await user.click(within(panel).getByRole("button", { name: "Mark as appears resolved" }));

    expect(mark).toHaveBeenCalledWith(42, { appearsResolved: true, comment: "Works again since this morning." });
    expect(await within(panel).findByText(/You marked this as appearing resolved on/)).toHaveTextContent("2026");
    expect(within(panel).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    const thread = screen.getByRole("region", { name: "Public Comments" });
    expect(within(thread).getByText("Works again since this morning.")).toBeInTheDocument();
    // The status shown is still the server's, unchanged.
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
  });

  it("Undo withdraws the signal and brings the form back", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(ticket({ requesterResolvedAt: "2026-10-01T09:14:22.310Z" }));
    const mark = vi.spyOn(api, "setAppearsResolved").mockResolvedValue({
      ticket: { id: 42, requesterResolvedAt: null, currentStatus: "IN_PROGRESS" },
      comment: null,
    });
    const user = userEvent.setup();
    renderScreen();

    const panel = await screen.findByTestId("appears-resolved");
    await user.click(await within(panel).findByRole("button", { name: "Undo" }));
    expect(mark).toHaveBeenCalledWith(42, { appearsResolved: false });
    expect(await within(panel).findByRole("button", { name: "Mark as appears resolved" })).toBeInTheDocument();
  });

  it("shows the server's reason and keeps the comment when marking fails", async () => {
    vi.spyOn(api, "setAppearsResolved").mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    const user = userEvent.setup();
    renderScreen();
    const panel = await screen.findByTestId("appears-resolved");

    await user.type(within(panel).getByLabelText(/^Comment/), "Looks fixed to me.");
    await user.click(within(panel).getByRole("button", { name: "Mark as appears resolved" }));
    expect(await within(panel).findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^Comment/)).toHaveValue("Looks fixed to me.");
  });
});

describe("UI-11 the Requester screen has no Internal Notes region", () => {
  it("shows no notes region, heading, caption, control, or request for notes", async () => {
    vi.spyOn(api, "fetchComments").mockResolvedValue([entry(1, "We ordered the part.")]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = renderScreen();
    await screen.findByText("We ordered the part.");

    expect(screen.queryByText(/internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bnotes?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /note/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-thread="internal"], .tt-thread--internal')).toBeNull();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/notes"))).toBe(false);
  });
});

describe("the two thread variants cannot be confused (AC-39)", () => {
  it("labels, captions, styles, and buttons differ between public and internal", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <ConversationThread variant="public" status="ready" entries={[]} onRetry={() => {}} onPost={onPost} />
        <ConversationThread variant="internal" status="ready" entries={[]} onRetry={() => {}} onPost={onPost} />
      </>,
    );
    const pub = screen.getByRole("region", { name: "Public Comments" });
    const internal = screen.getByRole("region", { name: `Internal Notes — ${INTERNAL_CAPTION}` });

    expect(within(internal).getByText(INTERNAL_CAPTION)).toBeInTheDocument();
    expect(within(pub).queryByText(INTERNAL_CAPTION)).not.toBeInTheDocument();
    expect(internal).toHaveClass("tt-thread--internal");
    expect(pub).not.toHaveClass("tt-thread--internal");
    expect(within(pub).getByRole("button", { name: "Post comment" })).toBeInTheDocument();
    expect(within(internal).getByRole("button", { name: "Post internal note" })).toBeInTheDocument();
    expect(within(internal).getByLabelText(/^Add an internal note/)).toBeInTheDocument();
    expect(within(internal).getByText("No internal notes yet.")).toBeInTheDocument();
  });

  it("each composer posts only its own draft", async () => {
    const postComment = vi.fn().mockResolvedValue(undefined);
    const postNote = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <>
        <ConversationThread variant="public" status="ready" entries={[]} onRetry={() => {}} onPost={postComment} />
        <ConversationThread variant="internal" status="ready" entries={[]} onRetry={() => {}} onPost={postNote} />
      </>,
    );
    await user.type(screen.getByLabelText(/^Add an internal note/), "Staff only detail.");
    await user.click(screen.getByRole("button", { name: "Post internal note" }));
    await waitFor(() => expect(postNote).toHaveBeenCalledWith("Staff only detail."));
    expect(postComment).not.toHaveBeenCalled();
  });
});
