import { test, expect, request as playwrightRequest, Locator, Page } from "@playwright/test";
import { API_URL } from "../../playwright.config.js";
import {
  ACCOUNTS,
  OPEN_STATUSES,
  type QueueRow,
  RUN,
  actionsOf,
  actionsRegion,
  allOwnTickets,
  allQueueTickets,
  apiAs,
  claimTicket,
  createTicketAs,
  deactivateCreatedUsers,
  fillLogin,
  historyOf,
  isOpen,
  listTotal,
  logOut,
  makeRequester,
  operationalRegion,
  recordAction,
  recordActionOnScreen,
  actionTime,
  signIn,
  staffTicket,
  ticketAt,
  settledTimeline,
  whoAmI,
} from "./helpers.js";

// E2E-05, E2E-06 and E2E-07 — the three dashboards and the Administrator's reach through the screen
// (docs/lab-04/tests.md §2.11; AC-02, AC-17 to AC-21, AC-34; labsheet Parts 5 and 8).
//
// A dashboard figure is never compared with itself. Each is checked against a second query the test
// makes for itself: the exact counts of a Requester made for the run and given Tickets in known
// statuses, and a tally of the whole queue and of the whole user list read through their own
// endpoints. Following a card is checked by reading the total the list it opens reports.

test.afterAll(deactivateCreatedUsers);

// ---- reading a dashboard ---------------------------------------------------------------------------------

/** The number on a link named "<label>: <n>. View all", inside `scope`. */
async function valueOf(scope: Locator, label: string): Promise<number> {
  const link = scope.getByRole("link", { name: new RegExp(`^${label}: \\d+\\. View all$`) }).first();
  return Number(/: (\d+)\./.exec((await link.getAttribute("aria-label")) ?? "")![1]);
}

/** The Ticket Numbers a dashboard list shows, in the order it shows them. */
async function numbersIn(page: Page, region: string): Promise<string[]> {
  return page.getByRole("region", { name: region }).locator(".tt-dash-row__number").allInnerTexts();
}

/** Follows a card or a status row, and returns the address it opened. */
async function follow(page: Page, scope: Locator, label: string) {
  await scope.getByRole("link", { name: new RegExp(`^${label}: \\d+\\. View all$`) }).first().click();
}

/** The list a drill-down opened reports `total`; an empty one says there is nothing, and the number is 0. */
async function expectTotal(page: Page, total: number, label: string) {
  if (total === 0) {
    await expect(page.getByText(/No tickets/).first(), `${label}: an empty list`).toBeVisible();
    return;
  }
  await expect.poll(() => listTotal(page).catch(() => -1), { message: `${label}: the list's total` }).toBe(total);
}

const backToDashboard = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();

// ---- E2E-05 --------------------------------------------------------------------------------------------------

test("E2E-05 a Requester lands on their Dashboard, the figures are their own, and each card opens the list that matches it", async ({ page }) => {
  test.setTimeout(150_000);
  const account = await makeRequester("Dash");
  const own = await apiAs(account.email, account.password);
  const staff = await apiAs(ACCOUNTS.staff.email);
  const other = await apiAs(ACCOUNTS.otherRequester.email);

  // Seven Tickets in known statuses: four are open, one of them waiting for this Requester; one each of
  // Resolved and Closed; and one Cancelled, which belongs to no open figure (BR-31).
  const made: Record<string, { id: number; ticketNumber: string }> = {};
  for (const status of ["NEW", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const) {
    made[status] = await ticketAt(own, staff, `E2E dashboard ${status} ${RUN}`, status);
  }
  // Another Requester's Ticket, made last so that, if the dashboard leaked, it would be the newest of all.
  const foreign = await createTicketAs(other, `E2E dashboard somebody else's ${RUN}`);

  // --- signing in lands on the Dashboard, marked as the current page (AC-34) ------------------------------------
  await fillLogin(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("current-user")).toHaveText(account.name);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, E2E");
  const dashboardLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" });
  await expect(dashboardLink).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText(["Dashboard", "My Tickets", "Create Ticket"]);

  // --- the four figures are exactly what the Tickets say, and a second query agrees -----------------------------
  const cards = page.getByLabel("Your tickets at a glance");
  const figures = { open: 4, waiting: 1, resolved: 1, closed: 1 };
  expect(await valueOf(cards, "Open Tickets")).toBe(figures.open);
  expect(await valueOf(cards, "Waiting for You")).toBe(figures.waiting);
  expect(await valueOf(cards, "Resolved")).toBe(figures.resolved);
  expect(await valueOf(cards, "Closed")).toBe(figures.closed);
  const mine = await allOwnTickets(own);
  expect(mine, "the Requester's own list holds the seven").toHaveLength(7);
  expect(mine.filter((row) => isOpen(row.currentStatus))).toHaveLength(figures.open);
  expect(mine.filter((row) => row.currentStatus === "WAITING_FOR_REQUESTER")).toHaveLength(figures.waiting);

  // --- the two lists hold the right Tickets in the right order (BR-33) ----------------------------------------
  expect(await numbersIn(page, "Needs your attention")).toEqual([made.WAITING_FOR_REQUESTER.ticketNumber]);
  // Newest change first, five at most: the seventh Ticket (the oldest) is the one left out.
  expect(await numbersIn(page, "Recently updated")).toEqual(
    [made.CANCELLED, made.CLOSED, made.RESOLVED, made.REOPENED, made.WAITING_FOR_REQUESTER].map((ticket) => ticket.ticketNumber),
  );
  await expect(page.getByRole("region", { name: "Recently updated" }).getByRole("link", { name: new RegExp(made.CANCELLED.ticketNumber) })).toContainText("Cancelled");

  // --- nobody else's Ticket is anywhere on the page ------------------------------------------------------------
  await expect(page.getByText(foreign.ticketNumber)).toHaveCount(0);
  await expect(page.getByText(`somebody else's`)).toHaveCount(0);

  // --- each card opens My Tickets with a list whose total is the card's number (AC-21) -------------------------
  const drill: [string, number, RegExp][] = [
    ["Open Tickets", figures.open, /\/tickets\?group=open$/],
    ["Waiting for You", figures.waiting, /\/tickets\?status=WAITING_FOR_REQUESTER$/],
    ["Resolved", figures.resolved, /\/tickets\?status=RESOLVED$/],
    ["Closed", figures.closed, /\/tickets\?status=CLOSED$/],
  ];
  for (const [label, value, address] of drill) {
    await follow(page, page.getByLabel("Your tickets at a glance"), label);
    await expect(page).toHaveURL(address);
    await expectTotal(page, value, label);
    await expect(page.getByText(foreign.ticketNumber)).toHaveCount(0);
    await backToDashboard(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  // The open group says so on the list it opens, as a chip that can be removed.
  await follow(page, page.getByLabel("Your tickets at a glance"), "Open Tickets");
  await expect(page.getByText("Open tickets", { exact: true })).toBeVisible();
  await backToDashboard(page);

  // "View all" beside Recently updated opens My Tickets with no filter: all seven.
  await page.getByRole("region", { name: "Recently updated" }).getByRole("link", { name: /^View all/ }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expectTotal(page, 7, "My Tickets");
  await backToDashboard(page);

  // --- the figures follow the data: one more Ticket, one Refresh, and the card says so ---------------------------
  const extra = await createTicketAs(own, `E2E dashboard refresh ${RUN}`);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => valueOf(page.getByLabel("Your tickets at a glance"), "Open Tickets")).toBe(figures.open + 1);
  expect((await numbersIn(page, "Recently updated"))[0]).toBe(extra.ticketNumber);

  // --- the API holds the line the screen drew: a Requester cannot open another's Ticket (AC-02) -------------------
  expect((await own.get(`/api/tickets/${foreign.id}`)).status()).toBe(404);
  expect((await own.get("/api/staff/dashboard")).status(), "a Requester has no staff dashboard").toBe(403);

  await own.dispose();
  await staff.dispose();
  await other.dispose();
});

test("E2E-05 a Requester with no Tickets sees zeros that are zeros, and empty lists that say so", async ({ page }) => {
  await signIn(page, ACCOUNTS.noTickets.email, ACCOUNTS.noTickets.name);
  await expect(page).toHaveURL(/\/dashboard$/);
  const cards = page.getByLabel("Your tickets at a glance");
  for (const label of ["Open Tickets", "Waiting for You", "Resolved", "Closed"]) {
    expect(await valueOf(cards, label), label).toBe(0);
  }
  // A zero is drawn as 0 and keeps its link (BR-39).
  await expect(cards.getByRole("link")).toHaveCount(4);
  await expect(cards.locator(".tt-metric__value")).toHaveText(["0", "0", "0", "0"]);
  await expect(page.getByRole("region", { name: "Needs your attention" })).toContainText("Nothing is waiting on you.");
  await expect(page.getByRole("region", { name: "Recently updated" })).toContainText("You have no tickets yet.");
  await expect(page.getByRole("region", { name: "Recently updated" }).getByRole("link", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Quick actions" }).getByRole("link", { name: "Create Ticket" })).toBeVisible();
  // Neither list is hidden, so the page does not jump (BR-39).
  await expect(page.getByRole("region", { name: "Needs your attention" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recently updated" })).toBeVisible();

  // A zero card still opens its list, which is empty.
  await cards.getByRole("link", { name: /^Open Tickets: 0\./ }).click();
  await expect(page).toHaveURL(/\/tickets\?group=open$/);
  await expectTotal(page, 0, "Open Tickets");
});

// ---- E2E-06 --------------------------------------------------------------------------------------------------

/** What the dashboard's figures must be, worked out from the whole queue by the test itself (BR-31, BR-34 to BR-36). */
function tally(rows: QueueRow[], me: number) {
  const open = rows.filter((row) => isOpen(row.currentStatus));
  const mine = open.filter((row) => row.owner?.id === me);
  const urgent = open.filter((row) => row.itPriority === "URGENT");
  return {
    unassigned: open.filter((row) => row.owner === null).length,
    assignedToMe: mine.length,
    waitingForRequester: rows.filter((row) => row.currentStatus === "WAITING_FOR_REQUESTER").length,
    urgent: urgent.length,
    byStatus: OPEN_STATUSES.map((status) => [status, rows.filter((row) => row.currentStatus === status).length] as const),
    myTickets: mine
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)
      .slice(0, 5)
      .map((row) => row.ticketNumber),
    urgentTickets: urgent
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      .slice(0, 5)
      .map((row) => row.ticketNumber),
  };
}

const STATUS_NAME: Record<string, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  REOPENED: "Reopened",
};

/** Opens the Dashboard as `who`, checks every figure and list against the tally, and follows each link. */
async function checkStaffDashboard(page: Page, who: { email: string; name: string }) {
  const api = await apiAs(who.email);
  const me = await whoAmI(api);
  // Real work for the "me" figures and for My Recent Actions: a Ticket the member claims and records two actions on.
  const requester = await apiAs(ACCOUNTS.requester.email);
  const work = await createTicketAs(requester, `E2E staff dashboard ${who.name} ${RUN}`, "URGENT");
  await requester.dispose();
  await claimTicket(api, work.id);
  const when = await actionTime(api, work.id);
  await recordAction(api, work.id, { description: "First thing done on the Ticket.", result: "Nothing changed yet.", actionAt: when.toISOString() });
  await recordAction(api, work.id, {
    description: "Second thing done on the Ticket, which still needs a look tomorrow.",
    result: "Partly fixed.",
    followUpRequired: true,
    followUpNote: "Look at it again tomorrow morning.",
    actionAt: when.toISOString(),
  });
  const expected = tally(await allQueueTickets(api), me.id);

  await signIn(page, who.email, who.name);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Welcome back, ${who.name.split(" ")[0]}`);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

  // --- every card and status row equals the tally -----------------------------------------------------------------
  const cards = page.getByLabel("Your queue at a glance");
  const statusRow = page.getByRole("region", { name: "By status" });
  const figures: [string, number][] = [
    ["Unassigned", expected.unassigned],
    ["Assigned to Me", expected.assignedToMe],
    ["Waiting for Requester", expected.waitingForRequester],
    ["Urgent", expected.urgent],
  ];
  for (const [label, value] of figures) expect(await valueOf(cards, label), label).toBe(value);
  for (const [status, value] of expected.byStatus) expect(await valueOf(statusRow, STATUS_NAME[status]), STATUS_NAME[status]).toBe(value);
  expect(expected.byStatus.map(([status]) => status), "five open statuses, in order").toEqual([...OPEN_STATUSES]);
  expect(expected.assignedToMe, "the member has work").toBeGreaterThan(0);

  // --- the lists hold the right Tickets in the right order ------------------------------------------------------
  expect(await numbersIn(page, "My Tickets")).toEqual(expected.myTickets);
  expect(await numbersIn(page, "Urgent Tickets")).toEqual(expected.urgentTickets);
  // My Recent Actions: newest recorded first, with the follow-up pill telling the two apart.
  const recent = page.getByRole("region", { name: "My Recent Actions" }).locator("a.tt-dash-row");
  await expect(recent.first()).toContainText(work.ticketNumber);
  await expect(recent.first()).toContainText("Second thing done on the Ticket");
  await expect(recent.first()).toContainText("Follow-up needed");
  await expect(recent.nth(1)).toContainText("First thing done on the Ticket.");
  await expect(recent.nth(1)).toContainText("No follow-up");
  expect(await recent.count(), "at most five").toBeLessThanOrEqual(5);

  // --- each link opens the Ticket Queue, filtered, with the card's number as its total (AC-21) -----------------
  const drill: [Locator, string, number, RegExp][] = [
    [cards, "Unassigned", expected.unassigned, /\/queue\?owner=unassigned&group=open$/],
    [cards, "Assigned to Me", expected.assignedToMe, /\/queue\?owner=me&group=open$/],
    [cards, "Waiting for Requester", expected.waitingForRequester, /\/queue\?status=WAITING_FOR_REQUESTER$/],
    [cards, "Urgent", expected.urgent, /\/queue\?itPriority=URGENT&group=open$/],
    ...expected.byStatus.map(([status, value]): [Locator, string, number, RegExp] => [statusRow, STATUS_NAME[status], value, new RegExp(`/queue\\?status=${status}$`)]),
  ];
  for (const [scope, label, value, address] of drill) {
    await follow(page, scope === cards ? page.getByLabel("Your queue at a glance") : page.getByRole("region", { name: "By status" }), label);
    await expect(page, label).toHaveURL(address);
    await expectTotal(page, value, label);
    await backToDashboard(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  // The two lists' View all links agree with their cards.
  await page.getByRole("region", { name: "My Tickets" }).getByRole("link", { name: /^View all/ }).click();
  await expect(page).toHaveURL(/\/queue\?owner=me&group=open$/);
  await expectTotal(page, expected.assignedToMe, "My Tickets, View all");
  await backToDashboard(page);
  await page.getByRole("region", { name: "Urgent Tickets" }).getByRole("link", { name: /^View all/ }).click();
  await expect(page).toHaveURL(/\/queue\?itPriority=URGENT&group=open$/);
  await expectTotal(page, expected.urgent, "Urgent Tickets, View all");
  await backToDashboard(page);

  // The Dashboard takes no query: a hand-typed one changes nothing (BR-37).
  const typed = await api.get("/api/staff/dashboard", { params: { owner: "me", group: "open", userId: "1" } });
  expect(typed.status()).toBe(200);
  await api.dispose();
  return { expected, work };
}

test("E2E-06 an IT Staff member's figures equal a tally of the whole queue, every link opens its list, and there is no accounts region", async ({ page }) => {
  test.setTimeout(150_000);
  await checkStaffDashboard(page, ACCOUNTS.staff);
  // Accounts belong to the Administrator alone (BR-38): there is no region, no heading, and no trace of one.
  await expect(page.getByRole("region", { name: "Accounts" })).toHaveCount(0);
  await expect(page.getByText("Open User Management")).toHaveCount(0);
  const api = await apiAs(ACCOUNTS.staff.email);
  const body = (await (await api.get("/api/staff/dashboard")).json()) as Record<string, unknown>;
  expect(body.userCounts, "IT Staff are not sent the counts").toBeUndefined();
  expect((await api.get("/api/admin/users")).status(), "and are refused the Administrator's routes").toBe(403);
  await api.dispose();
});

test("E2E-06 an Administrator sees the same figures and the accounts as plain numbers beside one link to User Management", async ({ page }) => {
  test.setTimeout(150_000);
  await checkStaffDashboard(page, ACCOUNTS.admin);

  // The four account counts equal the user list read through the Administrator's own endpoint (AC-20).
  const admin = await apiAs(ACCOUNTS.admin.email);
  const users = ((await (await admin.get("/api/admin/users")).json()) as { users: { role: string; isActive: boolean }[] }).users;
  const count = (role: string) => users.filter((user) => user.role === role && user.isActive).length;
  const accounts = page.getByRole("region", { name: "Accounts" });
  await expect(accounts).toBeVisible();
  await expect(accounts).toContainText("Active accounts by role, and inactive accounts counted separately.");
  const expected = [
    ["Requesters", count("REQUESTER")],
    ["IT Staff", count("IT_STAFF")],
    ["Administrators", count("ADMINISTRATOR")],
    ["Inactive", users.filter((user) => !user.isActive).length],
  ] as const;
  for (const [label, value] of expected) {
    const card = accounts.locator(".tt-metric").filter({ has: page.locator(".tt-metric__label", { hasText: new RegExp(`^${label}$`) }) });
    await expect(card.locator(".tt-metric__value"), label).toHaveText(String(value));
    // A plain number: not a link, with no "View all" and no address (BR-40).
    expect(await card.evaluate((el) => el.tagName), `${label} is a <div>`).toBe("DIV");
    await expect(card.getByText("View all")).toHaveCount(0);
  }
  await expect(accounts.getByRole("link")).toHaveCount(1);
  await accounts.getByRole("link", { name: /^Open User Management/ }).click();
  await expect(page).toHaveURL(/\/users$/);
  expect((await admin.get("/api/staff/dashboard")).status()).toBe(200);
  await admin.dispose();
});

test("E2E-06 an IT Staff member with no work sees zeros and empty lists, and the 'me' figures differ between members", async ({ page }) => {
  const idle = await apiAs(ACCOUNTS.idleStaff.email);
  const busy = await apiAs(ACCOUNTS.staff.email);
  const mine = async (context: typeof idle) => ((await (await context.get("/api/staff/dashboard")).json()) as { metrics: { assignedToMe: { value: number } } }).metrics.assignedToMe.value;
  const [idleCount, busyCount] = [await mine(idle), await mine(busy)];
  expect(idleCount, "the idle member has nothing assigned").toBe(0);
  expect(busyCount, "and the other has work").toBeGreaterThan(0);
  await idle.dispose();
  await busy.dispose();

  await signIn(page, ACCOUNTS.idleStaff.email, ACCOUNTS.idleStaff.name);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await valueOf(page.getByLabel("Your queue at a glance"), "Assigned to Me")).toBe(0);
  await expect(page.getByRole("region", { name: "My Tickets" })).toContainText("No tickets are assigned to you.");
  await expect(page.getByRole("region", { name: "My Recent Actions" })).toContainText("You have not recorded any actions yet.");
  // The four cards and the status row always render, and the status counts are everyone's, not the member's.
  await expect(page.getByLabel("Your queue at a glance").getByRole("link")).toHaveCount(4);
  await expect(page.getByRole("region", { name: "By status" }).getByRole("link")).toHaveCount(5);
  await logOut(page);

  await signIn(page, ACCOUNTS.staff.email, ACCOUNTS.staff.name);
  expect(await valueOf(page.getByLabel("Your queue at a glance"), "Assigned to Me")).toBe(busyCount);
});

// ---- E2E-07 --------------------------------------------------------------------------------------------------

test("E2E-07 an Administrator works a Ticket through the screen under their own name, and a Requester is sent away from the queue", async ({ page }) => {
  test.setTimeout(150_000);
  const requester = await apiAs(ACCOUNTS.requester.email);
  const ticket = await createTicketAs(requester, `E2E administrator works a ticket ${RUN}`, "LOW");
  const admin = ACCOUNTS.admin;

  // --- an Administrator opens the queue from the navigation, finds the Ticket, and opens it ------------------------
  await signIn(page, admin.email, admin.name);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Ticket Queue", "User Management"]);
  await nav.getByRole("link", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search number or summary").fill(ticket.ticketNumber);
  await page.getByRole("link", { name: ticket.ticketNumber }).filter({ visible: true }).first().click();
  await expect(page.getByTestId("detail-ticket-number")).toHaveText(ticket.ticketNumber);

  // --- claim, re-prioritise, move, and record: each under the Administrator's name (AC-17) ------------------------
  const operational = operationalRegion(page);
  await operational.getByRole("button", { name: "Claim" }).click();
  await page.getByRole("button", { name: "Confirm claim" }).click();
  await expect(page.getByText(`You claimed ${ticket.ticketNumber}, and it moved to Open.`)).toBeVisible();
  await expect(operational.getByText("You", { exact: true })).toBeVisible();

  await operational.getByLabel("IT Priority").selectOption("HIGH");
  await operational.getByRole("button", { name: "Update IT Priority" }).click();
  await expect(page.getByText("IT Priority is now HIGH.")).toBeVisible();
  await expect(operational.getByLabel("Requested Priority")).toHaveValue("LOW"); // the Requester's choice never changes

  await operational.getByLabel("Move to").selectOption("IN_PROGRESS");
  await operational.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Status changed to In Progress.")).toBeVisible();

  await recordActionOnScreen(page, { description: "Checked the account and reset the lock.", result: "The account is unlocked." });
  const card = actionsRegion(page).locator("li.tt-action").first();
  await expect(card).toContainText(admin.name);
  await expect(card).toContainText("Administrator");

  // --- the API and the history say the same: the Administrator's id, role, and name everywhere -------------------
  const api = await apiAs(admin.email);
  const me = await whoAmI(api);
  const stored = await staffTicket(api, ticket.id);
  expect(stored.owner?.id, "the Owner is the Administrator").toBe(me.id);
  expect(stored.itPriority).toBe("HIGH");
  const actions = await actionsOf(api, ticket.id);
  expect(actions).toHaveLength(1);
  expect([actions[0].performedBy.fullName, actions[0].performedBy.role]).toEqual([admin.name, "ADMINISTRATOR"]);
  const steps = await settledTimeline(page, ["Ticket created", "New → Open", "Open → In Progress"]);
  expect(steps.slice(1).every((step) => step.who === `${admin.name} Administrator`), `every move is the Administrator's: ${JSON.stringify(steps)}`).toBe(true);
  expect((await historyOf(api, ticket.id)).length).toBe(2);
  await api.dispose();
  await logOut(page);

  // --- a Requester typing the queue's address is sent to their own Dashboard, and the API refuses too ----------------
  await signIn(page, ACCOUNTS.requester.email, ACCOUNTS.requester.name);
  for (const typed of ["/queue", `/queue/${ticket.id}`, "/users"]) {
    await page.goto(typed);
    await expect(page, `typed ${typed}`).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("You do not have access to that page.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Anucha");
  }
  for (const route of ["/api/staff/tickets", `/api/staff/tickets/${ticket.id}`, "/api/staff/dashboard", "/api/admin/users"]) {
    expect((await requester.get(route)).status(), `a Requester calling ${route}`).toBe(403);
  }
  const staff = await apiAs(ACCOUNTS.staff.email);
  expect((await staff.get("/api/admin/users")).status(), "IT Staff calling an Administrator route").toBe(403);
  expect((await staff.get("/api/staff/tickets")).status(), "but not a staff route").toBe(200);
  await staff.dispose();
  await requester.dispose();
  const anonymous = await playwrightRequest.newContext({ baseURL: API_URL });
  expect((await anonymous.get("/api/staff/tickets")).status(), "no session").toBe(401);
  expect((await anonymous.get("/api/admin/users")).status(), "no session").toBe(401);
  await anonymous.dispose();
});
