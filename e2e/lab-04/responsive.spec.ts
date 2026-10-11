import { test, expect, Locator, Page } from "@playwright/test";
import {
  ACCOUNTS,
  LAB4_VIEWPORTS,
  RUN,
  VIEWPORT_NAMES,
  actionsRegion,
  apiAs,
  claimTicket,
  createTicketAs,
  deactivateCreatedUsers,
  expectSound,
  historyRegion,
  layoutProblems,
  linesOf,
  logOut,
  makeRequester,
  operationalRegion,
  recordAction,
  recordActionOnScreen,
  actionTime,
  shoot,
  signIn,
  staffTicket,
  ticketAt,
  trackCreatedUser,
  type MadeAccount,
  type ViewportName,
} from "./helpers.js";

// RESP-01 to RESP-06 (docs/lab-04/tests.md §2.10) at the three Lab 4 widths, and the screenshot set
// ui-spec §12 lists, saved under artifacts/lab-04/screenshots/<folder>/<shot>-<viewport>.png.
//
// Every screenshot is taken of a real state, reached through the screen. Where a state cannot be reached
// honestly (a dashboard that is forbidden to the role that opened it, a request that fails, a request that
// has not finished), the response is held back or replaced for that one shot, and tests.md §5.1 says which.
// Straight after each screenshot the screen is checked against the layout and focus rules of ui-spec §10 and
// §11 (RESP-06): no sideways scroll, nothing sticking out or hidden behind an edge, no two controls
// overlapping, and an outline on every control that takes focus.

test.afterAll(deactivateCreatedUsers);

const MOBILE_MAX = 767;
const TABLET_MIN = 768;
const DESKTOP_MIN = 992;

/** Saves the screenshot, then holds the screen to the layout and focus rules (RESP-06). */
async function capture(page: Page, folder: string, shot: string, viewport: ViewportName, options: { fullPage?: boolean; element?: Locator; through?: Locator } = {}) {
  await shoot(page, folder, shot, viewport, options);
  await expectSound(page, `${folder}/${shot} at ${viewport}`);
}

/** Holds every response to `pattern` until `release()` is called: a request that has not finished. */
async function holdResponses(page: Page, pattern: string | RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

/** Answers every request to `pattern` with `status` and the API's error shape: a refusal or a failure, for one shot. */
async function answerWith(page: Page, pattern: string | RegExp, status: number, code: string, message: string) {
  await page.route(pattern, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code, message } }) }),
  );
}

/** Where the boxes of `locator` sit: the distinct rows and columns they fall into, to the pixel. */
async function grid(locator: Locator) {
  const boxes = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) };
    }),
  );
  return { boxes, rows: new Set(boxes.map((box) => box.y)).size, columns: new Set(boxes.map((box) => box.x)).size };
}

// ---- the people and Tickets every viewport reads ------------------------------------------------------------

let populated: MadeAccount;
const statuses = ["NEW", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  // A Requester with Tickets in every kind of status, so the dashboard has something in each card and each list.
  populated = await makeRequester("Responsive", "Napat Saetang");
  const own = await apiAs(populated.email, populated.password);
  const staff = await apiAs(ACCOUNTS.staff.email);
  for (const status of statuses) await ticketAt(own, staff, `Printer on floor 3 does not respond (${status.toLowerCase().replace(/_/g, " ")}) ${RUN}`, status);
  await own.dispose();
  await staff.dispose();

  // Work for the Administrator, so the staff dashboard's "me" lists and My Recent Actions have rows in them.
  const requester = await apiAs(ACCOUNTS.requester.email);
  const admin = await apiAs(ACCOUNTS.admin.email);
  const urgent = await createTicketAs(requester, `Grade upload rejects every file (urgent) ${RUN}`, "URGENT");
  await requester.dispose();
  const when = (await actionTime(admin, urgent.id)).toISOString();
  await claimTicket(admin, urgent.id);
  await recordAction(admin, urgent.id, { description: "Raised the upload size limit on the registrar's portal.", result: "Uploads under 20 MB now pass.", actionAt: when });
  await recordAction(admin, urgent.id, {
    description: "Asked the vendor whether the limit can be raised for every faculty.",
    result: "Waiting for the vendor's answer.",
    followUpRequired: true,
    followUpNote: "Chase the vendor on Monday.",
    actionAt: when,
  });
  await admin.dispose();
});

for (const viewport of VIEWPORT_NAMES) {
  const { width } = LAB4_VIEWPORTS[viewport];

  test.describe(`at ${viewport} ${width}×${LAB4_VIEWPORTS[viewport].height}`, () => {
    test.use({ viewport: LAB4_VIEWPORTS[viewport] });

    test(`RESP-01 the Requester Dashboard (${viewport})`, async ({ page }) => {
      test.setTimeout(150_000);
      // The same seven Tickets for each width, in a Requester of its own, so the three pictures show the same figures: the shared
      // Requester gains Tickets in every test, and the tablet's dashboard would not match the desktop's.
      const shown = await makeRequester(`Responsive ${viewport}`, "Napat Saetang");
      const shownApi = await apiAs(shown.email, shown.password);
      const staffApi = await apiAs(ACCOUNTS.staff.email);
      for (const status of statuses) await ticketAt(shownApi, staffApi, `Printer on floor 3 does not respond (${status.toLowerCase().replace(/_/g, " ")}) ${RUN}`, status);
      await shownApi.dispose();
      await staffApi.dispose();

      await signIn(page, shown.email, shown.name, shown.password);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Napat");
      for (const [label, value] of [["Open Tickets", 4], ["Waiting for You", 1], ["Resolved", 1], ["Closed", 1]] as const) {
        await expect(page.getByRole("link", { name: `${label}: ${value}. View all` }), label).toBeVisible();
      }
      await expect(page.getByLabel("Your tickets at a glance").getByRole("link")).toHaveCount(4);

      // Cards: four across, two by two, then one per row (ui-spec §3.6).
      const cards = await grid(page.locator("[aria-label='Your tickets at a glance'] .tt-metric"));
      if (width >= DESKTOP_MIN) expect([cards.rows, cards.columns], "four cards in one row").toEqual([1, 4]);
      else if (width >= TABLET_MIN) expect([cards.rows, cards.columns], "two by two").toEqual([2, 2]);
      else {
        expect([cards.rows, cards.columns], "one card per row").toEqual([4, 1]);
        for (const box of cards.boxes) expect(box.width, "full width inside the 16px gutters").toBeGreaterThanOrEqual(width - 40);
      }
      // The two lists and the quick actions stack below the cards, full width.
      const lists = await grid(page.locator(".tt-dash__list, .tt-dash__actions"));
      expect(lists.columns, "the lists are one column").toBe(1);
      await capture(page, "requester-dashboard", "populated", viewport);

      // Quick actions: in one row from 768 px, stacked below it with the primary on top (ui-spec §3.6, §10).
      const buttons = await grid(page.locator(".tt-dash__actions .tt-btn"));
      if (width >= TABLET_MIN) expect(buttons.rows, "quick actions in one row").toBe(1);
      else {
        expect(buttons.rows, "quick actions stacked").toBe(2);
        const [first, second] = buttons.boxes;
        expect(first.y, "the primary is on top").toBeLessThan(second.y);
        const row = (await page.locator(".tt-dash__buttons").boundingBox())!;
        expect(first.width, "full width of the card").toBeGreaterThanOrEqual(row.width - 1);
      }

      // Navigation: the header's links from 768 px; a menu below it that holds them and the account actions.
      if (width <= MOBILE_MAX) {
        await expect(page.getByRole("banner").getByRole("navigation", { name: "Main" })).toBeHidden();
        await page.getByRole("button", { name: "Menu" }).click();
        const menu = page.locator(".tt-shell__mobile-nav");
        await expect(menu.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        for (const name of ["My Tickets", "Create Ticket", "Change Password"]) await expect(menu.getByRole("link", { name })).toBeVisible();
        await expect(menu.getByRole("button", { name: "Logout" })).toBeVisible();
      } else {
        await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      }
      await capture(page, "requester-dashboard", "navigation", viewport, { fullPage: false });
      if (width <= MOBILE_MAX) await page.getByRole("button", { name: "Menu" }).click();

      // A card, followed: My Tickets, filtered, with the open group shown as a chip (ui-spec §7).
      await page.getByRole("link", { name: /^Open Tickets: \d+\. View all$/ }).click();
      await expect(page).toHaveURL(/\/tickets\?group=open$/);
      await expect(page.getByText("Open tickets", { exact: true })).toBeVisible();
      await expect(page.getByTestId("result-count")).toBeVisible();
      await capture(page, "requester-dashboard", "drill-down-result", viewport);

      // Loading: the skeletons are shaped like the cards and the lists (ui-spec §3.5).
      const release = await holdResponses(page, "**/api/dashboard/requester");
      await page.goto("/dashboard");
      await expect(page.locator("[data-state='loading']")).toBeVisible();
      await expect(page.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
      await capture(page, "requester-dashboard", "loading", viewport);
      release();
      await expect(page.getByLabel("Your tickets at a glance")).toBeVisible();
      await page.unroute("**/api/dashboard/requester");

      // Failure: the safe message and Try again, and the shell stays usable.
      await answerWith(page, "**/api/dashboard/requester", 500, "SERVER_ERROR", "Something broke on the server: stack trace here.");
      await page.reload();
      await expect(page.getByText("The dashboard could not be loaded.")).toBeVisible();
      await expect(page.getByText(/stack trace|SERVER_ERROR/)).toHaveCount(0); // no raw detail reaches the person (AC-28)
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await capture(page, "requester-dashboard", "failure", viewport);
      await page.unroute("**/api/dashboard/requester");
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByLabel("Your tickets at a glance")).toBeVisible();

      // Zero data: a Requester with no Tickets sees zeros, and nothing is hidden (BR-39).
      await logOut(page);
      await signIn(page, ACCOUNTS.noTickets.email, ACCOUNTS.noTickets.name);
      await expect(page.getByRole("region", { name: "Recently updated" })).toContainText("You have no tickets yet.");
      await expect(page.getByLabel("Your tickets at a glance").locator(".tt-metric__value")).toHaveText(["0", "0", "0", "0"]);
      await capture(page, "requester-dashboard", "zero-data", viewport);
    });

    test(`RESP-02 the IT Staff and Administrator Dashboard (${viewport})`, async ({ page }) => {
      test.setTimeout(150_000);
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back, Nattapong");
      await expect(page.getByLabel("Your queue at a glance").getByRole("link")).toHaveCount(4);

      // Cards, as the Requester's: four across, two by two, one per row.
      const cards = await grid(page.locator("[aria-label='Your queue at a glance'] .tt-metric"));
      if (width >= DESKTOP_MIN) expect([cards.rows, cards.columns], "four cards in one row").toEqual([1, 4]);
      else if (width >= TABLET_MIN) expect([cards.rows, cards.columns], "two by two").toEqual([2, 2]);
      else expect([cards.rows, cards.columns], "one card per row").toEqual([4, 1]);

      // The two lists sit side by side from 992 px and stack below it (ui-spec §3.6).
      const pair = await grid(page.locator(".tt-dash__pair > .tt-dash__list"));
      if (width >= DESKTOP_MIN) expect([pair.rows, pair.columns], "the two lists side by side").toEqual([1, 2]);
      else expect([pair.rows, pair.columns], "the two lists stacked").toEqual([2, 1]);

      // The status counts: five in a row on a desktop, wrapped to two lines on a tablet, still inside the card on a phone.
      const counts = await grid(page.locator(".tt-dash-status"));
      expect(counts.boxes).toHaveLength(5);
      if (width >= DESKTOP_MIN) expect(counts.rows, "By status in one line").toBe(1);
      else expect(counts.rows, "By status wraps").toBeGreaterThanOrEqual(2);
      if (width >= TABLET_MIN && width < DESKTOP_MIN) expect(counts.rows, "By status wraps to two lines").toBe(2);
      await expect(page.getByRole("region", { name: "Accounts" })).toHaveCount(0); // IT Staff are not given the accounts (BR-38)
      await capture(page, "staff-dashboard", "it-staff-populated", viewport);

      // A card, followed: the Ticket Queue, filtered, with the open group as a chip.
      await page.getByRole("link", { name: /^Unassigned: \d+\. View all$/ }).first().click();
      await expect(page).toHaveURL(/\/queue\?owner=unassigned&group=open$/);
      await expect(page.getByText("Open tickets", { exact: true })).toBeVisible();
      await expect(page.getByTestId("result-count")).toBeVisible();
      await capture(page, "staff-dashboard", "drill-down-result", viewport);
      await page.goto("/dashboard");
      await expect(page.getByLabel("Your queue at a glance")).toBeVisible();

      // Loading, failure, and a refusal. The refusal is not reachable by a role that has a dashboard, so the
      // API's own 403 is put in its place for the one shot (ui-spec §3.5).
      const release = await holdResponses(page, "**/api/staff/dashboard");
      await page.goto("/dashboard");
      await expect(page.locator("[data-state='loading']")).toBeVisible();
      await capture(page, "staff-dashboard", "loading", viewport);
      release();
      await expect(page.getByLabel("Your queue at a glance")).toBeVisible();
      await page.unroute("**/api/staff/dashboard");

      await answerWith(page, "**/api/staff/dashboard", 500, "SERVER_ERROR", "Something broke on the server: stack trace here.");
      await page.reload();
      await expect(page.getByText("The dashboard could not be loaded.")).toBeVisible();
      await expect(page.getByText(/stack trace|SERVER_ERROR/)).toHaveCount(0);
      await capture(page, "staff-dashboard", "failure", viewport);
      await page.unroute("**/api/staff/dashboard");

      await answerWith(page, "**/api/staff/dashboard", 403, "FORBIDDEN", "You do not have permission to do that.");
      await page.reload();
      await expect(page.getByText("You do not have access to this dashboard.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0); // a refusal is not an outage
      await capture(page, "staff-dashboard", "forbidden", viewport);
      await page.unroute("**/api/staff/dashboard");
      await logOut(page);

      // An IT Staff member with no work: zeros, and each list says so.
      await signIn(page, ACCOUNTS.idleStaff.email, ACCOUNTS.idleStaff.name);
      await expect(page.getByRole("region", { name: "My Tickets" })).toContainText("No tickets are assigned to you.");
      await expect(page.getByRole("region", { name: "My Recent Actions" })).toContainText("You have not recorded any actions yet.");
      await capture(page, "staff-dashboard", "it-staff-zero-data", viewport);
      await logOut(page);

      // The Administrator: the same dashboard, and the accounts as plain numbers (BR-38, BR-40).
      await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
      const accounts = page.getByRole("region", { name: "Accounts" });
      await expect(accounts).toBeVisible();
      await expect(accounts.getByRole("link")).toHaveCount(1); // Open User Management, and nothing else
      const numbers = await grid(page.locator(".tt-dash__cards--accounts .tt-metric"));
      expect(numbers.boxes).toHaveLength(4);
      if (width >= DESKTOP_MIN) expect([numbers.rows, numbers.columns], "the four counts in one row").toEqual([1, 4]);
      else if (width >= TABLET_MIN) expect([numbers.rows, numbers.columns], "two by two").toEqual([2, 2]);
      else expect([numbers.rows, numbers.columns], "one per row").toEqual([4, 1]);
      await expect(page.getByRole("region", { name: "My Recent Actions" }).locator("a.tt-dash-row").first()).toContainText("Follow-up needed");
      await capture(page, "staff-dashboard", "administrator-accounts", viewport);
    });

    test(`RESP-03 and RESP-04 Actions Taken, for IT Staff and for the Requester (${viewport})`, async ({ page }) => {
      test.setTimeout(240_000);
      const rich = await buildRichTicket(viewport);
      const empty = await buildTicket(`Projector in room 402 flickers (no actions yet, ${viewport}) ${RUN}`, "IN_PROGRESS");
      const resolved = await buildTicket(`Wi-Fi drops in the library (resolved, ${viewport}) ${RUN}`, "RESOLVED");

      // --- the list: several actions, written by different people, in the order they happened ------------------------
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await page.goto(`/queue/${rich.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(rich.ticketNumber);
      const region = actionsRegion(page);
      await expect(region.getByRole("heading", { level: 2 })).toHaveText("Actions Taken (3)");
      const cards = region.locator("li.tt-action");
      await expect(cards).toHaveCount(3);
      // One column of cards at every width, and exactly one "Latest recorded", which is not on the last card (BR-17).
      const stack = await grid(cards);
      expect(stack.columns, "one column of cards").toBe(1);
      await expect(region.getByText("Latest recorded")).toHaveCount(1);
      await expect(cards.first().getByText("Latest recorded")).toBeVisible();
      await expect(cards.last().getByText("Latest recorded")).toHaveCount(0);
      await expect(cards.last()).toContainText("Attachment Notes");
      await expect(cards.first()).toContainText("Edited by"); // the third action was recorded by Nattapong and edited by Siriporn
      // The labels sit beside their values from 992 px, in a 180 px column, and above them below it (ui-spec §4.5).
      const label = await cards.nth(1).locator("dt").first().boundingBox();
      const value = await cards.nth(1).locator("dd").first().boundingBox();
      if (width >= DESKTOP_MIN) {
        expect(Math.abs(label!.y - value!.y), "label beside value").toBeLessThan(6);
        expect(Math.round(value!.x - label!.x), "after a 180 px column and its gap").toBeGreaterThanOrEqual(180);
      } else {
        expect(value!.y, "label above value").toBeGreaterThan(label!.y + label!.height - 1);
        expect(Math.abs(value!.x - label!.x), "at the same left edge").toBeLessThan(2);
      }
      await region.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "list", viewport, { element: region });

      // --- edit mode: the same form, filled, with the original performer, read-only ------------------------------------
      await cards.last().getByRole("button", { name: /^Edit action of/ }).click();
      const editForm = region.getByRole("form", { name: "Edit action" });
      await expect(editForm).toBeVisible();
      await expect(editForm.getByLabel("Performed by")).toHaveValue(ACCOUNTS.staff.name);
      await expect(editForm.getByLabel("Performed by")).toHaveAttribute("readonly", "");
      await expect(editForm.getByLabel(/^Action Description/)).toHaveValue("Replaced the toner cartridge and ran a test page.");
      // Only one card is editable at a time: every other control in the region waits (BR-53).
      const otherEdits = region.getByRole("button", { name: /^Edit action of/ });
      await expect(otherEdits).toHaveCount(2); // the card being edited has no Edit button of its own
      for (let i = 0; i < 2; i++) await expect(otherEdits.nth(i)).toBeDisabled();
      await expect(region.getByRole("button", { name: "+ Add action" })).toBeDisabled();
      await editForm.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "edit-mode", viewport, { element: region });

      // --- a conflict: a colleague edits the same action while this form is open ----------------------------------------
      const colleague = await apiAs(ACCOUNTS.colleague.email);
      const stored = (await (await colleague.get(`/api/tickets/${rich.id}/actions-taken`)).json()) as { actions: { id: number; version: number; description: string }[] };
      const target = stored.actions.find((action) => action.description.startsWith("Replaced the toner"))!;
      expect(
        (await colleague.patch(`/api/staff/tickets/${rich.id}/actions-taken/${target.id}`, { data: { expectedVersion: target.version, result: "The test page printed cleanly; the toner reads 100%." } })).status(),
      ).toBe(200);
      await colleague.dispose();
      await editForm.getByLabel(/^Result/).fill("The test page printed cleanly and the drum was wiped.");
      await editForm.getByRole("button", { name: "Save changes" }).click();
      const conflict = editForm.getByRole("alert").filter({ hasText: "Someone else edited this action while you were working on it." });
      await expect(conflict).toBeVisible();
      await expect(conflict).toContainText("Your changes are still in the form.");
      await expect(conflict.getByRole("button", { name: "Show latest" })).toBeVisible();
      await expect(editForm.getByLabel(/^Result/)).toHaveValue("The test page printed cleanly and the drum was wiped.");
      await editForm.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "conflict", viewport, { element: region });
      await editForm.getByRole("button", { name: "Cancel" }).click();

      // --- an empty list, the create form, and what it says when it is wrong -------------------------------------------
      await page.goto(`/queue/${empty.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(empty.ticketNumber);
      await expect(region.getByText("No actions recorded yet.")).toBeVisible();
      await expect(region.getByText("Record what you do on this ticket so the Requester can see it.")).toBeVisible();
      await region.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "empty-state", viewport, { element: region });

      await region.getByRole("button", { name: "+ Add action" }).click();
      const form = region.getByRole("form", { name: "Record an action" });
      await expect(form.getByLabel(/^Action Date\/Time/)).toBeFocused();
      await expect(form.getByLabel("Performed by")).toHaveValue(ACCOUNTS.staff.name);
      // The form's buttons: side by side from 768 px; stacked, full width, with Save on top below it (ui-spec §4.5).
      const buttons = await grid(form.locator(".tt-actions .tt-btn"));
      if (width >= TABLET_MIN) expect(buttons.rows, "Cancel and Save side by side").toBe(1);
      else {
        expect(buttons.rows, "Cancel and Save stacked").toBe(2);
        // In the page's order Cancel comes first and Save second; below 768 px they are drawn in reverse, so Save is on top.
        const [cancel, save] = buttons.boxes;
        expect(save.y, `Save on top: ${JSON.stringify(buttons.boxes)}`).toBeLessThan(cancel.y);
        expect(save.width, "Save is full width").toBeGreaterThanOrEqual(cancel.width - 1);
      }
      await form.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "create-form", viewport, { element: region });

      await form.getByRole("radio", { name: "Yes" }).check();
      await expect(form.getByLabel(/^Follow-up Note/)).toBeVisible();
      await expect(form.locator("label", { hasText: "Follow-up Note" }).locator(".tt-field__required")).toHaveText("*");
      await capture(page, "actions-taken", "follow-up-note-required", viewport, { element: region });

      await form.getByRole("button", { name: "Save action" }).click();
      for (const message of ["Action Description is required.", "Result is required.", "Follow-up Note is required when follow-up is needed."]) {
        await expect(form.getByText(message)).toBeVisible();
      }
      await expect(form.getByLabel(/^Action Description/)).toBeFocused(); // the first invalid field takes focus
      await capture(page, "actions-taken", "validation-errors", viewport, { element: region });
      await form.getByRole("button", { name: "Cancel" }).click();

      // --- a resolved Ticket takes no more actions: disabled, and it says why -------------------------------------------
      await page.goto(`/queue/${resolved.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(resolved.ticketNumber);
      await expect(region.getByRole("button", { name: "+ Add action" })).toBeDisabled();
      await expect(region.getByRole("button", { name: /^Edit action of/ })).toBeDisabled();
      await expect(region).toContainText("This ticket is Resolved, so no more actions can be recorded. Reopen it first.");
      await region.scrollIntoViewIfNeeded();
      await capture(page, "actions-taken", "ticket-not-active", viewport, { element: region });
      await logOut(page);

      // --- the Requester reads the same, with nothing to press (RESP-04) -----------------------------------------------
      await signIn(page, populated.email, populated.name, populated.password);
      await page.goto(`/tickets/${rich.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(rich.ticketNumber);
      await expect(region.getByRole("heading", { level: 2 })).toHaveText("Actions Taken (3)");
      await expect(region.getByRole("button")).toHaveCount(0);
      await expect(region.getByRole("textbox")).toHaveCount(0);
      await expect(historyRegion(page)).toContainText("Ticket created");
      const requesterCards = await grid(region.locator("li.tt-action"));
      expect(requesterCards.columns, "one column of cards").toBe(1);
      const regionBox = (await region.boundingBox())!;
      const historyBox = (await historyRegion(page).boundingBox())!;
      expect(historyBox.y, "Status History follows Actions Taken").toBeGreaterThan(regionBox.y + regionBox.height - 1);
      expect(regionBox.x + regionBox.width, "inside the window").toBeLessThanOrEqual(width + 1);
      await capture(page, "actions-taken", "requester-read-only-view", viewport, { element: region, through: historyRegion(page) });
    });

    test(`RESP-06 the status control, its refusals, and the Status History (${viewport})`, async ({ page }) => {
      test.setTimeout(240_000);
      const ticket = await buildTicket(`Projector in room 402 flickers (workflow, ${viewport}) ${RUN}`, "IN_PROGRESS");
      const operational = operationalRegion(page);
      const message = (text: string | RegExp) => operational.getByText(text);

      // --- a move that is held back, with the reason and the way to the region that opens it ---------------------------
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await page.goto(`/queue/${ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
      await expect(operational.getByRole("list", { name: "Not available now" })).toContainText(
        "Resolved — Record at least one action before resolving this ticket.",
      );
      await expect(operational.getByRole("button", { name: "Go to Actions Taken" })).toBeVisible();
      await expect(operational.getByLabel("Move to").locator("option")).toHaveText(["Choose a status", "Waiting for Requester", "Cancelled"]);
      await operational.scrollIntoViewIfNeeded();
      await capture(page, "ticket-workflow", "status-blocked", viewport, { element: operational });

      // --- focus goes where the person needs it, at every width (ui-spec §9) ---------------------------------------------
      // Go to Actions Taken: the region's heading. Create: the new card's heading. Edit: back to the card's Edit button.
      await operational.getByRole("button", { name: "Go to Actions Taken" }).click();
      await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toBeFocused();

      // --- the closing action opens the gate; a colleague then reopens the question before Apply is pressed -----------
      await recordActionOnScreen(page, { description: "Re-seated the projector's HDMI cable.", result: "The picture is steady." });
      const closingCard = actionsRegion(page).locator("li.tt-action").filter({ hasText: "Re-seated the projector's HDMI cable." });
      await expect(closingCard.getByRole("heading", { level: 3 })).toBeFocused();
      await closingCard.getByRole("button", { name: /^Edit action of/ }).click();
      await actionsRegion(page).getByRole("form", { name: "Edit action" }).getByLabel(/^Result/).fill("The picture is steady after ten minutes.");
      await actionsRegion(page).getByRole("form", { name: "Edit action" }).getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Changes saved.")).toBeVisible();
      await expect(closingCard.getByRole("button", { name: /^Edit action of/ })).toBeFocused();
      await expect(operational.getByLabel("Move to").locator("option")).toContainText(["Resolved"]);
      const colleague = await apiAs(ACCOUNTS.colleague.email);
      const [closing] = ((await (await colleague.get(`/api/tickets/${ticket.id}/actions-taken`)).json()) as { actions: { id: number; version: number }[] }).actions;
      expect(
        (await colleague.patch(`/api/staff/tickets/${ticket.id}/actions-taken/${closing.id}`, {
          data: { expectedVersion: closing.version, followUpRequired: true, followUpNote: "Watch the picture again after the lamp warms up." },
        })).status(),
      ).toBe(200);
      await operational.getByLabel("Move to").selectOption("RESOLVED");
      await operational.getByLabel(/^Reason/).fill("Re-seated the cable; the picture is steady.");
      await operational.getByRole("button", { name: "Apply" }).click();
      // The server refuses a move the screen offered, in its own words, and the screen says what is true now (BR-54).
      const gate = operational.getByRole("alert").filter({ hasText: "The most recently recorded action still needs follow-up." });
      await expect(gate).toBeVisible();
      await expect(gate.getByRole("button", { name: "Go to Actions Taken" })).toBeVisible();
      await expect(operational.getByRole("list", { name: "Not available now" })).toContainText("Resolved — The most recently recorded action still needs follow-up.");
      await expect(operational.getByLabel("Move to").locator("option")).not.toContainText(["Resolved"]);
      await operational.scrollIntoViewIfNeeded();
      await capture(page, "ticket-workflow", "gate-refusal", viewport, { element: operational });

      // --- a new action records the follow-up; the move then succeeds, and the summary and options follow ---------------
      await recordActionOnScreen(page, { description: "Watched the picture after the lamp had warmed up.", result: "No flicker after an hour." });
      await operational.getByLabel("Move to").selectOption("RESOLVED");
      await operational.getByLabel(/^Reason/).fill("Cable re-seated and the picture is steady after an hour.");
      await operational.getByRole("button", { name: "Apply" }).click();
      await expect(message("Status changed to Resolved.")).toBeVisible();
      await expect(operational.getByText("Current:")).toContainText("Resolved");
      await expect(operational.getByLabel("Move to").locator("option")).toHaveText(["Choose a status", "Closed", "Reopened"]);
      await operational.scrollIntoViewIfNeeded();
      await capture(page, "ticket-workflow", "success", viewport, { element: operational });

      // --- the Status History, in order, spelled out, starting with "Ticket created" ------------------------------------
      const history = historyRegion(page);
      await expect(history.locator("li.tt-timeline__step")).toHaveCount(4);
      await expect(history.locator("li.tt-timeline__step").first()).toContainText("Ticket created");
      await expect(history.locator("li.tt-timeline__step").last()).toContainText("Resolved");
      await expect(history.getByText("IN_PROGRESS")).toHaveCount(0); // spelled out, never the stored name
      await history.scrollIntoViewIfNeeded();
      await capture(page, "ticket-workflow", "status-history", viewport, { element: history });

      // --- a stale save: someone else changed the Ticket after this screen loaded ------------------------------------------
      await operational.getByLabel("IT Priority").selectOption("URGENT");
      const current = await staffTicket(colleague, ticket.id);
      expect(
        (await colleague.patch(`/api/staff/tickets/${ticket.id}/it-priority`, { data: { itPriority: "HIGH", expectedVersion: current.version } })).status(),
      ).toBe(200);
      await operational.getByRole("button", { name: "Update IT Priority" }).click();
      const stale = operational.getByRole("alert").filter({ hasText: "This ticket changed while you were working on it" });
      await expect(stale).toBeVisible();
      await expect(stale).toContainText("It is now Resolved");
      await expect(stale.getByRole("button", { name: "Show latest" })).toBeVisible();
      await operational.scrollIntoViewIfNeeded();
      await capture(page, "ticket-workflow", "stale-conflict", viewport, { element: operational });
      await colleague.dispose();
      await logOut(page);

      // --- an Administrator has the same controls, under their own name ------------------------------------------------------
      await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
      await page.goto(`/queue/${ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
      await expect(operational.getByLabel("Move to")).toBeVisible();
      await expect(operational.getByRole("button", { name: "Update IT Priority" })).toBeVisible();
      await expect(actionsRegion(page).getByRole("button", { name: "+ Add action" })).toBeDisabled(); // resolved: no more actions, for anyone
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, "ticket-workflow", "administrator-ticket-detail", viewport, { fullPage: false });
    });

    test(`RESP-06 the Owner label tells Inactive from No longer IT Staff (${viewport})`, async ({ page }) => {
      test.setTimeout(150_000);
      const admin = await apiAs(ACCOUNTS.admin.email);
      const requester = await apiAs(ACCOUNTS.requester.email);
      const tag = `${viewport}-${RUN}`;

      // Two IT Staff, each given a Ticket; then one is deactivated and the other is made a Requester (BR-55).
      const owners: Record<"deactivated" | "demoted", { id: number; ticket: { id: number; ticketNumber: string } }> = {} as never;
      for (const kind of ["deactivated", "demoted"] as const) {
        const email = `e2e.owner.${kind}.${tag}@example.test`.toLowerCase();
        const made = await admin.post("/api/admin/users", {
          data: { fullName: `E2E ${kind} staff ${tag}`, email, role: "IT_STAFF", isActive: true, initialPassword: "Initial#2026" },
        });
        expect(made.status(), `create ${email}`).toBe(201);
        trackCreatedUser(email);
        const user = ((await made.json()) as { user: { id: number } }).user;
        const ticket = await createTicketAs(requester, `E2E owner label ${kind} ${tag}`);
        const assigned = await admin.patch(`/api/staff/tickets/${ticket.id}/owner`, { data: { ownerId: user.id, expectedOwnerId: null } });
        expect(assigned.status(), `assign ${ticket.ticketNumber}`).toBe(200);
        owners[kind] = { id: user.id, ticket };
      }
      expect((await admin.patch(`/api/admin/users/${owners.deactivated.id}`, { data: { isActive: false } })).status()).toBe(200);
      expect((await admin.patch(`/api/admin/users/${owners.demoted.id}`, { data: { role: "REQUESTER" } })).status()).toBe(200);
      await admin.dispose();
      await requester.dispose();

      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await page.goto(`/queue?q=${encodeURIComponent(tag)}&sort=updatedAt&direction=desc`); // this run's two Tickets, and no others
      const rowOf = (ticket: { ticketNumber: string }) =>
        page.locator("table.tt-queue-table tbody tr, .tt-queue-card").filter({ hasText: ticket.ticketNumber }).filter({ visible: true }).first();
      // The two labels are different words, and neither is a colour (ui-spec §1.6).
      await expect(page.getByTestId("result-count")).toHaveText("Showing 2 of 2");
      await expect(rowOf(owners.deactivated.ticket)).toContainText(`E2E deactivated staff ${tag}`);
      await expect(rowOf(owners.deactivated.ticket).locator("[data-badge='owner-inactive']")).toHaveText("Inactive");
      await expect(rowOf(owners.demoted.ticket)).toContainText(`E2E demoted staff ${tag}`);
      await expect(rowOf(owners.demoted.ticket).locator("[data-badge='owner-not-staff']")).toHaveText("No longer IT Staff");
      await expect(rowOf(owners.demoted.ticket).locator("[data-badge='owner-inactive']")).toHaveCount(0);
      await capture(page, "ticket-workflow", "owner-labels", viewport);

      // The Ticket Detail says the same.
      await page.goto(`/queue/${owners.demoted.ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(owners.demoted.ticket.ticketNumber);
      await expect(operationalRegion(page).locator("[data-badge='owner-not-staff']")).toHaveText("No longer IT Staff");
      await page.goto(`/queue/${owners.deactivated.ticket.id}`);
      await expect(operationalRegion(page).locator("[data-badge='owner-inactive']")).toHaveText("Inactive");
      await expectSound(page, `an Inactive owner on the Ticket Detail at ${viewport}`);
    });

    test(`RESP-05 the Lab 2 and Lab 3 screens, after Lab 4 (${viewport})`, async ({ page }) => {
      test.setTimeout(240_000);
      const own = await apiAs(populated.email, populated.password);
      const ticket = await createTicketAs(own, `Library self-service kiosk shows a blank screen (regression, ${viewport}) ${RUN}`, "HIGH");
      await own.dispose();

      /** The Dashboard is every role's first navigation item (D-09): in the header from 768 px, in the menu below it. */
      const expectDashboardFirst = async () => {
        if (width <= MOBILE_MAX) {
          await page.getByRole("button", { name: "Menu" }).click();
          await expect(page.locator(".tt-shell__mobile-nav").getByRole("link").first()).toHaveText("Dashboard");
          await page.getByRole("button", { name: "Menu" }).click();
        } else {
          await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link").first()).toHaveText("Dashboard");
        }
      };

      // --- Lab 3: Login ---------------------------------------------------------------------------------------------
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await capture(page, "regression", "login", viewport);

      // --- Labs 2 and 3: the Requester's screens -----------------------------------------------------------------------
      await signIn(page, populated.email, populated.name, populated.password);
      await expectDashboardFirst();
      await page.goto("/tickets");
      await expect(page.getByLabel("Search tickets")).toBeVisible();
      // The Ticket Number is the button that opens the Ticket (Lab 2), in the table and on the card.
      await expect(page.getByRole("button", { name: ticket.ticketNumber }).filter({ visible: true }).first()).toBeVisible();
      if (width >= TABLET_MIN) {
        await expect(page.locator("table.tt-table")).toBeVisible();
        await expect(page.locator(".tt-cards")).toBeHidden();
        // A long Summary does not squeeze the Ticket Number onto two lines (found in Issue 10: "TT-2026-" / "00628").
        const rows = page.locator("table.tt-table tbody tr");
        for (const row of await rows.all()) {
          expect(await linesOf(row.locator("td").first().getByRole("button")), "a Ticket Number is on one line").toBe(1);
          expect(await linesOf(row.locator("td").last()), "a date is on one line").toBe(1);
        }
      } else {
        await expect(page.locator("table.tt-table")).toBeHidden();
        await expect(page.locator(".tt-cards")).toBeVisible();
      }
      await capture(page, "regression", "my-tickets", viewport);

      await page.goto("/tickets/new");
      await expect(page.getByLabel(/^Ticket Summary/)).toBeVisible();
      await capture(page, "regression", "create-ticket", viewport);

      await page.goto("/change-password");
      await expect(page.getByLabel(/^Current password/)).toBeVisible();
      await capture(page, "regression", "change-password", viewport);

      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
      await page.getByLabel("Choose a file to attach").setInputFiles({
        name: "kiosk-screen.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n"),
      });
      await expect(page.getByText("kiosk-screen.pdf")).toBeVisible();
      const thread = page.getByRole("region", { name: "Public Comments" });
      await thread.getByLabel(/Add a comment/).fill("The kiosk by the main entrance has shown a blank screen since this morning.");
      await thread.getByRole("button", { name: "Post comment" }).click();
      await expect(thread.getByText("The kiosk by the main entrance has shown a blank screen since this morning.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Problem Appears Resolved" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Internal Notes" })).toHaveCount(0); // the Requester has no sign of one (Lab 3 AC-17)
      // A badge is as wide as its words, not as wide as the row it sits in (on a phone the attachment row was a column that
      // stretched its ACTIVE badge across the whole card, found in Issue 10).
      const attachmentBadge = (await page.locator(".tt-attachment [data-badge]").first().boundingBox())!;
      expect(attachmentBadge.width, "the ACTIVE badge is the width of its word").toBeLessThan(120);
      await capture(page, "regression", "requester-ticket-detail", viewport);
      await logOut(page);

      // --- Lab 3: IT Staff -----------------------------------------------------------------------------------------------
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await expectDashboardFirst();
      await page.goto("/queue");
      await expect(page.getByRole("link", { name: /^TT-/ }).filter({ visible: true }).first()).toBeVisible();
      if (width >= DESKTOP_MIN) await expect(page.locator(".tt-queue-table th")).toHaveCount(7);
      else if (width >= TABLET_MIN) await expect(page.locator(".tt-queue-table .tt-queue__secondary").first()).toBeVisible();
      else await expect(page.locator(".tt-queue-card").first()).toBeVisible();
      await capture(page, "regression", "ticket-queue", viewport);

      await page.goto(`/queue/${ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
      await expect(page.getByText("kiosk-screen.pdf")).toBeVisible();
      const notes = page.getByRole("region", { name: /^Internal Notes/ });
      await notes.getByLabel(/Add an internal note/).fill("Checked the kiosk's logs: the display driver crashed overnight.");
      await notes.getByRole("button", { name: "Post internal note" }).click();
      await expect(notes.getByText("Checked the kiosk's logs: the display driver crashed overnight.")).toBeVisible();
      await capture(page, "regression", "staff-ticket-detail", viewport);
      await logOut(page);

      // --- Lab 3: the Administrator ---------------------------------------------------------------------------------------
      await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
      await expectDashboardFirst();
      await page.goto("/users");
      await expect(page.getByText(ACCOUNTS.staff.email).filter({ visible: true }).first()).toBeVisible();
      if (width >= TABLET_MIN) await expect(page.locator(".tt-table")).toBeVisible();
      else await expect(page.locator(".tt-users__card").first()).toBeVisible();
      // The list is not paginated, by design (Lab 3 FR-39), and this database holds every account the suites have made, so the
      // picture is of the seeded accounts, found by their address: the screen's own search, which is part of what it shows.
      await page.getByLabel("Search name or email").fill("toktickit.local");
      await expect(page.getByText(ACCOUNTS.colleague.email).filter({ visible: true }).first()).toBeVisible();
      const shown = width >= TABLET_MIN ? page.locator(".tt-table tbody tr") : page.locator(".tt-users__card");
      await expect.poll(() => shown.count(), { message: "only the seeded accounts are listed" }).toBeLessThan(20);
      await capture(page, "regression", "user-management", viewport);
    });
  });
}

// ---- RESP-06 at 320 px ----------------------------------------------------------------------------------------------------

test.describe("at 320×568, the narrowest width ui-spec §10 names", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("RESP-06 every Lab 4 screen has no sideways scroll, no clipping, no overlap, and a focus outline on every control (320 px)", async ({ page }) => {
    test.setTimeout(240_000);
    const rich = await buildRichTicket("320 px");
    const resolved = await buildTicket(`Wi-Fi drops in the library (resolved, 320 px) ${RUN}`, "RESOLVED");

    // --- the Requester's screens ---------------------------------------------------------------------------------------
    await signIn(page, populated.email, populated.name, populated.password);
    await expect(page.getByLabel("Your tickets at a glance")).toBeVisible();
    await expectSound(page, "Requester Dashboard");
    await page.getByRole("link", { name: /^Open Tickets: \d+\. View all$/ }).click();
    await expect(page.getByTestId("result-count")).toBeVisible();
    await expectSound(page, "My Tickets, from a card");
    await page.goto(`/tickets/${rich.id}`);
    await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (3)");
    await expect(historyRegion(page)).toContainText("Ticket created");
    await expectSound(page, "Requester Ticket Detail with Actions Taken and Status History");
    await logOut(page);
    await signIn(page, ACCOUNTS.noTickets.email, ACCOUNTS.noTickets.name);
    await page.goto("/dashboard"); // a sign-in that began at a Ticket returns to it, which this account may not open
    await expect(page.getByRole("region", { name: "Recently updated" })).toContainText("You have no tickets yet.");
    await expectSound(page, "Requester Dashboard, no Tickets");
    await logOut(page);

    // --- IT Staff ---------------------------------------------------------------------------------------------------------
    await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
    await page.goto("/dashboard");
    await expect(page.getByLabel("Your queue at a glance")).toBeVisible();
    await expectSound(page, "IT Staff Dashboard");
    await page.getByRole("link", { name: /^Unassigned: \d+\. View all$/ }).first().click();
    await expect(page.getByTestId("result-count")).toBeVisible();
    await expectSound(page, "Ticket Queue, from a card");

    await page.goto(`/queue/${rich.id}`);
    const region = actionsRegion(page);
    await expect(region.getByRole("heading", { level: 2 })).toHaveText("Actions Taken (3)");
    await expectSound(page, "IT Staff Ticket Detail with Actions Taken");
    await region.locator("li.tt-action").last().getByRole("button", { name: /^Edit action of/ }).click();
    await expect(region.getByRole("form", { name: "Edit action" })).toBeVisible();
    await expectSound(page, "an Action Taken being edited");
    await region.getByRole("button", { name: "Cancel" }).click();
    await page.goto(`/queue/${resolved.id}`);
    await expect(region.getByRole("button", { name: "+ Add action" })).toBeDisabled();
    await expectSound(page, "Actions Taken on a Resolved Ticket");

    const fresh = await buildTicket(`Projector in room 402 flickers (320 px) ${RUN}`, "IN_PROGRESS");
    await page.goto(`/queue/${fresh.id}`);
    await expect(operationalRegion(page).getByRole("list", { name: "Not available now" })).toBeVisible();
    await expectSound(page, "the status control with a held-back move");
    await region.getByRole("button", { name: "+ Add action" }).click();
    await region.getByRole("form", { name: "Record an action" }).getByRole("button", { name: "Save action" }).click();
    await expect(region.getByText("Action Description is required.")).toBeVisible();
    await expectSound(page, "the create form with its messages");
    await logOut(page);

    // --- the Administrator --------------------------------------------------------------------------------------------------
    await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Accounts" })).toBeVisible();
    await expectSound(page, "Administrator Dashboard");
  });
});

// ---- Tickets the Actions Taken screens read ---------------------------------------------------------------------------

/** A Ticket of the made Requester, brought to `status` by the Owner Nattapong. */
async function buildTicket(summary: string, status: "IN_PROGRESS" | "RESOLVED") {
  const own = await apiAs(populated.email, populated.password);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(own, staff, summary, status);
  await own.dispose();
  await staff.dispose();
  return ticket;
}

/**
 * An In Progress Ticket with three actions by two people. They are recorded in the order 1, 2, 3 but dated
 * 3, 2, 1, so the most recently *recorded* one (the one the gate reads) is the first card and not the last,
 * which is what the "Latest recorded" tag exists to show. The third was edited by the colleague.
 */
async function buildRichTicket(label: string) {
  const own = await apiAs(populated.email, populated.password);
  const owner = await apiAs(ACCOUNTS.staff.email);
  const colleague = await apiAs(ACCOUNTS.colleague.email);
  const ticket = await ticketAt(own, owner, `Printer on floor 3 prints blank pages (several actions, ${label}) ${RUN}`, "IN_PROGRESS");
  const now = (await actionTime(owner, ticket.id)).getTime();
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  await recordAction(owner, ticket.id, {
    actionAt: at(2),
    description: "Replaced the toner cartridge and ran a test page.",
    result: "The test page printed cleanly.",
    attachmentNotes: "Look for the photo of the toner label.",
  });
  await recordAction(colleague, ticket.id, {
    actionAt: at(1),
    description: "Checked the fuser unit with the vendor's remote tool.",
    result: "The unit is worn and needs replacing.",
    followUpRequired: true,
    followUpNote: "Replace the fuser unit when the part arrives on Thursday.",
  });
  const third = await recordAction(owner, ticket.id, {
    actionAt: at(0),
    description: "Moved the printer to the spare tray and printed again.",
    result: "Prints cleanly from tray 2.",
  });
  const edited = await colleague.patch(`/api/staff/tickets/${ticket.id}/actions-taken/${third.id}`, {
    data: { expectedVersion: third.version, result: "Prints cleanly from tray 2; tray 1 still jams." },
  });
  expect(edited.status(), "the colleague's edit").toBe(200);
  await own.dispose();
  await owner.dispose();
  await colleague.dispose();
  return ticket;
}

// ---- the header, at every width where it is the widest (RESP-05) -----------------------------------------------------------

test.describe("the header between 768 and 991 px", () => {
  test("RESP-05 every role's header keeps each label on one line, with Dashboard first, from 768 to 991 px", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(LAB4_VIEWPORTS.desktop);
    const roles = [
      { who: "Requester", email: populated.email, name: populated.name, password: populated.password, links: ["Dashboard", "My Tickets", "Create Ticket"] },
      { who: "IT Staff", email: ACCOUNTS.staff.email, name: ACCOUNTS.staff.name, password: undefined, links: ["Dashboard", "Ticket Queue"] },
      // The widest: three links, a long name, and the longest role badge.
      { who: "Administrator", email: ACCOUNTS.admin.email, name: ACCOUNTS.admin.name, password: undefined, links: ["Dashboard", "Ticket Queue", "User Management"] },
    ];
    for (const role of roles) {
      await signIn(page, role.email, role.name, role.password);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      for (const width of [768, 820, 900, 991]) {
        await page.setViewportSize({ width, height: 900 });
        const label = `${role.who} at ${width} px`;
        await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link"), label).toHaveText(role.links);
        // Every label, name, badge, and action is drawn on one line: none of them has a second box.
        const broken = await page.locator(".tt-shell__header").evaluate((header) =>
          [...header.querySelectorAll(".tt-shell__brand, .tt-shell__link, .tt-shell__user-name, .tt-shell__user .tt-badge, .tt-shell__action")]
            .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "none")
            .filter((el) => el.getClientRects().length > 1 || el.getBoundingClientRect().height > 48)
            .map((el) => `${el.textContent!.trim()} (${el.getClientRects().length} lines)`),
        );
        expect(broken, `${label}: a label breaks across lines`).toEqual([]);
        // The header is one row where it fits, and never more than two.
        const header = (await page.locator(".tt-shell__header").boundingBox())!;
        expect(header.height, `${label}: the header is at most two rows`).toBeLessThanOrEqual(120);
        await expectSound(page, label);
      }
      await page.setViewportSize(LAB4_VIEWPORTS.desktop);
      await logOut(page);
    }
  });
});

// ---- nothing is said by colour alone, and nothing is broken (RESP-06) -------------------------------------------------------

test.describe("at 1440×900, the words on every badge", () => {
  test.use({ viewport: LAB4_VIEWPORTS.desktop });

  test("RESP-06 status, priority, role, follow-up, and the Owner label are words as well as colours", async ({ page }) => {
    test.setTimeout(150_000);
    const rich = await buildRichTicket("colour removed");
    const wordsOnly = async (label: string) => {
      // Every badge, pill, and tag on the screen carries its meaning as text, so a person who cannot tell the colours apart loses nothing.
      const empty = await page.locator(".tt-badge, .tt-action__latest").evaluateAll((els) =>
        els.filter((el) => el.getClientRects().length > 0 && (el.textContent ?? "").trim() === "").map((el) => el.outerHTML.slice(0, 80)),
      );
      expect(empty, `${label}: badges with no words`).toEqual([]);
      const kinds = await page.locator("[data-badge]").evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-badge")))]);
      return kinds as string[];
    };

    await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
    await page.goto("/dashboard");
    await expect(page.getByLabel("Your queue at a glance")).toBeVisible();
    expect(await wordsOnly("IT Staff Dashboard")).toEqual(expect.arrayContaining(["status", "priority", "follow-up"]));
    await page.goto(`/queue/${rich.id}`);
    await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toHaveText("Actions Taken (3)");
    // Status, role, and follow-up, on the screen that shows all three.
    expect(await wordsOnly("IT Staff Ticket Detail")).toEqual(expect.arrayContaining(["status", "role", "follow-up"]));
    await expect(actionsRegion(page).locator("[data-badge='follow-up']", { hasText: /^Follow-up needed$/ })).toHaveCount(1);
    await expect(actionsRegion(page).locator("[data-badge='follow-up']", { hasText: /^No follow-up$/ })).toHaveCount(2);
    // The same screen with the colour taken out of it is still readable: a grey page, every badge with its words.
    await page.addStyleTag({ content: "html { filter: grayscale(1) !important; }" });
    await expect(page.getByRole("heading", { level: 2, name: /^Actions Taken/ })).toBeVisible();
    await wordsOnly("IT Staff Ticket Detail, greyscale");
  });
});

for (const viewport of VIEWPORT_NAMES) {
  test.describe(`the sweep of every screen at ${viewport}`, () => {
    test.use({ viewport: LAB4_VIEWPORTS[viewport] });

    test(`RESP-06 no console error, placeholder text, or broken link on any screen a person can reach (${viewport})`, async ({ page }) => {
      test.setTimeout(300_000);
      const rich = await buildRichTicket("sweep");
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        // The one line the browser writes by itself: the signed-out Login screen asks /api/auth/me who is signed in, and
        // the API's answer, 401, is logged as "Failed to load resource". That is the contract (Lab 3), not an error of the app.
        if (message.location().url.endsWith("/api/auth/me") && /401/.test(message.text())) return;
        problems.push(`console error on ${page.url()}: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`uncaught error on ${page.url()}: ${error.message}`));
      page.on("response", (response) => {
        // A signed-out visit to /api/auth/me is how the app asks whether anyone is signed in, and answers 401 by design.
        if (response.status() >= 400 && response.url().includes("/api/") && !response.url().endsWith("/api/auth/me")) {
          problems.push(`${response.status()} from ${response.url()} on ${page.url()}`);
        }
      });

      const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|coming soon|placeholder|\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date/i;
      const visited = new Set<string>();
      /** Waits for the screen's requests to finish. The Login screen, signed out, does not always report idle, so the wait is short. */
      const settle = () => page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);

      /** Opens a screen, waits for it to settle, and reads it for placeholder text; returns the internal links on it. */
      async function visit(path: string): Promise<string[]> {
        await page.goto(path);
        await settle();
        const text = await page.locator("body").innerText();
        const found = PLACEHOLDER.exec(text);
        if (found) problems.push(`placeholder text "${found[0]}" on ${path}`);
        visited.add(path);
        return page.locator("a[href^='/']").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!))]);
      }

      /**
       * Follows each distinct internal link once: it must land where it says, and not on the page the router sends an
       * unknown route to. Links that differ only by a Ticket's number are the same route, so only the first is followed.
       */
      const followed = new Set<string>();
      async function followLinks(from: string, links: string[]) {
        for (const href of links) {
          const route = href.replace(/\/\d+(?=\/|\?|$)/g, "/:id");
          if (visited.has(href) || followed.has(route)) continue;
          followed.add(route);
          await page.goto(href);
          await settle();
          const landed = new URL(page.url());
          if (`${landed.pathname}${landed.search}` !== href) problems.push(`the link ${href} on ${from} lands on ${landed.pathname}${landed.search}`);
          visited.add(href);
        }
      }

      // --- the Requester ---------------------------------------------------------------------------------------------------------
      await signIn(page, populated.email, populated.name, populated.password);
      for (const path of ["/dashboard", "/tickets", "/tickets/new", "/change-password", `/tickets/${rich.id}`]) {
        await followLinks(path, await visit(path));
      }
      await logOut(page);

      // --- IT Staff ---------------------------------------------------------------------------------------------------------------
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      for (const path of ["/dashboard", "/queue", `/queue/${rich.id}`]) await followLinks(path, await visit(path));
      await logOut(page);

      // --- the Administrator --------------------------------------------------------------------------------------------------------
      await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
      for (const path of ["/dashboard", "/users"]) await followLinks(path, await visit(path));
      await logOut(page);

      // --- the Login screen, signed out ----------------------------------------------------------------------------------------------
      await visit("/login");

      expect(visited.size, "the sweep looked at a real number of screens").toBeGreaterThan(15);
      expect(problems, `${problems.length} problem(s) found by the sweep: ${problems.join(" | ")}`).toEqual([]);
    });
  });
}

// ---- the audit, held to account ---------------------------------------------------------------------------------------------

test.describe("at 320×568, the audit itself", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("RESP-06 the layout audit finds what it claims to: content past the window, overlap, a missing outline, clipped text", async ({ page }) => {
    // Every RESP-06 result above is only as good as the audit behind it. This puts each defect it looks for into a screen that
    // is clean, one at a time, and asks whether it is found; the stylesheet's `html, body { overflow-x: hidden }` means the
    // page never scrolls sideways, so it is the per-element check, not a scroll width, that has to see content pushed out.
    await signIn(page, ACCOUNTS.noTickets.email, ACCOUNTS.noTickets.name);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await layoutProblems(page), "a clean screen has nothing to report").toEqual([]);

    const defects: [string, string, string][] = [
      ["content past the window", ".tt-dash__cards { width: 520px !important; }", "sticks out of the window"],
      ["two controls overlapping", ".tt-dash__cards .tt-metric:nth-child(2) { margin-top: -40px; position: relative; }", "overlap"],
      ["a control with no outline", "a:focus, a:focus-visible, button:focus-visible { outline: none !important; box-shadow: none !important; }", "takes focus with nothing to show it"],
      ["text hidden behind an edge", ".tt-dash__head { overflow: hidden; width: 80px; } .tt-dash__head .tt-h1 { white-space: nowrap; }", "hides content behind its edge"],
      // Inside the window, so the first finding cannot see it: a label drawn past the card it belongs to.
      ["content spilling out of its card", ".tt-metric { width: 150px !important; } .tt-metric__label { position: relative; left: 120px; white-space: nowrap; }", "spills out of its"],
    ];
    for (const [what, css, finding] of defects) {
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.addStyleTag({ content: css });
      await page.keyboard.press("Tab");
      const found = await layoutProblems(page);
      expect(found.some((problem) => problem.startsWith(finding)), `${what}: reported as "${finding}", got ${JSON.stringify(found.slice(0, 2))}`).toBe(true);
    }
  });
});
