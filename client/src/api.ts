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
