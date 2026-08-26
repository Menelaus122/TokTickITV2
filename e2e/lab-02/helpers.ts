import { Page, expect } from "@playwright/test";

// Shared helpers for the Lab 2 end-to-end suites.

export const STORAGE_KEY = "toktickit.devRequesterId";

/**
 * Chooses a Development Requester through the real selection screen, which is
 * how a person enters the application (FR-01, FR-02).
 */
export async function selectRequester(page: Page, name: string) {
  await page.goto("/select-requester");
  await chooseFromSelector(page, name);
}

/**
 * Picks a Requester from the selector that is already on screen.
 *
 * Options read "Name — Department", so the value is looked up by text rather
 * than matching a label the seed could change.
 */
export async function chooseFromSelector(page: Page, name: string) {
  const dropdown = page.getByLabel(/Development Requester/);
  await expect(dropdown).toBeVisible();

  const value = await dropdown
    .locator("option", { hasText: name })
    .first()
    .getAttribute("value");
  if (!value) throw new Error(`No Development Requester option matching "${name}"`);

  await dropdown.selectOption(value);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByTestId("current-requester")).toHaveText(name);
}

/** Uses Change Requester in the shell, then picks a different identity. */
export async function switchRequester(page: Page, name: string) {
  await page.getByRole("button", { name: "Change Requester" }).click();
  await chooseFromSelector(page, name);
}

/** Switches identity without going through Change Requester in the UI. */
export async function setStoredRequester(page: Page, requesterId: number) {
  await page.addInitScript(
    ([key, id]) => window.localStorage.setItem(key as string, String(id)),
    [STORAGE_KEY, requesterId] as const,
  );
}

export interface CreatedTicket {
  number: string;
  summary: string;
}

/**
 * Fills and submits the Create Ticket form, returning the official number the
 * backend generated.
 */
export async function createTicket(
  page: Page,
  summary: string,
  options: { category?: number; system?: number; priority?: string } = {},
): Promise<CreatedTicket> {
  // Navigated by URL rather than by clicking the nav link: below 768px that
  // link lives behind the mobile menu, and this helper runs at every viewport.
  await page.goto("/tickets/new");
  await expect(page.getByLabel(/^Ticket Summary/)).toBeVisible();

  // Reference data comes from the database, so the options are whatever the
  // seed holds — pick by index rather than by hard-coded name.
  await page.getByLabel(/^Category/).selectOption({ index: options.category ?? 1 });
  await page.getByLabel(/^Related System/).selectOption({ index: options.system ?? 1 });
  await page.getByLabel(/^Requested Priority/).selectOption(options.priority ?? "MEDIUM");
  await page.getByLabel(/^Ticket Summary/).fill(summary);
  await page
    .getByLabel(/^Description/)
    .fill(`Created by the Lab 2 end-to-end suite: ${summary}. This text is long enough to pass validation.`);

  await page.getByRole("button", { name: "Submit Ticket" }).click();

  // Landing on the detail screen means creation succeeded and the app routed
  // to the new ticket.
  const number = page.getByTestId("detail-ticket-number");
  await expect(number).toBeVisible();

  return { number: (await number.innerText()).trim(), summary };
}

/** Returns the ticket id from the current /tickets/:id URL. */
export function ticketIdFromUrl(page: Page): number {
  const match = /\/tickets\/(\d+)/.exec(page.url());
  if (!match) throw new Error(`Not on a ticket detail URL: ${page.url()}`);
  return Number(match[1]);
}

/** True when the page can be scrolled sideways, which it never should be. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // One pixel of slack for sub-pixel rounding.
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}
