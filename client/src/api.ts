import type { TicketStatus } from "./components/Badge.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Lab 3 — every request carries the session cookie. The client runs on another
// port, so without credentials: "include" the browser would not send tt_sid to
// the API at all, and every call would arrive unauthenticated (api-spec §1.1).
//
// Issue 6 — a 401 from anywhere outside /api/auth means the session ended
// while the user was working (it expired, or was signed out elsewhere). The
// listener — AuthProvider — forgets the user, and the route guard sends them
// to Login, which brings them back to the same page afterwards. /api/auth is
// excluded because its 401s are answers, not news: a wrong password, or
// "nobody is signed in" on first load.
type SessionEndedListener = () => void;
const sessionEndedListeners = new Set<SessionEndedListener>();

export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
  };
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (response.status === 401 && !url.startsWith(`${API_URL}/api/auth/`)) {
    for (const listener of sessionEndedListeners) listener();
  }
  return response;
}

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// --- The current Requester --------------------------------------------------

// The signed-in Requester as the Lab 2 screens read it. Since Issue 6 it comes
// from the session (AuthProvider), never from a selector.
export interface Requester {
  id: number;
  fullName: string;
  email: string;
  department: string | null;
}

// --- Lab 2, Issue 5 — reference data and ticket creation -------------------

export interface RelatedSystem {
  id: number;
  name: string;
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface NewTicket {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  requester: { id: number; fullName: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

// A rejection the form can render field by field. Anything else is a transport
// or server failure and becomes one safe form-level message.
export class TicketValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super("The ticket was rejected by the server.");
    this.name = "TicketValidationError";
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await apiFetch(`${API_URL}/api/categories`);
  if (!response.ok) throw new Error(`Failed to load categories (HTTP ${response.status})`);
  return (await response.json()) as Category[];
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await apiFetch(`${API_URL}/api/related-systems`);
  if (!response.ok) throw new Error(`Failed to load related systems (HTTP ${response.status})`);
  return (await response.json()) as RelatedSystem[];
}

// Creates one Ticket for the signed-in Requester. Who that is comes from the
// session cookie, never from the body (Lab 3 BR-03), and the server owns the
// ticket number, date, and status.
export async function createTicket(ticket: NewTicket): Promise<Ticket> {
  const response = await apiFetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });

  if (response.status === 201) return (await response.json()) as Ticket;

  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { fields?: Record<string, string> } }
      | null;
    const fields = body?.error?.fields;
    if (fields && Object.keys(fields).length > 0) throw new TicketValidationError(fields);
  }

  throw new Error(`Failed to create the ticket (HTTP ${response.status})`);
}

// --- Lab 2, Issue 6 — My Tickets -------------------------------------------

// A list row. Description is absent on purpose: no column shows it, and it can
// be 4000 characters.
export interface TicketListItem {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  activeAttachmentCount: number;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface TicketListResponse {
  data: TicketListItem[];
  meta: PageMeta;
}

export interface TicketListParams {
  search?: string;
  categoryId?: number | "";
  relatedSystemId?: number | "";
  requestedPriority?: RequestedPriority | "";
  currentStatus?: TicketStatus | "";
  sortBy?: "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const PERMITTED_PAGE_SIZES = [10, 20, 50] as const;

// Lists the signed-in Requester's tickets. Ownership is decided server-side
// from the session; nothing the client sends can widen it.
export async function fetchMyTickets(params: TicketListParams = {}): Promise<TicketListResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Empty means "no filter" and is left out of the query entirely, rather
    // than sent as a blank the server would have to interpret.
    if (value !== undefined && value !== "" && value !== null) {
      search.set(key, String(value));
    }
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch(`${API_URL}/api/tickets${suffix}`);

  if (!response.ok) throw new Error(`Failed to load tickets (HTTP ${response.status})`);
  return (await response.json()) as TicketListResponse;
}

// --- Lab 2, Issue 7 — Ticket Detail and Attachments ------------------------

export interface Attachment {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  /** null for a removed attachment, so no working link can be constructed. */
  downloadUrl: string | null;
}

export interface TicketDetail extends Ticket {
  attachments: Attachment[];
  /** Lab 3, Issue 7 — when the Requester said the problem appears resolved. */
  requesterResolvedAt: string | null;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS = 5;
export const PERMITTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

// Thrown for a rejection the UI should explain on the offending row rather than
// as a screen-level failure.
export class AttachmentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AttachmentError";
  }
}

export async function fetchTicketDetail(ticketId: number): Promise<TicketDetail> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}`);

  if (response.status === 404) {
    throw new AttachmentError("NOT_FOUND", "That ticket could not be found.");
  }
  if (!response.ok) throw new Error(`Failed to load the ticket (HTTP ${response.status})`);
  return (await response.json()) as TicketDetail;
}

export async function fetchAttachments(ticketId: number): Promise<Attachment[]> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/attachments`);
  if (!response.ok) throw new Error(`Failed to load attachments (HTTP ${response.status})`);
  return (await response.json()) as Attachment[];
}

async function readError(response: Response): Promise<AttachmentError> {
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
  return new AttachmentError(
    body?.error?.code ?? "UPLOAD_FAILED",
    body?.error?.message ?? "The file could not be attached.",
  );
}

export async function uploadAttachment(ticketId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);

  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: form,
  });

  if (response.status === 201) return (await response.json()) as Attachment;
  throw await readError(response);
}

/**
 * Downloads an active attachment and hands it to the browser to save.
 *
 * Fetched rather than opened as a link, so a refusal (an ended session, a
 * removed attachment) is shown on the row instead of replacing the page with a
 * raw JSON error. The relative `downloadUrl` from the API is also relative to
 * the API origin, not the page's — which differ whenever the client and server
 * are served separately, as they are in development.
 */
export async function downloadAttachment(
  attachment: Pick<Attachment, "id" | "originalFilename">,
): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/attachments/${attachment.id}/download`);

  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.originalFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Released on the next tick so the click has taken the URL first.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

export async function removeAttachment(attachmentId: number, removalReason: string): Promise<Attachment> {
  const response = await apiFetch(`${API_URL}/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removalReason }),
  });

  if (response.ok) return (await response.json()) as Attachment;
  throw await readError(response);
}

// --- Lab 3, Issue 7 — Public Comments and Problem Appears Resolved ----------

/** One entry in a conversation thread (api-spec §4.1). */
export interface ThreadEntry {
  id: number;
  body: string;
  createdAt: string;
  author: { id: number; fullName: string; role: Role };
}

export const COMMENT_MAX = 2000; // BR-41
export const APPEARS_RESOLVED_MIN = 5; // BR-29

export async function fetchComments(ticketId: number): Promise<ThreadEntry[]> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/comments`);
  if (!response.ok) throw await failure(response, "Cannot load the comments.");
  return ((await response.json()) as { comments: ThreadEntry[] }).comments;
}

/** Throws ApiError; a 400 carries the field message under `fields.body`. */
export async function postComment(ticketId: number, body: string): Promise<ThreadEntry> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (response.status !== 201) throw await failure(response, "The comment could not be posted.");
  return (await response.json()) as ThreadEntry;
}

export interface AppearsResolvedResult {
  ticket: { id: number; requesterResolvedAt: string | null; currentStatus: TicketStatus };
  comment: ThreadEntry | null;
}

/**
 * Sets (with a comment) or clears the Requester's "appears resolved" signal.
 * There is deliberately no status in the request: only IT Staff resolve (BR-05).
 */
export async function setAppearsResolved(
  ticketId: number,
  change: { appearsResolved: true; comment: string } | { appearsResolved: false },
): Promise<AppearsResolvedResult> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/appears-resolved`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!response.ok) throw await failure(response, "That could not be saved.");
  return (await response.json()) as AppearsResolvedResult;
}

// Issue 2 + Issue 4 — call the backend.
// Confirms the API is healthy, then loads the categories it serves.
// Throwing on any failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  // Issue 2 — confirm the backend is reachable and healthy.
  const health = await apiFetch(`${API_URL}/api/health`);
  if (!health.ok) {
    throw new Error(`Health check failed (HTTP ${health.status})`);
  }

  // Issue 4 — load the supported request categories from the API.
  const categoriesRes = await apiFetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error(`Failed to load categories (HTTP ${categoriesRes.status})`);
  }
  const categories: Category[] = await categoriesRes.json();

  return { online: true, categories };
}

// --- Lab 3, Issue 5 — authentication (api-spec §2) --------------------------

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

// The permitted user shape (api-spec §1.6). No password or token ever.
export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

// A failure the screens can show safely: the API's own message and code, plus
// any field-level messages. Never a status line or stack trace (FR-47).
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function failure(response: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; fields?: Record<string, string> } };
    return new ApiError(response.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? fallback, body.error?.fields ?? {});
  } catch {
    return new ApiError(response.status, "UNKNOWN", fallback);
  }
}

/** The signed-in user, or null when there is no session (a 401). */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await apiFetch(`${API_URL}/api/auth/me`);
  if (response.status === 401) return null;
  if (!response.ok) throw await failure(response, "Cannot reach TokTickIT right now.");
  return ((await response.json()) as { user: AuthUser }).user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await failure(response, "Sign-in failed. Please try again.");
  return ((await response.json()) as { user: AuthUser }).user;
}

export async function logout(): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
  if (!response.ok) throw await failure(response, "Sign-out failed. Please try again.");
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function changePassword(change: PasswordChange): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!response.ok) throw await failure(response, "The password could not be changed. Please try again.");
}

// --- Lab 3, Issue 8 — the IT Staff queue (api-spec §5.1, §5.6) --------------

export interface QueueOwner {
  id: number;
  fullName: string;
  // false marks work held by a deactivated account (BR-26).
  isActive: boolean;
}

export interface QueueTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryName: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  // null is an unassigned ticket, shown as the word "Unassigned" (FR-28).
  owner: QueueOwner | null;
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueResponse {
  tickets: QueueTicket[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type QueueSort = "itPriority" | "createdAt" | "updatedAt";

export interface QueueParams {
  q?: string;
  status?: TicketStatus;
  itPriority?: RequestedPriority;
  categoryId?: number;
  // "any" | "unassigned" | "me" | a user id (D-18)
  owner?: string;
  sort?: QueueSort;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** One page of the shared queue. Throws ApiError, so a 403 can be told apart from an outage. */
export async function fetchQueue(params: QueueParams = {}): Promise<QueueResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch(`${API_URL}/api/staff/tickets${suffix}`);
  if (!response.ok) throw await failure(response, "Cannot load the ticket queue.");
  return (await response.json()) as QueueResponse;
}

export interface AssignableUser {
  id: number;
  fullName: string;
  role: Role;
  isActive: boolean;
}

/** Active IT Staff and Administrators, by name — the Owner filter's choices. */
export async function fetchAssignableUsers(): Promise<AssignableUser[]> {
  const response = await apiFetch(`${API_URL}/api/staff/assignable-users`);
  if (!response.ok) throw await failure(response, "Cannot load IT Staff.");
  return ((await response.json()) as { users: AssignableUser[] }).users;
}

// --- Lab 3, Issue 10 — Administrator User Management (api-spec §6) ----------

/** A row of the Administrator's user list. No password material, ever (BR-52). */
export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  department: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface UserListParams {
  q?: string;
  role?: Role;
}

export interface NewUser {
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

export type UserChange = Partial<Pick<AdminUser, "fullName" | "email" | "role" | "isActive">>;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** Throws ApiError, so a 403 can be told apart from an outage. */
export async function fetchUsers(params: UserListParams = {}): Promise<AdminUser[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.role) search.set("role", params.role);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch(`${API_URL}/api/admin/users${suffix}`);
  if (!response.ok) throw await failure(response, "Cannot load the users.");
  return ((await response.json()) as { users: AdminUser[] }).users;
}

/** Throws ApiError; field messages arrive under `fields`, a duplicate email under `fields.email`. */
export async function createUser(user: NewUser): Promise<AdminUser> {
  const response = await apiFetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  if (response.status !== 201) throw await failure(response, "The user could not be created.");
  return ((await response.json()) as { user: AdminUser }).user;
}

/** Throws ApiError; 409 SELF_DEACTIVATION or LAST_ADMINISTRATOR explain a refused change. */
export async function updateUser(userId: number, change: UserChange): Promise<AdminUser> {
  const response = await apiFetch(`${API_URL}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!response.ok) throw await failure(response, "The user could not be saved.");
  return ((await response.json()) as { user: AdminUser }).user;
}

/** Signs the user out everywhere; they must change it at next sign-in (BR-47). */
export async function issueInitialPassword(userId: number, initialPassword: string): Promise<void> {
  const response = await apiFetch(`${API_URL}/api/admin/users/${userId}/initial-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initialPassword }),
  });
  if (!response.ok) throw await failure(response, "The new initial password could not be set.");
}
