import { test, expect, Page } from "@playwright/test";
import {
  ACCOUNTS,
  LAB3_VIEWPORTS,
  RUN,
  VIEWPORT_NAMES,
  apiAs,
  createTicketAs,
  deactivateCreatedUsers,
  fillLogin,
  hasHorizontalOverflow,
  logOut,
  shoot,
  signIn,
  trackCreatedUser,
  type ViewportName,
} from "./helpers.js";

// RESP-01 to RESP-06 (docs/lab-03/tests.md §2.12) at the three Lab 3 widths,
// plus the screenshot set ui-spec §13 lists, saved under
// artifacts/lab-03/screenshots/<folder>/<shot>-<viewport>.png. The visual
// checklist in tests.md §4 is completed against these files.

const MOBILE_MAX = 767;

test.afterAll(deactivateCreatedUsers);

/** Every new screen must fit, and keyboard focus must show (RESP-06). */
async function fitsAndShowsFocus(page: Page, label: string) {
  expect(await hasHorizontalOverflow(page), `${label}: horizontal overflow`).toBe(false);
  // The first few Tab stops each carry a visible focus indicator.
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  let checked = 0;
  for (let stop = 0; stop < 4; stop++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outlined = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      return { tag: el.tagName, text: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30), visible: outlined || style.boxShadow !== "none" };
    });
    if (focus) {
      expect(focus.visible, `${label}: focus ring on ${focus.tag} "${focus.text}"`).toBe(true);
      checked++;
    }
  }
  expect(checked, `${label}: Tab reached focusable elements`).toBeGreaterThan(0);
}

/** The bounding boxes of two locators, for layout assertions. */
async function boxes(page: Page, a: string, b: string) {
  const first = await page.locator(a).first().boundingBox();
  const second = await page.locator(b).first().boundingBox();
  expect(first && second, `${a} and ${b} are laid out`).toBeTruthy();
  return [first!, second!] as const;
}

for (const viewport of VIEWPORT_NAMES) {
  test.describe(`at ${viewport} ${LAB3_VIEWPORTS[viewport].width}×${LAB3_VIEWPORTS[viewport].height}`, () => {
    test.use({ viewport: LAB3_VIEWPORTS[viewport] });

    test(`RESP-01, RESP-02 authentication screens and the shell (${viewport})`, async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await fitsAndShowsFocus(page, "login");
      await shoot(page, "authentication", "login-empty", viewport);

      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Enter your email address.")).toBeVisible();
      await shoot(page, "authentication", "login-validation", viewport);

      await fillLogin(page, `e2e.nobody.${RUN}@example.test`, "Wrong-password#1");
      await expect(page.getByRole("alert")).toBeVisible();
      await shoot(page, "authentication", "login-invalid-credentials", viewport);

      await fillLogin(page, ACCOUNTS.inactiveRequester.email, "Toktickit#2026");
      await expect(page.getByRole("alert")).toHaveText(/not active/);
      await shoot(page, "authentication", "login-inactive-account", viewport);

      // A fresh account with an initial password, so the mandatory screen is real.
      const admin = await apiAs(ACCOUNTS.admin.email);
      const email = `e2e.resp.${viewport}.${RUN}@example.test`;
      expect(
        (await admin.post("/api/admin/users", { data: { fullName: `E2E Resp ${viewport} ${RUN}`, email, role: "REQUESTER", isActive: true, initialPassword: "Initial#2026" } })).status(),
      ).toBe(201);
      trackCreatedUser(email);
      await admin.dispose();
      await fillLogin(page, email, "Initial#2026");
      await expect(page).toHaveURL(/\/change-password$/);
      await fitsAndShowsFocus(page, "change password (mandatory)");
      await shoot(page, "authentication", "change-password-mandatory", viewport);
      await page.getByRole("button", { name: "Logout" }).click();

      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      if (LAB3_VIEWPORTS[viewport].width <= MOBILE_MAX) {
        // RESP-02: below 768px the menu holds navigation, the user, Change Password, and Logout.
        await expect(page.getByRole("banner").getByRole("button", { name: "Logout" })).toBeHidden();
        await page.getByRole("button", { name: "Menu" }).click();
        const menu = page.locator(".tt-shell__mobile-nav");
        await expect(menu.getByRole("link", { name: "Ticket Queue" })).toBeVisible();
        await expect(menu.getByText(ACCOUNTS.staff.name)).toBeVisible();
        await expect(menu.getByText("IT Staff", { exact: true })).toBeVisible();
        await expect(menu.getByRole("link", { name: "Change Password" })).toBeVisible();
        await expect(menu.getByRole("button", { name: "Logout" })).toBeVisible();
      } else {
        await expect(page.getByRole("banner").getByText("IT Staff", { exact: true })).toBeVisible();
      }
      await shoot(page, "authentication", "shell-signed-in", viewport);

      await page.goto("/change-password");
      await expect(page.getByLabel(/^Current password/)).toBeVisible();
      await fitsAndShowsFocus(page, "change password (voluntary)");
      await shoot(page, "authentication", "change-password", viewport);

      await logOut(page);
      await shoot(page, "authentication", "after-logout", viewport);
    });

    test(`RESP-03 the queue (${viewport})`, async ({ page }) => {
      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      // Changed in Lab 4 (Issue 8, D-09): signing in lands on the Dashboard, so open the queue.
      await page.goto("/queue");
      await expect(page.getByRole("link", { name: /^TT-/ }).filter({ visible: true }).first()).toBeVisible();
      await fitsAndShowsFocus(page, "queue");

      const width = LAB3_VIEWPORTS[viewport].width;
      const table = page.locator(".tt-queue-table");
      if (width >= 992) {
        await expect(table).toBeVisible();
        await expect(table.locator("th")).toHaveCount(7);
      } else if (width >= 768) {
        // Requested Priority and Last Updated fold beneath the summary.
        await expect(table).toBeVisible();
        await expect(table.locator(".tt-queue__secondary").first()).toBeVisible();
      } else {
        await expect(table).toBeHidden();
        await expect(page.locator(".tt-queue-card").first()).toBeVisible();
        await expect(page.getByLabel("Status")).toBeHidden();
      }
      // A Ticket Number never breaks across lines (found at 820px in Issue 11).
      const number = (await page.locator(".tt-queue__number").filter({ visible: true }).first().boundingBox())!;
      expect(number.height, "ticket number on one line").toBeLessThan(30);
      await shoot(page, "staff-queue", width < 768 ? "mobile-card-list" : "populated", viewport);

      if (width < 768) await page.getByRole("button", { name: "Filters" }).click();

      // Every status badge stays inside its own cell; "Waiting for Requester",
      // the longest, overlapped the owner column at 820px (found in Issue 12).
      if (width >= 768) {
        await page.getByLabel("Status").selectOption("WAITING_FOR_REQUESTER");
        await expect(table.locator("tbody tr").first()).toContainText("Waiting for Requester");
        const spills = await table.locator("td.tt-queue__col-5").evaluateAll((cells) =>
          cells.filter((td) => {
            const badge = td.querySelector(".tt-badge");
            return badge && badge.getBoundingClientRect().right > td.getBoundingClientRect().right + 0.5;
          }).length);
        expect(spills, "status badges spilling out of their cell").toBe(0);
        await page.getByLabel("Status").selectOption("");
      }

      await page.getByLabel("Search number or summary").fill("printer");
      await expect(page.getByRole("link", { name: /^TT-/ }).filter({ visible: true }).first()).toBeVisible();
      await shoot(page, "staff-queue", "search", viewport);

      await page.getByLabel("Search number or summary").fill("");
      await page.getByLabel("Status").selectOption("NEW");
      await page.getByLabel("Owner").selectOption("unassigned");
      await expect(page.getByRole("button", { name: "Clear Filters" })).toBeVisible();
      await shoot(page, "staff-queue", "filters-applied", viewport);
      expect(await hasHorizontalOverflow(page), "queue with filters open").toBe(false);

      await page.getByLabel("Search number or summary").fill(`no-such-ticket-${RUN}`);
      await expect(page.getByText("No tickets match your filters")).toBeVisible();
      await shoot(page, "staff-queue", "no-results", viewport);
      await logOut(page);

      // A Requester typing the address is refused.
      await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
      await page.goto("/queue");
      await expect(page.getByText("You do not have access to that page.")).toBeVisible();
      await shoot(page, "staff-queue", "forbidden", viewport);
    });

    test(`RESP-04 the staff ticket detail (${viewport})`, async ({ page }) => {
      const requester = await apiAs(ACCOUNTS.requester.email);
      const ticket = await createTicketAs(requester, `E2E responsive detail ${viewport} ${RUN}`);
      await requester.dispose();

      await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
      await page.goto(`/queue/${ticket.id}`);
      await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
      await fitsAndShowsFocus(page, "staff detail");

      const [submitted, operational] = await boxes(page, "[data-region='submitted']", "[data-region='operational']");
      if (LAB3_VIEWPORTS[viewport].width >= 992) {
        // Two columns: submitted on the left, operational on the right.
        expect(operational.x).toBeGreaterThan(submitted.x + submitted.width - 1);
      } else {
        // Stacked, operational first (ui-spec §7.3).
        expect(operational.y + operational.height).toBeLessThanOrEqual(submitted.y + 1);
        expect(Math.abs(operational.x - submitted.x)).toBeLessThan(2);
      }
      await shoot(page, "staff-ticket-detail", "unassigned-with-claim", viewport);

      const ops = page.getByRole("region", { name: "Operational" });
      await ops.getByRole("button", { name: "Claim" }).click();
      await page.getByRole("button", { name: "Confirm claim" }).click();
      await expect(page.getByText(/You claimed .*, and it moved to Open\./)).toBeVisible();
      await shoot(page, "staff-ticket-detail", "owned-with-transitions", viewport);

      await ops.getByLabel("Move to").selectOption("CANCELLED");
      await expect(ops.getByLabel(/^Reason/)).toBeVisible();
      await expect(ops.getByRole("button", { name: "Apply" })).toBeDisabled();
      await shoot(page, "staff-ticket-detail", "reason-required", viewport);
      await ops.getByLabel("Move to").selectOption("");

      const publicThread = page.getByRole("region", { name: "Public Comments" });
      await publicThread.getByLabel(/Add a comment/).fill("Thanks, we are looking at it now.");
      await publicThread.getByRole("button", { name: "Post comment" }).click();
      await expect(publicThread.getByText("Thanks, we are looking at it now.")).toBeVisible();
      await publicThread.scrollIntoViewIfNeeded();
      await shoot(page, "staff-ticket-detail", "public-comment-posted", viewport);

      const internalThread = page.getByRole("region", { name: /^Internal Notes/ });
      await internalThread.getByLabel(/Add an internal note/).fill("Checked the print server logs first.");
      await internalThread.getByRole("button", { name: "Post internal note" }).click();
      await expect(internalThread.getByText("Checked the print server logs first.")).toBeVisible();
      await shoot(page, "staff-ticket-detail", "internal-note-posted", viewport);
      expect(await hasHorizontalOverflow(page), "staff detail with both threads").toBe(false);
      await logOut(page);

      await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
      await page.goto(`/queue/${ticket.id}`);
      await expect(page.getByText("You do not have access to that page.")).toBeVisible();
      await shoot(page, "staff-ticket-detail", "forbidden", viewport);
    });

    test(`RESP-05 User Management (${viewport})`, async ({ page }) => {
      await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.name);
      // Changed in Lab 4 (Issue 8, D-09): signing in lands on the Dashboard, so open User Management.
      await page.goto("/users");
      await expect(page.getByText(ACCOUNTS.staff.email).filter({ visible: true }).first()).toBeVisible();
      await fitsAndShowsFocus(page, "user management");

      const width = LAB3_VIEWPORTS[viewport].width;
      if (width >= 768) {
        await expect(page.locator(".tt-table")).toBeVisible();
        await expect(page.locator(".tt-cards")).toBeHidden();
      } else {
        await expect(page.locator(".tt-table")).toBeHidden();
        await expect(page.locator(".tt-users__card").first()).toBeVisible();
      }
      await shoot(page, "user-management", "list", viewport);

      await page.getByLabel("Search name or email").fill("toktickit.local");
      await expect(page.getByText(ACCOUNTS.staff.email).filter({ visible: true }).first()).toBeVisible();
      await shoot(page, "user-management", "search", viewport);
      await page.getByLabel("Search name or email").fill("");
      await page.getByLabel("Role").selectOption("IT_STAFF");
      await expect(page.getByText(ACCOUNTS.colleague.email).filter({ visible: true }).first()).toBeVisible();
      await shoot(page, "user-management", "role-filter", viewport);
      await page.getByLabel("Role").selectOption("");

      await page.getByRole("button", { name: "+ Create user" }).click();
      const panel = page.locator(".tt-drawer__panel");
      const panelBox = (await panel.boundingBox())!;
      if (width >= 992) {
        // A right-hand drawer, not the whole screen.
        expect(panelBox.width).toBeLessThanOrEqual(481);
        expect(panelBox.x + panelBox.width).toBeGreaterThanOrEqual(width - 1);
      } else {
        // A full-screen sheet.
        expect(panelBox.width).toBeGreaterThanOrEqual(width - 1);
      }
      expect(await hasHorizontalOverflow(page), "create panel").toBe(false);
      await shoot(page, "user-management", "create-panel", viewport, { fullPage: false });

      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/^Full name/).fill(`E2E Duplicate ${viewport} ${RUN}`);
      await dialog.getByLabel(/^Email/).fill(ACCOUNTS.staff.email);
      await dialog.getByRole("radio", { name: "IT Staff" }).check();
      await dialog.getByLabel(/^Initial password/).fill("Duplicate#2026");
      await dialog.getByRole("button", { name: "Create user" }).click();
      await expect(dialog.getByText("Another user already has this email.")).toBeVisible();
      await shoot(page, "user-management", "duplicate-email", viewport, { fullPage: false });
      await page.keyboard.press("Escape");

      await page.getByLabel("Search name or email").fill(ACCOUNTS.admin.email);
      await page.getByRole("button", { name: `Edit ${ACCOUNTS.admin.name}` }).filter({ visible: true }).click();
      await expect(dialog.getByText("You cannot change your own role or deactivate yourself.")).toBeVisible();
      await shoot(page, "user-management", "edit-own-account-restricted", viewport, { fullPage: false });
      await page.keyboard.press("Escape");

      // BR-49's refusal can only come from a race (D-27), so for this one shot
      // the PATCH is answered with the API's documented 409 instead of being
      // sent; API-63 and UI-24 prove the real behaviour.
      await page.route("**/api/admin/users/*", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "LAST_ADMINISTRATOR", message: "At least one active Administrator is required." } }),
        });
      });
      await page.getByLabel("Search name or email").fill("kittisak.admin");
      await page.getByRole("button", { name: "Edit Kittisak Phromma" }).filter({ visible: true }).click();
      await dialog.getByRole("switch", { name: "Active" }).uncheck();
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(/At least one active Administrator is required\./);
      await shoot(page, "user-management", "last-administrator-refusal", viewport, { fullPage: false });
      await page.unroute("**/api/admin/users/*");
      await page.keyboard.press("Escape");

      await page.getByLabel("Search name or email").fill(ACCOUNTS.otherRequester.email);
      await page.getByRole("button", { name: `Edit ${ACCOUNTS.otherRequester.name}` }).filter({ visible: true }).click();
      await dialog.getByRole("button", { name: "Set new initial password" }).click();
      await expect(page.getByRole("group", { name: "Set new initial password" })).toContainText("signs the user out everywhere");
      await shoot(page, "user-management", "new-initial-password-confirmation", viewport, { fullPage: false });
      // Cancelled: no seeded account's password is ever changed by this suite.
      await page.getByRole("group", { name: "Set new initial password" }).getByRole("button", { name: "Cancel" }).click();
      await page.keyboard.press("Escape");
    });
  });
}
