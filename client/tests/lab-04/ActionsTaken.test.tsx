import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsTakenRegion } from "../../src/components/ActionsTakenRegion.js";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import * as api from "../../src/api.js";
import { ApiError, type ActionTaken, type ActionTakenInput } from "../../src/api.js";
import type { TicketStatus } from "../../src/components/index.js";

// Lab 4, Issue 5 — UI-01 to UI-09 in docs/lab-04/tests.md §2.8 (ui-spec §1.2,
// §1.3, §1.5, §4, §6; specification.md FR-01 to FR-08, FR-27, FR-28, BR-03 to
// BR-10, BR-13, BR-27, BR-28, BR-53, BR-54, D-14, D-15, D-18).
//
// The seam is the region as a person meets it: rendered, clicked, and typed
// into. The API client is the system boundary, so it is the only thing mocked.

const ME = { fullName: "Nattapong Saelim", role: "IT_STAFF" as const };

function action(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return {
    id: 31,
    ticketId: 12,
    actionAt: "2026-10-05T03:10:00.000Z",
    description: "Replaced the toner cartridge and ran a test page.",
    result: "Test page printed cleanly.",
    performedBy: { id: 7, fullName: "Wirachat T.", role: "IT_STAFF" },
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    version: 1,
    createdAt: "2026-10-05T03:12:41.000Z",
    updatedAt: "2026-10-05T03:12:41.000Z",
    updatedBy: null,
    ...overrides,
  };
}

interface RegionProps {
  ticketStatus?: TicketStatus;
  mode?: "staff" | "requester";
  ticketCreatedAt?: string;
}

function renderRegion({ ticketStatus = "IN_PROGRESS", mode = "staff", ticketCreatedAt = "2026-09-28T02:10:00.000Z" }: RegionProps = {}) {
  return render(
    <ActionsTakenRegion
      ticketId={12}
      ticketStatus={ticketStatus}
      ticketCreatedAt={ticketCreatedAt}
      mode={mode}
      currentUser={ME}
    />,
  );
}

const region = () => screen.getByRole("region", { name: /^Actions Taken/ });
const cards = () => within(region()).queryAllByRole("listitem").filter((item) => item.hasAttribute("data-action-id"));
const cardIds = () => cards().map((card) => Number(card.getAttribute("data-action-id")));

let fetchSpy: MockInstance<typeof api.fetchActionsTaken>;

beforeEach(() => {
  fetchSpy = vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function ready(actions: ActionTaken[], props: RegionProps = {}) {
  fetchSpy.mockResolvedValue(actions);
  const view = renderRegion(props);
  await waitFor(() => expect(screen.queryByText("Loading actions taken…")).not.toBeInTheDocument());
  return view;
}

describe("UI-01 the Actions Taken list (FR-01, FR-08, AC-10, AC-23)", () => {
  const first = action({ id: 40, actionAt: "2026-10-04T08:00:00.000Z", createdAt: "2026-10-04T08:05:00.000Z", description: "Checked the paper tray sensor." });
  // Dated in the middle, but recorded last: it is the one the resolution gate reads.
  const recordedLast = action({ id: 41, actionAt: "2026-10-04T12:00:00.000Z", createdAt: "2026-10-05T09:00:00.000Z", description: "Backdated note about the firmware." });
  const third = action({ id: 42, actionAt: "2026-10-05T03:10:00.000Z", createdAt: "2026-10-05T03:12:41.000Z", description: "Replaced the toner cartridge and ran a test page." });

  it("shows the count in the heading and every entry in reading order, oldest Action Date/Time first", async () => {
    // The API returns them in order, but the screen must not depend on it.
    await ready([third, first, recordedLast]);
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken (3)" })).toBeInTheDocument();
    expect(cardIds()).toEqual([40, 41, 42]);
  });

  it("breaks a tie on Action Date/Time by id, so the order never changes between reads", async () => {
    const a = action({ id: 51, actionAt: "2026-10-05T03:10:00.000Z" });
    const b = action({ id: 50, actionAt: "2026-10-05T03:10:00.000Z" });
    await ready([a, b]);
    expect(cardIds()).toEqual([50, 51]);
  });

  it("shows all seven fields of an entry, each value beside its label", async () => {
    await ready([
      action({
        followUpRequired: true,
        followUpNote: "Check the printer again on Thursday.",
        attachmentNotes: "Look for the photo of the toner label.",
        updatedBy: null,
      }),
    ]);
    const card = within(cards()[0]);
    // Action Date/Time and Performed by, in the header line.
    const heading = card.getByRole("heading", { level: 3 });
    expect(heading.querySelector("time")).toHaveAttribute("datetime", "2026-10-05T03:10:00.000Z");
    expect(card.getByText("Wirachat T.")).toBeInTheDocument();
    expect(card.getByText("IT Staff")).toBeInTheDocument();
    // The five definition-list rows.
    const terms = card.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Action Description", "Result", "Follow-Up Required?", "Follow-up Note", "Attachment Notes"]);
    const definition = (label: string) => card.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(definition("Action Description")).toHaveTextContent("Replaced the toner cartridge and ran a test page.");
    expect(definition("Result")).toHaveTextContent("Test page printed cleanly.");
    expect(definition("Follow-Up Required?")).toHaveTextContent("Follow-up needed");
    expect(definition("Follow-up Note")).toHaveTextContent("Check the printer again on Thursday.");
    expect(definition("Attachment Notes")).toHaveTextContent("Look for the photo of the toner label.");
  });

  it("omits the Follow-up Note and Attachment Notes rows when they are empty, and always shows Follow-Up Required?", async () => {
    await ready([action({ followUpRequired: false, followUpNote: null, attachmentNotes: null })]);
    const card = within(cards()[0]);
    expect(card.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Action Description", "Result", "Follow-Up Required?",
    ]);
    expect(card.getByText("No follow-up")).toBeInTheDocument();
  });

  it("tags exactly one entry Latest recorded: the most recently recorded, even when it is not the last card", async () => {
    await ready([first, recordedLast, third]);
    const tags = screen.getAllByText("Latest recorded");
    expect(tags).toHaveLength(1);
    expect(cards().indexOf(tags[0].closest("[data-action-id]") as HTMLElement)).toBe(1);
    expect(tags[0].closest("[data-action-id]")).toHaveAttribute("data-action-id", "41");
    // It is not the last card, which is the point of the tag.
    expect(cardIds().at(-1)).toBe(42);
  });

  it("breaks a tie on when they were recorded by id, as the resolution gate does", async () => {
    const a = action({ id: 60, createdAt: "2026-10-05T09:00:00.000Z", actionAt: "2026-10-05T01:00:00.000Z" });
    const b = action({ id: 61, createdAt: "2026-10-05T09:00:00.000Z", actionAt: "2026-10-05T02:00:00.000Z" });
    await ready([a, b]);
    expect(screen.getByText("Latest recorded").closest("[data-action-id]")).toHaveAttribute("data-action-id", "61");
  });

  it("shows when each entry was recorded, and who edited it only after an edit (BR-07)", async () => {
    await ready([
      action({ id: 70, actionAt: "2026-10-05T01:00:00.000Z" }),
      action({
        id: 71,
        actionAt: "2026-10-05T02:00:00.000Z",
        version: 2,
        updatedAt: "2026-10-05T04:02:00.000Z",
        updatedBy: { id: 8, fullName: "Siriporn K.", role: "IT_STAFF" },
      }),
    ]);
    const [unedited, edited] = cards().map((card) => within(card));
    expect(unedited.getByText(/^Recorded/)).toBeInTheDocument();
    expect(unedited.queryByText(/Edited by/)).not.toBeInTheDocument();
    expect(edited.getByText(/^Recorded/)).toBeInTheDocument();
    expect(edited.getByText(/Edited by Siriporn K\./)).toBeInTheDocument();
  });

  it("wraps long unbroken text instead of clipping it, and renders text, never markup", async () => {
    const long = "x".repeat(400);
    await ready([action({ description: `<b>bold?</b> ${long}` })]);
    const card = cards()[0];
    expect(within(card).getByText(new RegExp(long))).toBeInTheDocument();
    expect(card.querySelector("b")).toBeNull();
  });

  it("shows an explicit empty state for a Ticket with no actions, including every Lab 2 and Lab 3 ticket (FR-08)", async () => {
    await ready([]);
    const empty = within(region());
    expect(empty.getByText("No actions recorded yet.")).toBeInTheDocument();
    expect(empty.getByText("Record what you do on this ticket so the Requester can see it.")).toBeInTheDocument();
    expect(empty.getByRole("button", { name: "+ Add action" })).toBeEnabled();
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken (0)" })).toBeInTheDocument();
  });
});

describe("UI-09 the region's loading, API-failure, and forbidden states (AC-28)", () => {
  it("shows skeleton cards inside the region while it loads, and nothing else is blocked", async () => {
    let finish: (actions: ActionTaken[]) => void = () => {};
    fetchSpy.mockReturnValue(new Promise<ActionTaken[]>((resolve) => (finish = resolve)));
    renderRegion();
    const loading = within(region()).getByRole("status");
    expect(loading).toHaveAttribute("data-state", "loading");
    expect(within(region()).getByText("Loading actions taken…")).toBeInTheDocument();
    finish([action()]);
    expect(await within(region()).findByRole("heading", { level: 2, name: "Actions Taken (1)" })).toBeInTheDocument();
  });

  it("shows a callout with Try again inside the region on a failure, and Try again loads the list", async () => {
    const user = userEvent.setup();
    fetchSpy.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    renderRegion();
    const callout = await within(region()).findByRole("alert");
    expect(callout).toHaveTextContent("Cannot load the actions taken right now.");
    // No raw detail: no status code, no error code.
    expect(callout).not.toHaveTextContent(/500|INTERNAL_ERROR/);

    fetchSpy.mockResolvedValue([action()]);
    await user.click(within(callout).getByRole("button", { name: "Try again" }));
    expect(await within(region()).findByRole("heading", { level: 2, name: "Actions Taken (1)" })).toBeInTheDocument();
    expect(within(region()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats a network failure the same way", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));
    renderRegion();
    expect(await within(region()).findByText("Cannot load the actions taken right now.")).toBeInTheDocument();
    expect(within(region()).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the forbidden callout, with no Try again, when the API answers 403", async () => {
    fetchSpy.mockRejectedValue(new ApiError(403, "FORBIDDEN", "You do not have permission to do that."));
    renderRegion();
    const callout = await within(region()).findByRole("alert");
    expect(callout).toHaveTextContent("You do not have access to record actions.");
    expect(within(callout).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------

const KEY = /^[A-Za-z0-9_-]{8,64}$/;
type User = ReturnType<typeof userEvent.setup>;

// A label as the form prints it: the red asterisk is part of the label's text,
// so a label is found by how it starts.
const named = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`);

/** The inline create form, found by its name; there is never a dialog (FR-31). */
const createForm = () => within(screen.getByRole("form", { name: "Record an action" }));
const control = (form: ReturnType<typeof createForm>, label: string) => form.getByLabelText(named(label));

async function openCreate(user: User) {
  await user.click(within(region()).getByRole("button", { name: "+ Add action" }));
  return createForm();
}

/** Types the two required texts; the date already defaults to now. */
async function fillRequired(user: User, form: ReturnType<typeof createForm>) {
  await user.type(control(form, "Action Description"), "Replaced the toner cartridge and ran a test page.");
  await user.type(control(form, "Result"), "Test page printed cleanly.");
}

function created(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return action({
    id: 99,
    actionAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    performedBy: { id: 5, fullName: ME.fullName, role: ME.role },
    ...overrides,
  });
}

describe("UI-02 create mode (FR-02, AC-04)", () => {
  it("opens an inline form above the list, not a dialog, and puts focus in its first field", async () => {
    const user = userEvent.setup();
    await ready([action()]);
    const form = await openCreate(user);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(control(form, "Action Date/Time")).toHaveFocus();
    // Above the list of entries, inside the region.
    const formElement = screen.getByRole("form", { name: "Record an action" });
    const list = region().querySelector("ul.tt-actions-taken__list") as HTMLElement;
    expect(formElement.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has every field a person fills in, with a red asterisk and the required attribute on the three that must be filled", async () => {
    const user = userEvent.setup();
    await ready([]);
    const form = await openCreate(user);

    for (const label of ["Action Date/Time", "Action Description", "Result"]) {
      const field = control(form, label);
      expect(field, label).toBeRequired();
      expect(field.closest(".tt-field")!.querySelector(".tt-field__required"), label).not.toBeNull();
    }
    const attachment = control(form, "Attachment Notes");
    expect(attachment).not.toBeRequired();
    expect(attachment.closest(".tt-field")!.querySelector(".tt-field__required")).toBeNull();
    expect(form.getByText("Say which file, screenshot, or image to look for. This does not upload a file.")).toBeInTheDocument();
  });

  it("defaults Action Date/Time to now, and sizes the text areas as the spec says", async () => {
    const user = userEvent.setup();
    await ready([]);
    const form = await openCreate(user);
    const shown = (control(form, "Action Date/Time") as HTMLInputElement).value;
    expect(shown).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(Math.abs(new Date(shown).getTime() - Date.now())).toBeLessThan(2 * 60 * 1000);
    expect(control(form, "Action Description")).toHaveAttribute("rows", "4");
    expect(control(form, "Result")).toHaveAttribute("rows", "2");
    expect(control(form, "Attachment Notes")).toHaveAttribute("rows", "2");
  });

  it("shows Performed by as the signed-in user, read-only, never as something to type into", async () => {
    const user = userEvent.setup();
    await ready([]);
    const form = await openCreate(user);
    const performer = control(form, "Performed by");
    expect(performer).toHaveValue(ME.fullName);
    expect(performer).toHaveAttribute("readonly");
    expect(performer).not.toBeDisabled();
    expect(form.getByText("IT Staff")).toBeInTheDocument();
  });

  it("offers Follow-Up Required? as a group of two radios, No preselected", async () => {
    const user = userEvent.setup();
    await ready([]);
    const form = await openCreate(user);
    const group = form.getByRole("group", { name: /^Follow-Up Required\?/ });
    expect(within(group).getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual(["no", "yes"]);
    expect(within(group).getByRole("radio", { name: "No" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Yes" })).not.toBeChecked();
  });

  it("shows Follow-up Note, and requires it, only once Yes is chosen; No hides it again but the text is kept (D-18)", async () => {
    const user = userEvent.setup();
    await ready([]);
    const form = await openCreate(user);
    expect(form.queryByLabelText(named("Follow-up Note"))).not.toBeInTheDocument();

    await user.click(form.getByRole("radio", { name: "Yes" }));
    const note = control(form, "Follow-up Note");
    expect(note).toBeRequired();
    expect(note.closest(".tt-field")!.querySelector(".tt-field__required")).not.toBeNull();
    await user.type(note, "Check the printer again on Thursday.");

    await user.click(form.getByRole("radio", { name: "No" }));
    expect(form.queryByLabelText(named("Follow-up Note"))).not.toBeInTheDocument();
    await user.click(form.getByRole("radio", { name: "Yes" }));
    expect(control(form, "Follow-up Note")).toHaveValue("Check the printer again on Thursday.");
  });

  it("has Save action and Cancel, and Cancel closes the form without a request", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    await ready([]);
    const form = await openCreate(user);
    expect(form.getByRole("button", { name: "Save action" })).toBeEnabled();
    await user.type(control(form, "Result"), "Typed, then abandoned.");
    await user.click(form.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("sends the trimmed fields, the Action Date/Time as an instant with its zone, and no note for No", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    await ready([]);
    const form = await openCreate(user);
    fireEvent.change(control(form, "Action Date/Time"), { target: { value: "2026-10-05T10:30" } });
    await user.type(control(form, "Action Description"), "  Replaced the toner cartridge.  ");
    await user.type(control(form, "Result"), "Printed cleanly.");
    // Typed while Yes was chosen, then hidden: kept in the form, not sent.
    await user.click(form.getByRole("radio", { name: "Yes" }));
    await user.type(control(form, "Follow-up Note"), "A note nobody should send.");
    await user.click(form.getByRole("radio", { name: "No" }));
    await user.click(form.getByRole("button", { name: "Save action" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const [ticketId, input, key] = create.mock.calls[0] as [number, ActionTakenInput, string];
    expect(ticketId).toBe(12);
    expect(input).toEqual({
      actionAt: new Date("2026-10-05T10:30").toISOString(),
      description: "Replaced the toner cartridge.",
      result: "Printed cleanly.",
      followUpRequired: false,
    });
    expect(key).toMatch(KEY);
  });

  it("sends the Follow-up Note and the Attachment Notes when they apply", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    await ready([]);
    const form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("radio", { name: "Yes" }));
    await user.type(control(form, "Follow-up Note"), "Check the printer again on Thursday.");
    await user.type(control(form, "Attachment Notes"), "Look for the photo of the toner label.");
    await user.click(form.getByRole("button", { name: "Save action" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const input = create.mock.calls[0][1] as ActionTakenInput;
    expect(input).toMatchObject({
      followUpRequired: true,
      followUpNote: "Check the printer again on Thursday.",
      attachmentNotes: "Look for the photo of the toner label.",
    });
  });
});

// ---------------------------------------------------------------------------
// Validation, a failed save, and a repeated save
// ---------------------------------------------------------------------------

/** Sets a control at once, for values too long to type. */
function setValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("UI-03 validation and a failed save (FR-28, AC-04, AC-27, BR-54)", () => {
  async function open(actions: ActionTaken[] = []) {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    await ready(actions);
    const form = await openCreate(user);
    return { user, create, form };
  }

  it("refuses an empty submission with a message beneath each field, sends nothing, and focuses the first invalid field", async () => {
    const { user, create, form } = await open();
    await user.click(form.getByRole("button", { name: "Save action" }));

    const description = control(form, "Action Description");
    const result = control(form, "Result");
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAccessibleDescription("Action Description is required.");
    expect(result).toHaveAttribute("aria-invalid", "true");
    expect(result).toHaveAccessibleDescription("Result is required.");
    // The date was valid, so it is not marked.
    expect(control(form, "Action Date/Time")).not.toHaveAttribute("aria-invalid");
    expect(description).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses text that is only spaces as an empty field", async () => {
    const { user, create, form } = await open();
    await user.type(control(form, "Action Description"), "          ");
    await user.type(control(form, "Result"), "     ");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(control(form, "Action Description")).toHaveAccessibleDescription("Action Description is required.");
    expect(control(form, "Result")).toHaveAccessibleDescription("Result is required.");
    expect(create).not.toHaveBeenCalled();
  });

  it("holds each text to its length, at both edges (BR-03)", async () => {
    const { user, create, form } = await open();
    const description = control(form, "Action Description");
    const result = control(form, "Result");
    const message = (min: number, max: number, label: string) => `${label} must be between ${min} and ${max} characters.`;

    setValue(description, "abcd");
    setValue(result, "x");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(description).toHaveAccessibleDescription(message(5, 2000, "Action Description"));
    expect(result).toHaveAccessibleDescription(message(2, 1000, "Result"));

    setValue(description, "x".repeat(2001));
    setValue(result, "x".repeat(1001));
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(description).toHaveAccessibleDescription(message(5, 2000, "Action Description"));
    expect(result).toHaveAccessibleDescription(message(2, 1000, "Result"));
    expect(create).not.toHaveBeenCalled();

    setValue(description, "x".repeat(2000));
    setValue(result, "x".repeat(1000));
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("requires a Follow-up Note of 5 to 1000 characters when Yes is chosen, and not when No is (BR-04)", async () => {
    const { user, create, form } = await open();
    await fillRequired(user, form);
    await user.click(form.getByRole("radio", { name: "Yes" }));
    await user.click(form.getByRole("button", { name: "Save action" }));
    const note = control(form, "Follow-up Note");
    expect(note).toHaveAccessibleDescription("Follow-up Note is required when follow-up is needed.");
    expect(note).toHaveFocus();

    setValue(note, "abcd");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(note).toHaveAccessibleDescription("Follow-up Note must be between 5 and 1000 characters.");

    setValue(note, "x".repeat(1001));
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(note).toHaveAccessibleDescription("Follow-up Note must be between 5 and 1000 characters.");
    expect(create).not.toHaveBeenCalled();

    setValue(note, "abcde");
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("holds Attachment Notes to 500 characters", async () => {
    const { user, create, form } = await open();
    await fillRequired(user, form);
    const notes = control(form, "Attachment Notes");
    setValue(notes, "x".repeat(501));
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(notes).toHaveAccessibleDescription("Attachment Notes must be at most 500 characters.");
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an Action Date/Time that is empty, in the future, or before the ticket existed (BR-06)", async () => {
    const { user, create, form } = await open();
    await fillRequired(user, form);
    const when = control(form, "Action Date/Time");

    setValue(when, "");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(when).toHaveAccessibleDescription("Action Date/Time is required.");

    setValue(when, "2099-01-01T10:00");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(when).toHaveAccessibleDescription("Action Date/Time cannot be in the future.");

    // The ticket in these tests was created on 28 September 2026.
    setValue(when, "2026-09-27T10:00");
    await user.click(form.getByRole("button", { name: "Save action" }));
    expect(when).toHaveAccessibleDescription("Action Date/Time cannot be before the ticket was created.");
    expect(when).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
  });

  it("clears a field's message as soon as that field is changed", async () => {
    const { user, form } = await open();
    await user.click(form.getByRole("button", { name: "Save action" }));
    const description = control(form, "Action Description");
    expect(description).toHaveAttribute("aria-invalid", "true");
    await user.type(description, "Replaced the toner cartridge.");
    expect(description).not.toHaveAttribute("aria-invalid");
    // The other field is still told.
    expect(control(form, "Result")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps every typed value after a refusal, and puts the message beneath its own field", async () => {
    const { user, form } = await open();
    await user.type(control(form, "Action Description"), "Replaced the toner cartridge.");
    await user.type(control(form, "Attachment Notes"), "The photo of the label.");
    await user.click(form.getByRole("radio", { name: "Yes" }));
    await user.click(form.getByRole("button", { name: "Save action" }));

    expect(control(form, "Action Description")).toHaveValue("Replaced the toner cartridge.");
    expect(control(form, "Attachment Notes")).toHaveValue("The photo of the label.");
    expect(form.getByRole("radio", { name: "Yes" })).toBeChecked();
    // Each message is in its own field's group, directly under its control.
    const field = control(form, "Result").closest(".tt-field")!;
    expect(within(field as HTMLElement).getByText("Result is required.")).toBeInTheDocument();
  });

  it("shows the server's own messages beneath their fields on a 400, keeps the values, and focuses the first invalid field", async () => {
    const { user, create, form } = await open();
    create.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", {
        actionAt: "Action Date/Time cannot be before the ticket was created.",
        result: "Result must be between 2 and 1000 characters.",
      }),
    );
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));

    expect(await screen.findByText("Action Date/Time cannot be before the ticket was created.")).toBeInTheDocument();
    expect(control(form, "Action Date/Time")).toHaveAccessibleDescription("Action Date/Time cannot be before the ticket was created.");
    expect(control(form, "Result")).toHaveAccessibleDescription("Result must be between 2 and 1000 characters.");
    expect(control(form, "Action Date/Time")).toHaveFocus();
    expect(control(form, "Action Description")).toHaveValue("Replaced the toner cartridge and ran a test page.");
    expect(control(form, "Result")).toHaveValue("Test page printed cleanly.");
    expect(form.getByRole("button", { name: "Save action" })).toBeEnabled();
    expect(screen.queryByText(/VALIDATION_FAILED/)).not.toBeInTheDocument();
  });

  it("shows a conflict that the ticket is no longer open in its own callout, never as a generic failure, and keeps the form (BR-10)", async () => {
    const { user, create, form } = await open();
    create.mockRejectedValueOnce(
      new ApiError(409, "TICKET_NOT_ACTIVE", "This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed."),
    );
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));

    const callout = await within(screen.getByRole("form", { name: "Record an action" })).findByRole("alert");
    expect(callout).toHaveTextContent("This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed.");
    expect(callout).toHaveTextContent("Everything you typed is still in the form.");
    expect(callout).not.toHaveTextContent("Something went wrong");
    expect(control(form, "Result")).toHaveValue("Test page printed cleanly.");
  });

  it("keeps the form and says so after a network failure, with a safe message and no detail", async () => {
    const { user, create, form } = await open();
    create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));

    const callout = await within(screen.getByRole("form", { name: "Record an action" })).findByRole("alert");
    expect(callout).toHaveTextContent("The action could not be saved. Check your connection and try again. Everything you typed is still in the form.");
    expect(callout).not.toHaveTextContent(/Failed to fetch|TypeError/);
    expect(control(form, "Action Description")).toHaveValue("Replaced the toner cartridge and ran a test page.");
    expect(form.getByRole("button", { name: "Save action" })).toBeEnabled();
  });

  it("answers a 403 with the forbidden message, and a 500 with the same safe one as a network failure", async () => {
    const { user, create, form } = await open();
    create.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "You do not have permission to do that."));
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    const first = await within(screen.getByRole("form", { name: "Record an action" })).findByRole("alert");
    expect(first).toHaveTextContent("You do not have access to record actions.");

    create.mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    const second = await within(screen.getByRole("form", { name: "Record an action" })).findByRole("alert");
    expect(second).toHaveTextContent("The action could not be saved. Check your connection and try again.");
    expect(second).not.toHaveTextContent("INTERNAL_ERROR");
  });
});

describe("UI-04 a repeated click and a retry (FR-06, FR-27, AC-07, AC-27, BR-28, BR-53)", () => {
  it("sends one request for a double click, shows Saving…, and disables every other control in the region while it is in flight", async () => {
    const user = userEvent.setup();
    const pending = deferred<ActionTaken>();
    const create = vi.spyOn(api, "createActionTaken").mockReturnValue(pending.promise);
    await ready([action()]);
    const form = await openCreate(user);
    await fillRequired(user, form);

    await user.dblClick(form.getByRole("button", { name: "Save action" }));

    expect(create).toHaveBeenCalledTimes(1);
    const saving = form.getByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    expect(form.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeDisabled();
    expect(control(form, "Action Description")).toBeDisabled();

    pending.resolve(created());
    await waitFor(() => expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("refuses a second submit that arrives before the screen has had a chance to re-render", async () => {
    // Two submit events in one tick: the Save button has not yet been disabled,
    // so only the form's own guard can stop the second (BR-53).
    const user = userEvent.setup();
    const pending = deferred<ActionTaken>();
    const create = vi.spyOn(api, "createActionTaken").mockReturnValue(pending.promise);
    await ready([]);
    const form = await openCreate(user);
    await fillRequired(user, form);
    const element = screen.getByRole("form", { name: "Record an action" });
    act(() => {
      fireEvent.submit(element);
      fireEvent.submit(element);
    });
    expect(create).toHaveBeenCalledTimes(1);
    pending.resolve(created());
    await waitFor(() => expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends one request when Save is pressed twice with the keyboard as well", async () => {
    const user = userEvent.setup();
    const pending = deferred<ActionTaken>();
    const create = vi.spyOn(api, "createActionTaken").mockReturnValue(pending.promise);
    await ready([]);
    const form = await openCreate(user);
    await fillRequired(user, form);
    const save = form.getByRole("button", { name: "Save action" });
    save.focus();
    await user.keyboard("{Enter}{Enter}");
    expect(create).toHaveBeenCalledTimes(1);
    pending.resolve(created());
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("reuses the same requestKey for a retry after a network failure, and a fresh one for the next form", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken");
    create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    create.mockResolvedValueOnce(created({ id: 100 }));
    create.mockResolvedValueOnce(created({ id: 101 }));
    await ready([]);

    let form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    await within(screen.getByRole("form", { name: "Record an action" })).findByRole("alert");
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument());

    const [firstKey, retryKey] = [create.mock.calls[0][2], create.mock.calls[1][2]];
    expect(firstKey).toMatch(KEY);
    expect(retryKey).toBe(firstKey);

    form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    const nextKey = create.mock.calls[2][2] as string;
    expect(nextKey).toMatch(KEY);
    expect(nextKey).not.toBe(firstKey);
  });

  it("keeps the same requestKey after a refused submission is corrected, and drops it when the form is cancelled", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, "createActionTaken");
    create.mockRejectedValueOnce(new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", { result: "Result must be between 2 and 1000 characters." }));
    create.mockResolvedValue(created());
    await ready([]);

    let form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);

    // Cancel abandons the submission, so the next one is a new submission.
    await waitFor(() => expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument());
    form = await openCreate(user);
    await user.click(form.getByRole("button", { name: "Cancel" }));
    form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create.mock.calls[2][2]).not.toBe(create.mock.calls[0][2]);
  });

  it("closes the form on success, puts the new card in its place in the order, moves focus to it, and says so (FR-02)", async () => {
    const user = userEvent.setup();
    const earlier = action({ id: 10, actionAt: "2026-10-01T08:00:00.000Z", createdAt: "2026-10-01T08:01:00.000Z" });
    const later = action({ id: 12, actionAt: "2026-10-06T08:00:00.000Z", createdAt: "2026-10-06T08:01:00.000Z" });
    const between = created({ id: 11, actionAt: new Date("2026-10-03T10:30").toISOString() });
    vi.spyOn(api, "createActionTaken").mockResolvedValue(between);
    await ready([earlier, later]);
    const form = await openCreate(user);
    setValue(control(form, "Action Date/Time"), "2026-10-03T10:30");
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Record an action" })).not.toBeInTheDocument());
    expect(cardIds()).toEqual([10, 11, 12]);
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken (3)" })).toBeInTheDocument();
    const heading = within(cards()[1]).getByRole("heading", { level: 3 });
    expect(heading).toHaveFocus();
    expect(within(region()).getByRole("status")).toHaveTextContent("Action recorded.");
    // The tag follows the most recently recorded entry, which is now this one.
    expect(screen.getByText("Latest recorded").closest("[data-action-id]")).toHaveAttribute("data-action-id", "11");
    expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

const card = (id: number) => cards().find((item) => item.getAttribute("data-action-id") === String(id))!;
const editForm = () => within(screen.getByRole("form", { name: "Edit action" }));

/** A date as the form's datetime-local input holds it: the viewer's local time, to the minute. */
function localInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function openEdit(user: User, id: number) {
  await user.click(within(card(id)).getByRole("button", { name: /^Edit/ }));
  return editForm();
}

const EDITOR = { id: 5, fullName: ME.fullName, role: ME.role };

describe("UI-05 edit mode (FR-03, AC-05, AC-06, BR-05, BR-07, BR-09, BR-27)", () => {
  const stored = action({
    id: 31,
    followUpRequired: true,
    followUpNote: "Check the printer again on Thursday.",
    attachmentNotes: "Look for the photo of the toner label.",
  });

  it("offers Edit on every entry, to any IT Staff member or Administrator, whoever performed it", async () => {
    await ready([stored, action({ id: 32, actionAt: "2026-10-05T04:10:00.000Z", performedBy: { id: 5, fullName: ME.fullName, role: ME.role } })]);
    for (const id of [31, 32]) expect(within(card(id)).getByRole("button", { name: /^Edit/ })).toBeEnabled();
  });

  it("replaces the card in place with the form, filled with the stored values", async () => {
    const user = userEvent.setup();
    await ready([action({ id: 30, actionAt: "2026-10-04T03:10:00.000Z" }), stored, action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z" })]);
    const form = await openEdit(user, 31);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The same list item, so it sits where the card was.
    expect(cardIds()).toEqual([30, 31, 32]);
    expect(within(card(31)).queryByRole("term")).not.toBeInTheDocument();
    expect(card(31)).toContainElement(screen.getByRole("form", { name: "Edit action" }));
    expect(control(form, "Action Date/Time")).toHaveValue(localInput(stored.actionAt));
    expect(control(form, "Action Description")).toHaveValue(stored.description);
    expect(control(form, "Result")).toHaveValue(stored.result);
    expect(form.getByRole("radio", { name: "Yes" })).toBeChecked();
    expect(control(form, "Follow-up Note")).toHaveValue("Check the printer again on Thursday.");
    expect(control(form, "Attachment Notes")).toHaveValue("Look for the photo of the toner label.");
    expect(form.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(form.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(form.queryByRole("button", { name: "Save action" })).not.toBeInTheDocument();
  });

  it("keeps Performed by read-only and showing the original performer, not the person editing", async () => {
    const user = userEvent.setup();
    await ready([stored]);
    const form = await openEdit(user, 31);
    const performer = control(form, "Performed by");
    expect(performer).toHaveValue("Wirachat T.");
    expect(performer).toHaveAttribute("readonly");
    expect(within(card(31)).getByText(/^Recorded/)).toBeInTheDocument();
  });

  it("allows one edit at a time: the other Edit buttons and Add action wait", async () => {
    const user = userEvent.setup();
    await ready([stored, action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z" })]);
    await openEdit(user, 31);
    expect(within(card(32)).getByRole("button", { name: /^Edit/ })).toBeDisabled();
    expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeDisabled();
  });

  it("returns to the card without a request when Cancel is pressed, and puts focus back on its Edit button", async () => {
    const user = userEvent.setup();
    const edit = vi.spyOn(api, "editActionTaken");
    await ready([stored]);
    const form = await openEdit(user, 31);
    await user.type(control(form, "Result"), " and more");
    await user.click(form.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument();
    expect(within(card(31)).getByText("Test page printed cleanly.")).toBeInTheDocument();
    expect(within(card(31)).getByRole("button", { name: /^Edit/ })).toHaveFocus();
    expect(edit).not.toHaveBeenCalled();
  });

  it("saves with the card's version as expectedVersion, and returns to view mode with Edited by, focus on Edit", async () => {
    const user = userEvent.setup();
    const edited = action({
      ...stored,
      result: "Test page printed cleanly; toner at 100%.",
      version: 2,
      updatedAt: "2026-10-05T04:02:00.000Z",
      updatedBy: EDITOR,
    });
    const edit = vi.spyOn(api, "editActionTaken").mockResolvedValue(edited);
    await ready([stored]);
    const form = await openEdit(user, 31);
    const result = control(form, "Result");
    await user.clear(result);
    await user.type(result, "Test page printed cleanly; toner at 100%.");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    const [ticketId, actionId, expectedVersion, input] = edit.mock.calls[0] as [number, number, number, ActionTakenInput];
    expect([ticketId, actionId, expectedVersion]).toEqual([12, 31, 1]);
    expect(input).toEqual({
      // Untouched, so the stored instant goes back exactly as it came.
      actionAt: stored.actionAt,
      description: stored.description,
      result: "Test page printed cleanly; toner at 100%.",
      followUpRequired: true,
      followUpNote: "Check the printer again on Thursday.",
      attachmentNotes: "Look for the photo of the toner label.",
    });

    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument());
    const view = within(card(31));
    expect(view.getByText("Test page printed cleanly; toner at 100%.")).toBeInTheDocument();
    expect(view.getByText(/Edited by Nattapong Saelim/)).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Edit/ })).toHaveFocus();
    expect(within(region()).getByRole("status")).toHaveTextContent("Changes saved.");
  });

  it("does not move the stored time when only another field is edited, even if it has seconds the form cannot show", async () => {
    const user = userEvent.setup();
    const withSeconds = action({ id: 31, actionAt: "2026-10-05T03:10:42.123Z" });
    const edit = vi.spyOn(api, "editActionTaken").mockResolvedValue({ ...withSeconds, version: 2 });
    await ready([withSeconds]);
    const form = await openEdit(user, 31);
    await user.type(control(form, "Result"), " Again.");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect((edit.mock.calls[0][3] as ActionTakenInput).actionAt).toBe("2026-10-05T03:10:42.123Z");
  });

  it("clears an emptied Attachment Notes by sending it empty, and sends no note once No is chosen (D-18)", async () => {
    const user = userEvent.setup();
    const edit = vi.spyOn(api, "editActionTaken").mockResolvedValue({ ...stored, version: 2, followUpRequired: false, followUpNote: null, attachmentNotes: null });
    await ready([stored]);
    const form = await openEdit(user, 31);
    await user.clear(control(form, "Attachment Notes"));
    await user.click(form.getByRole("radio", { name: "No" }));
    await user.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    const input = edit.mock.calls[0][3] as ActionTakenInput;
    expect(input.attachmentNotes).toBe("");
    expect(input.followUpRequired).toBe(false);
    expect(input).not.toHaveProperty("followUpNote");
    await waitFor(() => expect(card(31)).not.toHaveTextContent("Check the printer again on Thursday."));
  });

  it("moves the card to its new place when its Action Date/Time changes, announces it, and keeps focus on it", async () => {
    const user = userEvent.setup();
    const early = action({ id: 30, actionAt: "2026-10-01T03:10:00.000Z" });
    const late = action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z" });
    const moved = action({ ...stored, actionAt: new Date("2026-10-06T20:00").toISOString(), version: 2, updatedBy: EDITOR, updatedAt: "2026-10-06T14:00:00.000Z" });
    vi.spyOn(api, "editActionTaken").mockResolvedValue(moved);
    await ready([early, stored, late]);
    expect(cardIds()).toEqual([30, 31, 32].sort((a, b) => a - b));

    const form = await openEdit(user, 31);
    setValue(control(form, "Action Date/Time"), "2026-10-06T20:00");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(cardIds()).toEqual([30, 32, 31]));
    expect(within(region()).getByRole("status")).toHaveTextContent("Moved to its new position by date.");
    expect(within(card(31)).getByRole("heading", { level: 3 })).toHaveFocus();
  });

  it("does not say it moved when the date changed but the place did not", async () => {
    const user = userEvent.setup();
    const only = action({ id: 31 });
    vi.spyOn(api, "editActionTaken").mockResolvedValue({ ...only, actionAt: new Date("2026-10-05T09:00").toISOString(), version: 2 });
    await ready([only]);
    const form = await openEdit(user, 31);
    setValue(control(form, "Action Date/Time"), "2026-10-05T09:00");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument());
    expect(within(region()).getByRole("status")).not.toHaveTextContent("Moved to its new position");
  });

  it("holds the same rules as recording, and keeps the form and the typed values on a refusal", async () => {
    const user = userEvent.setup();
    const edit = vi.spyOn(api, "editActionTaken");
    await ready([stored]);
    const form = await openEdit(user, 31);
    setValue(control(form, "Result"), "x");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    expect(control(form, "Result")).toHaveAccessibleDescription("Result must be between 2 and 1000 characters.");
    expect(control(form, "Result")).toHaveFocus();
    expect(edit).not.toHaveBeenCalled();
    expect(control(form, "Action Description")).toHaveValue(stored.description);
  });

  it("sends one request for a double click and holds the other controls still while it is in flight", async () => {
    const user = userEvent.setup();
    const pending = deferred<ActionTaken>();
    const edit = vi.spyOn(api, "editActionTaken").mockReturnValue(pending.promise);
    await ready([stored, action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z" })]);
    const form = await openEdit(user, 31);
    await user.type(control(form, "Result"), " Again.");
    await user.dblClick(form.getByRole("button", { name: "Save changes" }));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(form.getByRole("button", { name: "Cancel" })).toBeDisabled();
    pending.resolve({ ...stored, version: 2 });
    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument());
    expect(edit).toHaveBeenCalledTimes(1);
  });
});

describe("UI-06 a stale edit: 409 STALE_UPDATE (FR-07, AC-06, AC-27, BR-27, BR-54)", () => {
  const stored = action({ id: 31 });
  const latest = action({
    id: 31,
    version: 2,
    result: "Someone else's newer result.",
    updatedAt: "2026-10-05T05:00:00.000Z",
    updatedBy: { id: 8, fullName: "Siriporn K.", role: "IT_STAFF" },
  });
  const STALE = "Someone else edited this action while you were working on it. Your changes are still in the form.";

  async function staleEdit() {
    const user = userEvent.setup();
    const edit = vi.spyOn(api, "editActionTaken");
    edit.mockRejectedValueOnce(new ApiError(409, "STALE_UPDATE", "This action changed while you were working on it. Review the latest version and try again.", {}, latest));
    await ready([stored]);
    const form = await openEdit(user, 31);
    const result = control(form, "Result");
    await user.clear(result);
    await user.type(result, "My own newer result.");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    const callout = await within(card(31)).findByRole("alert");
    return { user, edit, form, callout };
  }

  it("shows the conflict callout inside the card, in the warning style, and keeps what the person typed", async () => {
    const { form, callout } = await staleEdit();
    expect(callout).toHaveTextContent(STALE);
    expect(callout).toHaveAttribute("data-state", "warning");
    expect(callout).not.toHaveTextContent(/STALE_UPDATE|Something went wrong/);
    expect(card(31)).toContainElement(callout);
    expect(control(form, "Result")).toHaveValue("My own newer result.");
    expect(form.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("asks before replacing the person's edits, and Keep editing leaves them alone", async () => {
    const { user, form, callout } = await staleEdit();
    await user.click(within(callout).getByRole("button", { name: "Show latest" }));

    const confirm = screen.getByRole("group", { name: "Replace your changes?" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(confirm).toHaveTextContent("Your changes will be lost.");
    expect(control(form, "Result")).toHaveValue("My own newer result.");

    await user.click(within(confirm).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("group", { name: "Replace your changes?" })).not.toBeInTheDocument();
    expect(control(form, "Result")).toHaveValue("My own newer result.");
    expect(within(card(31)).getByRole("button", { name: "Show latest" })).toHaveFocus();
  });

  it("closes the confirmation with Escape and returns focus to Show latest, without replacing anything", async () => {
    const { user, form, callout } = await staleEdit();
    await user.click(within(callout).getByRole("button", { name: "Show latest" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Replace your changes?" })).not.toBeInTheDocument();
    expect(within(card(31)).getByRole("button", { name: "Show latest" })).toHaveFocus();
    expect(control(form, "Result")).toHaveValue("My own newer result.");
  });

  it("replaces the form with the server's latest values once confirmed, and the next save carries the new version", async () => {
    const { user, edit } = await staleEdit();
    await user.click(within(card(31)).getByRole("button", { name: "Show latest" }));
    await user.click(screen.getByRole("button", { name: "Replace my changes" }));

    const form = editForm();
    expect(control(form, "Result")).toHaveValue("Someone else's newer result.");
    expect(within(card(31)).queryByRole("alert")).not.toBeInTheDocument();

    edit.mockResolvedValueOnce({ ...latest, version: 3 });
    await user.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[1][2]).toBe(2);
  });

  it("still shows the latest in the card when the person cancels after a conflict", async () => {
    const { user, form } = await staleEdit();
    await user.click(within(card(31)).getByRole("button", { name: "Show latest" }));
    await user.click(screen.getByRole("button", { name: "Replace my changes" }));
    await user.click(editForm().getByRole("button", { name: "Cancel" }));
    expect(within(card(31)).getByText("Someone else's newer result.")).toBeInTheDocument();
    expect(within(card(31)).getByText(/Edited by Siriporn K\./)).toBeInTheDocument();
    expect(form).toBeDefined();
  });

  it("keeps a failed edit's values on a network failure, with the safe message", async () => {
    const user = userEvent.setup();
    const edit = vi.spyOn(api, "editActionTaken").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await ready([stored]);
    const form = await openEdit(user, 31);
    await user.type(control(form, "Result"), " Again.");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    const callout = await within(card(31)).findByRole("alert");
    expect(callout).toHaveTextContent("The action could not be saved.");
    expect(control(form, "Result")).toHaveValue("Test page printed cleanly. Again.");
    expect(edit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// The Requester's view, and a ticket that is no longer active
// ---------------------------------------------------------------------------

describe("UI-07 the Requester's view is read-only (FR-04, AC-08, BR-13)", () => {
  const entries = [
    action({
      id: 31,
      followUpRequired: true,
      followUpNote: "Check the printer again on Thursday.",
      attachmentNotes: "Look for the photo of the toner label.",
    }),
    action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z", description: "Checked the paper tray sensor again." }),
  ];

  it("shows every action with every field, the follow-up note and the performer included", async () => {
    await ready(entries, { mode: "requester" });
    expect(cardIds()).toEqual([31, 32]);
    const first = within(card(31));
    expect(first.getByText("Replaced the toner cartridge and ran a test page.")).toBeInTheDocument();
    expect(first.getByText("Follow-up needed")).toBeInTheDocument();
    expect(first.getByText("Check the printer again on Thursday.")).toBeInTheDocument();
    expect(first.getByText("Look for the photo of the toner label.")).toBeInTheDocument();
    expect(first.getByText("Wirachat T.")).toBeInTheDocument();
    expect(screen.getAllByText("Latest recorded")).toHaveLength(1);
  });

  it("has no Add action, no Edit, no form, and no control of any kind, and no hint of one", async () => {
    await ready(entries, { mode: "requester" });
    const requesterRegion = within(region());
    expect(requesterRegion.queryAllByRole("button")).toHaveLength(0);
    expect(requesterRegion.queryByRole("form")).not.toBeInTheDocument();
    expect(requesterRegion.queryAllByRole("textbox")).toHaveLength(0);
    expect(region().textContent).not.toMatch(/Add action|Edit|Record an action|Save/);
  });

  it("says that IT Staff have not recorded anything yet when there are no actions, with no button", async () => {
    await ready([], { mode: "requester" });
    expect(within(region()).getByText("IT Staff have not recorded any actions yet.")).toBeInTheDocument();
    expect(within(region()).queryAllByRole("button")).toHaveLength(0);
    expect(region().textContent).not.toMatch(/Add action|Record what you do/);
  });

  it("has no hint of the ticket being inactive either: nothing explains a control the Requester never had", async () => {
    await ready(entries, { mode: "requester", ticketStatus: "RESOLVED" });
    expect(region().textContent).not.toMatch(/no more actions can be recorded|Reopen/);
  });

  it("is what the Requester's Ticket Detail screen shows, between the ticket and its attachments, with no write call ever made", async () => {
    vi.spyOn(api, "fetchTicketDetail").mockResolvedValue({
      id: 12,
      ticketNumber: "TT-2026-00042",
      ticketDate: "2026-09-28T02:10:00.000Z",
      summary: "Printer on floor 3 will not print",
      description: "It shows a paper jam, but there is no paper stuck.",
      requestedPriority: "MEDIUM",
      currentStatus: "IN_PROGRESS",
      requester: { id: 3, fullName: "Pornchai Thana" },
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 1, name: "Campus Printers" },
      createdAt: "2026-09-28T02:10:00.000Z",
      updatedAt: "2026-09-29T09:14:22.310Z",
      requesterResolvedAt: null,
      attachments: [],
    } as api.TicketDetail);
    vi.spyOn(api, "fetchComments").mockResolvedValue([]);
    fetchSpy.mockResolvedValue(entries);
    const create = vi.spyOn(api, "createActionTaken");
    const edit = vi.spyOn(api, "editActionTaken");

    render(<RequesterTicketDetail ticketId={12} />);
    await screen.findByTestId("detail-ticket-number");
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (2)" });

    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
    expect(names.indexOf("Actions Taken (2)")).toBeLessThan(names.findIndex((n) => /^Attachments/.test(n ?? "")));
    expect(within(region()).queryAllByRole("button")).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(12);
  });
});

describe("UI-08 a Resolved, Closed, or Cancelled ticket takes no more actions (AC-09, BR-10, D-14)", () => {
  const entries = [action({ id: 31 }), action({ id: 32, actionAt: "2026-10-06T03:10:00.000Z" })];

  it.each([
    ["RESOLVED", "This ticket is Resolved, so no more actions can be recorded. Reopen it first."],
    ["CLOSED", "This ticket is Closed, so no more actions can be recorded. Reopen it first."],
    // A cancelled ticket cannot be reopened, so the helper does not say to.
    ["CANCELLED", "This ticket is Cancelled, so no more actions can be recorded."],
  ] as const)("disables Add action and every Edit on a %s ticket, explains why, and leaves the entries readable", async (status, explanation) => {
    await ready(entries, { ticketStatus: status });
    const add = within(region()).getByRole("button", { name: "+ Add action" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(explanation);
    for (const id of [31, 32]) {
      const edit = within(card(id)).getByRole("button", { name: /^Edit/ });
      expect(edit).toBeDisabled();
      expect(edit).toHaveAccessibleDescription(explanation);
    }
    expect(within(region()).getByText(explanation)).toBeInTheDocument();
    // Still readable.
    expect(within(card(31)).getByText("Replaced the toner cartridge and ran a test page.")).toBeInTheDocument();
  });

  it("disables Add action in the empty state too, with the explanation", async () => {
    await ready([], { ticketStatus: "RESOLVED" });
    expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeDisabled();
    expect(within(region()).getByText("This ticket is Resolved, so no more actions can be recorded. Reopen it first.")).toBeInTheDocument();
  });

  it.each(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const)(
    "leaves Add action and Edit enabled on a %s ticket, with no explanation",
    async (status) => {
      await ready(entries, { ticketStatus: status });
      expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeEnabled();
      expect(within(card(31)).getByRole("button", { name: /^Edit/ })).toBeEnabled();
      expect(region().textContent).not.toMatch(/no more actions can be recorded/);
    },
  );

  it("shows the server's own message when the ticket was resolved while an edit was open, and keeps the edit", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "editActionTaken").mockRejectedValueOnce(
      new ApiError(409, "TICKET_NOT_ACTIVE", "This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed."),
    );
    await ready(entries);
    const form = await openEdit(user, 31);
    await user.type(control(form, "Result"), " Again.");
    await user.click(form.getByRole("button", { name: "Save changes" }));
    const callout = await within(card(31)).findByRole("alert");
    expect(callout).toHaveTextContent("This ticket is resolved, closed, or cancelled, so its actions can no longer be recorded or changed.");
    expect(callout).toHaveTextContent("Everything you typed is still in the form.");
    expect(control(form, "Result")).toHaveValue("Test page printed cleanly. Again.");
    expect(callout).not.toHaveTextContent(/Something went wrong|TICKET_NOT_ACTIVE/);
  });
});

// ---------------------------------------------------------------------------
// The API client's own requests. Every test above mocks this layer, so a wrong
// URL, method, or body here would pass them all; these check what is sent.
// ---------------------------------------------------------------------------

describe("the Actions Taken API client sends what api-spec §2 says", () => {
  const sent = () => (vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]);

  function respond(status: number, body: unknown) {
    // A 204 carries no body by definition.
    const response = status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  }

  // These call the real client, so the spies the other tests share are lifted first.
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input: ActionTakenInput = {
    actionAt: "2026-10-05T03:10:00.000Z",
    description: "Replaced the toner cartridge.",
    result: "Printed cleanly.",
    followUpRequired: false,
  };

  it("lists from GET /api/tickets/:id/actions-taken with the session cookie, and returns the actions", async () => {
    respond(200, { actions: [action()] });
    const actions = await api.fetchActionsTaken(12);
    const [url, init] = sent();
    expect(url).toMatch(/\/api\/tickets\/12\/actions-taken$/);
    expect(init.credentials).toBe("include");
    expect(init.method ?? "GET").toBe("GET");
    expect(actions).toHaveLength(1);
  });

  it("records with POST /api/staff/tickets/:id/actions-taken, the fields and the requestKey in the body, and nothing about who", async () => {
    respond(201, { action: action() });
    await api.createActionTaken(12, input, "key-1234-abcd");
    const [url, init] = sent();
    expect(url).toMatch(/\/api\/staff\/tickets\/12\/actions-taken$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ ...input, requestKey: "key-1234-abcd" });
  });

  it("treats 200, the answer to a repeated requestKey, as success with the original action", async () => {
    respond(200, { action: action({ id: 77 }) });
    const again = await api.createActionTaken(12, input, "key-1234-abcd");
    expect(again.id).toBe(77);
  });

  it("edits with PATCH .../actions-taken/:actionId and expectedVersion in the body", async () => {
    respond(200, { action: action({ version: 2 }) });
    const updated = await api.editActionTaken(12, 31, 1, { ...input, attachmentNotes: "" });
    const [url, init] = sent();
    expect(url).toMatch(/\/api\/staff\/tickets\/12\/actions-taken\/31$/);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ ...input, attachmentNotes: "", expectedVersion: 1 });
    expect(updated.version).toBe(2);
  });

  it("raises the API's own error, with its fields, and the current record on a stale edit", async () => {
    respond(409, { error: { code: "STALE_UPDATE", message: "It changed.", current: action({ version: 3 }) } });
    const error = await api.editActionTaken(12, 31, 1, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("STALE_UPDATE");
    expect(((error as ApiError).current as ActionTaken).version).toBe(3);

    respond(400, { error: { code: "VALIDATION_FAILED", message: "Invalid.", fields: { description: "Too short." } } });
    const refused = await api.createActionTaken(12, input, "key-1234-abcd").catch((e: unknown) => e);
    expect((refused as ApiError).fields).toEqual({ description: "Too short." });
  });

  it("does not mistake any other status for success", async () => {
    for (const status of [204, 400, 403, 404, 409, 500]) {
      respond(status, { error: { code: "X", message: "No." } });
      await expect(api.createActionTaken(12, input, "key-1234-abcd"), String(status)).rejects.toBeInstanceOf(ApiError);
    }
  });
});

// ---------------------------------------------------------------------------
// What the form starts with (review of PR #83)
// ---------------------------------------------------------------------------

describe("the form's own default Action Date/Time is one the ticket accepts (FR-02, BR-06)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A moment on 7 October 2026 in the viewer's own time zone, whatever that is. */
  const at = (hour: number, minute: number, second = 0, ms = 0) => new Date(2026, 9, 7, hour, minute, second, ms);

  async function openAt(now: Date, createdAt: Date) {
    // Only the clock is faked: typing and promises keep running as they do.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const user = userEvent.setup();
    vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    fetchSpy.mockResolvedValue([]);
    renderRegion({ ticketCreatedAt: createdAt.toISOString() });
    await waitFor(() => expect(screen.queryByText("Loading actions taken…")).not.toBeInTheDocument());
    const form = await openCreate(user);
    return { user, form, defaultValue: (control(form, "Action Date/Time") as HTMLInputElement).value };
  }

  it("on a ticket created seconds ago, starts at the next whole minute rather than a minute the ticket did not exist in, and saves it", async () => {
    // The ticket was created at 13:54:39 and the form is opened at 13:54:50. "Now, to the minute" is 13:54:00,
    // which is before the ticket existed, so the form would have refused its own default.
    const { user, form, defaultValue } = await openAt(at(13, 54, 50), at(13, 54, 39));
    expect(defaultValue).toBe("2026-10-07T13:55");

    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));

    expect(screen.queryByText("Action Date/Time cannot be before the ticket was created.")).not.toBeInTheDocument();
    const create = vi.mocked(api.createActionTaken);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const sent = new Date((create.mock.calls[0][1] as ActionTakenInput).actionAt).getTime();
    expect(sent).toBe(at(13, 55).getTime());
    // Not before the ticket, and well inside the five minutes the server allows ahead of now.
    expect(sent).toBeGreaterThanOrEqual(at(13, 54, 39).getTime());
    expect(sent - at(13, 54, 50).getTime()).toBeLessThan(60 * 1000);
  });

  it("is still now, to the minute, on any ticket old enough for that to be allowed", async () => {
    const { defaultValue } = await openAt(at(13, 54, 50), at(9, 0, 39));
    expect(defaultValue).toBe("2026-10-07T13:54");
  });

  it("is still now, to the minute, once the minute the ticket was created in is over", async () => {
    // Created at 13:54:39, opened at 13:56:10: 13:56 is after the ticket, so there is nothing to correct.
    const { defaultValue } = await openAt(at(13, 56, 10), at(13, 54, 39));
    expect(defaultValue).toBe("2026-10-07T13:56");
  });

  it("does not move a default that is exactly the minute the ticket was created", async () => {
    const { defaultValue } = await openAt(at(13, 54, 50), at(13, 54, 0, 0));
    expect(defaultValue).toBe("2026-10-07T13:54");
  });

  it("rounds a creation time with only milliseconds past the minute up, as it does seconds", async () => {
    const { defaultValue } = await openAt(at(13, 54, 0, 800), at(13, 54, 0, 500));
    expect(defaultValue).toBe("2026-10-07T13:55");
  });
});

describe("the empty state while a form is open (review of PR #83)", () => {
  it("steps aside for the create form and comes back when it is cancelled", async () => {
    const user = userEvent.setup();
    await ready([]);
    expect(within(region()).getByText("No actions recorded yet.")).toBeInTheDocument();

    const form = await openCreate(user);
    // "No actions recorded yet" beside a form that is recording one reads as a contradiction, and its
    // disabled button is a second Add action beside a form that already is one.
    expect(within(region()).queryByText("No actions recorded yet.")).not.toBeInTheDocument();
    expect(within(region()).queryByText("Record what you do on this ticket so the Requester can see it.")).not.toBeInTheDocument();
    expect(within(region()).queryByRole("button", { name: "+ Add action" })).not.toBeInTheDocument();

    await user.click(form.getByRole("button", { name: "Cancel" }));
    expect(within(region()).getByText("No actions recorded yet.")).toBeInTheDocument();
    expect(within(region()).getByRole("button", { name: "+ Add action" })).toBeEnabled();
  });

  it("is replaced by the new entry once the first action is recorded", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createActionTaken").mockResolvedValue(created());
    await ready([]);
    const form = await openCreate(user);
    await fillRequired(user, form);
    await user.click(form.getByRole("button", { name: "Save action" }));
    await waitFor(() => expect(cardIds()).toEqual([99]));
    expect(within(region()).queryByText("No actions recorded yet.")).not.toBeInTheDocument();
  });
});
