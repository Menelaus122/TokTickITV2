import { test, expect, Page } from "@playwright/test";
import {
  ACCOUNTS,
  RUN,
  actionsRegion,
  apiAs,
  historyOf,
  historyRegion,
  logOut,
  newSession,
  operationalRegion,
  recordActionOnScreen,
  actionTime,
  signIn,
  staffTicket,
  ticketAt,
  settledTimeline,
} from "./helpers.js";

// E2E-02, E2E-03, E2E-08 and E2E-09 — the Ticket workflow through the screen: the resolution gate,
// a stale save from a second browser, an "appears resolved" signal that changes nothing, a reopened
// Ticket, and a cancelled one (docs/lab-04/tests.md §2.11; AC-03, AC-09, AC-11 to AC-16; labsheet
// Part 7). E2E-09 is not in the plan approved in PR #78; tests.md §3.1 says why it was added.
//
// Each test has a Ticket of its own, brought to the status it starts in through the same moves a
// person would make, so the history it reads at the end is genuine.

const GATE_ACTION_REQUIRED = "Resolved — Record at least one action before resolving this ticket.";
const GATE_FOLLOW_UP = "Resolved — The most recently recorded action still needs follow-up. Record the follow-up as a new action first.";

async function openStaffDetail(page: Page, ticket: { id: number; ticketNumber: string }) {
  await page.goto(`/queue/${ticket.id}`);
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);
}

/** The "Move to" options the status control offers, without its placeholder. */
async function moveOptions(page: Page): Promise<string[]> {
  const options = await operationalRegion(page).getByLabel("Move to").locator("option").allTextContents();
  return options.filter((text) => text !== "Choose a status");
}

/** Chooses a move, types the reason when the move asks for one (Resolved, Cancelled, Reopened), and applies it. */
async function moveTo(page: Page, value: string, reason?: string) {
  const operational = operationalRegion(page);
  await operational.getByLabel("Move to").selectOption(value);
  if (reason !== undefined) await operational.getByLabel(/^Reason/).fill(reason);
  await operational.getByRole("button", { name: "Apply" }).click();
}

test("E2E-02 an IT Staff member is held back from Resolved until the closing action is recorded, then resolves and closes", async ({ page }) => {
  test.setTimeout(90_000);
  const requester = await apiAs(ACCOUNTS.requester.email);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(requester, staff, `E2E resolution gate ${RUN}`, "IN_PROGRESS");
  await requester.dispose();
  const operational = operationalRegion(page);

  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openStaffDetail(page, ticket);

  // --- no action at all: Resolved is not offered, and the screen says why and where to go ----------------------
  await expect(operational.getByRole("list", { name: "Not available now" })).toContainText(GATE_ACTION_REQUIRED);
  expect(await moveOptions(page)).not.toContain("Resolved");
  await operational.getByRole("button", { name: "Go to Actions Taken" }).click();
  await expect(actionsRegion(page).getByRole("heading", { level: 2 })).toBeFocused();

  // The API refuses the same move made directly, and changes nothing (AC-03).
  const before = await staffTicket(staff, ticket.id);
  const refused = await staff.patch(`/api/staff/tickets/${ticket.id}/status`, {
    data: { currentStatus: "RESOLVED", reason: "Trying to resolve with nothing recorded.", expectedVersion: before.version },
  });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("ACTION_REQUIRED");
  const unchanged = await staffTicket(staff, ticket.id);
  expect([unchanged.currentStatus, unchanged.version]).toEqual([before.currentStatus, before.version]);

  // --- an action that needs follow-up does not open the gate either --------------------------------------------
  await recordActionOnScreen(page, {
    description: "Swapped the cable and the port still drops.",
    result: "The fault remains.",
    followUp: { note: "Try another switch port tomorrow." },
  });
  await expect(operational.getByRole("list", { name: "Not available now" })).toContainText(GATE_FOLLOW_UP);
  expect(await moveOptions(page)).not.toContain("Resolved");
  const pending = await staff.patch(`/api/staff/tickets/${ticket.id}/status`, {
    data: { currentStatus: "RESOLVED", reason: "Trying to resolve with a follow-up open.", expectedVersion: unchanged.version },
  });
  expect(pending.status()).toBe(409);
  expect(((await pending.json()) as { error: { code: string } }).error.code).toBe("FOLLOW_UP_PENDING");

  // --- the closing action opens it: Resolved joins the list with no reload -------------------------------------
  await recordActionOnScreen(page, { description: "Moved the cable to another switch port.", result: "The link has stayed up for an hour." });
  await expect(operational.getByRole("list", { name: "Not available now" })).toHaveCount(0);
  expect(await moveOptions(page)).toContain("Resolved");

  await operational.getByLabel("Move to").selectOption("RESOLVED");
  const apply = operational.getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled(); // a reason is required (Lab 3 BR-34)
  await operational.getByLabel(/^Reason/).fill("Moved the cable and the link stays up.");
  await apply.click();
  await expect(page.getByText("Status changed to Resolved.")).toBeVisible();
  await expect(operational.getByText("Current:")).toContainText("Resolved");
  await expect(page.getByRole("region", { name: "Public Comments" }).getByText("Moved the cable and the link stays up.")).toBeVisible();
  // A resolved Ticket takes no more actions: the control is disabled and says why (BR-10).
  await expect(actionsRegion(page).getByRole("button", { name: "+ Add action" })).toBeDisabled();
  await expect(actionsRegion(page)).toContainText("This ticket is Resolved, so no more actions can be recorded. Reopen it first.");
  expect(await moveOptions(page)).toEqual(["Closed", "Reopened"]);

  await moveTo(page, "CLOSED");
  await expect(page.getByText("Status changed to Closed.")).toBeVisible();
  await expect(operational.getByText("Current:")).toContainText("Closed");

  // --- the timeline shows each step, in order, with who made it (AC-13) ----------------------------------------
  const steps = await settledTimeline(page, ["Ticket created", "New → Open", "Open → In Progress", "In Progress → Resolved", "Resolved → Closed"]);
  expect(steps.slice(1).every((step) => step.who.startsWith(ACCOUNTS.staff.name))).toBe(true);
  expect((await historyOf(staff, ticket.id)).length, "one row for each change, and none for the refusals").toBe(4);
  await staff.dispose();
});

test("E2E-03 a save made from a stale screen is refused, the other person's change survives, and Show latest recovers", async ({ browser }) => {
  test.setTimeout(90_000);
  const requester = await apiAs(ACCOUNTS.requester.email);
  const owner = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(requester, owner, `E2E stale update ${RUN}`, "IN_PROGRESS");
  await requester.dispose();

  // Two browsers, two people, the same Ticket.
  const a = await newSession(browser);
  const b = await newSession(browser);
  await signIn(a.page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await signIn(b.page, ACCOUNTS.colleague.email, ACCOUNTS.colleague.name);
  await openStaffDetail(a.page, ticket);
  await openStaffDetail(b.page, ticket);
  const startVersion = (await staffTicket(owner, ticket.id)).version;

  // B moves the Ticket on.
  await operationalRegion(b.page).getByLabel("Move to").selectOption("WAITING_FOR_REQUESTER");
  await operationalRegion(b.page).getByRole("button", { name: "Apply" }).click();
  await expect(b.page.getByText("Status changed to Waiting for Requester.")).toBeVisible();

  // A, still looking at the old Ticket, saves a different change.
  const operationalA = operationalRegion(a.page);
  await operationalA.getByLabel("IT Priority").selectOption("URGENT");
  await operationalA.getByRole("button", { name: "Update IT Priority" }).click();
  const conflict = operationalA.getByRole("alert").filter({ hasText: "This ticket changed while you were working on it" });
  await expect(conflict).toBeVisible();
  // Its own message with the truth in it, not a generic failure (BR-54, ui-spec §1.5).
  await expect(conflict).toContainText(`It is now Waiting for Requester, owned by ${ACCOUNTS.staff.name}.`);
  await expect(conflict.getByRole("button", { name: "Show latest" })).toBeVisible();
  await expect(a.page.getByText("That did not work")).toHaveCount(0);

  // B's change survived and A's was not applied (AC-14).
  const afterConflict = await staffTicket(owner, ticket.id);
  expect(afterConflict.currentStatus).toBe("WAITING_FOR_REQUESTER");
  expect(afterConflict.itPriority).not.toBe("URGENT");
  expect(afterConflict.version).toBe(startVersion + 1);

  // Show latest reads the Ticket again and shows it as it is now; the same save, made again, goes through.
  await conflict.getByRole("button", { name: "Show latest" }).click();
  await expect(conflict).toHaveCount(0);
  await expect(operationalA.getByText("Current:")).toContainText("Waiting for Requester");
  await expect(operationalA.getByLabel("IT Priority")).toHaveValue(afterConflict.itPriority);
  await operationalA.getByLabel("IT Priority").selectOption("URGENT");
  await operationalA.getByRole("button", { name: "Update IT Priority" }).click();
  await expect(a.page.getByText("IT Priority is now URGENT.")).toBeVisible();
  const afterRetry = await staffTicket(owner, ticket.id);
  expect([afterRetry.currentStatus, afterRetry.itPriority, afterRetry.version]).toEqual(["WAITING_FOR_REQUESTER", "URGENT", startVersion + 2]);

  // B's screen is stale in turn. Its save is refused the same way, and Show latest keeps the reason B typed and
  // the move B chose, so the retry is one press (BR-54).
  const operationalB = operationalRegion(b.page);
  const reason = "Raised twice; the other ticket is the one to follow.";
  await operationalB.getByLabel("Move to").selectOption("CANCELLED");
  await operationalB.getByLabel(/^Reason/).fill(reason);
  await operationalB.getByRole("button", { name: "Apply" }).click();
  const conflictB = operationalB.getByRole("alert").filter({ hasText: "This ticket changed while you were working on it" });
  await expect(conflictB).toBeVisible();
  await expect(conflictB).toContainText("It is now Waiting for Requester");
  expect((await staffTicket(owner, ticket.id)).currentStatus, "the refused save changed nothing").toBe("WAITING_FOR_REQUESTER");
  await conflictB.getByRole("button", { name: "Show latest" }).click();
  await expect(conflictB).toHaveCount(0);
  await expect(operationalB.getByLabel("Move to")).toHaveValue("CANCELLED");
  await expect(operationalB.getByLabel(/^Reason/)).toHaveValue(reason);
  await operationalB.getByRole("button", { name: "Apply" }).click();
  await expect(b.page.getByText("Status changed to Cancelled.")).toBeVisible();
  const final = await staffTicket(owner, ticket.id);
  expect([final.currentStatus, final.itPriority], "both people's changes are there").toEqual(["CANCELLED", "URGENT"]);

  await a.context.close();
  await b.context.close();
  await owner.dispose();
});

test("E2E-08 a Requester's appears-resolved signal changes nothing; IT Staff resolve, reopen, and cannot resolve again until a new action", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const requester = await apiAs(ACCOUNTS.requester.email);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(requester, staff, `E2E reopen and resolve again ${RUN}`, "IN_PROGRESS");

  // --- the Requester says it looks fixed: a signal, not a status (AC-15) ---------------------------------------
  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await page.goto(`/tickets/${ticket.id}`);
  const panel = page.getByRole("region", { name: "Problem Appears Resolved" });
  await panel.getByLabel(/^Comment/).fill("It works again after the restart, thank you.");
  await panel.getByRole("button", { name: "Mark as appears resolved" }).click();
  await expect(panel.getByText(/You marked this as appearing resolved/)).toBeVisible();
  await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();
  expect((await staffTicket(staff, ticket.id)).currentStatus, "the signal did not move the status").toBe("IN_PROGRESS");
  await logOut(page);

  // --- IT Staff see the signal, and Resolved is still held back --------------------------------------------------
  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openStaffDetail(page, ticket);
  const operational = operationalRegion(page);
  await expect(operational.getByText(/The Requester says the problem appears resolved/)).toBeVisible();
  await expect(operational.getByRole("list", { name: "Not available now" })).toContainText(GATE_ACTION_REQUIRED);
  expect(await moveOptions(page)).not.toContain("Resolved");

  // --- resolve (after the action), then reopen ---------------------------------------------------------------------
  await recordActionOnScreen(page, { description: "Restarted the service and checked the logs.", result: "The errors stopped." });
  await moveTo(page, "RESOLVED", "Restarted the service; errors stopped.");
  await expect(page.getByText("Status changed to Resolved.")).toBeVisible();
  await moveTo(page, "REOPENED", "The Requester reports it failed again this afternoon.");
  await expect(page.getByText("Status changed to Reopened.")).toBeVisible();
  await expect(operational.getByText("Current:")).toContainText("Reopened");

  // --- a Reopened Ticket goes back to In Progress first (the matrix); resolving again then needs an action
  //     recorded after the reopen, whatever was recorded before it (AC-12) ---------------------------------------
  expect(await moveOptions(page)).toEqual(["In Progress", "Cancelled"]);
  await moveTo(page, "IN_PROGRESS");
  await expect(page.getByText("Status changed to In Progress.")).toBeVisible();
  await expect(operational.getByRole("list", { name: "Not available now" })).toContainText(GATE_ACTION_REQUIRED);
  expect(await moveOptions(page)).not.toContain("Resolved");
  const rows = (await historyOf(staff, ticket.id)).length;
  const current = await staffTicket(staff, ticket.id);
  const refused = await staff.patch(`/api/staff/tickets/${ticket.id}/status`, {
    data: { currentStatus: "RESOLVED", reason: "Trying again with only the old action.", expectedVersion: current.version },
  });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("ACTION_REQUIRED");
  expect((await historyOf(staff, ticket.id)).length, "a refused move writes no history row").toBe(rows);

  await recordActionOnScreen(page, { description: "Replaced the failing network adapter.", result: "The service has stayed up since." });
  // "Action recorded." appears before the screen has read the Ticket again, so the status control is still the old one for a
  // moment. E2E-02 waits for the gate's list to go; so does this (the review of PR #89).
  await expect(operational.getByRole("list", { name: "Not available now" })).toHaveCount(0);
  expect(await moveOptions(page)).toContain("Resolved");
  await moveTo(page, "RESOLVED", "Replaced the adapter; stable since.");
  await expect(page.getByText("Status changed to Resolved.")).toBeVisible();

  // --- every step is on the timeline, and the Requester reads the same one -----------------------------------
  const expected = [
    "Ticket created",
    "New → Open",
    "Open → In Progress",
    "In Progress → Resolved",
    "Resolved → Reopened",
    "Reopened → In Progress",
    "In Progress → Resolved",
  ];
  await settledTimeline(page, expected);

  const reader = await newSession(browser);
  await signIn(reader.page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await reader.page.goto(`/tickets/${ticket.id}`);
  await expect(historyRegion(reader.page)).toBeVisible();
  await settledTimeline(reader.page, expected);
  await reader.context.close();

  await requester.dispose();
  await staff.dispose();
});

test("E2E-09 a cancelled Ticket is final: it cannot change, and it takes no more actions", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const requester = await apiAs(ACCOUNTS.requester.email);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const ticket = await ticketAt(requester, staff, `E2E cancelled is final ${RUN}`, "OPEN");

  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  await openStaffDetail(page, ticket);
  const operational = operationalRegion(page);
  await operational.getByLabel("Move to").selectOption("CANCELLED");
  await expect(operational.getByRole("button", { name: "Apply" })).toBeDisabled(); // a reason is required first
  await operational.getByLabel(/^Reason/).fill("Raised twice; the other ticket is the one to follow.");
  await operational.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Status changed to Cancelled.")).toBeVisible();

  // Nothing is offered, and the control says it is final (ui-spec §5).
  await expect(operational.getByText("This ticket is cancelled and cannot change.")).toBeVisible();
  await expect(operational.getByLabel("Move to")).toHaveCount(0);
  // No action can be recorded; the sentence ends after "recorded" because a cancelled Ticket cannot be reopened.
  await expect(actionsRegion(page).getByRole("button", { name: "+ Add action" })).toBeDisabled();
  await expect(actionsRegion(page).getByText(/^This ticket is Cancelled, so no more actions can be recorded\.$/)).toBeVisible();
  await expect(actionsRegion(page)).not.toContainText("Reopen it first");

  // The API holds the line the screen drew (AC-09, AC-11).
  const record = await staff.post(`/api/staff/tickets/${ticket.id}/actions-taken`, {
    data: { actionAt: (await actionTime(staff, ticket.id)).toISOString(), description: "Trying to record on a cancelled ticket.", result: "No.", followUpRequired: false },
  });
  expect(record.status(), await record.text()).toBe(409);
  expect(((await record.json()) as { error: { code: string } }).error.code).toBe("TICKET_NOT_ACTIVE");
  const reopen = await staff.patch(`/api/staff/tickets/${ticket.id}/status`, {
    data: { currentStatus: "REOPENED", reason: "Trying to reopen a cancelled ticket.", expectedVersion: (await staffTicket(staff, ticket.id)).version },
  });
  expect(reopen.status()).toBe(409);
  expect(((await reopen.json()) as { error: { code: string } }).error.code).toBe("INVALID_TRANSITION");
  expect((await staffTicket(staff, ticket.id)).currentStatus).toBe("CANCELLED");

  // The Requester sees it cancelled, with the step on the timeline and the reason as a comment.
  const reader = await newSession(browser);
  await signIn(reader.page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  await reader.page.goto(`/tickets/${ticket.id}`);
  await expect(reader.page.getByRole("region", { name: "Public Comments" }).getByText("Raised twice; the other ticket is the one to follow.")).toBeVisible();
  await settledTimeline(reader.page, ["Ticket created", "New → Open", "Open → Cancelled"]);
  await reader.context.close();

  await requester.dispose();
  await staff.dispose();
});
