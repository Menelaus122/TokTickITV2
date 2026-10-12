import { APIRequestContext, Browser, BrowserContext, Locator, Page, expect, test } from "@playwright/test";
import { API_URL, BASE_URL } from "../../playwright.config.js";
import {
  ACCOUNTS as LAB3_ACCOUNTS,
  RUN,
  SEED_PASSWORD,
  apiAs,
  createTicketAs,
  deactivateCreatedUsers,
  fillLogin,
  hasHorizontalOverflow,
  logOut,
  signIn,
  trackCreatedUser,
} from "../lab-03/helpers.js";

// Shared helpers for the Lab 4 end-to-end and responsive suites
// (docs/lab-04/tests.md §2.10, §2.11).
//
// Like Labs 2 and 3, these act only as people would: through the screens, or
// through the API signed in as a real account. They never reach into the
// database. Tickets cannot be deleted and accounts only deactivated (BR-50), so
// every run leaves rows behind on the development database; no suite changes a
// seeded account's password or state, and the accounts a suite needs to change
// it creates first, with an email unique to the run.

export { RUN, SEED_PASSWORD, apiAs, createTicketAs, deactivateCreatedUsers, fillLogin, hasHorizontalOverflow, logOut, signIn, trackCreatedUser };

/** Seeded accounts (specification.md §7.5): Lab 3's, and the two Lab 4 added. */
export const ACCOUNTS = {
  ...LAB3_ACCOUNTS,
  /** A Requester with no Tickets at all: the dashboard's all-zero case. */
  noTickets: { name: "Ratree Chaiwat", email: "no.tickets@toktickit.local" },
  /** An IT Staff member with no work: the staff dashboard's zero case for "me". */
  idleStaff: { name: "Worawut Intarat", email: "idle.it@toktickit.local" },
  secondAdmin: { name: "Kittisak Phromma", email: "kittisak.admin@toktickit.local" },
} as const;

// The three viewports ui-spec §12 names for Lab 4: the same as Lab 3's.
export const LAB4_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof LAB4_VIEWPORTS;
export const VIEWPORT_NAMES = Object.keys(LAB4_VIEWPORTS) as ViewportName[];

export const SHOTS = "artifacts/lab-04/screenshots";

/**
 * Saves a screenshot under artifacts/lab-04/screenshots/<folder>/<shot>-<viewport>.png.
 *
 * Whole page by default, which is what a dashboard or a short screen is. A tall screen is shot by
 * the part the picture is about: `element` is that part, drawn at its full height; `through` is the
 * stretch from the top of `element` to the bottom of `through`. `fullPage: false` is the window, for
 * a fixed layer: a whole-page capture stretches the page past it and shows what no user ever sees.
 */
export async function shoot(
  page: Page,
  folder: string,
  shot: string,
  viewport: ViewportName,
  options: { fullPage?: boolean; element?: Locator; through?: Locator } = {},
) {
  // The pointer is left where the last click was, which would draw that control as hovered in the picture.
  await page.mouse.move(0, 0);
  const path = `${SHOTS}/${folder}/${shot}-${viewport}.png`;
  if (options.element && options.through) {
    const top = await options.element.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const bottom = await options.through.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    await page.screenshot({ path, fullPage: true, clip: { x: 0, y: Math.max(0, top - 16), width: LAB4_VIEWPORTS[viewport].width, height: bottom - top + 32 } });
  } else if (options.element) {
    await options.element.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: options.fullPage ?? true });
  }
}

// ---- the API, signed in as a real account ------------------------------------------------------------------

export interface StaffTicket {
  id: number;
  ticketNumber: string;
  currentStatus: string;
  itPriority: string;
  version: number;
  createdAt: string;
  owner: { id: number; fullName: string; role: string; isActive: boolean } | null;
  permittedTransitions: string[];
  blockedTransitions: { to: string; code: string; message: string }[];
}

export interface ActionTakenRow {
  id: number;
  version: number;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  performedBy: { id: number; fullName: string; role: string };
  updatedBy: { id: number; fullName: string } | null;
  /** When the row was recorded, by the server's clock: what "newest recorded" is decided by (BR-17). */
  createdAt: string;
}

/**
 * `rows` newest first by `stamp`, then by `id`: the order the dashboards sort their newest-first lists in. A test builds
 * rows a fraction of a second apart, and the development stack's clock steps back about 0.7 s every 33 s (tests.md §7), so
 * the order they were made in is not always the order they were stamped in. A list is therefore checked against the
 * stamps the server holds, which is what the rule sorts by; and a run that was stepped over says so in its report
 * (`madeNewestFirst` is the ids in the order they were made, newest first).
 */
export function newestFirst<T extends { id: number }>(rows: T[], stamp: (row: T) => string, madeNewestFirst?: number[]): T[] {
  const sorted = [...rows].sort((a, b) => Date.parse(stamp(b)) - Date.parse(stamp(a)) || b.id - a.id);
  if (madeNewestFirst && sorted.some((row, index) => row.id !== madeNewestFirst[index])) {
    test.info().annotations.push({
      type: "clock-step",
      description: `rows made in quick succession were stamped out of the order they were made in: ${sorted.map((row) => row.id).join(", ")}`,
    });
  }
  return sorted;
}

/** The account a signed-in API context acts as. */
export async function whoAmI(context: APIRequestContext): Promise<{ id: number; fullName: string }> {
  const res = await context.get("/api/auth/me");
  expect(res.status(), "who am I").toBe(200);
  return ((await res.json()) as { user: { id: number; fullName: string } }).user;
}

/** A Ticket as IT Staff see it, with its version and the moves it can make now. */
export async function staffTicket(staff: APIRequestContext, id: number): Promise<StaffTicket> {
  const res = await staff.get(`/api/staff/tickets/${id}`);
  expect(res.status(), `read ticket ${id}`).toBe(200);
  return ((await res.json()) as { ticket: StaffTicket }).ticket;
}

/** The signed-in member claims an unowned Ticket (a NEW one becomes OPEN). */
export async function claimTicket(staff: APIRequestContext, id: number) {
  const me = await whoAmI(staff);
  const ticket = await staffTicket(staff, id);
  const res = await staff.patch(`/api/staff/tickets/${id}/owner`, {
    data: { ownerId: me.id, expectedOwnerId: null, expectedVersion: ticket.version },
  });
  expect(res.status(), `claim ticket ${id}`).toBe(200);
}

/** Moves a Ticket to `status` as the signed-in member, reading its version first. */
export async function moveTicket(staff: APIRequestContext, id: number, status: string, reason = "Moved by the Lab 4 end-to-end suite.") {
  const ticket = await staffTicket(staff, id);
  const res = await staff.patch(`/api/staff/tickets/${id}/status`, {
    data: { currentStatus: status, reason, expectedVersion: ticket.version },
  });
  expect(res.status(), `move ticket ${id} to ${status}: ${await res.text()}`).toBe(200);
}

/**
 * The server's clock, read from the Date header of any answer, plus three seconds. The header has a
 * resolution of one second and is cached by the server for up to one more, so it can be two seconds
 * behind; and the host's own clock can be seconds off the container's (Docker Desktop lets them
 * drift). An action cannot be dated before its Ticket existed (BR-06), so a test that dates one
 * "now" by the wrong clock, right after creating the Ticket, can be refused for a reason that has
 * nothing to do with it. Three seconds ahead is far inside the five minutes the server allows.
 */
export async function serverNow(context: APIRequestContext): Promise<Date> {
  const res = await context.get("/api/health");
  return new Date(new Date(res.headers()["date"]).getTime() + 3000);
}

/**
 * A time an action on `ticketId` may carry: the server's clock, but never earlier than a second after the
 * Ticket was created. The Docker Desktop VM's clock steps now and then, so a time taken from the clock
 * alone, a few calls after the Ticket was made, can still come out before it (BR-06), and the run is then
 * refused for a reason that has nothing to do with what it tests.
 */
export async function actionTime(staff: APIRequestContext, ticketId: number): Promise<Date> {
  const clock = (await serverNow(staff)).getTime();
  const created = new Date((await staffTicket(staff, ticketId)).createdAt).getTime() + 1000;
  return new Date(Math.max(clock, created));
}

/** Records an Action Taken as the signed-in member, dated now by the server's clock. */
export async function recordAction(
  staff: APIRequestContext,
  id: number,
  overrides: Partial<{
    description: string;
    result: string;
    followUpRequired: boolean;
    followUpNote: string;
    actionAt: string;
    attachmentNotes: string;
  }> = {},
): Promise<ActionTakenRow> {
  const res = await staff.post(`/api/staff/tickets/${id}/actions-taken`, {
    data: {
      actionAt: (await actionTime(staff, id)).toISOString(),
      description: "Checked the device and restarted the service.",
      result: "The service came back up.",
      followUpRequired: false,
      ...overrides,
    },
  });
  expect([200, 201], `record action on ${id}: ${await res.text()}`).toContain(res.status());
  return ((await res.json()) as { action: ActionTakenRow }).action;
}

/** Every Action Taken on a Ticket, in the order the API reads them. */
export async function actionsOf(context: APIRequestContext, id: number): Promise<ActionTakenRow[]> {
  const res = await context.get(`/api/tickets/${id}/actions-taken`);
  expect(res.status(), `read actions of ${id}`).toBe(200);
  return ((await res.json()) as { actions: ActionTakenRow[] }).actions;
}

/** A Ticket brought to `status` through the real moves, so its history and actions are genuine. */
export async function ticketAt(
  requester: APIRequestContext,
  staff: APIRequestContext,
  summary: string,
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED",
  priority = "MEDIUM",
) {
  const ticket = await createTicketAs(requester, summary, priority);
  if (status === "NEW") return ticket;
  if (status === "CANCELLED") {
    await claimTicket(staff, ticket.id);
    await moveTicket(staff, ticket.id, "CANCELLED", "Cancelled by the Lab 4 end-to-end suite.");
    return ticket;
  }
  await claimTicket(staff, ticket.id); // NEW -> OPEN, owned by the signed-in member
  if (status === "OPEN") return ticket;
  await moveTicket(staff, ticket.id, "IN_PROGRESS");
  if (status === "IN_PROGRESS") return ticket;
  if (status === "WAITING_FOR_REQUESTER") {
    await moveTicket(staff, ticket.id, "WAITING_FOR_REQUESTER");
    return ticket;
  }
  await recordAction(staff, ticket.id); // the gate (BR-17)
  await moveTicket(staff, ticket.id, "RESOLVED", "Resolved by the Lab 4 end-to-end suite.");
  if (status === "RESOLVED") return ticket;
  if (status === "CLOSED") {
    await moveTicket(staff, ticket.id, "CLOSED", "Closed by the Lab 4 end-to-end suite.");
    return ticket;
  }
  await moveTicket(staff, ticket.id, "REOPENED", "Reopened by the Lab 4 end-to-end suite.");
  return ticket;
}

// ---- an account made for one run -------------------------------------------------------------------------

export interface MadeAccount {
  name: string;
  email: string;
  password: string;
}

/**
 * A Requester created through the Administrator's API with the forced password change already
 * done through the account's own API, so the suite can sign in on the real Login screen and
 * land on the Dashboard. Its dashboard starts at zero and holds only what the suite creates,
 * which is what lets a test state the exact figures it expects instead of copying them from
 * the screen. Deactivated afterwards by deactivateCreatedUsers.
 */
export async function makeRequester(label: string, fullName?: string): Promise<MadeAccount> {
  const name = fullName ?? `E2E ${label} ${RUN}`;
  const email = `e2e.${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${RUN}@example.test`;
  const initial = "Initial#2026";
  const password = `Fresh-${RUN}#2026`;

  const admin = await apiAs(ACCOUNTS.admin.email);
  const created = await admin.post("/api/admin/users", {
    data: { fullName: name, email, role: "REQUESTER", isActive: true, initialPassword: initial },
  });
  expect(created.status(), `create ${email}`).toBe(201);
  trackCreatedUser(email);
  await admin.dispose();

  const own = await apiAs(email, initial);
  const changed = await own.post("/api/auth/password", {
    data: { currentPassword: initial, newPassword: password, confirmPassword: password },
  });
  expect(changed.status(), `change the initial password of ${email}: ${await changed.text()}`).toBe(200);
  await own.dispose();
  return { name, email, password };
}

/** A second, independent browser session: a person at another desk. */
export async function newSession(browser: Browser, viewport: { width: number; height: number } = LAB4_VIEWPORTS.desktop): Promise<{ context: BrowserContext; page: Page }> {
  // A context made from the browser does not inherit the config's baseURL, so it is given here.
  const context = await browser.newContext({ viewport, baseURL: BASE_URL });
  return { context, page: await context.newPage() };
}

// ---- reading the screen -------------------------------------------------------------------------------------

/** The Ticket Number links and the total a list screen reports: "Showing 10 of 57". */
export async function listTotal(page: Page): Promise<number> {
  const text = (await page.getByTestId("result-count").innerText()).trim();
  const match = /^Showing \d+ of (\d+)$/.exec(text);
  if (!match) throw new Error(`Unexpected result count text: "${text}"`);
  return Number(match[1]);
}

export interface QueueRow {
  id: number;
  ticketNumber: string;
  itPriority: string;
  currentStatus: string;
  owner: { id: number } | null;
  createdAt: string;
  updatedAt: string;
}

/** Every Ticket in the queue, read page by page: the second query a dashboard figure is checked against (AC-19). */
export async function allQueueTickets(staff: APIRequestContext): Promise<QueueRow[]> {
  const rows: QueueRow[] = [];
  for (let page = 1; ; page++) {
    const res = await staff.get("/api/staff/tickets", { params: { pageSize: "50", page: String(page) } });
    expect(res.status(), `read queue page ${page}`).toBe(200);
    const body = (await res.json()) as { tickets: QueueRow[]; totalPages: number };
    rows.push(...body.tickets);
    if (page >= body.totalPages) return rows;
  }
}

/** Every Ticket a Requester has, read page by page. */
export async function allOwnTickets(requester: APIRequestContext): Promise<{ id: number; ticketNumber: string; currentStatus: string; updatedAt: string }[]> {
  const rows: { id: number; ticketNumber: string; currentStatus: string; updatedAt: string }[] = [];
  for (let page = 1; ; page++) {
    const res = await requester.get("/api/tickets", { params: { pageSize: "50", page: String(page) } });
    expect(res.status(), `read My Tickets page ${page}`).toBe(200);
    const body = (await res.json()) as { data: typeof rows; meta: { totalPages: number } };
    rows.push(...body.data);
    if (page >= body.meta.totalPages) return rows;
  }
}

/** The statuses that are "open" (BR-31): everything but Resolved, Closed, and Cancelled. */
export const OPEN_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
export const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status);

/** A date as a datetime-local input holds it: the browser's local time, to the minute ("2026-10-05T10:30"). */
export function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The region of an IT Staff Ticket Detail that holds the Actions Taken. */
export const actionsRegion = (page: Page) => page.getByRole("region", { name: /^Actions Taken/ });
/** The Operational region of an IT Staff Ticket Detail: owner, priority, and the status control. */
export const operationalRegion = (page: Page) => page.getByRole("region", { name: "Operational" });
/** The Status History region, on either screen. */
export const historyRegion = (page: Page) => page.getByRole("region", { name: "Status History" });

/** The Status History as the screen lists it: "Ticket created", then "New → Open" and so on, with who made each move. */
export async function timelineSteps(page: Page): Promise<{ what: string; who: string }[]> {
  return historyRegion(page)
    .locator("li.tt-timeline__step")
    .evaluateAll((items) =>
      items.map((item) => {
        const badges = [...item.querySelectorAll('.tt-timeline__what [data-badge="status"]')].map((badge) => badge.textContent!.trim());
        const who = item.querySelector(".tt-timeline__who");
        return {
          what: badges.length > 0 ? badges.join(" → ") : item.querySelector(".tt-timeline__what")!.textContent!.trim(),
          who: who ? who.textContent!.replace(/\s+/g, " ").trim() : "",
        };
      }),
    );
}

const STATUS_WORDS: Record<string, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

/**
 * Whether the Status History the screen shows differs from `expected` only because the server's clock stepped backwards
 * between two moves, and whether the application is right to show it so. The API orders the history by `createdAt`, then
 * `id` (BR-22). The development stack's Docker VM steps its clock back by about 0.7 s every 33 s (tests.md §7), and two
 * moves a quarter of a second apart on either side of a step are stored with the second one stamped earlier, so the
 * list shows them swapped. That is the rule working on the data it was given, not a defect, and it must not fail a test of
 * something else. It is accepted only when the API's own rows prove all of it: taken in the order they were made (by
 * `id`) they are exactly the moves expected; their stamps run backwards somewhere; and the screen shows precisely what
 * the API sorted. A list that is wrong for any other reason, such as an ordering bug or a missing step, is still a failure.
 */
async function swappedByAClockStep(page: Page, shown: string[], expected: string[]): Promise<boolean> {
  const id = /\/(?:queue|tickets)\/(\d+)/.exec(new URL(page.url()).pathname)?.[1];
  if (!id) return false;
  const res = await page.request.get(`${API_URL}/api/tickets/${id}/status-history`);
  if (!res.ok()) return false;
  const rows = ((await res.json()) as { history: { id: number; fromStatus: string; toStatus: string; createdAt: string }[] }).history;
  const words = (row: { fromStatus: string; toStatus: string }) => `${STATUS_WORDS[row.fromStatus]} → ${STATUS_WORDS[row.toStatus]}`;
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);
  const inOrderMade = [...rows].sort((a, b) => a.id - b.id);
  const stampedBackwards = inOrderMade.some((row, index) => index > 0 && Date.parse(row.createdAt) < Date.parse(inOrderMade[index - 1].createdAt));
  const explained =
    stampedBackwards &&
    sameList(["Ticket created", ...inOrderMade.map(words)], expected) &&
    sameList(shown, ["Ticket created", ...rows.map(words)]);
  if (explained) {
    test.info().annotations.push({ type: "clock-step", description: `the Status History of Ticket ${id} is in the order of its stamps; two moves were stamped backwards` });
  }
  return explained;
}

/**
 * The Status History once it shows exactly `expected`. The screen reads it again after a move, a moment after
 * the message that says the move was made, so a test that reads it at once can see the list one step short.
 * The one other thing accepted is a pair of moves the server's clock stepped over (see `swappedByAClockStep`).
 */
export async function settledTimeline(page: Page, expected: string[]): Promise<{ what: string; who: string }[]> {
  await expect
    .poll(
      async () => {
        const shown = (await timelineSteps(page)).map((step) => step.what);
        const same = shown.length === expected.length && shown.every((item, index) => item === expected[index]);
        return same || (await swappedByAClockStep(page, shown, expected)) ? expected : shown;
      },
      { message: "the Status History", timeout: 10_000 },
    )
    .toEqual(expected);
  return timelineSteps(page);
}

/** The ids and statuses of a Ticket's history rows, from the API: one row per change that succeeded (AC-13). */
export async function historyOf(context: APIRequestContext, id: number): Promise<{ id: number; fromStatus: string; toStatus: string }[]> {
  const res = await context.get(`/api/tickets/${id}/status-history`);
  expect(res.status(), `read the history of ${id}`).toBe(200);
  return ((await res.json()) as { history: { id: number; fromStatus: string; toStatus: string }[] }).history;
}

/** Fills the create form of the Actions Taken region and leaves it open. */
export async function fillAction(
  page: Page,
  values: { description: string; result: string; followUp?: { note: string }; attachmentNotes?: string },
) {
  const form = actionsRegion(page).getByRole("form", { name: "Record an action" });
  await form.getByLabel(/^Action Description/).fill(values.description);
  await form.getByLabel(/^Result/).fill(values.result);
  if (values.followUp) {
    await form.getByRole("radio", { name: "Yes" }).check();
    await form.getByLabel(/^Follow-up Note/).fill(values.followUp.note);
  }
  if (values.attachmentNotes) await form.getByLabel(/^Attachment Notes/).fill(values.attachmentNotes);
  return form;
}

/** Records one action through the screen: opens the form, fills it, saves it, and waits for the confirmation. */
export async function recordActionOnScreen(
  page: Page,
  values: { description: string; result: string; followUp?: { note: string }; attachmentNotes?: string },
) {
  await actionsRegion(page).getByRole("button", { name: "+ Add action" }).click();
  const form = await fillAction(page, values);
  await form.getByRole("button", { name: "Save action" }).click();
  await expect(page.getByText("Action recorded.")).toBeVisible();
}

// ---- what a screen must be at every width (ui-spec §10, §11; RESP-06) ----------------------------------------

/**
 * Looks at the screen as it is drawn and names everything that breaks a rule of ui-spec §10 and §11:
 *
 *  - the page scrolls sideways;
 *  - an element sticks out of the window, or hides part of its own content behind an edge (the one-line
 *    summaries that end in an ellipsis are meant to, and are left alone);
 *  - content spills out of the table cell or the card it belongs to;
 *  - two controls overlap;
 *  - a control cannot take keyboard focus, or takes it with no outline and no shadow to show where it is.
 *
 * It reads geometry and computed style only, so it is as true on a phone as on a desktop. The caller presses
 * Tab once first: focus moved by a script after a key press counts as keyboard focus, which is what
 * `:focus-visible` needs to draw its outline.
 */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const doc = document.documentElement;
    const width = doc.clientWidth;
    if (doc.scrollWidth > width + 1) problems.push(`the page scrolls sideways: it is ${doc.scrollWidth}px wide in a ${width}px window`);

    const describe = (el: Element) => {
      const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      const cls = (el.getAttribute("class") ?? "").split(/\s+/)[0];
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${text}"`;
    };
    const drawn = (el: Element) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false; // none, or a visually hidden label
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && !el.closest("[aria-hidden='true']");
    };

    const everything = [...document.body.querySelectorAll("*")].filter((el) => !["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName) && drawn(el));
    for (const el of everything) {
      const rect = el.getBoundingClientRect();
      if (rect.right > width + 1 || rect.left < -1) problems.push(`sticks out of the window (${Math.round(rect.left)} to ${Math.round(rect.right)} of ${width}): ${describe(el)}`);
      const style = getComputedStyle(el);
      const hides = ["hidden", "clip"].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (hides && style.textOverflow !== "ellipsis") problems.push(`hides content behind its edge (${el.scrollWidth}px in ${el.clientWidth}px): ${describe(el)}`);
    }

    // Content that spills out of the cell or the card it belongs to: inside the window, so the check above does not see it, but
    // drawn over its neighbour or over the page behind the card (a pill wider than its table column did this at 820 px).
    for (const el of everything) {
      const container = el.parentElement?.closest("td, th, .tt-card, .tt-metric, .tt-dash-row");
      if (!container || !drawn(container)) continue;
      const inner = el.getBoundingClientRect();
      const outer = container.getBoundingClientRect();
      // A few pixels is the cell's own padding taking the end of a line of text; more than that is drawn over something.
      if (inner.right > outer.right + 4 || inner.left < outer.left - 4) {
        problems.push(`spills out of its ${container.tagName.toLowerCase()} (${Math.round(inner.left)} to ${Math.round(inner.right)}, the ${container.tagName.toLowerCase()} is ${Math.round(outer.left)} to ${Math.round(outer.right)}): ${describe(el)}`);
      }
    }

    const controlSelector = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1'])";
    const controls = [...document.body.querySelectorAll(controlSelector)].filter(drawn);
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i];
        const b = controls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const across = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const down = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (across > 2 && down > 2) problems.push(`overlap: ${describe(a)} and ${describe(b)}`);
      }
    }

    for (const el of controls) {
      const control = el as HTMLElement;
      if (control.matches(":disabled") || control.closest("fieldset:disabled")) continue; // a disabled control takes no focus, by design
      control.focus({ preventScroll: true });
      if (document.activeElement !== control) {
        problems.push(`cannot take keyboard focus: ${describe(el)}`);
        continue;
      }
      const style = getComputedStyle(control);
      const outlined = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      if (!outlined && style.boxShadow === "none") problems.push(`takes focus with nothing to show it: ${describe(el)}`);
    }
    (document.activeElement as HTMLElement | null)?.blur();
    return problems;
  });
}

/** Fails, naming every problem found, when the screen breaks a layout or focus rule. Call it after the screenshot: it moves focus. */
export async function expectSound(page: Page, label: string) {
  await page.keyboard.press("Tab");
  const problems = await layoutProblems(page);
  expect(problems, `${label}: ${problems.length} layout or focus problem(s)\n  ${problems.join("\n  ")}`).toEqual([]);
}

/** A colour token, as the browser computes it ("rgb(0, 107, 60)"), so a test compares what is drawn with what the stylesheet defines. */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
}

/** How many lines the text of an element is drawn on: the distinct tops of the boxes its text occupies. */
export async function linesOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size;
  });
}
