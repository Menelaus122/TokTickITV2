import { test, expect, Page } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config.js";
import { createTicket, hasHorizontalOverflow, selectRequester, ticketIdFromUrl } from "./helpers.js";

// RESP-01 to RESP-04 — the three viewports from ui-spec.md section 13, plus the
// screenshots the visual checklist in tests.md is completed against.

const SHOTS = "artifacts/lab-02/screenshots";

type ViewportName = keyof typeof VIEWPORTS;
const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as ViewportName[];

async function shoot(page: Page, folder: string, name: string) {
  await page.screenshot({ path: `${SHOTS}/${folder}/${name}.png`, fullPage: true });
}

/** Puts the app in a known state: a Requester selected and one ticket owned. */
async function seedSession(page: Page) {
  await selectRequester(page, "Anucha Wongsawat");
  return seedTicket(page);
}

/**
 * Creates a ticket for the Requester already selected. Separate from
 * seedSession because re-running the selector once an identity exists would
 * redirect straight past it.
 */
async function seedTicket(page: Page) {
  await createTicket(page, `Responsive fixture ${Date.now()}`);
  return ticketIdFromUrl(page);
}

test.describe("RESP-01 no horizontal overflow", () => {
  for (const name of VIEWPORT_NAMES) {
    test(`every screen fits at ${name}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[name]);

      await page.goto("/select-requester");
      await expect(page.getByLabel(/Development Requester/)).toBeVisible();
      expect(await hasHorizontalOverflow(page), "selection screen").toBe(false);

      const ticketId = await seedSession(page);
      expect(await hasHorizontalOverflow(page), "ticket detail").toBe(false);

      await page.goto("/tickets");
      await expect(page.getByLabel("Search tickets")).toBeVisible();
      expect(await hasHorizontalOverflow(page), "my tickets").toBe(false);

      await page.goto("/tickets/new");
      await expect(page.getByLabel(/^Ticket Summary/)).toBeVisible();
      expect(await hasHorizontalOverflow(page), "create ticket").toBe(false);

      await page.goto(`/tickets/${ticketId}`);
      await expect(page.getByTestId("detail-ticket-number")).toBeVisible();
      expect(await hasHorizontalOverflow(page), "detail again").toBe(false);
    });
  }
});

test.describe("RESP-02 list representation per viewport", () => {
  test("a table on desktop and cards on mobile", async ({ page }) => {
    await seedSession(page);
    await page.goto("/tickets");
    await expect(page.getByLabel("Search tickets")).toBeVisible();

    await page.setViewportSize(VIEWPORTS.desktop);
    await expect(page.locator("table.tt-table")).toBeVisible();
    await expect(page.locator(".tt-cards")).toBeHidden();

    await page.setViewportSize(VIEWPORTS.mobile);
    await expect(page.locator("table.tt-table")).toBeHidden();
    await expect(page.locator(".tt-cards")).toBeVisible();
  });

  test("navigation collapses behind the menu on mobile", async ({ page }) => {
    await seedSession(page);
    await page.goto("/tickets");

    await page.setViewportSize(VIEWPORTS.desktop);
    await expect(page.locator(".tt-shell__desktop-nav")).toBeVisible();
    await expect(page.locator(".tt-shell__menu-toggle")).toBeHidden();

    await page.setViewportSize(VIEWPORTS.mobile);
    await expect(page.locator(".tt-shell__desktop-nav")).toBeHidden();
    await expect(page.locator(".tt-shell__menu-toggle")).toBeVisible();
  });
});

test.describe("RESP-04 controls stay usable at mobile size", () => {
  test("filters, pagination, and the menu are reachable and touch-sized", async ({ page }) => {
    await seedSession(page);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto("/tickets");
    await expect(page.getByLabel("Search tickets")).toBeVisible();

    for (const label of ["Filter by Category", "Filter by Requested Priority", "Sort tickets"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    // The menu toggle must be a real touch target (ui-spec.md section 12).
    const toggle = page.locator(".tt-shell__menu-toggle");
    const box = await toggle.boundingBox();
    expect(box, "menu toggle has a box").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // And it actually opens the navigation.
    await toggle.click();
    await expect(page.locator(".tt-shell__mobile-nav")).toBeVisible();
  });

  test("attachment actions are reachable on a narrow screen", async ({ page }) => {
    const ticketId = await seedSession(page);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(`/tickets/${ticketId}`);

    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "mobile-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ntrailer\n%%EOF\n"),
    });

    await expect(page.getByRole("button", { name: "Download mobile-evidence.pdf" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("RESP-03 screenshots for the visual checklist", () => {
  test("capture every screen at every viewport", async ({ page }) => {
    // One session, so the screenshots all show the same Requester and ticket.
    const ticketId = await seedSession(page);

    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ntrailer\n%%EOF\n"),
    });
    await expect(page.getByText("evidence.pdf")).toBeVisible();

    for (const name of VIEWPORT_NAMES) {
      await page.setViewportSize(VIEWPORTS[name]);

      await page.goto("/tickets");
      await expect(page.getByLabel("Search tickets")).toBeVisible();
      await shoot(page, "my-tickets", name);

      await page.goto("/tickets/new");
      await expect(page.getByLabel(/^Ticket Summary/)).toBeVisible();
      await shoot(page, "create-ticket", name);

      await page.goto(`/tickets/${ticketId}`);
      await expect(page.getByTestId("detail-ticket-number")).toBeVisible();
      await shoot(page, "ticket-detail", name);
    }
  });

  test("capture the selection screen and the states that matter", async ({ page }) => {
    // Requester Selection, before any identity exists.
    for (const name of VIEWPORT_NAMES) {
      await page.setViewportSize(VIEWPORTS[name]);
      await page.goto("/select-requester");
      await expect(page.getByLabel(/Development Requester/)).toBeVisible();
      await shoot(page, "requester-selection", name);
    }

    await page.setViewportSize(VIEWPORTS.desktop);

    // Create Ticket — validation failure, with messages beneath their fields.
    await selectRequester(page, "Anucha Wongsawat");
    await page.goto("/tickets/new");
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.getByText("Summary is required.")).toBeVisible();
    await shoot(page, "create-ticket", "validation-failure");

    // Create Ticket — an invalid attachment on the detail screen. The Requester
    // is already selected above, so only a ticket is needed here.
    const ticketId = await seedTicket(page);
    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "virus.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ"),
    });
    await expect(page.getByText(/files are permitted/)).toBeVisible();
    await shoot(page, "ticket-detail", "invalid-attachment");

    // Ticket Detail — a removed attachment keeping its metadata.
    await page.goto(`/tickets/${ticketId}`);
    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ntrailer\n%%EOF\n"),
    });
    await expect(page.getByText("evidence.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByLabel(/Removal reason/).fill("Captured for the visual checklist");
    await shoot(page, "ticket-detail", "removal-confirm");
    await page.getByRole("button", { name: "Remove attachment" }).click();
    await expect(page.getByText(/Captured for the visual checklist/)).toBeVisible();
    await shoot(page, "ticket-detail", "attachment-removed");

    // Create Ticket — the success state, which Part 6 asks for by name.
    await page.goto("/tickets/new");
    await page.getByLabel(/^Category/).selectOption({ index: 1 });
    await page.getByLabel(/^Related System/).selectOption({ index: 1 });
    await page.getByLabel(/^Requested Priority/).selectOption("MEDIUM");
    await page.getByLabel(/^Ticket Summary/).fill(`Success state capture ${Date.now()}`);
    await page
      .getByLabel(/^Description/)
      .fill("Captured for the Part 6 success-state screenshot in the visual checklist.");
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.getByTestId("created-ticket-number")).toBeVisible();
    await shoot(page, "create-ticket", "success");

    // Create Ticket — an invalid attachment chosen on the form itself.
    await page.goto("/tickets/new");
    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "virus.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ"),
    });
    await expect(page.getByText(/files are permitted/)).toBeVisible();
    await shoot(page, "create-ticket", "invalid-attachment");

    // Create Ticket — the safe API-failure state, with every value kept.
    await page.route("**/api/tickets", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.goto("/tickets/new");
    await page.getByLabel(/^Category/).selectOption({ index: 1 });
    await page.getByLabel(/^Related System/).selectOption({ index: 1 });
    await page.getByLabel(/^Requested Priority/).selectOption("HIGH");
    await page.getByLabel(/^Ticket Summary/).fill("Backend unavailable capture");
    await page
      .getByLabel(/^Description/)
      .fill("Captured for the Part 6 API-failure screenshot; these values must survive.");
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.getByText(/Cannot reach the TokTickIT API/)).toBeVisible();
    await shoot(page, "create-ticket", "api-failure");
    await page.unroute("**/api/tickets");

    // My Tickets — the no-results state.
    await page.goto("/tickets");
    await page.getByLabel("Search tickets").fill("zzz-no-such-ticket-zzz");
    await expect(page.getByText("No tickets match your filters.")).toBeVisible();
    await shoot(page, "my-tickets", "no-results");

    // Ticket Detail — not found, which is also what another Requester's ticket
    // looks like.
    await page.goto("/tickets/999999");
    await expect(page.getByText("Ticket not found.")).toBeVisible();
    await shoot(page, "ticket-detail", "not-found");
  });
});
