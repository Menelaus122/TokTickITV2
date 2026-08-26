import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { fetchRequesters, Requester } from "./api.js";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelection, SelectionStatus } from "./screens/RequesterSelection.js";
import { CreateTicket } from "./screens/CreateTicket.js";
import { MyTickets } from "./screens/MyTickets.js";
import { RequesterTicketDetail } from "./screens/RequesterTicketDetail.js";
import { AppShell } from "./components/AppShell.js";
import { LoadingState, Page } from "./components/index.js";

// Lab 2 application root and routing.
//
//   /select-requester   the Development Requester selector, outside the shell
//   /tickets            My Tickets
//   /tickets/new        Create Ticket
//   /tickets/:id        Requester Ticket Detail
//
// Every requester-scoped route is guarded: with no Requester selected there is
// nothing requester-scoped to render, so the guard redirects to the selector
// (FR-05).

export const ROUTES = {
  select: "/select-requester",
  list: "/tickets",
  create: "/tickets/new",
  detail: (id: number | string) => `/tickets/${id}`,
} as const;

function RequireRequester({ children }: { children: React.ReactNode }) {
  const { requester, ready } = useRequester();
  const location = useLocation();

  // Until the stored selection has been looked up, "no requester" is not yet a
  // fact. Redirecting here would throw a returning user off the URL they asked
  // for a frame before their selection was restored.
  if (!ready) return <LoadingState rows={4} label="Loading TokTickIT…" />;

  if (!requester) {
    // `replace` keeps the guarded URL out of history behind the selector, and
    // `state.from` carries it so the user lands where they meant to.
    return <Navigate to={ROUTES.select} replace state={{ from: location.pathname }} />;
  }

  return <AppShell>{children}</AppShell>;
}

function SelectionRoute({
  requesters,
  status,
  errorMessage,
  onRetry,
}: {
  requesters: Requester[];
  status: SelectionStatus;
  errorMessage?: string;
  onRetry: () => void;
}) {
  const { requester, selectRequester } = useRequester();
  const navigate = useNavigate();
  const location = useLocation();

  // Where the guard bounced the user from, so a deep link survives the detour.
  const intended = (location.state as { from?: string } | null)?.from ?? ROUTES.list;

  // Already chosen: nothing to select, so go where the user was headed.
  if (requester) return <Navigate to={intended} replace />;

  return (
    <RequesterSelection
      status={status}
      requesters={requesters}
      errorMessage={errorMessage}
      onRetry={onRetry}
      onContinue={(next) => {
        selectRequester(next);
        navigate(intended, { replace: true });
      }}
    />
  );
}

function MyTicketsRoute() {
  const navigate = useNavigate();
  const { requester } = useRequester();

  return (
    <Page>
      <MyTickets
        // Remounted per requester so no row from the previous one survives a
        // switch (BR-11).
        key={`list-${requester?.id}`}
        onOpenTicket={(ticket) => navigate(ROUTES.detail(ticket.id))}
        onCreateTicket={() => navigate(ROUTES.create)}
      />
    </Page>
  );
}

function CreateTicketRoute() {
  const navigate = useNavigate();
  const { requester } = useRequester();

  return (
    <Page>
      <CreateTicket
        key={`create-${requester?.id}`}
        onCreated={(ticket) => navigate(ROUTES.detail(ticket.id))}
      />
    </Page>
  );
}

function TicketDetailRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { requester } = useRequester();

  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return <Navigate to={ROUTES.list} replace />;
  }

  return (
    <Page>
      <RequesterTicketDetail
        key={`detail-${requester?.id}-${ticketId}`}
        ticketId={ticketId}
        onBack={() => navigate(ROUTES.list)}
      />
    </Page>
  );
}

function AppRoutes() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [status, setStatus] = useState<SelectionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(undefined);
    try {
      setRequesters(await fetchRequesters());
      setStatus("ready");
    } catch {
      // Safe message only: no status codes, URLs, or stack traces (FR-33).
      setRequesters([]);
      setErrorMessage(
        "Cannot load Development Requesters. Make sure the TokTickIT API is running, then try again.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    // undefined until the load settles, so a stored selection survives the
    // round trip instead of being discarded against an empty list.
    <RequesterProvider available={status === "ready" ? requesters : undefined}>
      <Routes>
        <Route
          path={ROUTES.select}
          element={
            <SelectionRoute
              requesters={requesters}
              status={status}
              errorMessage={errorMessage}
              onRetry={load}
            />
          }
        />

        <Route
          path={ROUTES.list}
          element={
            <RequireRequester>
              <MyTicketsRoute />
            </RequireRequester>
          }
        />
        <Route
          path={ROUTES.create}
          element={
            <RequireRequester>
              <CreateTicketRoute />
            </RequireRequester>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <RequireRequester>
              <TicketDetailRoute />
            </RequireRequester>
          }
        />

        <Route path="*" element={<Navigate to={ROUTES.list} replace />} />
      </Routes>
    </RequesterProvider>
  );
}

export function TokTickITApp({
  /** Tests mount with MemoryRouter; the browser gets real URLs. */
  initialEntries,
}: {
  initialEntries?: string[];
}) {
  if (initialEntries) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default TokTickITApp;
