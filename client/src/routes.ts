// Route paths, in one place so the shell and the router agree without the
// shell having to import from the app root (which imports the shell).

export const ROUTES = {
  // Lab 2's Development Requester selector; no longer routed since Issue 5,
  // and removed with the rest of the selector in Issue 6.
  select: "/select-requester",
  list: "/tickets",
  create: "/tickets/new",
  detail: (id: number | string) => `/tickets/${id}`,
  // Lab 3
  login: "/login",
  password: "/change-password",
  queue: "/queue",
  users: "/users",
} as const;

export default ROUTES;
