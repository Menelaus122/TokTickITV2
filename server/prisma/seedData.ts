import type { Priority, PrismaClient, Role, TicketStatus } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/password.js";
import { nextTicketNumber } from "../src/ticketNumber.js";

// Lab 3 seed — docs/lab-03/specification.md §7.5.
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
];

type AccountKey = (typeof ACCOUNTS)[number]["key"];

interface SeedEntry {
  author: AccountKey;
  body: string;
  hoursAfter: number;
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
}

// Two tickets per status, spread across the four active Requesters, every
// priority, assigned and unassigned (§7.5). Every RESOLVED, CANCELLED, and
// REOPENED ticket carries the reason comment BR-36 and BR-37 require, written by
// the IT Staff member who would have made that transition. Summaries avoid the
// phrases the Lab 2 My Tickets suite searches for.
export const TICKETS: SeedTicket[] = [
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
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "RESOLVED", owner: "malee", daysAgo: 9,
    comments: [{ author: "malee", body: "Resolved: toner replaced and a test page printed.", hoursAfter: 3 }],
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

export interface SeedSummary {
  usersByRole: Record<Role, { active: number; inactive: number }>;
  ticketsByStatus: Partial<Record<TicketStatus, number>>;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function convergeAccount(prisma: PrismaClient, account: SeedAccount): Promise<number> {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true, passwordHash: true },
  });

  // Keep the stored hash when it already matches, so a second run leaves the
  // row byte-identical; rehash only when the password has drifted.
  const hashMatches = existing !== null && (await verifyPassword(SEED_PASSWORD, existing.passwordHash));
  const passwordHash = hashMatches ? existing.passwordHash! : await hashPassword(SEED_PASSWORD);

  const data = {
    fullName: account.fullName,
    department: account.department,
    role: account.role,
    isActive: account.isActive,
    mustChangePassword: account.mustChangePassword,
    passwordHash,
  };

  const user = await prisma.user.upsert({
    where: { email: account.email },
    update: data,
    create: { email: account.email, ...data },
    select: { id: true },
  });

  // A reset password must not leave an old session alive (as BR-47 does for an
  // Administrator's reset).
  if (existing !== null && !hashMatches) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }

  return user.id;
}

async function convergeTicket(
  prisma: PrismaClient,
  seed: SeedTicket,
  userIds: Map<string, number>,
  categoryIds: Map<string, number>,
  systemIds: Map<string, number>,
): Promise<void> {
  const requesterId = userIds.get(seed.requester)!;
  const createdAt = new Date(Date.now() - seed.daysAgo * DAY);

  const fields = {
    categoryId: categoryIds.get(seed.category)!,
    relatedSystemId: systemIds.get(seed.system)!,
    description: seed.description,
    requestedPriority: seed.requestedPriority,
    itPriority: seed.itPriority,
    currentStatus: seed.status,
    ownerId: seed.owner === null ? null : userIds.get(seed.owner)!,
    requesterResolvedAt: seed.requesterSaysResolved ? new Date(createdAt.getTime() + 26 * HOUR) : null,
  };

  // A seeded ticket is identified by its Requester and summary, which are
  // unique within this file. Its Ticket Number comes from the real generator,
  // so seeded tickets look exactly like ones raised through the app.
  const existing = await prisma.ticket.findFirst({
    where: { requesterId, summary: seed.summary },
    select: { id: true, createdAt: true },
  });

  let ticketId: number;
  let ticketCreatedAt: Date;

  if (existing) {
    await prisma.ticket.update({ where: { id: existing.id }, data: fields });
    ticketId = existing.id;
    ticketCreatedAt = existing.createdAt;
  } else {
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx, new Date().getFullYear());
      return tx.ticket.create({
        data: { ticketNumber, requesterId, summary: seed.summary, createdAt, ...fields },
        select: { id: true, createdAt: true },
      });
    });
    ticketId = ticket.id;
    ticketCreatedAt = ticket.createdAt;
  }

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

  return { usersByRole, ticketsByStatus };
}
