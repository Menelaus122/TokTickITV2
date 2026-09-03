// Route paths, in one place so the shell and the router agree without the
// shell having to import from the app root (which imports the shell).

export const ROUTES = {
  select: "/select-requester",
  list: "/tickets",
  create: "/tickets/new",
  detail: (id: number | string) => `/tickets/${id}`,
} as const;

export default ROUTES;
