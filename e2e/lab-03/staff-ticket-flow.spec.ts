import { test, expect, Page } from "@playwright/test";
import { ACCOUNTS, RUN, apiAs, createTicketAs, logOut, signIn } from "./helpers.js";

// E2E-04 to E2E-07 — the IT Staff journey from the queue to a resolved ticket,
// and what the Requester sees of it (docs/lab-03/tests.md §2.13; AC-15 to
// AC-17, AC-20, AC-22, AC-24, AC-26).
//
// One ticket travels through E2E-04 to E2E-06 in order, so the suite runs
// serially; E2E-07 uses its own ticket.

test.describe.configure({ mode: "serial" });

const REASON = "Replaced the toner and printed a test page.";
const NOTE = "Toner came from the spare stock in room 2.";
const COMMENT = "We are on it and will update you shortly.";

let ticket: { id: number; ticketNumber: string };
let flagged: { id: number; ticketNumber: string };

test.beforeAll(async () => {
  const requester = await apiAs(ACCOUNTS.requester.email);
  ticket = await createTicketAs(requester, `E2E staff flow ${RUN}`, "MEDIUM");
  flagged = await createTicketAs(requester, `E2E appears resolved ${RUN}`, "LOW");
  await requester.dispose();
  console.log(`E2E created ticket ids: ${ticket.id}, ${flagged.id} — see tests.md section 5 to reset.`);
});

const operational = (page: Page) => page.getByRole("region", { name: "Operational" });

async function openFromQueue(page: Page, number: string) {
  await page.getByLabel("Search number or summary").fill(number);
  // The queue shows a table from 768px and cards below; either way the
  // Ticket Number is the link to the detail screen.
  await page.getByRole("link", { name: number }).filter({ visible: true }).first().click();
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(number);
}

test("E2E-04 IT Staff find the new ticket among the unassigned ones, claim it, and it becomes Open", async ({ page }) => {
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await expect(page).toHaveURL(/\/queue$/);

  await page.getByLabel("Owner").selectOption("unassigned");
  await page.getByLabel("Search number or summary").fill(ticket.ticketNumber);
  const row = page.getByRole("row").filter({ hasText: ticket.ticketNumber });
  await expect(row).toBeVisible();
  await expect(row.getByText("Unassigned")).toBeVisible();
  await expect(row.getByText("New", { exact: true })).toBeVisible();

  await row.getByRole("link", { name: ticket.ticketNumber }).click();
  await expect(page).toHaveURL(new RegExp(`/queue/${ticket.id}$`));

  await operational(page).getByRole("button", { name: "Claim" }).click();
  await expect(page.getByRole("group", { name: "Confirm claim" })).toContainText("move to Open");
  await page.getByRole("button", { name: "Confirm claim" }).click();

  await expect(page.getByText(`You claimed ${ticket.ticketNumber}, and it moved to Open.`)).toBeVisible();
  await expect(operational(page).getByText("You", { exact: true })).toBeVisible();

  // Back in the queue, the ticket is no longer unassigned.
  await page.getByRole("button", { name: "‹ Back to the queue" }).click();
  await page.getByLabel("Owner").selectOption("me");
  await page.getByLabel("Search number or summary").fill(ticket.ticketNumber);
  await expect(page.getByRole("row").filter({ hasText: ticket.ticketNumber }).getByText("Open", { exact: true })).toBeVisible();
});

test("E2E-05 raise IT Priority, then move to Resolved with a reason that appears as a Public Comment", async ({ page }) => {
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openFromQueue(page, ticket.ticketNumber);

  await operational(page).getByLabel("IT Priority").selectOption("URGENT");
  await operational(page).getByRole("button", { name: "Update IT Priority" }).click();
  await expect(page.getByText("IT Priority is now URGENT.")).toBeVisible();
  // Requested Priority stays the Requester's (AC-24).
  await expect(operational(page).getByLabel("Requested Priority")).toHaveValue("MEDIUM");

  await operational(page).getByLabel("Move to").selectOption("IN_PROGRESS");
  await operational(page).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(`${ticket.ticketNumber} moved to In Progress.`)).toBeVisible();

  await operational(page).getByLabel("Move to").selectOption("RESOLVED");
  const apply = operational(page).getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled();
  await operational(page).getByLabel(/^Reason/).fill(REASON);
  await apply.click();

  await expect(page.getByText(/moved to Resolved, and the reason was posted as a Public Comment/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Public Comments" }).getByText(REASON)).toBeVisible();
  // Resolved offers only Closed and Reopened next (BR-33).
  const options = await operational(page).getByLabel("Move to").locator("option").allTextContents();
  expect(options).toEqual(["Choose a status", "Closed", "Reopened"]);
});

test("E2E-06 IT Staff add a note and a comment; the Requester sees only the comment", async ({ page }) => {
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openFromQueue(page, ticket.ticketNumber);

  const publicThread = page.getByRole("region", { name: "Public Comments" });
  const internalThread = page.getByRole("region", { name: /^Internal Notes/ });
  await internalThread.getByLabel(/Add an internal note/).fill(NOTE);
  await internalThread.getByRole("button", { name: "Post internal note" }).click();
  await expect(internalThread.getByText(NOTE)).toBeVisible();
  await publicThread.getByLabel(/Add a comment/).fill(COMMENT);
  await publicThread.getByRole("button", { name: "Post comment" }).click();
  await expect(publicThread.getByText(COMMENT)).toBeVisible();
  await logOut(page);

  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
  const thread = page.getByRole("region", { name: "Public Comments" });
  await expect(thread.getByText(COMMENT)).toBeVisible();
  await expect(thread.getByText(REASON)).toBeVisible();
  // No note text, no Internal Notes region, nothing hinting at one (AC-17).
  await expect(page.getByText(NOTE)).toHaveCount(0);
  await expect(page.getByRole("region", { name: /Internal Notes/ })).toHaveCount(0);
  await expect(page.getByText(/internal/i)).toHaveCount(0);
});

test("E2E-07 the Requester marks a problem as appearing resolved, and IT Staff see the signal in the queue", async ({ page }) => {
  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await page.goto(`/tickets/${flagged.id}`);
  const panel = page.getByRole("region", { name: "Problem Appears Resolved" });
  await panel.getByLabel(/^Comment/).fill("It works again after the restart, thank you.");
  await panel.getByRole("button", { name: "Mark as appears resolved" }).click();
  await expect(panel.getByText(/You marked this as appearing resolved/)).toBeVisible();
  // It is an opinion, not a status: the ticket is still New (BR-05).
  await expect(page.getByText("New", { exact: true }).first()).toBeVisible();
  await logOut(page);

  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await page.getByLabel("Search number or summary").fill(flagged.ticketNumber);
  const row = page.getByRole("row").filter({ hasText: flagged.ticketNumber });
  await expect(row.getByText("Requester says resolved")).toBeVisible();
});
