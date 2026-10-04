// Route paths, in one place so the shell and the router agree without the
// shell having to import from the app root (which imports the shell).

export const ROUTES = {
  list: "/tickets",
  create: "/tickets/new",
  detail: (id: number | string) => `/tickets/${id}`,
  // Lab 3
  login: "/login",
  password: "/change-password",
  queue: "/queue",
  staffDetail: (id: number | string) => `/queue/${id}`,
  users: "/users",
} as const;

export default ROUTES;
