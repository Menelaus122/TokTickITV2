const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// --- Lab 2, Issue 4 — Development Requesters -------------------------------

// A temporary Lab 2 testing identity (BR-03). No password, role, or token:
// the model has none, and the API never sends one.
export interface Requester {
  id: number;
  fullName: string;
  email: string;
  department: string | null;
}

// Loads the requesters the selector may offer. The backend already filters to
// active ones (BR-09), so the client never has to decide who is selectable.
// Throws on any failure so the screen can show one safe error state.
export async function fetchRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters`);
  if (!response.ok) {
    throw new Error(`Failed to load development requesters (HTTP ${response.status})`);
  }
  return (await response.json()) as Requester[];
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
  currentStatus: "NEW";
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
  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) throw new Error(`Failed to load categories (HTTP ${response.status})`);
  return (await response.json()) as Category[];
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);
  if (!response.ok) throw new Error(`Failed to load related systems (HTTP ${response.status})`);
  return (await response.json()) as RelatedSystem[];
}

// Creates one Ticket for the selected Development Requester. The requester
// travels in the X-Requester-Id header, never in the body (BR-14), and the
// server owns the ticket number, date, and status.
export async function createTicket(requesterId: number, ticket: NewTicket): Promise<Ticket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(requesterId),
    },
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
  currentStatus: "NEW";
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
  currentStatus?: "NEW" | "";
  sortBy?: "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const PERMITTED_PAGE_SIZES = [10, 20, 50] as const;

// Lists tickets owned by the given requester. Ownership is decided server-side
// from the header; sending a different id here would change nothing.
export async function fetchMyTickets(
  requesterId: number,
  params: TicketListParams = {},
): Promise<TicketListResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Empty means "no filter" and is left out of the query entirely, rather
    // than sent as a blank the server would have to interpret.
    if (value !== undefined && value !== "" && value !== null) {
      search.set(key, String(value));
    }
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await fetch(`${API_URL}/api/tickets${suffix}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });

  if (!response.ok) throw new Error(`Failed to load tickets (HTTP ${response.status})`);
  return (await response.json()) as TicketListResponse;
}

// Issue 2 + Issue 4 — call the backend.
// Confirms the API is healthy, then loads the categories it serves.
// Throwing on any failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  // Issue 2 — confirm the backend is reachable and healthy.
  const health = await fetch(`${API_URL}/api/health`);
  if (!health.ok) {
    throw new Error(`Health check failed (HTTP ${health.status})`);
  }

  // Issue 4 — load the supported request categories from the API.
  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error(`Failed to load categories (HTTP ${categoriesRes.status})`);
  }
  const categories: Category[] = await categoriesRes.json();

  return { online: true, categories };
}
