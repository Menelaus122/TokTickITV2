import { test, expect, Locator, Page } from "@playwright/test";
import {
  ACCOUNTS,
  RUN,
  actionsOf,
  actionsRegion,
  apiAs,
  fillAction,
  historyRegion,
  localInput,
  logOut,
  recordActionOnScreen,
  signIn,
  ticketAt,
} from "./helpers.js";

// E2E-01 and E2E-04 — Actions Taken, from the IT Staff screen to what the Requester reads
// (docs/lab-04/tests.md §2.11; AC-01, AC-04, AC-05, AC-07, AC-08, AC-27; labsheet Part 6).
//
// E2E-01 is one story told in order, so the file runs serially: the Owner records an action, a
// different IT Staff member records another and edits the first, and the Requester reads both.
// E2E-04 uses a Ticket of its own so its counts start at zero.

test.describe.configure({ mode: "serial" });

const FIRST = { description: "Replaced the toner cartridge and ran a test page.", result: "The test page printed cleanly." };
const SECOND = {
  description: "Called the vendor about the fuser unit and booked a visit.",
  result: "A visit is booked for Thursday morning.",
  followUp: { note: "Check the printer again after the vendor's visit on Thursday." },
};
const EDITED_RESULT = "The test page printed cleanly and the toner level reads 100%.";

let shared: { id: number; ticketNumber: string };
let validation: { id: number; ticketNumber: string };

test.beforeAll(async () => {
  const requester = await apiAs(ACCOUNTS.requester.email);
  const staff = await apiAs(ACCOUNTS.staff.email);
  // Owned by Nattapong and In Progress: the state in which IT Staff record work.
  shared = await ticketAt(requester, staff, `E2E actions taken flow ${RUN}`, "IN_PROGRESS");
  validation = await ticketAt(requester, staff, `E2E actions taken validation ${RUN}`, "IN_PROGRESS");
  await requester.dispose();
  await staff.dispose();
  console.log(`E2E created ticket ids: ${shared.id}, ${validation.id} — see tests.md section 5 to reset.`);
});

/** The cards of the region, in the order the screen lists them. */
const cards = (page: Page) => actionsRegion(page).locator("li.tt-action");
const cardWith = (page: Page, text: string): Locator => cards(page).filter({ hasText: text });

async function openStaffDetail(page: Page, ticket: { id: number; ticketNumber: string }) {
  await page.goto(`/queue/${ticket.id}`);
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
}

test("E2E-01 the Owner records an action, a colleague records another and edits the first, and the Requester reads both", async ({ page }) => {
  // --- the Owner records the first action ----------------------------------------------------------------------
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openStaffDetail(page, shared);
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (0)");
  await expect(actionsRegion(page).getByText("No actions recorded yet.")).toBeVisible();

  await actionsRegion(page).getByRole("button", { name: "+ Add action" }).click();
  const form = actionsRegion(page).getByRole("form", { name: "Record an action" });
  // The form opens with focus on its first field, and Performed by is the signed-in member, not editable (BR-05).
  await expect(form.getByLabel(/^Action Date\/Time/)).toBeFocused();
  await expect(form.getByLabel("Performed by")).toHaveValue(ACCOUNTS.staff.name);
  await expect(form.getByLabel("Performed by")).toHaveAttribute("readonly", "");
  await fillAction(page, FIRST);
  await form.getByRole("button", { name: "Save action" }).click();

  await expect(page.getByText("Action recorded.")).toBeVisible();
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (1)");
  const first = cardWith(page, FIRST.description);
  await expect(first).toContainText(ACCOUNTS.staff.name);
  await expect(first).toContainText("IT Staff");
  await expect(first).toContainText("No follow-up");
  await expect(first.getByRole("heading", { level: 3 })).toBeFocused(); // focus follows the new card (ui-spec §9)
  await expect(first.getByText("Latest recorded")).toBeVisible();
  await logOut(page);

  // --- a colleague who is not the Owner records a second action and edits the first ----------------------------
  await signIn(page, ACCOUNTS.colleague.email, ACCOUNTS.colleague.name);
  await openStaffDetail(page, shared);
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (1)");
  await expect(page.getByRole("region", { name: "Operational" })).toContainText(ACCOUNTS.staff.name); // the Owner is Nattapong, not this member

  await recordActionOnScreen(page, SECOND);
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (2)");
  const second = cardWith(page, SECOND.description);
  await expect(second).toContainText(ACCOUNTS.colleague.name); // whoever owns the Ticket, Performed by is the person who recorded (AC-01)
  await expect(second).toContainText("Follow-up needed");
  await expect(second).toContainText(SECOND.followUp.note);
  // Exactly one card carries Latest recorded: the newest recorded, the one the resolution gate reads.
  await expect(actionsRegion(page).getByText("Latest recorded")).toHaveCount(1);
  await expect(second.getByText("Latest recorded")).toBeVisible();
  await expect(first.getByText("Latest recorded")).toHaveCount(0);

  // Edit the Owner's action: allowed for any IT Staff member (BR-09, AC-05).
  await first.getByRole("button", { name: /^Edit action of/ }).click();
  const editForm = actionsRegion(page).getByRole("form", { name: "Edit action" });
  await expect(editForm.getByLabel("Performed by")).toHaveValue(ACCOUNTS.staff.name); // the original performer stays
  await editForm.getByLabel(/^Result/).fill(EDITED_RESULT);
  await editForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  const edited = cardWith(page, EDITED_RESULT);
  await expect(edited).toContainText(`Edited by ${ACCOUNTS.colleague.name}`);
  await expect(edited).toContainText(ACCOUNTS.staff.name); // still performed by the Owner
  await expect(edited.getByRole("button", { name: /^Edit action of/ })).toBeFocused(); // focus returns to Edit (ui-spec §9)
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (2)");
  await logOut(page);

  // --- the Requester reads both, and can change neither --------------------------------------------------------
  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await page.goto(`/tickets/${shared.id}`);
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(shared.ticketNumber);
  const region = actionsRegion(page);
  await expect(region.getByRole("heading", { level: 2 })).toHaveText("Actions Taken (2)");
  await expect(cardWith(page, EDITED_RESULT)).toContainText(ACCOUNTS.staff.name);
  await expect(cardWith(page, EDITED_RESULT)).toContainText(`Edited by ${ACCOUNTS.colleague.name}`);
  await expect(cardWith(page, SECOND.description)).toContainText(ACCOUNTS.colleague.name);
  await expect(cardWith(page, SECOND.description)).toContainText("Follow-up needed");
  // Read-only: no Add action, no Edit, no form, and no hint of one (FR-04, AC-08).
  await expect(region.getByRole("button")).toHaveCount(0);
  await expect(region.getByRole("form")).toHaveCount(0);
  await expect(region.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add action|Edit/ })).toHaveCount(0);
  await expect(historyRegion(page)).toContainText("Ticket created");
  // The Status History follows the Actions Taken (ui-spec §6).
  const actionsBox = (await region.boundingBox())!;
  const historyBox = (await historyRegion(page).boundingBox())!;
  expect(historyBox.y).toBeGreaterThan(actionsBox.y);
  await logOut(page);

  // --- and the API says the same, to the same person (AC-08, SEC-02) -------------------------------------------
  const requester = await apiAs(ACCOUNTS.requester.email);
  const stored = await actionsOf(requester, shared.id);
  expect(stored.map((action) => action.performedBy.fullName)).toEqual([ACCOUNTS.staff.name, ACCOUNTS.colleague.name]);
  expect(stored[0].updatedBy?.fullName, "the edit is recorded under the editor").toBe(ACCOUNTS.colleague.name);
  const write = await requester.post(`/api/staff/tickets/${shared.id}/actions-taken`, {
    data: { actionAt: new Date().toISOString(), description: "A Requester must not write this.", result: "No.", followUpRequired: false },
  });
  expect(write.status(), "a Requester cannot record an action").toBe(403);
  const edit = await requester.patch(`/api/staff/tickets/${shared.id}/actions-taken/${stored[0].id}`, {
    data: { expectedVersion: stored[0].version, result: "A Requester must not edit this." },
  });
  expect(edit.status(), "a Requester cannot edit an action").toBe(403);
  expect((await actionsOf(requester, shared.id)).length, "nothing was written").toBe(2);
  await requester.dispose();

  const other = await apiAs(ACCOUNTS.otherRequester.email);
  expect((await other.get(`/api/tickets/${shared.id}/actions-taken`)).status(), "another Requester's Ticket is not found").toBe(404);
  await other.dispose();
});

test("E2E-04 an empty form, a follow-up without a note, a lost connection, and a double click", async ({ page }) => {
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openStaffDetail(page, validation);
  await actionsRegion(page).getByRole("button", { name: "+ Add action" }).click();
  const form = actionsRegion(page).getByRole("form", { name: "Record an action" });
  const save = form.getByRole("button", { name: "Save action" });

  /** The message sits directly beneath its own field, inside the same group (ui-spec §4.2, STYLE-05). */
  async function expectBeneath(field: Locator, message: Locator) {
    // Both boxes are read in one go: focus has just moved to a field, and the page may still be scrolling to it.
    const gap = await page.evaluate(
      ([fieldElement, messageElement]) => {
        const a = (fieldElement as Element).getBoundingClientRect();
        const b = (messageElement as Element).getBoundingClientRect();
        return { below: b.top - a.bottom, offset: Math.abs(b.left - a.left) };
      },
      [await field.elementHandle(), await message.elementHandle()],
    );
    expect(gap.below, "the message is below its field").toBeGreaterThanOrEqual(-1);
    expect(gap.offset, "and starts where the field does").toBeLessThan(4);
  }

  // --- nothing typed: a message on each required field, and focus on the first --------------------------------
  await save.click();
  const description = form.getByLabel(/^Action Description/);
  const result = form.getByLabel(/^Result/);
  await expect(form.getByText("Action Description is required.")).toBeVisible();
  await expect(form.getByText("Result is required.")).toBeVisible();
  await expect(description).toBeFocused();
  await expect(description).toHaveAttribute("aria-invalid", "true");
  await expectBeneath(description, form.getByText("Action Description is required."));
  await expectBeneath(result, form.getByText("Result is required."));
  expect(await actionsOf(await apiAs(ACCOUNTS.staff.email), validation.id), "a refused form writes nothing").toHaveLength(0);

  // --- too short, and the typed text is kept ------------------------------------------------------------------
  await description.fill("abc");
  await result.fill("Fixed");
  await save.click();
  await expect(form.getByText("Action Description must be between 5 and 2000 characters.")).toBeVisible();
  await expect(description).toHaveValue("abc");
  await expect(result).toHaveValue("Fixed");

  // --- Yes without a note --------------------------------------------------------------------------------------
  await description.fill("Restarted the print spooler on the file server.");
  await expect(form.getByLabel(/^Follow-up Note/)).toHaveCount(0); // the note exists only for Yes
  await form.getByRole("radio", { name: "Yes" }).check();
  const note = form.getByLabel(/^Follow-up Note/);
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute("required", ""); // the asterisk arrives with the field (STYLE-03)
  await expect(form.locator("label", { hasText: "Follow-up Note" }).locator(".tt-field__required")).toHaveText("*");
  await save.click();
  await expect(form.getByText("Follow-up Note is required when follow-up is needed.")).toBeVisible();
  await expectBeneath(note, form.getByText("Follow-up Note is required when follow-up is needed."));
  await expect(note).toBeFocused();
  await expect(description).toHaveValue("Restarted the print spooler on the file server.");

  // --- a date in the future, and one before the Ticket existed ------------------------------------------------
  const when = form.getByLabel(/^Action Date\/Time/);
  await note.fill("Check the spooler again tomorrow.");
  await when.fill("2099-01-01T10:00");
  await save.click();
  await expect(form.getByText("Action Date/Time cannot be in the future.")).toBeVisible();
  await when.fill("2020-01-01T09:00");
  await save.click();
  await expect(form.getByText("Action Date/Time cannot be before the ticket was created.")).toBeVisible();
  expect((await actionsOf(await apiAs(ACCOUNTS.staff.email), validation.id)).length, "still nothing written").toBe(0);

  // --- No again: the note is hidden and not sent; a lost connection keeps everything typed --------------------
  await form.getByRole("radio", { name: "No" }).check();
  await expect(form.getByLabel(/^Follow-up Note/)).toHaveCount(0);
  await when.fill(localInput(new Date(Date.now() + 60_000))); // a minute ahead: after the Ticket, inside the five-minute tolerance
  await result.fill("The spooler restarted and the queue drained.");

  await page.route("**/api/staff/tickets/*/actions-taken", (route) => route.abort("failed"));
  await save.click();
  await expect(page.getByText(/The action could not be saved\. Check your connection and try again\. Everything you typed is still in the form\./)).toBeVisible();
  await expect(description).toHaveValue("Restarted the print spooler on the file server.");
  await expect(result).toHaveValue("The spooler restarted and the queue drained.");
  await expect(save).toBeEnabled();
  await page.unroute("**/api/staff/tickets/*/actions-taken");

  // --- the connection is back: a double click sends one request and makes one action (AC-07, AC-27) -----------
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/actions-taken$/.test(request.url())) writes.push(request.url());
  });
  await save.dblclick();
  await expect(page.getByText("Action recorded.")).toBeVisible();
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (1)");
  expect(writes, "one request for two clicks").toHaveLength(1);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const stored = await actionsOf(staff, validation.id);
  expect(stored, "exactly one action exists").toHaveLength(1);
  expect(stored[0].followUpRequired).toBe(false);
  expect(stored[0].followUpNote, "a note typed under Yes and then hidden is not stored").toBeNull();
  await staff.dispose();
});
