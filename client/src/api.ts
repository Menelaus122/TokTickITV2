const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
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
