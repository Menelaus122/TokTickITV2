import { APIRequestContext, Page, expect, request as playwrightRequest } from "@playwright/test";
import { API_URL } from "../../playwright.config.js";

// Shared helpers for the Lab 3 end-to-end and responsive suites
// (docs/lab-03/tests.md §2.12, §2.13).
//
// Like Lab 2's suites, these act only as people would: through the screens,
// or through the API signed in as a real account. They never reach into the
// database. So nothing they create can be deleted (BR-50 forbids deleting
// users; tickets have no delete either), and every run leaves a few rows
// behind on the development database; tests.md §5 documents the reset. To keep
// that harmless, no suite changes a seeded account's password or state: users
// it needs to change, it creates first, with an email unique to the run.

export const SEED_PASSWORD = "Toktickit#2026";

// The three viewports ui-spec §13 names for Lab 3, which differ from Lab 2's.
export const LAB3_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof LAB3_VIEWPORTS;
export const VIEWPORT_NAMES = Object.keys(LAB3_VIEWPORTS) as ViewportName[];

export const SHOTS = "artifacts/lab-03/screenshots";

/** Seeded accounts (specification.md §7.5). */
export const ACCOUNTS = {
  requester: { name: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th" },
  otherRequester: { name: "Kanya Srisai", email: "kanya.sris@kmutt.ac.th" },
  inactiveRequester: { name: "Wichai Boonmee", email: "wichai.boon@kmutt.ac.th" },
  staff: { name: "Nattapong Saelim", email: "nattapong.it@toktickit.local" },
  colleague: { name: "Siriporn Kaewmanee", email: "siriporn.it@toktickit.local" },
  admin: { name: "Malee Sutthiwong", email: "malee.admin@toktickit.local" },
} as const;

/** A suffix unique to this run, for emails and summaries the suites create. */
export const RUN = Date.now().toString(36);

/** Fills the real Login screen and submits it. */
export async function fillLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in through the Login screen and waits for the shell to show who is signed in. */
export async function signIn(page: Page, email: string, name: string, password = SEED_PASSWORD) {
  await fillLogin(page, email, password);
  await expect(page.getByTestId("current-user")).toHaveText(name);
}

/** Logs out through the shell; below 768px the action lives in the menu. */
export async function logOut(page: Page) {
  const headerLogout = page.getByRole("banner").getByRole("button", { name: "Logout" });
  if (!(await headerLogout.isVisible())) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Logout" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

/** A bare API context signed in as `email`; its later calls act as that person. */
export async function apiAs(email: string, password = SEED_PASSWORD): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({ baseURL: API_URL });
  const res = await context.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `sign in as ${email}`).toBe(201);
  return context;
}

/** A Requester's new ticket, created through the API exactly as the Create Ticket form does. */
export async function createTicketAs(requester: APIRequestContext, summary: string, requestedPriority = "MEDIUM") {
  const categories = (await (await requester.get("/api/categories")).json()) as Array<{ id: number }>;
  const systems = (await (await requester.get("/api/related-systems")).json()) as Array<{ id: number }>;
  const res = await requester.post("/api/tickets", {
    data: {
      categoryId: categories[0].id,
      relatedSystemId: systems[0].id,
      requestedPriority,
      summary,
      description: `Created by the Lab 3 end-to-end suite: ${summary}. Long enough to pass validation.`,
    },
  });
  expect(res.status(), "create ticket").toBe(201);
  return (await res.json()) as { id: number; ticketNumber: string };
}

// Every account a suite creates, by email, so afterAll can deactivate it.
const createdEmails = new Set<string>();

/** Records an account this run created; deactivateCreatedUsers() retires it. */
export function trackCreatedUser(email: string) {
  createdEmails.add(email.toLowerCase());
}

/**
 * Deactivates, through the Administrator's API, every account this run
 * created. Deactivation is the only removal the application allows (BR-50),
 * and an inactive account can never be picked by the API suites, which choose
 * their fixtures among active accounts and sign in with the seeded password.
 * Run from each spec's afterAll, so it happens even when a test failed.
 */
export async function deactivateCreatedUsers() {
  if (createdEmails.size === 0) return;
  const admin = await apiAs(ACCOUNTS.admin.email);
  for (const email of createdEmails) {
    const found = (await (await admin.get("/api/admin/users", { params: { q: email } })).json()) as {
      users: { id: number; email: string; isActive: boolean }[];
    };
    for (const user of found.users.filter((u) => u.email === email && u.isActive)) {
      const res = await admin.patch(`/api/admin/users/${user.id}`, { data: { isActive: false } });
      expect(res.status(), `deactivate ${email}`).toBe(200);
    }
  }
  createdEmails.clear();
  await admin.dispose();
}

/** True when the page can be scrolled sideways, which it never should be. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // One pixel of slack for sub-pixel rounding.
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

/**
 * Saves a screenshot under artifacts/lab-03/screenshots/<folder>/<name>-<viewport>.png.
 * Full page by default; a fixed panel or dialog is shot at the viewport, because
 * a full-page capture stretches the page past the fixed layer and shows the
 * list behind it, which no user ever sees.
 */
export async function shoot(page: Page, folder: string, name: string, viewport: ViewportName, options: { fullPage?: boolean } = {}) {
  await page.screenshot({ path: `${SHOTS}/${folder}/${name}-${viewport}.png`, fullPage: options.fullPage ?? true });
}
