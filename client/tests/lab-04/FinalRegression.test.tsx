import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { computeAccessibleName } from "dom-accessibility-api";
import { ADMIN_BOARD, REQUESTER_TICKET, STAFF_TICKET, mockApi, openApp, signIn, type Mocks, type Visitor } from "./harness.js";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import {
  AttachmentBadge,
  FollowUpPill,
  OwnerPresentation,
  PriorityBadge,
  RoleBadge,
  STATUS_LABEL,
  StatusBadge,
  UserStatusBadge,
  type TicketStatus,
} from "../../src/components/index.js";
import { ApiError, AttachmentError, TicketValidationError, type ActionTaken } from "../../src/api.js";

// Lab 4, Issue 9 — the final regression of the whole application (UI-30 to UI-36 in
// docs/lab-04/tests.md §2.8; specification.md FR-25 to FR-31, BR-53, BR-54; ui-spec §8, §9).
//
// The seam is the rendered application, TokTickITApp, as a person in each role meets it: the router,
// the shell, and every screen. The API client is the system boundary, so it is the only thing
// replaced (harness.tsx). Nothing here reaches into a component.

let mocks: Mocks;

beforeEach(() => {
  mocks = mockApi();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Every screen of Labs 1–4, and the role that meets it (FR-25). */
const SCREENS: Array<[string, Visitor, string]> = [
  ["Login", "SIGNED_OUT", "/login"],
  ["Change Password, required at first sign-in", "MUST_CHANGE", "/change-password"],
  ["Change Password, chosen from the menu", "REQUESTER", "/change-password"],
  ["Requester Dashboard", "REQUESTER", "/dashboard"],
  ["My Tickets", "REQUESTER", "/tickets"],
  ["My Tickets, filtered from a Dashboard card", "REQUESTER", "/tickets?group=open&status=IN_PROGRESS"],
  ["Create Ticket", "REQUESTER", "/tickets/new"],
  ["Requester Ticket Detail", "REQUESTER", "/tickets/42"],
  ["IT Staff Dashboard", "IT_STAFF", "/dashboard"],
  ["Ticket Queue, as IT Staff", "IT_STAFF", "/queue"],
  ["Ticket Queue, filtered from a Dashboard card", "IT_STAFF", "/queue?group=open&owner=me&itPriority=URGENT"],
  ["IT Staff Ticket Detail, as IT Staff", "IT_STAFF", "/queue/12"],
  ["Administrator Dashboard", "ADMINISTRATOR", "/dashboard"],
  ["Ticket Queue, as an Administrator", "ADMINISTRATOR", "/queue"],
  ["IT Staff Ticket Detail, as an Administrator", "ADMINISTRATOR", "/queue/12"],
  ["User Management", "ADMINISTRATOR", "/users"],
];

describe("UI-33 no screen writes to console.error or console.warn (AC-31, FR-30)", () => {
  it.each(SCREENS)("%s", async (_name, visitor, path) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (visitor === "ADMINISTRATOR") mocks.fetchStaffDashboard.mockResolvedValue(ADMIN_BOARD);

    await openApp(visitor, path);
    // Let anything still in flight land: a late state change is where a warning would come from.
    await waitFor(() => expect(document.querySelectorAll('[data-state="loading"]')).toHaveLength(0));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(error.mock.calls, JSON.stringify(error.mock.calls.map((call) => String(call[0]).slice(0, 300)))).toEqual([]);
    expect(warn.mock.calls, JSON.stringify(warn.mock.calls.map((call) => String(call[0]).slice(0, 300)))).toEqual([]);
  });

  it("holds when the API fails, is slow to answer, or says no: the unhappy screens are as quiet as the happy ones", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = new TypeError("Failed to fetch");
    mocks.fetchRequesterDashboard.mockRejectedValue(boom);
    mocks.fetchMyTickets.mockRejectedValue(boom);
    mocks.fetchTicketDetail.mockRejectedValue(new ApiError(404, "NOT_FOUND", "That ticket could not be found."));
    for (const [visitor, path] of [["REQUESTER", "/dashboard"], ["REQUESTER", "/tickets"], ["REQUESTER", "/tickets/42"]] as const) {
      await openApp(visitor, path, false);
      cleanup();
    }
    mocks.fetchStaffDashboard.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    mocks.fetchQueue.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
    mocks.fetchStaffTicket.mockRejectedValue(boom);
    mocks.fetchUsers.mockRejectedValue(boom);
    for (const [visitor, path] of [["IT_STAFF", "/dashboard"], ["IT_STAFF", "/queue"], ["IT_STAFF", "/queue/12"], ["ADMINISTRATOR", "/users"]] as const) {
      await openApp(visitor, path, false);
      cleanup();
    }
    expect(error.mock.calls, JSON.stringify(error.mock.calls.map((call) => String(call[0]).slice(0, 300)))).toEqual([]);
    expect(warn.mock.calls, JSON.stringify(warn.mock.calls.map((call) => String(call[0]).slice(0, 300)))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// UI-34 — nothing left behind
// ---------------------------------------------------------------------------

// The application's own source, read as text: Vite resolves the glob at transform time, so no Node
// module is needed. Keys are paths such as "../../src/screens/Login.tsx".
const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const sourcePaths = Object.keys(SOURCES);
const nameOf = (path: string) => path.slice("../../src/".length);

/** Words that mean a screen was never finished. Matched against what a person can read. */
const UNFINISHED = /lorem ipsum|placeholder (?:page|text)|coming soon|under construction|not implemented|to be (?:built|done)|\bTODO\b|\bFIXME\b|\bTBD\b|arrives (?:in|with) (?:a )?(?:later|the next)|development requester|select (?:a )?requester|switch requester|🛠/i;

describe("UI-34 no placeholder text, no old RoleHome page, no Development Requester control (AC-31, FR-30)", () => {
  it.each(SCREENS)("%s: nothing a person reads is unfinished", async (_name, visitor, path) => {
    await openApp(visitor, path);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(UNFINISHED);
    // Attributes a person reads or hears: a hint inside a field, a tooltip, a name for a screen reader.
    for (const element of Array.from(document.querySelectorAll("[placeholder], [title], [aria-label], [alt]"))) {
      for (const attribute of ["placeholder", "title", "aria-label", "alt"]) {
        expect(element.getAttribute(attribute) ?? "", `${attribute} of <${element.tagName.toLowerCase()}>`).not.toMatch(UNFINISHED);
      }
    }
  });

  it("the Development Requester control is not on any Requester screen: no selector, and no way to act as someone else", async () => {
    for (const path of ["/dashboard", "/tickets", "/tickets/new", "/tickets/42"]) {
      const view = await openApp("REQUESTER", path);
      expect(document.querySelectorAll("select[name*='requester' i], select[id*='requester' i], [data-testid*='requester-select' i]")).toHaveLength(0);
      expect(document.body.textContent).not.toMatch(/choose (?:a )?requester|acting as|view as/i);
      view.unmount();
    }
    expect(window.localStorage.length).toBe(0);
  });

  describe("no broken link", () => {
    /** Every address the application serves (TokTickITApp's route table). */
    const ROUTES_SERVED = [/^\/login$/, /^\/change-password$/, /^\/dashboard$/, /^\/tickets$/, /^\/tickets\/new$/, /^\/tickets\/[1-9]\d*$/, /^\/queue$/, /^\/queue\/[1-9]\d*$/, /^\/users$/];

    it.each(SCREENS)("%s: every link goes to an address the application serves", async (_name, visitor, path) => {
      if (visitor === "ADMINISTRATOR") mocks.fetchStaffDashboard.mockResolvedValue(ADMIN_BOARD);
      await openApp(visitor, path);
      const links = Array.from(document.querySelectorAll("a"));
      for (const link of links) {
        const href = link.getAttribute("href");
        expect(href, `a link with no address: ${link.outerHTML.slice(0, 120)}`).not.toBeNull();
        expect(href, `a link that goes nowhere: ${link.outerHTML.slice(0, 120)}`).not.toMatch(/^(?:#|javascript:|)$/);
        if (/^(?:https?:|mailto:)/.test(href!)) continue;
        const served = ROUTES_SERVED.some((route) => route.test(href!.split(/[?#]/)[0]));
        expect(served, `${href} is not an address the application serves`).toBe(true);
      }
    });

    it("the cards and rows of the dashboards link where the server says, and nowhere else", async () => {
      await openApp("IT_STAFF", "/dashboard");
      const hrefs = Array.from(document.querySelectorAll("main a, [role='main'] a, .tt-dash a")).map((link) => link.getAttribute("href"));
      expect(hrefs.length).toBeGreaterThan(6);
      expect(hrefs).toContain("/queue?owner=unassigned&group=open");
      expect(hrefs).toContain("/queue/12");
    });
  });

  it("the stylesheet holds nothing for the Requester selector that Lab 3 removed", () => {
    const css = Object.entries(SOURCES).filter(([path]) => path.endsWith(".css")).map(([, text]) => text).join("\n");
    expect(css).not.toMatch(/tt-selection|tt-shell__requester|tt-shell__notice|tt-shell__change|Requester Selection screen/);
  });

  it("the placeholder page RoleHome is gone: its file, its import, and the text it showed", () => {
    expect(sourcePaths.some((path) => nameOf(path) === "screens/RoleHome.tsx")).toBe(false);
    expect(sourcePaths.length).toBeGreaterThan(20);
    const offenders = sourcePaths.filter((path) => /\bRoleHome\b/.test(SOURCES[path])).map(nameOf);
    expect(offenders).toEqual([]);
  });

  it("nothing in src sends the retired X-Requester-Id header, or keeps a selection in localStorage", () => {
    const offenders = sourcePaths
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => /X-Requester-Id|localStorage\.(?:get|set)Item\(["']toktickit/i.test(SOURCES[path]))
      .map(nameOf);
    expect(offenders).toEqual([]);
  });

  it("no source file is a leftover: every screen and component is imported by something", () => {
    const files = sourcePaths.filter((path) => /\.tsx?$/.test(path) && !/(?:main|vite-env\.d)\.tsx?$/.test(path));
    // Lab 1's Check System page is kept: tests/lab-01 still tests it (BR-50), and no Lab 1 test may be weakened.
    const KEPT = new Set(["App.tsx"]);
    const orphans = files
      .filter((path) => !KEPT.has(nameOf(path)))
      .filter((path) => {
        const base = path.split("/").pop()!.replace(/\.tsx?$/, "");
        const importer = new RegExp(`from ["'][^"']*/${base}(?:\\.js)?["']`);
        return !sourcePaths.some((other) => other !== path && /\.tsx?$/.test(other) && importer.test(SOURCES[other]));
      })
      .map(nameOf);
    expect(orphans).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// UI-30 and UI-31 — every write form: one request per submission, and nothing typed is lost
// ---------------------------------------------------------------------------

type Typist = ReturnType<typeof userEvent.setup>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spy = MockInstance<(...args: any[]) => any>;

interface FormCase {
  /** The form, as a person would name it. */
  name: string;
  visitor: Visitor;
  path: string;
  /** Data this form needs that the default mock does not give. */
  arrange?: (m: Mocks) => void;
  /** Whatever must be opened to reach the form: a drawer, a panel, a confirmation. */
  open?: (u: Typist) => Promise<void>;
  /** Types valid values and says what was typed, so it can be looked for afterwards. */
  fill: (u: Typist) => Promise<Array<[label: string | RegExp, value: string]>>;
  /** The control that submits, by its name in either state: idle or busy. */
  submit: () => HTMLElement;
  /** The API call the submission makes. */
  call: (m: Mocks) => Spy;
  /**
   * What a failed submission can end in that the person can recover from. A field named third is cleared
   * on purpose, by a rule of the specification; every other field keeps what was typed.
   */
  failures: Array<[what: string, error: unknown, cleared?: Array<string | RegExp>]>;
}

const NETWORK = new TypeError("Failed to fetch");
const SERVER = new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
const invalid = (field: string, message = "This is not valid.") => new ApiError(400, "VALIDATION_FAILED", "One or more fields are invalid.", { [field]: message });
const stale = (current: unknown) => new ApiError(409, "STALE_UPDATE", "This record changed while you were working on it.", {}, current);
const button = (name: RegExp) => () => screen.getByRole("button", { name });

const ACTION: ActionTaken = {
  id: 31,
  ticketId: 12,
  actionAt: "2026-10-05T03:10:00.000Z",
  description: "Replaced the toner cartridge and ran a test page.",
  result: "Test page printed cleanly.",
  performedBy: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF" },
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  version: 1,
  createdAt: "2026-10-05T03:12:41.000Z",
  updatedAt: "2026-10-05T03:12:41.000Z",
  updatedBy: null,
};

const FORMS: FormCase[] = [
  {
    name: "Create Ticket",
    visitor: "REQUESTER",
    path: "/tickets/new",
    fill: async (u) => {
      await u.selectOptions(await screen.findByLabelText(/^Category/), "2");
      await u.selectOptions(screen.getByLabelText(/^Related System/), "2");
      await u.selectOptions(screen.getByLabelText(/^Requested Priority/), "MEDIUM");
      await u.type(screen.getByLabelText(/^Ticket Summary/), "Printer on floor 3 will not print");
      await u.type(screen.getByLabelText(/^Description/), "It shows a paper jam, but there is no paper stuck in it at all.");
      return [
        [/^Category/, "2"],
        [/^Related System/, "2"],
        [/^Requested Priority/, "MEDIUM"],
        [/^Ticket Summary/, "Printer on floor 3 will not print"],
        [/^Description/, "It shows a paper jam, but there is no paper stuck in it at all."],
      ];
    },
    submit: button(/^(Submit Ticket|Submitting…)$/),
    call: (m) => m.createTicket,
    failures: [["the server refuses the summary", new TicketValidationError({ summary: "Summary must be between 5 and 120 characters." })], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Public comment (Requester)",
    visitor: "REQUESTER",
    path: "/tickets/42",
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Add a comment/), "Still jammed after the restart.");
      return [[/^Add a comment/, "Still jammed after the restart."]];
    },
    submit: button(/^(Post comment|Posting…)$/),
    call: (m) => m.postComment,
    failures: [["the server refuses the body", invalid("body", "Comment is required.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Internal note (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Add an internal note/), "Checked the fuser, it looks worn.");
      return [[/^Add an internal note/, "Checked the fuser, it looks worn."]];
    },
    submit: button(/^(Post internal note|Posting…)$/),
    call: (m) => m.postNote,
    failures: [["the server refuses the body", invalid("body", "Note is required.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Problem appears resolved (Requester)",
    visitor: "REQUESTER",
    path: "/tickets/42",
    fill: async (u) => {
      const panel = within(await screen.findByTestId("appears-resolved"));
      await u.type(panel.getByLabelText(/^Comment/), "It prints again since this morning.");
      return [[/^Comment/, "It prints again since this morning."]];
    },
    submit: () => within(screen.getByTestId("appears-resolved")).getByRole("button", { name: /^(Mark as appears resolved|Saving…)$/ }),
    call: (m) => m.setAppearsResolved,
    failures: [["the server refuses the comment", invalid("comment", "Comment must be at least 5 characters.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Attachment removal (Requester)",
    visitor: "REQUESTER",
    path: "/tickets/42",
    arrange: (m) =>
      m.fetchTicketDetail.mockResolvedValue({
        ...REQUESTER_TICKET,
        attachments: [{ id: 90, originalFilename: "battery-report.pdf", mimeType: "application/pdf", sizeBytes: 184320, uploadedAt: "2026-09-28T09:20:00.000Z", removedAt: null, removalReason: null, downloadUrl: "/api/attachments/90/download" }],
      }),
    open: async (u) => {
      await u.click(await screen.findByRole("button", { name: "Remove" }));
    },
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Removal reason/), "Uploaded to the wrong ticket.");
      return [[/^Removal reason/, "Uploaded to the wrong ticket."]];
    },
    submit: () => within(screen.getByRole("dialog", { name: "Remove attachment?" })).getByRole("button", { name: /^(Remove attachment|Removing…)$/ }),
    call: (m) => m.removeAttachment,
    failures: [["the server refuses the reason", new AttachmentError("VALIDATION_FAILED", "The removal reason must be between 5 and 200 characters.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Status (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    fill: async (u) => {
      await u.selectOptions(await screen.findByLabelText(/^Move to/), "CANCELLED");
      await u.type(screen.getByLabelText(/^Reason/), "Raised twice, this one is the duplicate.");
      return [
        [/^Move to/, "CANCELLED"],
        [/^Reason/, "Raised twice, this one is the duplicate."],
      ];
    },
    submit: button(/^(Apply|Applying…)$/),
    call: (m) => m.changeTicketStatus,
    failures: [
      ["the server refuses the reason", invalid("reason", "Reason must be at least 5 characters.")],
      ["a colleague changed the ticket first (stale)", stale({ ...STAFF_TICKET, version: 4, currentStatus: "OPEN" })],
      ["the move is no longer possible (a conflict)", new ApiError(409, "INVALID_TRANSITION", "A OPEN ticket cannot move to CANCELLED.")],
      ["the network fails", NETWORK],
      ["the server errs", SERVER],
    ],
  },
  {
    name: "IT Priority (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    fill: async (u) => {
      await u.selectOptions(await screen.findByLabelText(/^IT Priority/), "URGENT");
      return [[/^IT Priority/, "URGENT"]];
    },
    submit: button(/^(Update IT Priority|Saving…)$/),
    call: (m) => m.setItPriority,
    failures: [["a colleague changed the ticket first (stale)", stale({ ...STAFF_TICKET, version: 4 })], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Claim (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    arrange: (m) => m.fetchStaffTicket.mockResolvedValue({ ...STAFF_TICKET, owner: null, currentStatus: "OPEN", permittedTransitions: ["IN_PROGRESS", "CANCELLED"], blockedTransitions: [] }),
    open: async (u) => {
      await u.click(await screen.findByRole("button", { name: "Claim" }));
    },
    fill: async () => [],
    submit: button(/^(Confirm claim|Claiming…)$/),
    call: (m) => m.setTicketOwner,
    // A claim someone else won is not retried: the screen reloads to show who owns it now (UI-14 and WF-12 cover it).
    failures: [["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Owner, reassign (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    fill: async (u) => {
      await u.selectOptions(await screen.findByLabelText(/^Reassign to/), "8");
      return [[/^Reassign to/, "8"]];
    },
    submit: button(/^(Reassign|Saving…)$/),
    call: (m) => m.setTicketOwner,
    failures: [["a colleague changed the ticket first (stale)", stale({ ...STAFF_TICKET, version: 4 })], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Action Taken, record (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    open: async (u) => {
      await u.click(await screen.findByRole("button", { name: "+ Add action" }));
    },
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Action Description/), "Replaced the toner cartridge and ran a test page.");
      await u.type(screen.getByLabelText(/^Result/), "Test page printed cleanly.");
      return [
        [/^Action Description/, "Replaced the toner cartridge and ran a test page."],
        [/^Result/, "Test page printed cleanly."],
      ];
    },
    submit: button(/^(Save action|Saving…)$/),
    call: (m) => m.createActionTaken,
    failures: [["the server refuses the description", invalid("description", "Action Description must be between 5 and 2000 characters.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Action Taken, edit (IT Staff)",
    visitor: "IT_STAFF",
    path: "/queue/12",
    arrange: (m) => m.fetchActionsTaken.mockResolvedValue([ACTION]),
    open: async (u) => {
      await u.click(await screen.findByRole("button", { name: /^Edit action of/ }));
    },
    fill: async (u) => {
      const result = await screen.findByLabelText(/^Result/);
      await u.clear(result);
      await u.type(result, "Both test pages printed cleanly.");
      return [[/^Result/, "Both test pages printed cleanly."]];
    },
    submit: button(/^(Save changes|Saving…)$/),
    call: (m) => m.editActionTaken,
    failures: [["the server refuses the result", invalid("result", "Result must be between 2 and 1000 characters.")], ["the action changed first (stale)", stale({ ...ACTION, version: 2 })], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "User, create (Administrator)",
    visitor: "ADMINISTRATOR",
    path: "/users",
    open: async (u) => {
      await u.click(await screen.findByRole("button", { name: "+ Create user" }));
    },
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Full name/), "Kanya Suthi");
      await u.type(screen.getByLabelText(/^Email/), "kanya.suthi@toktickit.local");
      await u.click(screen.getByRole("radio", { name: "IT Staff" }));
      await u.type(screen.getByLabelText(/^Initial password/), "Correct-horse-1");
      return [
        [/^Full name/, "Kanya Suthi"],
        [/^Email/, "kanya.suthi@toktickit.local"],
        [/^Initial password/, "Correct-horse-1"],
      ];
    },
    submit: button(/^(Create user|Creating…)$/),
    call: (m) => m.createUser,
    failures: [["the email is taken", new ApiError(409, "EMAIL_IN_USE", "That email is already in use.", { email: "Another user already has this email." })], ["the server refuses the name", invalid("fullName", "Enter the user's full name.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "User, edit (Administrator)",
    visitor: "ADMINISTRATOR",
    path: "/users",
    open: async (u) => {
      // The list draws each row twice, a table row and a card, and CSS shows one of them.
      await u.click((await screen.findAllByRole("button", { name: "Edit Anucha Wongsawat" }))[0]);
    },
    fill: async (u) => {
      const name = await screen.findByLabelText(/^Full name/);
      await u.clear(name);
      await u.type(name, "Anucha W. Wongsawat");
      return [[/^Full name/, "Anucha W. Wongsawat"]];
    },
    submit: button(/^(Save changes|Saving…)$/),
    call: (m) => m.updateUser,
    failures: [["the email is taken", new ApiError(409, "EMAIL_IN_USE", "That email is already in use.", { email: "Another user already has this email." })], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "User, new initial password (Administrator)",
    visitor: "ADMINISTRATOR",
    path: "/users",
    open: async (u) => {
      await u.click((await screen.findAllByRole("button", { name: "Edit Anucha Wongsawat" }))[0]);
      await u.click(await screen.findByRole("button", { name: "Set new initial password" }));
    },
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^New initial password/), "Correct-horse-2");
      return [[/^New initial password/, "Correct-horse-2"]];
    },
    submit: button(/^(Set password and sign out|Setting…)$/),
    call: (m) => m.issueInitialPassword,
    failures: [["the server refuses the password", invalid("initialPassword", "Password must be at least 8 characters.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Login",
    visitor: "SIGNED_OUT",
    path: "/login",
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Email/), "anucha.wong@kmutt.ac.th");
      await u.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
      return [
        [/^Email/, "anucha.wong@kmutt.ac.th"],
        [/^Password/, "Toktickit#2026"],
      ];
    },
    submit: button(/^(Sign in|Signing in…)$/),
    call: (m) => m.login,
    failures: [["the password is wrong", new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")], ["too many attempts", new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Try again in 15 minutes.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
  {
    name: "Change Password",
    visitor: "MUST_CHANGE",
    path: "/change-password",
    fill: async (u) => {
      await u.type(await screen.findByLabelText(/^Current password/), "Toktickit#2026");
      await u.type(screen.getByLabelText(/^New password/), "Correct-horse-9");
      await u.type(screen.getByLabelText(/^Confirm new password/), "Correct-horse-9");
      return [
        [/^Current password/, "Toktickit#2026"],
        [/^New password/, "Correct-horse-9"],
        [/^Confirm new password/, "Correct-horse-9"],
      ];
    },
    submit: button(/^(Save password|Saving…)$/),
    call: (m) => m.changePassword,
    failures: [["the current password is wrong", new ApiError(401, "INVALID_CREDENTIALS", "Your current password is incorrect."), [/^Current password/]], ["the server refuses the new password", invalid("newPassword", "Password must be at least 8 characters.")], ["the network fails", NETWORK], ["the server errs", SERVER]],
  },
];

/** A request that never answers: the submission is in flight for as long as the test needs. */
const never = () => new Promise<never>(() => {});

async function reach(form: FormCase) {
  form.arrange?.(mocks);
  const user = userEvent.setup();
  await openApp(form.visitor, form.path);
  await form.open?.(user);
  return user;
}

describe("UI-30 every write form sends one request per submission, however often it is pressed (AC-27, BR-53)", () => {
  it.each(FORMS.map((form) => [form.name, form] as const))("%s", async (_name, form) => {
    form.call(mocks).mockReturnValue(never());
    const user = await reach(form);
    await form.fill(user);

    const submit = form.submit();
    await user.click(submit);
    await user.click(submit);
    await user.click(form.submit());
    // The keyboard and the browser can submit a form without the button: Enter in a field, a script.
    const element = form.submit().closest("form");
    if (element) {
      fireEvent.submit(element);
      fireEvent.submit(element);
    }

    expect(form.call(mocks)).toHaveBeenCalledTimes(1);
    // While it is in flight the control says so, and cannot be pressed.
    expect(form.submit()).toBeDisabled();
    expect(form.submit()).toHaveAttribute("aria-busy", "true");
  });

  it("an upload is one request, and a second file chosen while it is in flight waits for the person to choose again", async () => {
    mocks.uploadAttachment.mockReturnValue(never());
    const user = userEvent.setup();
    await openApp("REQUESTER", "/tickets/42");
    const chooser = await screen.findByLabelText("Choose a file to attach");
    await user.upload(chooser, new File(["a"], "first.png", { type: "image/png" }));
    await user.upload(chooser, new File(["b"], "second.png", { type: "image/png" }));
    await user.upload(chooser, new File(["c"], "third.png", { type: "image/png" }));
    expect(mocks.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    // The file input is disabled while it runs, so a person cannot choose another.
    expect(chooser).toBeDisabled();
  });

  it("the removal dialog sends one request even when Remove attachment is activated twice in the same instant", async () => {
    mocks.fetchTicketDetail.mockResolvedValue({
      ...REQUESTER_TICKET,
      attachments: [{ id: 90, originalFilename: "battery-report.pdf", mimeType: "application/pdf", sizeBytes: 184320, uploadedAt: "2026-09-28T09:20:00.000Z", removedAt: null, removalReason: null, downloadUrl: "/api/attachments/90/download" }],
    });
    mocks.removeAttachment.mockReturnValue(never());
    const user = userEvent.setup();
    await openApp("REQUESTER", "/tickets/42");
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await user.type(await screen.findByLabelText(/^Removal reason/), "Uploaded to the wrong ticket.");
    const remove = within(screen.getByRole("dialog")).getByRole("button", { name: "Remove attachment" });
    // Two activations before React has drawn the disabled button: only the screen's own guard can stop the second.
    act(() => {
      remove.click();
      remove.click();
    });
    expect(mocks.removeAttachment).toHaveBeenCalledTimes(1);
  });

  it("a file that reaches the screen while an upload is in flight is ignored all the same: the screen does not rely on the input being disabled", async () => {
    mocks.uploadAttachment.mockReturnValue(never());
    await openApp("REQUESTER", "/tickets/42");
    const chooser = await screen.findByLabelText("Choose a file to attach");
    for (const name of ["first.png", "second.png", "third.png"]) {
      // A change event dispatched straight at the input, as a script or a browser quirk could.
      fireEvent.change(chooser, { target: { files: [new File([name], name, { type: "image/png" })] } });
    }
    expect(mocks.uploadAttachment).toHaveBeenCalledTimes(1);
  });

  it("when an upload ends, the next one is sent: the guard is let go on success and on failure", async () => {
    mocks.uploadAttachment
      .mockResolvedValueOnce({ id: 91, originalFilename: "first.png", mimeType: "image/png", sizeBytes: 1, uploadedAt: "2026-10-01T00:00:00.000Z", removedAt: null, removalReason: null, downloadUrl: "/api/attachments/91/download" })
      .mockRejectedValueOnce(new AttachmentError("UPLOAD_FAILED", "The file could not be attached."))
      .mockReturnValue(never());
    const user = userEvent.setup();
    await openApp("REQUESTER", "/tickets/42");
    const chooser = await screen.findByLabelText("Choose a file to attach");
    await user.upload(chooser, new File(["a"], "first.png", { type: "image/png" }));
    await screen.findByText("first.png");
    await user.upload(chooser, new File(["b"], "second.png", { type: "image/png" }));
    await screen.findByText(/could not be attached/);
    await user.upload(chooser, new File(["c"], "third.png", { type: "image/png" }));
    expect(mocks.uploadAttachment).toHaveBeenCalledTimes(3);
  });
});

describe("UI-31 after a failure the person can recover from, what was typed is still in the form (AC-27, BR-54)", () => {
  const CASES = FORMS.flatMap((form) => form.failures.map(([what, error, cleared]) => [`${form.name}: ${what}`, form, error, cleared ?? []] as const));

  it.each(CASES)("%s", async (_name, form, error, cleared) => {
    form.call(mocks).mockRejectedValueOnce(error).mockReturnValue(never());
    const user = await reach(form);
    const typed = await form.fill(user);

    await user.click(form.submit());
    await waitFor(() => expect(form.call(mocks)).toHaveBeenCalledTimes(1));
    // The request has ended: the control is ready again, and the person is told what happened.
    await waitFor(() => expect(form.submit()).toBeEnabled());
    // ...in a way a screen reader announces: an alert, or the warning callout's status.
    expect(document.querySelectorAll('[role="alert"], [role="status"][data-state="warning"]').length).toBeGreaterThan(0);

    for (const [label, value] of typed) {
      const gone = cleared.some((name) => String(name) === String(label));
      expect(screen.getByLabelText(label), String(label)).toHaveValue(gone ? "" : value);
    }

    // And they can send it again: one more request, not two. A field the specification clears is typed once more.
    for (const [label, value] of typed.filter(([label]) => cleared.some((name) => String(name) === String(label)))) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(form.submit());
    await waitFor(() => expect(form.call(mocks)).toHaveBeenCalledTimes(2));
    expect(form.submit()).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// UI-32 — the same state, the same component, the same words, on every screen
// ---------------------------------------------------------------------------

/** What the server's own failure looks like when it leaks: SQL, a driver code, a path, a stack line. */
const RAW_FAILURE = new Error('P2002: Unique constraint failed on SELECT * FROM "Ticket" at /app/src/server.ts:41:9 (node:internal/process:12)');
const NOT_FOR_PEOPLE = /P2002|SELECT \*|\/app\/|node:internal|server\.ts|\bstack\b|\bat .*:\d+:\d+|undefined|\[object/i;

/** Every screen and region that loads something, the role that meets it, and the call that loads it. */
const LOADERS: Array<[name: string, visitor: Visitor, path: string, call: (m: Mocks) => Spy]> = [
  ["Requester Dashboard", "REQUESTER", "/dashboard", (m) => m.fetchRequesterDashboard],
  ["IT Staff Dashboard", "IT_STAFF", "/dashboard", (m) => m.fetchStaffDashboard],
  ["My Tickets", "REQUESTER", "/tickets", (m) => m.fetchMyTickets],
  ["Requester Ticket Detail", "REQUESTER", "/tickets/42", (m) => m.fetchTicketDetail],
  ["Ticket Queue", "IT_STAFF", "/queue", (m) => m.fetchQueue],
  ["IT Staff Ticket Detail", "IT_STAFF", "/queue/12", (m) => m.fetchStaffTicket],
  ["User Management", "ADMINISTRATOR", "/users", (m) => m.fetchUsers],
  ["Actions Taken region", "IT_STAFF", "/queue/12", (m) => m.fetchActionsTaken],
  ["Status History region", "IT_STAFF", "/queue/12", (m) => m.fetchStatusHistory],
  ["Public Comments region", "REQUESTER", "/tickets/42", (m) => m.fetchComments],
];

/** The shared callouts are found by what they are, not by where a screen put them. */
const callout = (state: string) => document.querySelector<HTMLElement>(`[data-state="${state}"]`);

describe("UI-32 loading, failure, forbidden, empty, not found, conflict, and success read the same on every screen (AC-28, FR-26, ui-spec §8)", () => {
  describe("loading is the skeleton, announced politely, with words for a screen reader", () => {
    it.each(LOADERS)("%s", async (_name, visitor, path, call) => {
      call(mocks).mockReturnValue(never());
      signIn(visitor);
      render(<TokTickITApp initialEntries={[path]} />);
      await waitFor(() => expect(callout("loading")).not.toBeNull());
      const loading = callout("loading")!;
      expect(loading).toHaveAttribute("role", "status");
      expect(loading).toHaveAttribute("aria-live", "polite");
      expect(loading.textContent?.trim().length ?? 0, "a label for a screen reader").toBeGreaterThan(0);
      expect(loading.textContent).toMatch(/^Loading/);
    });
  });

  describe("a failure is the Error callout: a title, a safe sentence, and Try again, which asks again", () => {
    it.each(LOADERS)("%s", async (_name, visitor, path, call) => {
      call(mocks).mockRejectedValueOnce(RAW_FAILURE);
      await openApp(visitor, path, false);
      await waitFor(() => expect(callout("error")).not.toBeNull());
      const error = callout("error")!;
      expect(error).toHaveAttribute("role", "alert");
      expect(error).toHaveTextContent("Something went wrong");
      expect(error.textContent).toMatch(/could not be loaded|Cannot load|Cannot reach/);
      // Nothing of the failure reaches the page: not its message, its code, its path.
      expect(document.body.textContent).not.toMatch(NOT_FOR_PEOPLE);

      const calls = call(mocks).mock.calls.length;
      await userEvent.setup().click(within(error).getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(call(mocks).mock.calls.length).toBeGreaterThan(calls));
    });

    it.each(["Requester Ticket Detail", "IT Staff Ticket Detail", "Ticket Queue", "User Management"])("%s: a server error carries the server's own wording nowhere on the page", async (name) => {
      const [, visitor, path, call] = LOADERS.find(([title]) => title === name)!;
      call(mocks).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
      await openApp(visitor, path, false);
      await waitFor(() => expect(callout("error")).not.toBeNull());
      expect(document.body.textContent).not.toMatch(NOT_FOR_PEOPLE);
    });
  });

  describe("forbidden is one callout, 'You do not have access to …', on every screen that can be refused", () => {
    const REFUSED: Array<[string, Visitor, string, (m: Mocks) => Spy, RegExp]> = [
      ["Requester Dashboard", "REQUESTER", "/dashboard", (m) => m.fetchRequesterDashboard, /^You do not have access to this dashboard\./],
      ["IT Staff Dashboard", "IT_STAFF", "/dashboard", (m) => m.fetchStaffDashboard, /^You do not have access to this dashboard\./],
      ["Ticket Queue", "IT_STAFF", "/queue", (m) => m.fetchQueue, /^You do not have access to the ticket queue\./],
      ["IT Staff Ticket Detail", "IT_STAFF", "/queue/12", (m) => m.fetchStaffTicket, /^You do not have access to this ticket\./],
      ["User Management", "ADMINISTRATOR", "/users", (m) => m.fetchUsers, /^You do not have access to User Management\./],
      ["Actions Taken region", "IT_STAFF", "/queue/12", (m) => m.fetchActionsTaken, /^You do not have access to record actions\./],
    ];

    it.each(REFUSED)("%s", async (_name, visitor, path, call, words) => {
      call(mocks).mockRejectedValue(new ApiError(403, "FORBIDDEN", "Your role does not allow this."));
      await openApp(visitor, path, false);
      await waitFor(() => expect(callout("forbidden")).not.toBeNull());
      const forbidden = callout("forbidden")!;
      expect(forbidden).toHaveAttribute("role", "alert");
      expect(forbidden.classList.contains("tt-callout--error")).toBe(true);
      expect(forbidden.querySelector("p")?.textContent?.trim()).toMatch(words);
      // It is not an outage: no "Something went wrong", no Try again, and none of the server's sentence.
      expect(forbidden).not.toHaveTextContent("Something went wrong");
      expect(within(forbidden).queryByRole("button")).not.toBeInTheDocument();
      expect(forbidden).not.toHaveTextContent("Your role does not allow this");
    });

    it("a page the role may not open is the same callout, after the router sends the person home (ui-spec §2)", async () => {
      await openApp("REQUESTER", "/queue");
      const forbidden = callout("forbidden")!;
      expect(forbidden.querySelector("p")?.textContent?.trim()).toBe("You do not have access to that page.");
      expect(forbidden).toHaveAttribute("role", "alert");
    });
  });

  describe("empty and no results are two states: the empty-state card, and the no-results card with Clear Filters", () => {
    it("My Tickets with no tickets, then a search with no match", async () => {
      mocks.fetchMyTickets.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false } });
      await openApp("REQUESTER", "/tickets");
      expect(callout("empty")).not.toBeNull();
      expect(callout("no-results")).toBeNull();
      cleanup();
      await openApp("REQUESTER", "/tickets?search=zzz");
      expect(callout("no-results")).not.toBeNull();
      expect(within(callout("no-results")!).getByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
    });

    it("the Ticket Queue, the same two", async () => {
      mocks.fetchQueue.mockResolvedValue({ tickets: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
      await openApp("IT_STAFF", "/queue");
      expect(callout("empty")).not.toBeNull();
      cleanup();
      await openApp("IT_STAFF", "/queue?q=zzz");
      expect(callout("no-results")).not.toBeNull();
      expect(within(callout("no-results")!).getByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
    });

    it("User Management, the same two", async () => {
      mocks.fetchUsers.mockResolvedValue([]);
      await openApp("ADMINISTRATOR", "/users");
      expect(callout("empty")).not.toBeNull();
    });

    it("the Actions Taken region says so in its own words, and as an empty-state card", async () => {
      await openApp("IT_STAFF", "/queue/12");
      const region = document.querySelector<HTMLElement>('[data-region="actions-taken"]')!;
      expect(within(region).getByText("No actions recorded yet.").closest('[data-state="empty"]')).not.toBeNull();
    });
  });

  describe("not found is the empty-state card with a way back, and is never a failure", () => {
    it("Requester Ticket Detail", async () => {
      mocks.fetchTicketDetail.mockRejectedValue(new AttachmentError("NOT_FOUND", "That ticket could not be found."));
      await openApp("REQUESTER", "/tickets/9999", false);
      await waitFor(() => expect(callout("empty")).not.toBeNull());
      expect(callout("empty")).toHaveTextContent("Ticket not found.");
      expect(screen.getByRole("button", { name: /^Back to My Tickets$/ })).toBeInTheDocument();
      expect(callout("error")).toBeNull();
    });

    it("IT Staff Ticket Detail", async () => {
      mocks.fetchStaffTicket.mockRejectedValue(new ApiError(404, "NOT_FOUND", "That ticket could not be found."));
      await openApp("IT_STAFF", "/queue/9999", false);
      await waitFor(() => expect(callout("empty")).not.toBeNull());
      expect(callout("empty")).toHaveTextContent("Ticket not found.");
      expect(screen.getByRole("button", { name: /^Back to the queue$/ })).toBeInTheDocument();
      expect(callout("error")).toBeNull();
    });
  });

  describe("a conflict is the warning callout, announced at once, with what the person can do about it", () => {
    it("IT Staff Ticket Detail: a stale status change", async () => {
      mocks.changeTicketStatus.mockRejectedValue(stale({ ...STAFF_TICKET, version: 4, currentStatus: "OPEN" }));
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.selectOptions(screen.getByLabelText(/^Move to/), "CANCELLED");
      await user.type(screen.getByLabelText(/^Reason/), "Raised twice, this one is the duplicate.");
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await waitFor(() => expect(callout("warning")).not.toBeNull());
      const warning = callout("warning")!;
      expect(warning).toHaveAttribute("role", "alert");
      expect(warning.classList.contains("tt-callout--warning")).toBe(true);
      expect(within(warning).getByRole("button", { name: "Show latest" })).toBeInTheDocument();
      expect(callout("error")).toBeNull();
    });

    it("Actions Taken: a stale edit", async () => {
      mocks.fetchActionsTaken.mockResolvedValue([ACTION]);
      mocks.editActionTaken.mockRejectedValue(stale({ ...ACTION, version: 2 }));
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: /^Edit action of/ }));
      await user.type(await screen.findByLabelText(/^Result/), " Twice.");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(callout("warning")).not.toBeNull());
      const warning = callout("warning")!;
      expect(warning).toHaveAttribute("role", "alert");
      expect(within(warning).getByRole("button", { name: "Show latest" })).toBeInTheDocument();
      expect(callout("error")).toBeNull();
    });
  });

  describe("success is the status callout, which a screen reader announces without interrupting", () => {
    it("IT Staff Ticket Detail: an IT Priority saved", async () => {
      mocks.setItPriority.mockResolvedValue({ ...STAFF_TICKET, itPriority: "URGENT", version: 4 });
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.selectOptions(screen.getByLabelText(/^IT Priority/), "URGENT");
      await user.click(screen.getByRole("button", { name: "Update IT Priority" }));
      await waitFor(() => expect(callout("success")).not.toBeNull());
      expect(callout("success")).toHaveAttribute("role", "status");
      expect(callout("success")).toHaveTextContent("IT Priority is now URGENT.");
    });

    it("User Management: a user created", async () => {
      mocks.createUser.mockResolvedValue({ id: 20, fullName: "Kanya Suthi", email: "kanya@toktickit.local", role: "IT_STAFF", isActive: true, department: null, mustChangePassword: true, lastLoginAt: null });
      const user = userEvent.setup();
      await openApp("ADMINISTRATOR", "/users");
      await user.click(screen.getByRole("button", { name: "+ Create user" }));
      await user.type(await screen.findByLabelText(/^Full name/), "Kanya Suthi");
      await user.type(screen.getByLabelText(/^Email/), "kanya@toktickit.local");
      await user.click(screen.getByRole("radio", { name: "IT Staff" }));
      await user.type(screen.getByLabelText(/^Initial password/), "Correct-horse-1");
      await user.click(screen.getByRole("button", { name: "Create user" }));
      await waitFor(() => expect(callout("success")).not.toBeNull());
      expect(callout("success")).toHaveAttribute("role", "status");
      expect(callout("success")).toHaveTextContent("Created Kanya Suthi.");
    });

    it("Change Password: a password changed from the menu", async () => {
      mocks.changePassword.mockResolvedValue(undefined);
      const user = userEvent.setup();
      await openApp("REQUESTER", "/change-password");
      await user.type(screen.getByLabelText(/^Current password/), "Toktickit#2026");
      await user.type(screen.getByLabelText(/^New password/), "Correct-horse-9");
      await user.type(screen.getByLabelText(/^Confirm new password/), "Correct-horse-9");
      await user.click(screen.getByRole("button", { name: "Save password" }));
      await waitFor(() => expect(callout("success")).not.toBeNull());
      expect(callout("success")).toHaveAttribute("role", "status");
      expect(callout("success")).toHaveTextContent("Password updated.");
    });
  });

  describe("no screen draws a callout of its own", () => {
    it("the callout classes, and the markers of a state, appear in the shared States component and nowhere else", () => {
      const mine = sourcePaths.filter((path) => /\.tsx$/.test(path) && nameOf(path) !== "components/States.tsx");
      const callouts = mine.filter((path) => /tt-callout/.test(SOURCES[path])).map(nameOf);
      expect(callouts).toEqual([]);
      // The dashboards draw their own skeleton: the same number of cards as the real thing (ui-spec §3.5).
      const loading = mine.filter((path) => /data-state=["']loading["']/.test(SOURCES[path])).map(nameOf);
      expect(loading).toEqual(["screens/dashboardParts.tsx"]);
      // Two one-line notes inside a form's own list are not the empty-state card: "No files chosen." beside the file
      // picker of Create Ticket, and "No attachments on this ticket yet." in the attachments region (Lab 2 ui-spec §11).
      const INLINE_NOTES = ["components/AttachmentSection.tsx", "screens/CreateTicket.tsx"];
      for (const marker of ["empty", "no-results", "forbidden"]) {
        const drawn = mine
          .filter((path) => new RegExp(`data-state=["']${marker}["']`).test(SOURCES[path]))
          .map(nameOf)
          .filter((name) => !(marker === "empty" && INLINE_NOTES.includes(name)));
        expect(drawn, `data-state="${marker}" outside States.tsx`).toEqual([]);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// UI-35 — the keyboard: reach, names, visible focus, where focus goes, and the two dialogs
// ---------------------------------------------------------------------------

const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [tabindex]';
const short = (element: Element) => element.outerHTML.replace(/\s+/g, " ").slice(0, 160);

describe("UI-35 the keyboard reaches every control, names it, shows where focus is, and moves it to where the person is working (AC-30, FR-31, ui-spec §9)", () => {
  describe("every control on every screen can be reached by Tab and has a name", () => {
    it.each(SCREENS)("%s", async (_name, visitor, path) => {
      await openApp(visitor, path);
      const controls = Array.from(document.querySelectorAll<HTMLElement>(CONTROLS));
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        // A name a screen reader can say: a label, an aria-label, or the text on a button or link.
        expect(computeAccessibleName(control).trim(), short(control)).not.toBe("");
        // Tab order is reading order: nothing jumps the queue, and nothing a person must use is skipped.
        const tabindex = control.getAttribute("tabindex");
        expect(tabindex === null || Number(tabindex) <= 0, `tabindex ${tabindex} on ${short(control)}`).toBe(true);
        if (tabindex === "-1") {
          const interactive = control.matches('a[href], button, input, select, textarea, [role="button"], [role="switch"]');
          expect(interactive, `${short(control)} is a control Tab cannot reach`).toBe(false);
        }
      }
    });

    it("a real walk with Tab visits the Login form in the order it reads: Email, Password, Sign in", async () => {
      const user = userEvent.setup();
      await openApp("SIGNED_OUT", "/login");
      const walked: string[] = [];
      for (let step = 0; step < 3; step += 1) {
        await user.tab();
        walked.push(computeAccessibleName(document.activeElement as HTMLElement));
      }
      expect(walked).toEqual(["Email *", "Password *", "Sign in"].map((name) => expect.stringContaining(name.replace(" *", ""))));
    });

    it("a real walk with Tab visits Create Ticket in reading order, and never lands on something hidden or disabled", async () => {
      const user = userEvent.setup();
      await openApp("REQUESTER", "/tickets/new");
      const order: string[] = [];
      for (let step = 0; step < 30; step += 1) {
        await user.tab();
        const active = document.activeElement as HTMLElement;
        expect(active.matches(":disabled"), short(active)).toBe(false);
        order.push(computeAccessibleName(active));
      }
      const asked = ["Category", "Related System", "Requested Priority", "Ticket Summary", "Description"].map((label) => order.findIndex((name) => name.startsWith(label)));
      expect(asked.every((index) => index >= 0), JSON.stringify(order)).toBe(true);
      expect([...asked].sort((a, b) => a - b)).toEqual(asked);
    });
  });

  describe("focus is always visible: the stylesheet never removes it, and styles it on every kind of control", () => {
    const CSS = Object.entries(SOURCES).filter(([path]) => path.endsWith(".css")).map(([, text]) => text).join("\n");

    it("no rule switches the outline off", () => {
      expect(CSS.length).toBeGreaterThan(1000);
      expect(CSS).not.toMatch(/outline\s*:\s*(?:none|0)\b/);
      expect(CSS).not.toMatch(/outline-width\s*:\s*0/);
    });

    it.each(["tt-field__control", "tt-btn", "tt-link", "tt-metric--link", "tt-dash-row", "tt-dash__view-all", "tt-dash-status", "tt-chip__remove"])("%s has a focus outline", (name) => {
      const rule = new RegExp(`\\.${name}:focus(?:-visible)?[^{]*\\{[^}]*outline\\s*:\\s*2px solid`);
      expect(CSS).toMatch(rule);
    });
  });

  describe("focus goes where the person is working (ui-spec §9)", () => {
    it("opening the record-an-action form focuses its first field", async () => {
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: "+ Add action" }));
      expect(await screen.findByLabelText(/^Action Date\/Time/)).toHaveFocus();
    });

    it("saving a new action focuses the new card's heading", async () => {
      mocks.createActionTaken.mockResolvedValue(ACTION);
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: "+ Add action" }));
      await user.type(await screen.findByLabelText(/^Action Description/), ACTION.description);
      await user.type(screen.getByLabelText(/^Result/), ACTION.result);
      await user.click(screen.getByRole("button", { name: "Save action" }));
      const card = await screen.findByText(ACTION.description);
      await waitFor(() => expect(document.activeElement).toBe(card.closest("li")!.querySelector("h3, h4, [tabindex='-1']")));
    });

    it("saving an edit returns focus to that card's Edit button", async () => {
      mocks.fetchActionsTaken.mockResolvedValue([ACTION]);
      mocks.editActionTaken.mockResolvedValue({ ...ACTION, result: "Both pages printed.", version: 2, updatedAt: "2026-10-06T03:12:41.000Z", updatedBy: ACTION.performedBy });
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: /^Edit action of/ }));
      const result = await screen.findByLabelText(/^Result/);
      await user.clear(result);
      await user.type(result, "Both pages printed.");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.getByRole("button", { name: /^Edit action of/ })).toHaveFocus());
    });

    it("Go to Actions Taken focuses the region's heading", async () => {
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: "Go to Actions Taken" }));
      expect(await screen.findByRole("heading", { level: 2, name: /^Actions Taken/ })).toHaveFocus();
    });

    it("after a refused submit, the first invalid field takes focus", async () => {
      const user = userEvent.setup();
      await openApp("IT_STAFF", "/queue/12");
      await user.click(await screen.findByRole("button", { name: "+ Add action" }));
      const description = await screen.findByLabelText(/^Action Description/);
      await user.clear(await screen.findByLabelText(/^Action Date\/Time/));
      await user.click(screen.getByRole("button", { name: "Save action" }));
      expect(mocks.createActionTaken).not.toHaveBeenCalled();
      await waitFor(() => expect(document.activeElement?.getAttribute("aria-invalid")).toBe("true"));
      expect(description).not.toHaveFocus();
    });
  });

  describe("a dialog is usable with the keyboard alone: focus goes in, Tab stays inside, Escape closes it, and focus comes back", () => {
    const DIALOGS: Array<[string, Visitor, string, (u: Typist) => Promise<HTMLElement>, string | RegExp, (m: Mocks) => void]> = [
      [
        "the attachment removal dialog",
        "REQUESTER",
        "/tickets/42",
        async (u) => {
          const trigger = await screen.findByRole("button", { name: "Remove" });
          await u.click(trigger);
          return trigger;
        },
        "Remove attachment?",
        (m) =>
          m.fetchTicketDetail.mockResolvedValue({
            ...REQUESTER_TICKET,
            attachments: [{ id: 90, originalFilename: "battery-report.pdf", mimeType: "application/pdf", sizeBytes: 184320, uploadedAt: "2026-09-28T09:20:00.000Z", removedAt: null, removalReason: null, downloadUrl: "/api/attachments/90/download" }],
          }),
      ],
      [
        "the Create user panel",
        "ADMINISTRATOR",
        "/users",
        async (u) => {
          const trigger = await screen.findByRole("button", { name: "+ Create user" });
          await u.click(trigger);
          return trigger;
        },
        "Create user",
        () => {},
      ],
      [
        "the Edit user panel",
        "ADMINISTRATOR",
        "/users",
        async (u) => {
          const trigger = (await screen.findAllByRole("button", { name: "Edit Anucha Wongsawat" }))[0];
          await u.click(trigger);
          return trigger;
        },
        "Edit user",
        () => {},
      ],
    ];

    it.each(DIALOGS)("%s: focus moves into it when it opens", async (_name, visitor, path, open, title, arrange) => {
      arrange(mocks);
      const user = userEvent.setup();
      await openApp(visitor, path);
      await open(user);
      const dialog = await screen.findByRole("dialog", { name: title });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    });

    it.each(DIALOGS)("%s: Tab and Shift+Tab go round inside it, never out to the page behind", async (_name, visitor, path, open, title, arrange) => {
      arrange(mocks);
      const user = userEvent.setup();
      await openApp(visitor, path);
      await open(user);
      const dialog = await screen.findByRole("dialog", { name: title });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      for (let step = 0; step < 14; step += 1) {
        await user.tab();
        expect(dialog.contains(document.activeElement), `Tab ${step + 1} left the dialog: ${short(document.activeElement!)}`).toBe(true);
      }
      for (let step = 0; step < 14; step += 1) {
        await user.tab({ shift: true });
        expect(dialog.contains(document.activeElement), `Shift+Tab ${step + 1} left the dialog: ${short(document.activeElement!)}`).toBe(true);
      }
    });

    it.each(DIALOGS)("%s: Escape closes it, and focus returns to the control that opened it", async (_name, visitor, path, open, title, arrange) => {
      arrange(mocks);
      const user = userEvent.setup();
      await openApp(visitor, path);
      const trigger = await open(user);
      await screen.findByRole("dialog", { name: title });
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it("Escape does not close the removal dialog while the removal is in flight, and the dialog stays until it ends", async () => {
      DIALOGS[0][5](mocks);
      mocks.removeAttachment.mockReturnValue(never());
      const user = userEvent.setup();
      await openApp("REQUESTER", "/tickets/42");
      await DIALOGS[0][3](user);
      await user.type(await screen.findByLabelText(/^Removal reason/), "Uploaded to the wrong ticket.");
      await user.click(screen.getByRole("button", { name: "Remove attachment" }));
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Remove attachment?" })).toBeInTheDocument();
      // Nor does Cancel, nor does the reason change under the request: the dialog is waiting for an answer.
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByLabelText(/^Removal reason/)).toBeDisabled();
    });

    it("Escape does not close the Edit user panel while it is saving", async () => {
      mocks.updateUser.mockReturnValue(never());
      const user = userEvent.setup();
      await openApp("ADMINISTRATOR", "/users");
      await DIALOGS[2][3](user);
      const name = await screen.findByLabelText(/^Full name/);
      await user.clear(name);
      await user.type(name, "Anucha W. Wongsawat");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Edit user" })).toBeInTheDocument();
      expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    });

    it("when the control that opened the removal dialog is gone once the file is removed, focus goes to the Attachments heading", async () => {
      DIALOGS[0][5](mocks);
      mocks.removeAttachment.mockResolvedValue({ id: 90, originalFilename: "battery-report.pdf", mimeType: "application/pdf", sizeBytes: 184320, uploadedAt: "2026-09-28T09:20:00.000Z", removedAt: "2026-10-10T00:00:00.000Z", removalReason: "Uploaded to the wrong ticket.", downloadUrl: null });
      const user = userEvent.setup();
      await openApp("REQUESTER", "/tickets/42");
      await DIALOGS[0][3](user);
      await user.type(await screen.findByLabelText(/^Removal reason/), "Uploaded to the wrong ticket.");
      await user.click(screen.getByRole("button", { name: "Remove attachment" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /^Attachments/ })).toHaveFocus();
    });

    it("when the list is redrawn after a user is saved, focus goes to + Create user, not to nowhere", async () => {
      mocks.updateUser.mockResolvedValue({ id: 1, fullName: "Anucha W. Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true, department: null, mustChangePassword: false, lastLoginAt: null });
      const user = userEvent.setup();
      await openApp("ADMINISTRATOR", "/users");
      await DIALOGS[2][3](user);
      const name = await screen.findByLabelText(/^Full name/);
      await user.clear(name);
      await user.type(name, "Anucha W. Wongsawat");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole("button", { name: "+ Create user" })).toHaveFocus());
    });
  });
});

// ---------------------------------------------------------------------------
// UI-36 — nothing is said by colour alone
// ---------------------------------------------------------------------------

describe("UI-36 status, priority, role, follow-up, and owner badges carry text, not colour alone (AC-30, FR-31)", () => {
  const STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

  it("each of the eight statuses is a different word, never the raw code", () => {
    const words = STATUSES.map((status) => {
      const { container, unmount } = render(<StatusBadge value={status} />);
      const text = container.textContent ?? "";
      unmount();
      return text;
    });
    expect(new Set(words).size).toBe(8);
    for (const [index, word] of words.entries()) {
      expect(word.trim().length).toBeGreaterThan(2);
      expect(word, STATUSES[index]).not.toMatch(/_/);
      expect(word).toBe(STATUS_LABEL[STATUSES[index]]);
    }
  });

  it("each priority, each role, each account state, and each follow-up state is a different word", () => {
    const priorities = (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((value) => render(<PriorityBadge value={value} />).container.textContent);
    const roles = (["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).map((value) => render(<RoleBadge value={value} />).container.textContent);
    const accounts = [true, false].map((active) => render(<UserStatusBadge active={active} />).container.textContent);
    const followUp = [true, false].map((required) => render(<FollowUpPill required={required} />).container.textContent);
    const attachments = [true, false].map((removed) => render(<AttachmentBadge removed={removed} />).container.textContent);
    for (const group of [priorities, roles, accounts, followUp, attachments]) {
      expect(group.every((text) => (text ?? "").trim().length > 0)).toBe(true);
      expect(new Set(group).size).toBe(group.length);
    }
    expect(followUp).toEqual(["Follow-up needed", "No follow-up"]);
    expect(roles).toEqual(["Requester", "IT Staff", "Administrator"]);
  });

  it("the badge is an element with text a screen reader reads: not aria-hidden, not empty, not an icon alone", () => {
    const { container } = render(
      <>
        <StatusBadge value="WAITING_FOR_REQUESTER" />
        <PriorityBadge value="URGENT" />
        <RoleBadge value="IT_STAFF" />
        <FollowUpPill required />
        <OwnerPresentation owner={{ id: 1, fullName: "Kanya", role: "REQUESTER", isActive: true }} />
      </>,
    );
    for (const badge of Array.from(container.querySelectorAll("[data-badge]"))) {
      expect(badge.getAttribute("aria-hidden"), short(badge)).toBeNull();
      expect((badge.textContent ?? "").trim().length, short(badge)).toBeGreaterThan(1);
      expect(badge.querySelector("svg, img"), short(badge)).toBeNull();
    }
  });

  it.each(SCREENS)("%s: every badge on the screen has text", async (_name, visitor, path) => {
    await openApp(visitor, path);
    for (const badge of Array.from(document.querySelectorAll("[data-badge]"))) {
      expect(badge.getAttribute("aria-hidden"), short(badge)).toBeNull();
      expect((badge.textContent ?? "").trim().length, short(badge)).toBeGreaterThan(1);
    }
    // Colour is never set on an element by hand to say something the text does not.
    expect(document.querySelectorAll("[style*='color'], [style*='background']")).toHaveLength(0);
  });

  it("the statuses on the staff Dashboard's status rows, and the follow-up pill on its lists, read as words", async () => {
    await openApp("IT_STAFF", "/dashboard");
    for (const label of ["New", "Open", "In Progress", "Waiting for Requester", "Reopened"]) {
      // "Waiting for Requester" is both a card and a status row, so there are two links by that name.
      expect(screen.getAllByRole("link", { name: new RegExp(`^${label}: \\d+\\. View all$`) }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Follow-up needed").length).toBeGreaterThan(0);
  });
});
