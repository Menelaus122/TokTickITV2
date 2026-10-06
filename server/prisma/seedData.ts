import { createHash } from "node:crypto";
import type { Priority, PrismaClient, Role, TicketStatus } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/password.js";
import { nextTicketNumber } from "../src/ticketNumber.js";

// Lab 3 seed — docs/lab-03/specification.md §7.5, extended by Lab 4 with Actions
// Taken, status history, and two accounts that show an empty dashboard
// (docs/lab-04/specification.md §7.5).
//
// The seed CONVERGES rather than only inserting. Every run puts each documented
// row back into its documented state, so running it twice ends in the same
// database, and running it after a demo or an E2E run undoes whatever they
// changed. Rows the seed does not document — tickets raised through the app,
// users created through User Management — are never touched.
//
// Credentials here are for local development only and are documented in
// README.md. None is a real person's password.

export const SEED_PASSWORD = "Toktickit#2026";

// The only documented account that must change its password after seeding, so
// the mandatory-change path can be tested without disturbing the accounts every
// other test logs in with (§7.5).
export const FIRST_LOGIN_EMAIL = "first.login@toktickit.local";

const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

export interface SeedAccount {
  key: string;
  fullName: string;
  email: string;
  department: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

// The first five are the Lab 2 Development Requesters, with the same emails, so
// on a migrated database they converge the existing rows rather than creating
// new ones (BR-60, BR-61). The migration leaves them with no hash and the
// change flag set; this is where they get the documented password and the flag
// is cleared.
export const ACCOUNTS: SeedAccount[] = [
  { key: "anucha", fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", department: "Civil Engineering", role: "REQUESTER", isActive: true, mustChangePassword: false },
  { key: "kanya", fullName: "Kanya Srisai", email: "kanya.sris@kmutt.ac.th", department: "Registrar", role: "REQUESTER", isActive: true, mustChangePassword: false },
  { key: "pornchai", fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", department: "Library", role: "REQUESTER", isActive: true, mustChangePassword: false },
  { key: "suchada", fullName: "Suchada Meesuk", email: "suchada.mees@kmutt.ac.th", department: "Finance", role: "REQUESTER", isActive: true, mustChangePassword: false },
  // Inactive on purpose: proves an inactive account cannot log in.
  { key: "wichai", fullName: "Wichai Boonmee", email: "wichai.boon@kmutt.ac.th", department: "Facilities", role: "REQUESTER", isActive: false, mustChangePassword: false },

  { key: "firstLogin", fullName: "Somchai Jaidee", email: FIRST_LOGIN_EMAIL, department: "Student Affairs", role: "REQUESTER", isActive: true, mustChangePassword: true },

  { key: "nattapong", fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", department: "IT Service Desk", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  { key: "siriporn", fullName: "Siriporn Kaewmanee", email: "siriporn.it@toktickit.local", department: "IT Service Desk", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  { key: "thanakorn", fullName: "Thanakorn Rattana", email: "thanakorn.it@toktickit.local", department: "IT Service Desk", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  // Inactive on purpose: still owns a ticket, which is how BR-26 is shown.
  { key: "prasert", fullName: "Prasert Chaiyo", email: "prasert.it@toktickit.local", department: "IT Service Desk", role: "IT_STAFF", isActive: false, mustChangePassword: false },

  // Two active Administrators, so the last-Administrator rule can be tested from
  // both sides (§7.5, BR-49).
  { key: "malee", fullName: "Malee Sutthiwong", email: "malee.admin@toktickit.local", department: "IT Administration", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
  { key: "kittisak", fullName: "Kittisak Phromma", email: "kittisak.admin@toktickit.local", department: "IT Administration", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },

  // Lab 4 (§7.5, D-21): two accounts with nothing to show, so the zero-data state
  // of each dashboard can be seen by signing in. Neither owns, requests, or
  // performs anything, and neither is ever given a ticket, comment, or action
  // below. A Requester with no tickets, and an IT Staff member with no work.
  { key: "noTickets", fullName: "Ratree Chaiwat", email: "no.tickets@toktickit.local", department: "Student Affairs", role: "REQUESTER", isActive: true, mustChangePassword: false },
  { key: "idleIt", fullName: "Worawut Intarat", email: "idle.it@toktickit.local", department: "IT Service Desk", role: "IT_STAFF", isActive: true, mustChangePassword: false },
];

type AccountKey = (typeof ACCOUNTS)[number]["key"];

interface SeedEntry {
  author: AccountKey;
  body: string;
  hoursAfter: number;
}

// One Action Taken (Lab 4 BR-03 to BR-08). `actionAfter` is the Action Date/Time
// the person typed and `recordedAfter` is when it was recorded, both in hours
// after the ticket was created. They differ on purpose where someone logged
// earlier work afterwards, which is what BR-17 and WF-19 are about.
export interface SeedAction {
  by: AccountKey;
  actionAfter: number;
  recordedAfter: number;
  description: string;
  result: string;
  /** Present exactly when the action says Follow-Up Required? = Yes (BR-04). */
  followUp?: string;
  attachmentNotes?: string;
}

// One status change (Lab 4 BR-21). The "from" is the step before it, starting
// at NEW, so a chain cannot be written out of order or skip a status.
export interface SeedStep {
  by: AccountKey;
  to: TicketStatus;
  after: number;
}

interface SeedTicket {
  requester: AccountKey;
  category: string;
  system: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  status: TicketStatus;
  owner: AccountKey | null;
  daysAgo: number;
  requesterSaysResolved?: boolean;
  comments?: SeedEntry[];
  notes?: SeedEntry[];
  actions?: SeedAction[];
  history?: SeedStep[];
}

// Two tickets per status, spread across the four active Requesters, every
// priority, assigned and unassigned (§7.5). Every RESOLVED, CANCELLED, and
// REOPENED ticket carries the reason comment BR-36 and BR-37 require, written by
// the IT Staff member who would have made that transition. Summaries avoid the
// phrases the Lab 2 My Tickets suite searches for.
const SEEDED_TICKETS: SeedTicket[] = [
  {
    requester: "anucha", category: "Account and Access", system: "Email",
    summary: "Cannot sign in to staff email since password expiry",
    description: "My staff email password expired this morning and the reset page says my account is locked.",
    requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", owner: null, daysAgo: 0.2,
  },
  {
    requester: "kanya", category: "Software", system: "Grade Submission App",
    summary: "Grade upload rejects the CSV export",
    description: "The grade submission app rejects the CSV exported from the registrar system with a format error.",
    requestedPriority: "URGENT", itPriority: "URGENT", status: "NEW", owner: null, daysAgo: 0.5,
  },
  {
    requester: "pornchai", category: "Network", system: "Campus Wi-Fi",
    summary: "Library reading room Wi-Fi drops every few minutes",
    description: "Students in the second floor reading room lose the Wi-Fi connection every few minutes all day.",
    requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", owner: "nattapong", daysAgo: 3,
    comments: [{ author: "nattapong", body: "Thanks for the report. We are checking the access point in the reading room.", hoursAfter: 2 }],
  },
  {
    requester: "suchada", category: "Hardware", system: "Printer",
    summary: "Finance office printer jams on every second page",
    description: "The shared printer in the finance office jams on every second page when printing double-sided.",
    requestedPriority: "LOW", itPriority: "LOW", status: "OPEN", owner: "siriporn", daysAgo: 2,
  },
  {
    requester: "anucha", category: "Network", system: "VPN",
    summary: "VPN disconnects when uploading large drawings",
    description: "The VPN connection drops whenever I upload large CAD drawings to the department file share.",
    requestedPriority: "HIGH", itPriority: "HIGH", status: "IN_PROGRESS", owner: "nattapong", daysAgo: 5,
    comments: [
      { author: "anucha", body: "It happens most often with files over 200 MB.", hoursAfter: 4 },
      { author: "nattapong", body: "We have raised the VPN idle timeout and are testing large uploads now.", hoursAfter: 20 },
    ],
    notes: [{ author: "nattapong", body: "Suspect the MTU on the VPN concentrator; compare with the engineering subnet.", hoursAfter: 21 }],
  },
  {
    requester: "kanya", category: "Software", system: "LEB2 App",
    summary: "LEB2 shows the wrong timetable for semester 1",
    description: "LEB2 shows the semester 2 timetable when I select semester 1 for the registrar staff view.",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "IN_PROGRESS", owner: "thanakorn", daysAgo: 4,
  },
  {
    requester: "pornchai", category: "Hardware", system: "Corporate Laptop",
    summary: "Work laptop fan runs loudly and the machine overheats",
    description: "The fan on my work machine runs at full speed and the case becomes too hot to touch after an hour.",
    requestedPriority: "MEDIUM", itPriority: "LOW", status: "WAITING_FOR_REQUESTER", owner: "siriporn", daysAgo: 6,
    comments: [{ author: "siriporn", body: "Could you tell us the asset tag on the bottom of the machine?", hoursAfter: 6 }],
  },
  {
    requester: "suchada", category: "Account and Access", system: "Email",
    summary: "Shared finance mailbox missing from Outlook",
    description: "The shared finance mailbox disappeared from Outlook after the weekend and I cannot see its folders.",
    requestedPriority: "HIGH", itPriority: "HIGH", status: "WAITING_FOR_REQUESTER", owner: "thanakorn", daysAgo: 7,
    requesterSaysResolved: true,
    comments: [
      { author: "thanakorn", body: "Please confirm whether the mailbox appears after restarting Outlook.", hoursAfter: 5 },
      { author: "suchada", body: "It shows up now after the restart, thank you.", hoursAfter: 26 },
    ],
    notes: [{ author: "thanakorn", body: "Mailbox permission was granted through the admin console at 10:40.", hoursAfter: 4 }],
  },
  {
    requester: "anucha", category: "Software", system: "Email",
    summary: "Calendar invites arrive one hour late",
    description: "Meeting invites from other faculties arrive about an hour after they were sent.",
    requestedPriority: "LOW", itPriority: "LOW", status: "RESOLVED", owner: "nattapong", daysAgo: 10,
    comments: [{ author: "nattapong", body: "Resolved: the mail server clock was corrected and invites now arrive on time.", hoursAfter: 30 }],
  },
  {
    requester: "kanya", category: "Hardware", system: "Printer",
    summary: "Registrar printer toner is empty",
    description: "The registrar office printer reports an empty toner cartridge and prints blank pages.",
    // Owned by an Administrator: assignable, though not an operator (BR-20).
    // The resolution itself is an IT Staff action (BR-32), so IT Staff write
    // the reason comment (BR-36).
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "RESOLVED", owner: "malee", daysAgo: 9,
    comments: [{ author: "siriporn", body: "Resolved: toner replaced and a test page printed.", hoursAfter: 3 }],
  },
  {
    requester: "pornchai", category: "Network", system: "Campus Wi-Fi",
    summary: "Cannot join Wi-Fi with the new library tablet",
    description: "The new library kiosk tablet cannot join the staff Wi-Fi network and shows an authentication error.",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "CLOSED", owner: "siriporn", daysAgo: 14,
    comments: [{ author: "siriporn", body: "Resolved: the tablet is registered on the staff network.", hoursAfter: 8 }],
  },
  {
    requester: "suchada", category: "Software", system: "Grade Submission App",
    summary: "Request access to the grade submission app",
    description: "I need read access to the grade submission app to reconcile the finance reports for each faculty.",
    requestedPriority: "LOW", itPriority: "LOW", status: "CLOSED", owner: "thanakorn", daysAgo: 12,
    comments: [{ author: "thanakorn", body: "Resolved: read access granted for the finance role.", hoursAfter: 10 }],
  },
  {
    requester: "anucha", category: "Hardware", system: "Corporate Laptop",
    summary: "Docking station stopped charging",
    description: "The docking station at my desk no longer charges my work machine, although the screens still work.",
    // Re-prioritised above what the Requester asked for (BR-28).
    requestedPriority: "HIGH", itPriority: "URGENT", status: "REOPENED", owner: "nattapong", daysAgo: 8,
    comments: [
      { author: "nattapong", body: "Resolved: the dock was reset and is charging again.", hoursAfter: 6 },
      { author: "nattapong", body: "Reopened: the Requester reports the dock stopped charging again.", hoursAfter: 50 },
    ],
    notes: [{ author: "nattapong", body: "Dock firmware is two versions behind; update it before replacing the hardware.", hoursAfter: 51 }],
  },
  {
    requester: "kanya", category: "Network", system: "VPN",
    summary: "VPN asks for the authenticator code twice",
    description: "Every VPN sign-in asks for the authenticator code twice before it connects.",
    // Owned by a deactivated account: ownership survives deactivation (BR-26).
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "REOPENED", owner: "prasert", daysAgo: 11,
    comments: [
      { author: "prasert", body: "Resolved: the duplicate prompt was a client setting.", hoursAfter: 12 },
      { author: "prasert", body: "Reopened: the duplicate prompt came back after the client update.", hoursAfter: 60 },
    ],
    notes: [{ author: "kittisak", body: "Prasert's account is deactivated; this ticket needs reassigning.", hoursAfter: 70 }],
  },
  {
    requester: "pornchai", category: "Account and Access", system: "LEB2 App",
    summary: "Duplicate request for a LEB2 password reset",
    description: "I need my LEB2 password reset because I can no longer sign in to the library account.",
    // Cancelled without anyone claiming it first, which BR-35 permits.
    requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", owner: null, daysAgo: 3,
    comments: [{ author: "siriporn", body: "Cancelled: this duplicates an earlier ticket for the same request.", hoursAfter: 1 }],
  },
  {
    requester: "suchada", category: "Hardware", system: "Printer",
    summary: "Printer request raised in the wrong category",
    description: "Raised this printer request under the wrong category by mistake; please ignore it.",
    requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", owner: "siriporn", daysAgo: 4,
    comments: [{ author: "siriporn", body: "Cancelled: raised under the wrong category, and a new ticket has been opened.", hoursAfter: 2 }],
  },
];

// ---------------------------------------------------------------------------
// Lab 4 — what was done on those tickets (specification §7.5). Keyed by summary,
// which is already how this file identifies a seeded ticket. Times are hours
// after the ticket was created, and each status change lines up with the reason
// comment above where there is one (a Resolved comment at +30 h, a Resolved
// change at +30 h).
//
// The spread, on purpose:
//   * no actions on the NEW and CANCELLED tickets; one on most OPEN and CLOSED;
//     several on the IN_PROGRESS ones, one of them by an IT Staff member who is
//     not the Owner (BR-02);
//   * a RESOLVED ticket whose work was recorded by an Administrator (BR-45);
//   * the most recently recorded action needs follow-up on the WAITING tickets
//     and on one IN_PROGRESS ticket (the gate's FOLLOW_UP_PENDING), and never on
//     a RESOLVED one;
//   * one REOPENED ticket with no action since the reopen (resolving is blocked)
//     and one with a fresh action after it (resolving is allowed);
//   * one ticket whose newest-recorded action is dated EARLIER than another, so
//     a list ordered by date and the gate's "latest" disagree (BR-08, BR-17).
// ---------------------------------------------------------------------------
const ACTIVITY: Record<string, { actions?: SeedAction[]; history?: SeedStep[] }> = {
  "Library reading room Wi-Fi drops every few minutes": {
    history: [{ by: "nattapong", to: "OPEN", after: 2 }],
    actions: [
      {
        by: "nattapong", actionAfter: 3, recordedAfter: 3.2,
        description: "Checked the access point in the second-floor reading room and found it running old firmware.",
        result: "A firmware update is scheduled for tonight; nothing changes for users until then.",
        followUp: "Check the reading room Wi-Fi logs tomorrow morning to confirm the drops have stopped.",
      },
    ],
  },
  "Finance office printer jams on every second page": {
    history: [{ by: "siriporn", to: "OPEN", after: 1 }],
    actions: [
      {
        by: "siriporn", actionAfter: 2, recordedAfter: 2.1,
        description: "Opened the printer and cleaned the paper-feed rollers.",
        result: "A 20-page double-sided test printed without a jam.",
      },
    ],
  },
  "VPN disconnects when uploading large drawings": {
    history: [
      { by: "nattapong", to: "OPEN", after: 1 },
      { by: "nattapong", to: "IN_PROGRESS", after: 3 },
    ],
    actions: [
      {
        by: "nattapong", actionAfter: 5, recordedAfter: 5.1,
        description: "Raised the VPN idle timeout from 5 to 30 minutes on the concentrator.",
        result: "The disconnect at the 5-minute mark is gone; uploads over 200 MB still drop.",
      },
      {
        // Not the Owner: a colleague on the same ticket (BR-02).
        by: "thanakorn", actionAfter: 22, recordedAfter: 22.1,
        description: "Compared the MTU on the VPN concentrator with the one on the engineering subnet.",
        result: "The engineering subnet uses 1400 and the concentrator 1500, which explains the drops on large uploads.",
      },
      {
        by: "nattapong", actionAfter: 30, recordedAfter: 30.2,
        description: "Set the concentrator MTU to 1400 and re-tested a 300 MB upload.",
        result: "The upload finished without a disconnect.",
        attachmentNotes: "Look for the throughput graph named vpn-upload-test.png.",
      },
    ],
  },
  "LEB2 shows the wrong timetable for semester 1": {
    history: [
      { by: "thanakorn", to: "OPEN", after: 1 },
      { by: "thanakorn", to: "IN_PROGRESS", after: 2 },
    ],
    actions: [
      {
        by: "thanakorn", actionAfter: 30, recordedAfter: 30.1,
        description: "Compared the semester selector configuration with what the registrar view requests.",
        result: "The registrar view maps semester 1 to the wrong term code.",
      },
      {
        // Recorded last but dated earlier than the entry above: a late log of
        // yesterday's call. The newest-recorded action needs follow-up, so the
        // gate refuses RESOLVED even though a list by date ends on the other one.
        by: "siriporn", actionAfter: 25, recordedAfter: 40,
        description: "Late entry for yesterday's call with the registrar about the term codes.",
        result: "The registrar will send a corrected term-code export.",
        followUp: "Wait for the corrected term-code export from the registrar before changing the mapping.",
        attachmentNotes: "The call notes are in the registrar's email titled LEB2 term codes.",
      },
    ],
  },
  "Work laptop fan runs loudly and the machine overheats": {
    history: [
      { by: "siriporn", to: "OPEN", after: 1 },
      { by: "siriporn", to: "IN_PROGRESS", after: 2 },
      { by: "siriporn", to: "WAITING_FOR_REQUESTER", after: 6 },
    ],
    actions: [
      {
        by: "siriporn", actionAfter: 4, recordedAfter: 4.1,
        description: "Ran the vendor diagnostics on the work laptop.",
        result: "The fan sensor reports normal readings; the asset tag is needed to check the warranty.",
        followUp: "Look up the warranty with the asset tag as soon as the Requester replies.",
      },
    ],
  },
  "Shared finance mailbox missing from Outlook": {
    history: [
      { by: "thanakorn", to: "OPEN", after: 1 },
      { by: "thanakorn", to: "IN_PROGRESS", after: 2 },
      { by: "thanakorn", to: "WAITING_FOR_REQUESTER", after: 5 },
    ],
    actions: [
      {
        by: "thanakorn", actionAfter: 4, recordedAfter: 4.1,
        description: "Granted the shared finance mailbox permission through the admin console.",
        result: "The mailbox is visible in the web client.",
      },
      {
        by: "thanakorn", actionAfter: 24, recordedAfter: 24.1,
        description: "Asked the Requester to restart Outlook and check the mailbox again.",
        result: "The Requester says the mailbox appears after the restart.",
        followUp: "Confirm the mailbox is still visible in two days before resolving.",
      },
    ],
  },
  "Calendar invites arrive one hour late": {
    history: [
      { by: "nattapong", to: "OPEN", after: 1 },
      { by: "nattapong", to: "IN_PROGRESS", after: 4 },
      { by: "nattapong", to: "RESOLVED", after: 30 },
    ],
    actions: [
      {
        by: "nattapong", actionAfter: 10, recordedAfter: 10.1,
        description: "Compared the mail server clock with network time.",
        result: "The mail server clock was 61 minutes behind.",
      },
      {
        by: "nattapong", actionAfter: 29, recordedAfter: 29.1,
        description: "Corrected the mail server clock and sent test invites from another faculty.",
        result: "Invites now arrive within a minute.",
      },
    ],
  },
  "Registrar printer toner is empty": {
    history: [
      { by: "siriporn", to: "OPEN", after: 1 },
      { by: "siriporn", to: "IN_PROGRESS", after: 2 },
      { by: "siriporn", to: "RESOLVED", after: 3 },
    ],
    actions: [
      {
        // An Administrator acting as themself on a ticket they own (BR-45).
        by: "malee", actionAfter: 2.5, recordedAfter: 2.6,
        description: "Replaced the empty toner cartridge and printed a test page.",
        result: "The test page printed cleanly.",
      },
    ],
  },
  "Cannot join Wi-Fi with the new library tablet": {
    history: [
      { by: "siriporn", to: "OPEN", after: 1 },
      { by: "siriporn", to: "IN_PROGRESS", after: 3 },
      { by: "siriporn", to: "RESOLVED", after: 8 },
      { by: "siriporn", to: "CLOSED", after: 30 },
    ],
    actions: [
      {
        by: "siriporn", actionAfter: 7, recordedAfter: 7.1,
        description: "Registered the kiosk tablet's hardware address on the staff network.",
        result: "The tablet joins the staff Wi-Fi.",
      },
    ],
  },
  "Request access to the grade submission app": {
    history: [
      { by: "thanakorn", to: "OPEN", after: 1 },
      { by: "thanakorn", to: "IN_PROGRESS", after: 3 },
      { by: "thanakorn", to: "RESOLVED", after: 10 },
      { by: "thanakorn", to: "CLOSED", after: 36 },
    ],
    actions: [
      {
        by: "thanakorn", actionAfter: 9, recordedAfter: 9.1,
        description: "Granted read access to the grade submission app for the finance role.",
        result: "The Requester confirmed the access works.",
      },
    ],
  },
  "Docking station stopped charging": {
    // Reopened, and nothing has been recorded since: resolving it again is blocked (BR-17).
    history: [
      { by: "nattapong", to: "OPEN", after: 1 },
      { by: "nattapong", to: "IN_PROGRESS", after: 3 },
      { by: "nattapong", to: "RESOLVED", after: 6 },
      { by: "nattapong", to: "REOPENED", after: 50 },
    ],
    actions: [
      {
        by: "nattapong", actionAfter: 4.5, recordedAfter: 5,
        description: "Reset the docking station and updated its power profile.",
        result: "The dock charged the laptop again.",
      },
    ],
  },
  "VPN asks for the authenticator code twice": {
    // Reopened with a fresh action after the reopen: resolving it is allowed.
    history: [
      { by: "prasert", to: "OPEN", after: 1 },
      { by: "prasert", to: "IN_PROGRESS", after: 4 },
      { by: "prasert", to: "RESOLVED", after: 12 },
      { by: "prasert", to: "REOPENED", after: 60 },
    ],
    actions: [
      {
        by: "prasert", actionAfter: 10, recordedAfter: 10.1,
        description: "Changed the authenticator prompt setting in the VPN client.",
        result: "The prompt appeared once in a test sign-in.",
      },
      {
        // Typed as 63 h, recorded at 64 h: after the reopen at 60 h.
        by: "siriporn", actionAfter: 63, recordedAfter: 64,
        description: "Reverted the VPN client update and asked the Requester to retest.",
        result: "The duplicate prompt no longer appears in a test sign-in.",
      },
    ],
  },
  "Duplicate request for a LEB2 password reset": {
    history: [{ by: "siriporn", to: "CANCELLED", after: 1 }],
  },
  "Printer request raised in the wrong category": {
    history: [
      { by: "siriporn", to: "OPEN", after: 1 },
      { by: "siriporn", to: "CANCELLED", after: 2 },
    ],
  },
};

// A summary that matches no ticket would attach its activity to nothing and
// pass silently, so it is a mistake caught here, when the file loads.
for (const summary of Object.keys(ACTIVITY)) {
  if (!SEEDED_TICKETS.some((ticket) => ticket.summary === summary)) {
    throw new Error(`seed activity names a ticket that does not exist: "${summary}"`);
  }
}

export const TICKETS: SeedTicket[] = SEEDED_TICKETS.map((ticket) => ({ ...ticket, ...ACTIVITY[ticket.summary] }));

export interface SeedSummary {
  usersByRole: Record<Role, { active: number; inactive: number }>;
  ticketsByStatus: Partial<Record<TicketStatus, number>>;
  /** Rows in the database after seeding, not only the ones this seed wrote. */
  actions: number;
  statusChanges: number;
}

// The request key an Action Taken is recorded under (Lab 4 BR-28). It is derived
// from the same identity the seed uses for a ticket (Requester and summary), so a
// reordered list cannot change it, and it fits the key's 8 to 64 characters.
function seedRequestKey(seed: SeedTicket, n: number): string {
  const ticket = createHash("sha1").update(`${seed.requester}|${seed.summary}`).digest("hex").slice(0, 8);
  return `seed-${ticket}-${n}`;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// When the Requester's "appears resolved" signal lands, in hours after creation.
const RESOLVED_SIGNAL_HOURS = 26;

const sameTime = (a: Date | null, b: Date | null) => (a === null || b === null ? a === b : a.getTime() === b.getTime());

// Converging rows are only WRITTEN when they have drifted. An unconditional
// update would bump @updatedAt on every run, so a second run would not end in
// the same database and every sample row would look "just updated".
async function convergeAccount(prisma: PrismaClient, account: SeedAccount): Promise<number> {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true, fullName: true, department: true, role: true, isActive: true, mustChangePassword: true, passwordHash: true },
  });

  // Keep the stored hash when it already matches; bcrypt salts every hash, so
  // rehashing an unchanged password would itself be a change.
  const hashMatches = existing !== null && (await verifyPassword(SEED_PASSWORD, existing.passwordHash));
  const passwordHash = hashMatches ? existing.passwordHash! : await hashPassword(SEED_PASSWORD);

  const desired = {
    fullName: account.fullName,
    department: account.department,
    role: account.role,
    isActive: account.isActive,
    mustChangePassword: account.mustChangePassword,
    passwordHash,
  };

  if (existing === null) {
    const created = await prisma.user.create({ data: { email: account.email, ...desired }, select: { id: true } });
    return created.id;
  }

  const drifted =
    !hashMatches ||
    existing.fullName !== desired.fullName ||
    existing.department !== desired.department ||
    existing.role !== desired.role ||
    existing.isActive !== desired.isActive ||
    existing.mustChangePassword !== desired.mustChangePassword;

  if (drifted) {
    await prisma.user.update({ where: { id: existing.id }, data: desired });
  }

  // A reset password must not leave an old session alive (as BR-47 does for an
  // Administrator's reset).
  if (!hashMatches) {
    await prisma.session.deleteMany({ where: { userId: existing.id } });
  }

  return existing.id;
}

async function convergeTicket(
  prisma: PrismaClient,
  seed: SeedTicket,
  userIds: Map<string, number>,
  categoryIds: Map<string, number>,
  systemIds: Map<string, number>,
): Promise<void> {
  const requesterId = userIds.get(seed.requester)!;

  // A seeded ticket is identified by its Requester and summary, which are
  // unique within this file. Its Ticket Number comes from the real generator,
  // so seeded tickets look exactly like ones raised through the app.
  const existing = await prisma.ticket.findFirst({
    where: { requesterId, summary: seed.summary },
    select: {
      id: true, createdAt: true, updatedAt: true, categoryId: true, relatedSystemId: true, description: true,
      requestedPriority: true, itPriority: true, currentStatus: true, ownerId: true, requesterResolvedAt: true,
    },
  });

  // Every timestamp hangs off the ticket's own createdAt — the stored one once
  // it exists — so re-running the seed never moves a ticket's timeline.
  const createdAt = existing?.createdAt ?? new Date(Date.now() - seed.daysAgo * DAY);
  const at = (hours: number) => new Date(createdAt.getTime() + hours * HOUR);

  const fields = {
    categoryId: categoryIds.get(seed.category)!,
    relatedSystemId: systemIds.get(seed.system)!,
    description: seed.description,
    requestedPriority: seed.requestedPriority,
    itPriority: seed.itPriority,
    currentStatus: seed.status,
    ownerId: seed.owner === null ? null : userIds.get(seed.owner)!,
    requesterResolvedAt: seed.requesterSaysResolved ? at(RESOLVED_SIGNAL_HOURS) : null,
  };

  // "Last Updated" is the ticket's last seeded activity, not the moment the
  // seed ran, so the queue's Last Updated column reads like real history.
  const lastActivityHours = Math.max(
    0,
    ...(seed.comments ?? []).map((c) => c.hoursAfter),
    ...(seed.notes ?? []).map((n) => n.hoursAfter),
    // Recording an action and changing a status both move Last Updated (BR-11).
    ...(seed.actions ?? []).map((a) => a.recordedAfter),
    ...(seed.history ?? []).map((step) => step.after),
    seed.requesterSaysResolved ? RESOLVED_SIGNAL_HOURS : 0,
  );
  const updatedAt = at(lastActivityHours);

  let ticketId: number;

  if (existing) {
    ticketId = existing.id;
    const drifted =
      existing.categoryId !== fields.categoryId ||
      existing.relatedSystemId !== fields.relatedSystemId ||
      existing.description !== fields.description ||
      existing.requestedPriority !== fields.requestedPriority ||
      existing.itPriority !== fields.itPriority ||
      existing.currentStatus !== fields.currentStatus ||
      existing.ownerId !== fields.ownerId ||
      !sameTime(existing.requesterResolvedAt, fields.requesterResolvedAt);
    // Untouched rows stay untouched, updatedAt included, with one exception: a
    // ticket whose Last Updated is older than its seeded activity is brought up
    // to it, so a seeded action is never newer than the ticket that holds it
    // (Lab 4 BR-11). It is a one-time catch-up; the next run finds nothing behind.
    if (drifted) {
      await prisma.ticket.update({ where: { id: existing.id }, data: { ...fields, updatedAt } });
    } else if (existing.updatedAt.getTime() < updatedAt.getTime()) {
      await prisma.ticket.update({ where: { id: existing.id }, data: { updatedAt } });
    }
  } else {
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx, new Date().getFullYear());
      return tx.ticket.create({
        data: { ticketNumber, requesterId, summary: seed.summary, createdAt, updatedAt, ...fields },
        select: { id: true },
      });
    });
    ticketId = ticket.id;
  }

  const ticketCreatedAt = createdAt;

  // Comments and notes are append-only (BR-42), so the seed only adds the ones
  // that are missing and never removes anything a demo added.
  for (const entry of seed.comments ?? []) {
    const authorId = userIds.get(entry.author)!;
    const found = await prisma.publicComment.findFirst({ where: { ticketId, authorId, body: entry.body } });
    if (!found) {
      await prisma.publicComment.create({
        data: { ticketId, authorId, body: entry.body, createdAt: new Date(ticketCreatedAt.getTime() + entry.hoursAfter * HOUR) },
      });
    }
  }

  for (const entry of seed.notes ?? []) {
    const authorId = userIds.get(entry.author)!;
    const found = await prisma.internalNote.findFirst({ where: { ticketId, authorId, body: entry.body } });
    if (!found) {
      await prisma.internalNote.create({
        data: { ticketId, authorId, body: entry.body, createdAt: new Date(ticketCreatedAt.getTime() + entry.hoursAfter * HOUR) },
      });
    }
  }

  // Status history is append-only too (Lab 4 BR-22), so the seed adds the steps
  // that are missing and never removes one a demo added. A step is identified by
  // what it is, because it has no key of its own.
  let from: TicketStatus = "NEW";
  for (const step of seed.history ?? []) {
    const changedById = userIds.get(step.by)!;
    const stepAt = at(step.after);
    const found = await prisma.ticketStatusChange.findFirst({
      where: { ticketId, fromStatus: from, toStatus: step.to, changedById, createdAt: stepAt },
      select: { id: true },
    });
    if (!found) {
      await prisma.ticketStatusChange.create({ data: { ticketId, fromStatus: from, toStatus: step.to, changedById, createdAt: stepAt } });
    }
    from = step.to;
  }

  // Actions Taken are identified by the request key they were recorded under,
  // the same key that makes a double submit safe in the app (Lab 4 BR-28), and
  // converge to the documented text and times if a demo edited them.
  for (const [index, action] of (seed.actions ?? []).entries()) {
    const performedById = userIds.get(action.by)!;
    const requestKey = seedRequestKey(seed, index + 1);
    const recordedAt = at(action.recordedAfter);
    const desired = {
      actionAt: at(action.actionAfter),
      description: action.description,
      result: action.result,
      followUpRequired: action.followUp !== undefined,
      followUpNote: action.followUp ?? null,
      attachmentNotes: action.attachmentNotes ?? null,
    };
    const stored = await prisma.actionTaken.findUnique({
      where: { ticketId_performedById_requestKey: { ticketId, performedById, requestKey } },
    });

    if (!stored) {
      await prisma.actionTaken.create({
        data: { ticketId, performedById, requestKey, createdAt: recordedAt, updatedAt: recordedAt, ...desired },
      });
      continue;
    }

    const drifted =
      stored.actionAt.getTime() !== desired.actionAt.getTime() ||
      stored.createdAt.getTime() !== recordedAt.getTime() ||
      stored.description !== desired.description ||
      stored.result !== desired.result ||
      stored.followUpRequired !== desired.followUpRequired ||
      stored.followUpNote !== desired.followUpNote ||
      stored.attachmentNotes !== desired.attachmentNotes ||
      stored.updatedById !== null ||
      stored.version !== 1;
    if (drifted) {
      // Back to a record nobody has edited.
      await prisma.actionTaken.update({
        where: { id: stored.id },
        data: { ...desired, createdAt: recordedAt, updatedAt: recordedAt, updatedById: null, version: 1 },
      });
    }
  }
}

export async function runSeed(prisma: PrismaClient): Promise<SeedSummary> {
  const categoryIds = new Map<string, number>();
  for (const name of CATEGORY_NAMES) {
    const row = await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
      select: { id: true },
    });
    categoryIds.set(name, row.id);
  }

  const systemIds = new Map<string, number>();
  for (const name of RELATED_SYSTEM_NAMES) {
    const row = await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
      select: { id: true },
    });
    systemIds.set(name, row.id);
  }

  const userIds = new Map<string, number>();
  for (const account of ACCOUNTS) {
    userIds.set(account.key, await convergeAccount(prisma, account));
  }

  for (const ticket of TICKETS) {
    await convergeTicket(prisma, ticket, userIds, categoryIds, systemIds);
  }

  const roles: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
  const usersByRole = {} as SeedSummary["usersByRole"];
  for (const role of roles) {
    usersByRole[role] = {
      active: await prisma.user.count({ where: { role, isActive: true } }),
      inactive: await prisma.user.count({ where: { role, isActive: false } }),
    };
  }

  const grouped = await prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } });
  const ticketsByStatus: SeedSummary["ticketsByStatus"] = {};
  for (const row of grouped) ticketsByStatus[row.currentStatus] = row._count._all;

  return {
    usersByRole,
    ticketsByStatus,
    actions: await prisma.actionTaken.count(),
    statusChanges: await prisma.ticketStatusChange.count(),
  };
}
