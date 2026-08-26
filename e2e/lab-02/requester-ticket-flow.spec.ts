import { test, expect } from "@playwright/test";
import { API_URL } from "../../playwright.config.js";
import { createTicket, selectRequester, switchRequester, ticketIdFromUrl } from "./helpers.js";

// E2E-01 to E2E-04 — the Requester journeys, against a real stack.

const REQUESTER_A = "Anucha Wongsawat";
const REQUESTER_B = "Kanya Srisai";

// Ids of the tickets this suite creates, reported at the end.
//
// Unlike the API suites, these cannot clean up after themselves: Lab 2
// deliberately exposes no delete endpoint, and reaching around the application
// into the database would mean this suite no longer tests only what a user can
// actually do. The rows are left behind on the development database, and
// docs/lab-02/tests.md section 5 documents the reset command.
const created: number[] = [];

test.afterAll(() => {
  if (created.length > 0) {
    console.log(`E2E created ticket ids: ${created.join(", ")} — see tests.md section 5 to reset.`);
  }
});

test.describe("E2E-01 complete creation journey", () => {
  test("select a Requester, create a Ticket, find it in My Tickets", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);

    const summary = `E2E creation ${Date.now()}`;
    const ticket = await createTicket(page, summary);
    created.push(ticketIdFromUrl(page));

    // The official number came from the backend, in the documented format.
    expect(ticket.number).toMatch(/^TT-\d{4}-\d{5}$/);

    // And the ticket is findable in the list afterwards.
    await page.getByRole("link", { name: "My Tickets" }).first().click();
    await expect(page.getByLabel("Search tickets")).toBeVisible();

    await page.getByLabel("Search tickets").fill(ticket.number);
    await expect(page.getByRole("button", { name: ticket.number }).first()).toBeVisible();
  });

  test("opening the ticket from the list shows the same ticket", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);

    const summary = `E2E open ${Date.now()}`;
    const ticket = await createTicket(page, summary);
    created.push(ticketIdFromUrl(page));

    await page.getByRole("link", { name: "My Tickets" }).first().click();
    await page.getByLabel("Search tickets").fill(ticket.number);
    await page.getByRole("button", { name: ticket.number }).first().click();

    await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.number);
    await expect(page.getByTestId("detail-summary")).toHaveText(summary);
  });
});

test.describe("E2E-02 cross-requester isolation", () => {
  test("Requester B cannot open Requester A's ticket by URL", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    const summary = `E2E private ${Date.now()}`;
    await createTicket(page, summary);
    const ticketId = ticketIdFromUrl(page);
    created.push(ticketId);

    // Switch identity through the UI, then try the other requester's URL.
    await switchRequester(page, REQUESTER_B);

    await page.goto(`/tickets/${ticketId}`);

    await expect(page.getByText("Ticket not found.")).toBeVisible();
    // Nothing of the other requester's ticket leaks onto the screen.
    await expect(page.getByText(summary)).toHaveCount(0);
  });

  test("the API itself refuses the cross-requester read", async ({ page, request }) => {
    await selectRequester(page, REQUESTER_A);
    await createTicket(page, `E2E api private ${Date.now()}`);
    const ticketId = ticketIdFromUrl(page);
    created.push(ticketId);

    const asOwner = await request.get(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { "X-Requester-Id": "1" },
    });
    const asOther = await request.get(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { "X-Requester-Id": "2" },
    });

    expect(asOwner.status()).toBe(200);
    expect(asOther.status()).toBe(404);
  });

  test("Requester B's list never contains Requester A's ticket", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    const summary = `E2E list isolation ${Date.now()}`;
    await createTicket(page, summary);
    created.push(ticketIdFromUrl(page));

    await switchRequester(page, REQUESTER_B);

    await expect(page.getByLabel("Search tickets")).toBeVisible();
    await page.getByLabel("Search tickets").fill(summary);

    await expect(page.getByText(summary)).toHaveCount(0);
  });
});

test.describe("E2E-03 attachment lifecycle", () => {
  test("add, download, and soft-remove an attachment", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await createTicket(page, `E2E attachments ${Date.now()}`);
    created.push(ticketIdFromUrl(page));

    // --- add ---------------------------------------------------------------
    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n"),
    });

    await expect(page.getByText("evidence.pdf")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Attachments \(1 of 5 active\)/ })).toBeVisible();

    // --- download ----------------------------------------------------------
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download evidence.pdf" }).click();
    expect((await download).suggestedFilename()).toBe("evidence.pdf");

    // --- soft-remove -------------------------------------------------------
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // The confirm stays disabled until a reason is supplied (BR-39).
    const confirm = page.getByRole("button", { name: "Remove attachment" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/Removal reason/).fill("Uploaded the wrong evidence");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Metadata is retained, and every route to the bytes is gone (BR-40).
    await expect(page.getByText("evidence.pdf")).toBeVisible();
    await expect(page.getByText(/Uploaded the wrong evidence/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Download evidence.pdf" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Attachments \(0 of 5 active\)/ })).toBeVisible();
  });

  test("a removed attachment cannot be downloaded through the API", async ({ page, request }) => {
    await selectRequester(page, REQUESTER_A);
    await createTicket(page, `E2E removed download ${Date.now()}`);
    const ticketId = ticketIdFromUrl(page);
    created.push(ticketId);

    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ntrailer\n%%EOF\n"),
    });
    await expect(page.getByText("evidence.pdf")).toBeVisible();

    const detail = await request.get(`${API_URL}/api/tickets/${ticketId}`, {
      headers: { "X-Requester-Id": "1" },
    });
    const attachmentId = (await detail.json()).attachments[0].id;

    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByLabel(/Removal reason/).fill("Removed for the API check");
    await page.getByRole("button", { name: "Remove attachment" }).click();
    await expect(page.getByText(/Removed for the API check/)).toBeVisible();

    const blocked = await request.get(`${API_URL}/api/attachments/${attachmentId}/download`, {
      headers: { "X-Requester-Id": "1" },
    });
    expect(blocked.status()).toBe(410);
  });

  test("an unsupported file is rejected without leaving the screen", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    const summary = `E2E rejected upload ${Date.now()}`;
    await createTicket(page, summary);
    created.push(ticketIdFromUrl(page));

    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "virus.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ"),
    });

    await expect(page.getByText(/files are permitted/)).toBeVisible();
    // The ticket is untouched by the rejection (FR-31).
    await expect(page.getByTestId("detail-summary")).toHaveText(summary);
  });
});

test.describe("E2E-04 changing Requester", () => {
  test("switching identity replaces the visible list", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    const summary = `E2E switch ${Date.now()}`;
    await createTicket(page, summary);
    created.push(ticketIdFromUrl(page));

    await page.getByRole("link", { name: "My Tickets" }).first().click();
    await page.getByLabel("Search tickets").fill(summary);
    await expect(page.getByText(summary).first()).toBeVisible();

    await switchRequester(page, REQUESTER_B);

    await expect(page.getByTestId("current-requester")).toHaveText(REQUESTER_B);
    await expect(page.getByText(summary)).toHaveCount(0);
  });

  test("the selection survives a page reload", async ({ page }) => {
    await selectRequester(page, REQUESTER_A);
    await page.reload();

    await expect(page.getByTestId("current-requester")).toHaveText(REQUESTER_A);
  });
});
