import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import * as api from "../../src/api.js";
import type { AuthUser, Role, StaffTicketDetail as StaffDetail, TicketDetail } from "../../src/api.js";

// Lab 4, Issue 9 — the whole application, as a person in each role meets it, with only the API
// client replaced (the system boundary). FinalRegression.test.tsx drives every screen through it.
//
// Not a test file: Vitest's `include` takes `*.test.tsx` only.

export type Visitor = Role | "SIGNED_OUT" | "MUST_CHANGE";

export const USERS: Record<Role, AuthUser> = {
  REQUESTER: { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true, mustChangePassword: false },
  IT_STAFF: { id: 7, fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  ADMINISTRATOR: { id: 9, fullName: "Malee Sutthiwong", email: "malee.admin@toktickit.local", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
};
export const MUST_CHANGE: AuthUser = { ...USERS.REQUESTER, id: 2, fullName: "Pornchai Thana", email: "pornchai@toktickit.local", mustChangePassword: true };

export const REQUESTER_TICKET: TicketDetail = {
  id: 42,
  ticketNumber: "TT-2026-00042",
  ticketDate: "2026-09-28T02:10:00.000Z",
  summary: "Printer on floor 3 will not print",
  description: "It shows a paper jam, but there is no paper stuck in it.",
  requestedPriority: "MEDIUM",
  currentStatus: "IN_PROGRESS",
  requester: { id: 1, fullName: "Anucha Wongsawat" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 2, name: "Campus Printers" },
  createdAt: "2026-09-28T02:10:00.000Z",
  updatedAt: "2026-09-29T09:14:22.310Z",
  requesterResolvedAt: null,
  attachments: [],
};

export const STAFF_TICKET: StaffDetail = {
  id: 12,
  ticketNumber: "TT-2026-00012",
  summary: "Printer on floor 3 will not print",
  description: "It shows a paper jam, but there is no paper stuck in it.",
  categoryName: "Hardware",
  relatedSystemName: "Campus Printers",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "IN_PROGRESS",
  owner: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
  requesterResolvedAt: null,
  version: 3,
  requester: { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true },
  createdAt: "2026-09-28T02:10:00.000Z",
  updatedAt: "2026-09-29T09:14:22.310Z",
  attachments: [],
  permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
  blockedTransitions: [{ to: "RESOLVED", code: "ACTION_REQUIRED", message: "Record at least one action before resolving this ticket." }],
};

export const REQUESTER_BOARD: api.RequesterDashboard = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    openTickets: { value: 3, href: "/tickets?group=open" },
    waitingForYou: { value: 1, href: "/tickets?status=WAITING_FOR_REQUESTER" },
    resolved: { value: 5, href: "/tickets?status=RESOLVED" },
    closed: { value: 12, href: "/tickets?status=CLOSED" },
  },
  needsAttention: [{ id: 42, ticketNumber: "TT-2026-00042", summary: "Printer on floor 3 will not print", currentStatus: "WAITING_FOR_REQUESTER", updatedAt: "2026-10-04T08:00:00.000Z" }],
  recentTickets: [{ id: 42, ticketNumber: "TT-2026-00042", summary: "Printer on floor 3 will not print", currentStatus: "IN_PROGRESS", updatedAt: "2026-10-05T03:12:00.000Z" }],
};

export const STAFF_BOARD: api.StaffDashboard = {
  generatedAt: "2026-10-05T09:00:00.000Z",
  metrics: {
    unassigned: { value: 2, href: "/queue?owner=unassigned&group=open" },
    assignedToMe: { value: 4, href: "/queue?owner=me&group=open" },
    waitingForRequester: { value: 3, href: "/queue?status=WAITING_FOR_REQUESTER" },
    urgent: { value: 5, href: "/queue?itPriority=URGENT&group=open" },
  },
  byStatus: [
    { status: "NEW", value: 1, href: "/queue?status=NEW" },
    { status: "OPEN", value: 1, href: "/queue?status=OPEN" },
    { status: "IN_PROGRESS", value: 1, href: "/queue?status=IN_PROGRESS" },
    { status: "WAITING_FOR_REQUESTER", value: 1, href: "/queue?status=WAITING_FOR_REQUESTER" },
    { status: "REOPENED", value: 1, href: "/queue?status=REOPENED" },
  ],
  myTickets: [
    { id: 12, ticketNumber: "TT-2026-00012", summary: "Printer on floor 3 will not print", currentStatus: "IN_PROGRESS", updatedAt: "2026-10-05T03:12:00.000Z", itPriority: "HIGH", owner: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true } },
  ],
  urgentTickets: [
    { id: 20, ticketNumber: "TT-2026-00020", summary: "Exam server is down", currentStatus: "NEW", updatedAt: "2026-10-04T04:00:00.000Z", itPriority: "URGENT", owner: null },
  ],
  myRecentActions: [
    { id: 31, ticketId: 12, ticketNumber: "TT-2026-00012", actionAt: "2026-10-05T03:10:00.000Z", description: "Replaced the toner cartridge and ran a test page.", followUpRequired: true },
  ],
};

export const ADMIN_BOARD: api.StaffDashboard = {
  ...STAFF_BOARD,
  userCounts: { activeRequesters: { value: 6 }, activeItStaff: { value: 4 }, activeAdministrators: { value: 2 }, inactive: { value: 3 } },
};

const LIST_META = { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasPrev: false, hasNext: false };

/** Every API call the screens make, answered with plausible data. A test overrides the one it is about. */
export function mockApi() {
  return {
    fetchCategories: vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }, { id: 4, name: "Network" }]),
    fetchRelatedSystems: vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 2, name: "Campus Printers" }, { id: 5, name: "Campus Wi-Fi" }]),
    createTicket: vi.spyOn(api, "createTicket").mockResolvedValue({ ...REQUESTER_TICKET }),
    fetchMyTickets: vi.spyOn(api, "fetchMyTickets").mockResolvedValue({
      data: [
        { id: 42, ticketNumber: "TT-2026-00042", ticketDate: "2026-09-28T02:10:00.000Z", summary: "Printer on floor 3 will not print", requestedPriority: "MEDIUM", currentStatus: "IN_PROGRESS", category: { id: 2, name: "Hardware" }, relatedSystem: { id: 2, name: "Campus Printers" }, activeAttachmentCount: 0, updatedAt: "2026-09-29T09:14:22.310Z" },
        { id: 43, ticketNumber: "TT-2026-00043", ticketDate: "2026-09-29T02:10:00.000Z", summary: "Wi-Fi drops in the library", requestedPriority: "HIGH", currentStatus: "NEW", category: { id: 4, name: "Network" }, relatedSystem: { id: 5, name: "Campus Wi-Fi" }, activeAttachmentCount: 1, updatedAt: "2026-09-30T09:14:22.310Z" },
      ],
      meta: LIST_META,
    }),
    fetchTicketDetail: vi.spyOn(api, "fetchTicketDetail").mockResolvedValue(REQUESTER_TICKET),
    fetchAttachments: vi.spyOn(api, "fetchAttachments").mockResolvedValue([]),
    uploadAttachment: vi.spyOn(api, "uploadAttachment"),
    removeAttachment: vi.spyOn(api, "removeAttachment"),
    fetchComments: vi.spyOn(api, "fetchComments").mockResolvedValue([]),
    postComment: vi.spyOn(api, "postComment"),
    setAppearsResolved: vi.spyOn(api, "setAppearsResolved"),
    fetchNotes: vi.spyOn(api, "fetchNotes").mockResolvedValue([]),
    postNote: vi.spyOn(api, "postNote"),
    fetchActionsTaken: vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]),
    createActionTaken: vi.spyOn(api, "createActionTaken"),
    editActionTaken: vi.spyOn(api, "editActionTaken"),
    fetchStatusHistory: vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([]),
    fetchRequesterDashboard: vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(REQUESTER_BOARD),
    fetchStaffDashboard: vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(STAFF_BOARD),
    fetchQueue: vi.spyOn(api, "fetchQueue").mockResolvedValue({
      tickets: [
        { id: 12, ticketNumber: "TT-2026-00012", summary: "Printer on floor 3 will not print", categoryName: "Hardware", requestedPriority: "MEDIUM", itPriority: "HIGH", currentStatus: "IN_PROGRESS", owner: { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true }, requesterResolvedAt: null, createdAt: "2026-09-28T02:10:00.000Z", updatedAt: "2026-09-29T09:14:22.310Z" },
        { id: 13, ticketNumber: "TT-2026-00013", summary: "Cannot join the campus VPN", categoryName: "Network", requestedPriority: "LOW", itPriority: "LOW", currentStatus: "NEW", owner: null, requesterResolvedAt: null, createdAt: "2026-09-29T02:10:00.000Z", updatedAt: "2026-09-30T09:14:22.310Z" },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 2,
      totalPages: 1,
    }),
    fetchAssignableUsers: vi.spyOn(api, "fetchAssignableUsers").mockResolvedValue([
      { id: 7, fullName: "Nattapong Saelim", role: "IT_STAFF", isActive: true },
      { id: 8, fullName: "Siriporn Kaewmanee", role: "IT_STAFF", isActive: true },
      { id: 9, fullName: "Malee Sutthiwong", role: "ADMINISTRATOR", isActive: true },
    ]),
    fetchStaffTicket: vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(STAFF_TICKET),
    setTicketOwner: vi.spyOn(api, "setTicketOwner"),
    setItPriority: vi.spyOn(api, "setItPriority"),
    changeTicketStatus: vi.spyOn(api, "changeTicketStatus"),
    fetchUsers: vi.spyOn(api, "fetchUsers").mockResolvedValue([
      { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", role: "REQUESTER", isActive: true, department: null, mustChangePassword: false, lastLoginAt: null },
      { id: 7, fullName: "Nattapong Saelim", email: "nattapong.it@toktickit.local", role: "IT_STAFF", isActive: true, department: null, mustChangePassword: false, lastLoginAt: null },
    ]),
    createUser: vi.spyOn(api, "createUser"),
    updateUser: vi.spyOn(api, "updateUser"),
    issueInitialPassword: vi.spyOn(api, "issueInitialPassword"),
    login: vi.spyOn(api, "login"),
    logout: vi.spyOn(api, "logout").mockResolvedValue(undefined),
    changePassword: vi.spyOn(api, "changePassword"),
  };
}

export type Mocks = ReturnType<typeof mockApi>;

/** The person is signed in as this visitor, or not at all. */
export function signIn(visitor: Visitor) {
  const user = visitor === "SIGNED_OUT" ? null : visitor === "MUST_CHANGE" ? MUST_CHANGE : USERS[visitor];
  return vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(user);
}

/**
 * Every request has been answered: no skeleton is left on the page. A page that failed to load may have no
 * heading, so a test of one passes `false`.
 */
export async function settled(expectHeading = true) {
  await waitFor(() => expect(document.querySelectorAll('[data-state="loading"]')).toHaveLength(0));
  if (expectHeading) await screen.findAllByRole("heading");
  else await new Promise((resolve) => setTimeout(resolve, 20));
}

export async function openApp(visitor: Visitor, path: string, expectHeading = true) {
  signIn(visitor);
  const view = render(<TokTickITApp initialEntries={[path]} />);
  await settled(expectHeading);
  return view;
}
