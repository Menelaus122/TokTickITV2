import { test, expect, Locator, Page } from "@playwright/test";
import {
  ACCOUNTS,
  LAB4_VIEWPORTS,
  RUN,
  actionsRegion,
  apiAs,
  deactivateCreatedUsers,
  logOut,
  makeRequester,
  recordAction,
  actionTime,
  signIn,
  ticketAt,
  tokenColor,
} from "./helpers.js";

// STYLE-07 — the Zen Green tokens, as the browser draws them (docs/lab-04/tests.md §2.9; ui-spec §1, §4;
// AC-27, AC-29, AC-30; FR-26, FR-31). It is the real-browser counterpart of STYLE-01 to STYLE-06, which read the
// stylesheet and the DOM in jsdom. Here nothing is read from the stylesheet: the colour or size a control is
// drawn with is compared with the token's own value, so a rule that never applies, or applies to the wrong
// element, fails. STYLE-07 is not in the plan approved in PR #78; tests.md §3.1 says why it was added.

test.afterAll(deactivateCreatedUsers);
test.use({ viewport: LAB4_VIEWPORTS.desktop });

/** Computed style properties of an element, by their CSS names. */
async function drawn(locator: Locator, ...properties: string[]): Promise<Record<string, string>> {
  return locator.first().evaluate((element, names) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
  }, properties);
}

/**
 * A non-colour token, as the stylesheet defines it ("12px"): read from `scope`, because a token can be defined on
 * the element that uses it (the metric card names its two sizes on itself, ui-spec §1.1) and not on the root.
 */
const token = (page: Page, name: string, scope?: Locator) =>
  scope
    ? scope.first().evaluate((element, property) => getComputedStyle(element).getPropertyValue(property).trim(), name)
    : page.evaluate((property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(), name);

/** What a badge of each tone is drawn with (ui-spec §1.3 and Lab 2's badges): [background, text, border]. */
const TONES: Record<string, [string, string, string]> = {
  neutral: ["--tt-disabled-bg", "--tt-text-muted", "--tt-border"],
  green: ["--tt-green-pale", "--tt-green-primary", "--tt-green-pale"],
  amber: ["--tt-warning-bg", "--tt-warning", "--tt-warning-bg"],
  red: ["--tt-error-bg", "--tt-error", "--tt-error"],
  outline: ["--tt-surface", "--tt-green-secondary", "--tt-green-secondary"],
  success: ["--tt-success-bg", "--tt-success", "--tt-success-bg"],
};

/** The tone each status is drawn in (Lab 2's `STATUS_TONE`), keyed by the words on the badge. */
const STATUS_TONE: Record<string, string> = {
  New: "green",
  "In Progress": "outline",
  "Waiting for Requester": "amber",
  Resolved: "success",
  Closed: "success",
  Reopened: "red",
  Cancelled: "neutral",
};

async function expectTone(page: Page, badge: Locator, tone: string, label: string) {
  const [background, text, border] = TONES[tone];
  const style = await drawn(badge, "background-color", "color", "border-top-color");
  expect(style["background-color"], `${label}: background`).toBe(await tokenColor(page, background));
  expect(style.color, `${label}: text`).toBe(await tokenColor(page, text));
  expect(style["border-top-color"], `${label}: border`).toBe(await tokenColor(page, border));
}

test("STYLE-07 the metric card, the status badges, and the type scale are drawn with the Lab 2 and Lab 3 tokens", async ({ page }) => {
  test.setTimeout(150_000);
  const account = await makeRequester("Style");
  const own = await apiAs(account.email, account.password);
  const staff = await apiAs(ACCOUNTS.staff.email);
  for (const status of ["NEW", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const) {
    await ticketAt(own, staff, `E2E style ${status} ${RUN}`, status);
  }
  await own.dispose();
  await staff.dispose();

  await signIn(page, account.email, account.name, account.password);
  await expect(page.getByLabel("Your tickets at a glance")).toBeVisible();

  // --- the metric card (ui-spec §1.1): the card's own surface, and the two sizes it names -----------------------------
  const card = page.locator(".tt-metric--link").first();
  const frame = await drawn(card, "background-color", "border-top-color", "border-top-width", "border-top-style", "border-top-left-radius");
  expect(frame["background-color"], "a card is on the surface").toBe(await tokenColor(page, "--tt-surface"));
  expect(frame["border-top-color"], "with the border token").toBe(await tokenColor(page, "--tt-border"));
  expect([frame["border-top-width"], frame["border-top-style"]]).toEqual(["1px", "solid"]);
  expect(frame["border-top-left-radius"], "and the radius token").toBe(await token(page, "--tt-radius"));

  const label = await drawn(card.locator(".tt-metric__label"), "font-size", "text-transform", "color");
  expect(label["font-size"], "12 px label").toBe(await token(page, "--tt-font-caption", card));
  expect(label["font-size"]).toBe("12px");
  expect(label["text-transform"]).toBe("uppercase");
  expect(label.color, "muted label").toBe(await tokenColor(page, "--tt-text-muted"));

  const value = await drawn(card.locator(".tt-metric__value"), "font-size", "color");
  expect(value["font-size"], "32 px value").toBe(await token(page, "--tt-font-metric", card));
  expect(value["font-size"]).toBe("32px");
  expect(value.color, "in the primary green").toBe(await tokenColor(page, "--tt-green-primary"));

  const link = await drawn(card.locator(".tt-metric__link"), "font-size", "color");
  expect(link["font-size"]).toBe(await token(page, "--tt-font-label"));
  expect(link.color).toBe(await tokenColor(page, "--tt-green-primary"));
  // The card never says anything by colour alone: the label, the number, and "View all" are text.
  await expect(card).toHaveText(/^\s*Open Tickets\s*\d+\s*View all\s*→\s*$/);

  // --- the type scale: only the tokens' sizes (FR-26) -----------------------------------------------------------------
  expect((await drawn(page.getByRole("heading", { level: 1 }), "font-size"))["font-size"]).toBe(await token(page, "--tt-font-h1"));
  expect((await drawn(page.getByRole("region", { name: "Recently updated" }).getByRole("heading", { level: 2 }), "font-size"))["font-size"]).toBe(await token(page, "--tt-font-h2"));
  expect((await drawn(page.locator("body"), "font-size"))["font-size"]).toBe(await token(page, "--tt-font-body"));

  // --- the status badges, one tone each, with the status written out in words (FR-31) ---------------------------------
  const rows = page.getByRole("region", { name: "Recently updated" }).locator("a.tt-dash-row");
  for (const status of ["Cancelled", "Closed", "Resolved", "Reopened", "Waiting for Requester"]) {
    await expectTone(page, rows.locator("[data-badge='status']", { hasText: new RegExp(`^${status}$`) }).first(), STATUS_TONE[status], `${status} badge`);
  }
  await page.goto("/tickets");
  await expect(page.getByTestId("result-count")).toBeVisible();
  for (const status of ["New", "In Progress"]) {
    await expectTone(page, page.locator("table.tt-table [data-badge='status']", { hasText: new RegExp(`^${status}$`) }).first(), STATUS_TONE[status], `${status} badge`);
  }
  // Two statuses that share a tone are still told apart by their words.
  await expect(page.locator("table.tt-table [data-badge='status']", { hasText: /^Closed$/ }).first()).toBeVisible();
  await expect(page.locator("table.tt-table [data-badge='status']", { hasText: /^Resolved$/ }).first()).toBeVisible();
  await logOut(page);
});

test("STYLE-07 the Action Taken form and card: the red asterisk, the message beneath its field, read-only against disabled, and a busy button", async ({ page }) => {
  test.setTimeout(150_000);
  const account = await makeRequester("Style form");
  const own = await apiAs(account.email, account.password);
  const owner = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(own, owner, `E2E style actions ${RUN}`, "IN_PROGRESS");
  const when = (await actionTime(owner, ticket.id)).toISOString();
  await recordAction(owner, ticket.id, { description: "Restarted the print spooler.", result: "The queue drained.", actionAt: when });
  await recordAction(owner, ticket.id, {
    description: "Asked the vendor about the fuser unit.",
    result: "Waiting for an answer.",
    followUpRequired: true,
    followUpNote: "Chase the vendor on Monday.",
    actionAt: when,
  });
  await own.dispose();
  await owner.dispose();

  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await page.goto(`/queue/${ticket.id}`);
  const region = actionsRegion(page);
  await expect(region.getByRole("heading", { level: 2 })).toHaveText("Actions Taken (2)");

  // --- the card: the surface and the border; the follow-up pill, in words and in tone (ui-spec §1.2, §1.3) -----------
  const entry = await drawn(region.locator("li.tt-action").first(), "background-color", "border-top-color", "border-top-width");
  expect(entry["background-color"]).toBe(await tokenColor(page, "--tt-surface"));
  expect(entry["border-top-color"]).toBe(await tokenColor(page, "--tt-border"));
  expect(entry["border-top-width"]).toBe("1px");
  const yes = region.locator("[data-badge='follow-up']", { hasText: "Follow-up needed" });
  const no = region.locator("[data-badge='follow-up']", { hasText: "No follow-up" });
  await expectTone(page, yes, "amber", "Follow-up needed pill");
  await expectTone(page, no, "neutral", "No follow-up pill");
  // Exactly one card says "Latest recorded", in words (BR-17).
  await expect(region.getByText("Latest recorded")).toHaveCount(1);

  // --- the form: a red asterisk on each required field, and on no other ---------------------------------------------------
  await region.getByRole("button", { name: "+ Add action" }).click();
  const form = region.getByRole("form", { name: "Record an action" });
  const error = await tokenColor(page, "--tt-error");
  const asterisks = form.locator(".tt-field__required");
  await expect(asterisks).toHaveCount(4); // Action Date/Time, Action Description, Result, and the Follow-Up Required? legend
  for (const star of await asterisks.all()) {
    expect((await drawn(star, "color"))["color"], "the asterisk is the error red").toBe(error);
    await expect(star).toHaveText("*");
    await expect(star).toHaveAttribute("aria-hidden", "true"); // the control's own `required` says it to a screen reader
  }
  await expect(form.locator("label", { hasText: "Attachment Notes" }).locator(".tt-field__required")).toHaveCount(0); // optional: no asterisk
  await expect(form.locator("label", { hasText: "Follow-up Note" })).toHaveCount(0);
  await form.getByRole("radio", { name: "Yes" }).check();
  await expect(asterisks).toHaveCount(5); // the note's arrives with the note, as `required` does
  await expect(form.locator("label", { hasText: "Follow-up Note" }).locator(".tt-field__required")).toHaveText("*");
  await form.getByRole("radio", { name: "No" }).check();

  // --- a message beneath its own field, in the error red; the field's border goes red with it -------------------------------
  await form.getByRole("button", { name: "Save action" }).click();
  const description = form.getByLabel(/^Action Description/);
  const message = form.locator(".tt-field__message", { hasText: "Action Description is required." });
  await expect(message).toBeVisible();
  expect((await drawn(message, "color"))["color"]).toBe(error);
  expect((await drawn(description, "border-top-color"))["border-top-color"], "an invalid control is outlined in red").toBe(error);
  expect(await description.getAttribute("aria-describedby"), "and the message is tied to it").toBe(await message.getAttribute("id"));
  // Both boxes are read in one go: focus has just moved to the field, and the page may still be scrolling to it.
  const gap = await page.evaluate(
    ([fieldId, messageId]) => {
      const field = document.getElementById(fieldId!)!.getBoundingClientRect();
      const note = document.getElementById(messageId!)!.getBoundingClientRect();
      return { below: note.top - field.bottom, offset: Math.abs(note.left - field.left) };
    },
    [await description.getAttribute("id"), await message.getAttribute("id")],
  );
  expect(gap.below, "directly beneath its field").toBeGreaterThanOrEqual(-1);
  expect(gap.below, "and close to it").toBeLessThan(16);
  expect(gap.offset, "starting where the field starts").toBeLessThan(4);

  // --- read-only is not disabled (ui-spec §1.2, STYLE-04) ---------------------------------------------------------------------
  const performedBy = form.getByLabel("Performed by");
  const readonly = await drawn(performedBy, "background-color", "color");
  expect(readonly["background-color"], "a read-only field uses the read-only token").toBe(await tokenColor(page, "--tt-readonly-bg"));
  expect(readonly.color, "and stays readable").toBe(await tokenColor(page, "--tt-text"));
  await performedBy.focus();
  await expect(performedBy, "a read-only field can be focused").toBeFocused();
  const add = region.getByRole("button", { name: "+ Add action" });
  await expect(add).toBeDisabled(); // one form at a time (BR-53)
  const disabled = await drawn(add, "background-color", "color", "cursor");
  expect(disabled["background-color"], "a disabled button uses the disabled tokens").toBe(await tokenColor(page, "--tt-disabled-bg"));
  expect(disabled.color).toBe(await tokenColor(page, "--tt-disabled-text"));
  expect(disabled.cursor, "and the cursor that says no").toBe("not-allowed");
  expect(readonly["background-color"], "the two are told apart").not.toBe(disabled["background-color"]);

  // --- a busy button: disabled, labelled, with a spinner a screen reader skips, and the progress cursor (STYLE-05) ----------
  await description.fill("Restarted the print spooler a second time.");
  await form.getByLabel(/^Result/).fill("The queue drained again.");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/staff/tickets/*/actions-taken", async (route) => {
    await gate;
    await route.continue();
  });
  const save = form.getByRole("button", { name: "Save action" });
  await save.click();
  const busy = form.getByRole("button", { name: "Saving…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(busy.locator(".tt-spinner")).toHaveAttribute("aria-hidden", "true");
  expect((await drawn(busy, "cursor"))["cursor"], "the wait does not read as a refusal").toBe("progress");
  await expect(form.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(description).toBeDisabled(); // nothing can be changed under the request
  release();
  await expect(page.getByText("Action recorded.")).toBeVisible();
  await page.unroute("**/api/staff/tickets/*/actions-taken");
  await logOut(page);
});
