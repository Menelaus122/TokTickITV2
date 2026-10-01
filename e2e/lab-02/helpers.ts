import { Page, expect } from "@playwright/test";

// Shared helpers for the Lab 2 end-to-end suites.

// Lab 3, Issue 5: the application is entered by signing in, so "selecting a
// Requester" now means signing in as one of the seeded Requester accounts. The
// helpers keep their Lab 2 names so the Lab 2 specs read as they did.

export const SEED_PASSWORD = "Toktickit#2026";

const REQUESTER_EMAILS: Record<string, string> = {
  "Anucha Wongsawat": "anucha.wong@kmutt.ac.th",
  "Kanya Srisai": "kanya.sris@kmutt.ac.th",
  "Pornchai Thana": "pornchai.than@kmutt.ac.th",
  "Suchada Meesuk": "suchada.mees@kmutt.ac.th",
};

/** Signs in as a seeded Requester through the real Login screen (FR-01). */
export async function selectRequester(page: Page, name: string) {
  await page.goto("/login");
  await signInOnScreen(page, name);
}

async function signInOnScreen(page: Page, name: string) {
  const email = REQUESTER_EMAILS[name];
  if (!email) throw new Error(`No seeded Requester account named "${name}"`);

  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByTestId("current-user")).toHaveText(name);
}

/** Logs out through the shell, then signs in as a different Requester. */
export async function switchRequester(page: Page, name: string) {
  // Below 768px the Logout action lives in the menu.
  const headerLogout = page.getByRole("banner").getByRole("button", { name: "Logout" });
  if (!(await headerLogout.isVisible())) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Logout" }).filter({ visible: true }).first().click();

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await signInOnScreen(page, name);
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

  // Creation lands on the success state, which is where the official number
  // is confirmed; View ticket is the next action from there.
  const confirmed = page.getByTestId("created-ticket-number");
  await expect(confirmed).toBeVisible();
  const number = (await confirmed.innerText()).trim();

  await page.getByRole("button", { name: "View ticket" }).click();
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(number);

  return { number, summary };
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
