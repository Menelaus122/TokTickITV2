import { ReactNode } from "react";
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
import type { Role } from "./api.js";
import { AuthProvider, LANDING, useAuth } from "./context/AuthContext.js";
import { RequesterProvider } from "./context/RequesterContext.js";
import { Login } from "./screens/Login.js";
import { ChangePassword } from "./screens/ChangePassword.js";
import { CreateTicket } from "./screens/CreateTicket.js";
import { RequesterDashboard } from "./screens/RequesterDashboard.js";
import { StaffDashboard } from "./screens/StaffDashboard.js";
import { MyTicketsWithUrl } from "./screens/MyTickets.js";
import { RequesterTicketDetail } from "./screens/RequesterTicketDetail.js";
import { StaffTicketQueueWithUrl } from "./screens/StaffTicketQueue.js";
import { StaffTicketDetail } from "./screens/StaffTicketDetail.js";
import { UserManagement } from "./screens/UserManagement.js";
import { AppShell } from "./components/AppShell.js";
import { ErrorState, LoadingState, Page } from "./components/index.js";
import { ROUTES } from "./routes.js";

export { ROUTES };

// Application root and routing — Lab 3, Issue 5.
//
//   /login              Login, outside the shell
//   /change-password    mandatory (no shell) or voluntary (in the shell)
//   /dashboard          every role, each its own (Lab 4, Issues 7 and 8)
//   /tickets, /tickets/new, /tickets/:id    Requester
//   /queue, /queue/:id  IT Staff and Administrator
//   /users              Administrator
//
// Every application route passes one guard, in this order: session loaded →
// signed in (FR-07) → no password change pending (BR-02) → the role may open
// this page (FR-09). The API enforces the same rules; the guard exists so a
// person is never shown a page the server would refuse.

// Which roles may open a path, so a deep link is honoured after sign-in only
// when it belongs to the role that signed in. The queue is shared by IT Staff
// and Administrators (Lab 4 D-08); every other page has one owner.
function rolesForPath(path: string): Role[] {
  // Lab 4: the Dashboard is every role's, and shows that role's own (Issues 7 and 8).
  if (path.startsWith(ROUTES.dashboard)) return ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
  if (path.startsWith(ROUTES.list)) return ["REQUESTER"];
  if (path.startsWith(ROUTES.queue)) return ["IT_STAFF", "ADMINISTRATOR"];
  if (path.startsWith(ROUTES.users)) return ["ADMINISTRATOR"];
  return [];
}

function Loading() {
  return <LoadingState rows={4} label="Loading TokTickIT…" />;
}

function Unavailable() {
  const { refresh } = useAuth();
  return (
    <Page>
      <ErrorState
        message="Cannot reach TokTickIT right now. Make sure the API is running, then try again."
        onRetry={() => void refresh()}
      />
    </Page>
  );
}

function RequireAuth({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Loading />;
  if (status === "unavailable") return <Unavailable />;
  if (!user) {
    // `state.from` carries the page asked for, so sign-in can return to it.
    // The query string travels too, so a filtered list survives the detour.
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  }
  if (user.mustChangePassword) return <Navigate to={ROUTES.password} replace />;
  if (!roles.includes(user.role)) {
    // Not this role's page: back to its own home, saying why (ui-spec §2).
    return <Navigate to={LANDING[user.role]} replace state={{ forbidden: true }} />;
  }

  const forbidden = (location.state as { forbidden?: boolean } | null)?.forbidden === true;
  return (
    <AppShell>
      {forbidden && (
        <Page>
          <div className="tt-callout tt-callout--error" role="alert" data-state="forbidden">
            <span aria-hidden="true">⚠</span>
            <div>You do not have access to that page.</div>
          </div>
        </Page>
      )}
      {children}
    </AppShell>
  );
}

// Requester screens read "the current Requester" from RequesterContext, as in
// Lab 2. Since Issue 6 that Requester is only ever the signed-in user; the
// guard has already proved there is one, and that it is a Requester.
function SignedInRequester({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <RequesterProvider requester={{ id: user.id, fullName: user.fullName, email: user.email, department: null }}>
      {children}
    </RequesterProvider>
  );
}

function RequesterRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={["REQUESTER"]}>
      <SignedInRequester>{children}</SignedInRequester>
    </RequireAuth>
  );
}

function LoginRoute() {
  const { status, user, signIn } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Loading />;
  if (user) {
    if (user.mustChangePassword) return <Navigate to={ROUTES.password} replace />;
    const from = (location.state as { from?: string } | null)?.from;
    const destination = from && rolesForPath(from).includes(user.role) ? from : LANDING[user.role];
    return <Navigate to={destination} replace />;
  }
  return <Login onSignIn={signIn} />;
}

function PasswordRoute() {
  const { status, user, changePassword, signOut } = useAuth();
  const navigate = useNavigate();

  if (status === "loading") return <Loading />;
  if (status === "unavailable") return <Unavailable />;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  if (user.mustChangePassword) {
    return (
      <ChangePassword
        email={user.email}
        mandatory
        onChange={changePassword}
        onDone={() => navigate(LANDING[user.role], { replace: true })}
        onSignOut={async () => {
          await signOut();
          navigate(ROUTES.login, { replace: true });
        }}
      />
    );
  }
  return (
    <AppShell>
      <Page>
        <ChangePassword email={user.email} mandatory={false} onChange={changePassword} />
      </Page>
    </AppShell>
  );
}

function CatchAll() {
  const { status, user } = useAuth();
  if (status === "loading") return <Loading />;
  return <Navigate to={user ? LANDING[user.role] : ROUTES.login} replace />;
}

// One address, the Dashboard of whoever is signed in: a Requester's is theirs alone (Issue 7), IT Staff
// and an Administrator share one, the Administrator's with the account counts the server adds (Issue 8).
function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Page>
      {user.role === "REQUESTER" ? (
        <RequesterDashboard fullName={user.fullName} />
      ) : (
        <StaffDashboard fullName={user.fullName} currentUserId={user.id} />
      )}
    </Page>
  );
}

function MyTicketsRoute() {
  const navigate = useNavigate();
  return (
    <Page>
      <MyTicketsWithUrl onOpenTicket={(ticket) => navigate(ROUTES.detail(ticket.id))} onCreateTicket={() => navigate(ROUTES.create)} />
    </Page>
  );
}

function CreateTicketRoute() {
  const navigate = useNavigate();
  return (
    <Page>
      <CreateTicket
        // Reached from the success state's View ticket button, so the
        // confirmation with the official number is always seen first.
        onCreated={(ticket) => navigate(ROUTES.detail(ticket.id))}
        onCancel={() => navigate(ROUTES.list)}
      />
    </Page>
  );
}

function TicketDetailRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) return <Navigate to={ROUTES.list} replace />;
  return (
    <Page>
      <RequesterTicketDetail key={`detail-${ticketId}`} ticketId={ticketId} onBack={() => navigate(ROUTES.list)} />
    </Page>
  );
}

function QueueRoute() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Page>
      <StaffTicketQueueWithUrl currentUserId={user.id} />
    </Page>
  );
}

function UsersRoute() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Page>
      <UserManagement currentUserId={user.id} />
    </Page>
  );
}

function StaffDetailRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const ticketId = Number(id);
  if (!user) return null;
  if (!Number.isInteger(ticketId) || ticketId <= 0) return <Navigate to={ROUTES.queue} replace />;
  return (
    <Page>
      <StaffTicketDetail
        key={`staff-detail-${ticketId}`}
        ticketId={ticketId}
        currentUserId={user.id}
        currentUser={{ fullName: user.fullName, role: user.role }}
        onBack={() => navigate(ROUTES.queue)}
      />
    </Page>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginRoute />} />
      <Route path={ROUTES.password} element={<PasswordRoute />} />

      <Route
        path={ROUTES.dashboard}
        element={
          <RequireAuth roles={["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]}>
            <DashboardRoute />
          </RequireAuth>
        }
      />
      <Route path={ROUTES.list} element={<RequesterRoute><MyTicketsRoute /></RequesterRoute>} />
      <Route path={ROUTES.create} element={<RequesterRoute><CreateTicketRoute /></RequesterRoute>} />
      <Route path="/tickets/:id" element={<RequesterRoute><TicketDetailRoute /></RequesterRoute>} />

      <Route
        path={ROUTES.queue}
        element={
          <RequireAuth roles={["IT_STAFF", "ADMINISTRATOR"]}>
            <QueueRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/queue/:id"
        element={
          <RequireAuth roles={["IT_STAFF", "ADMINISTRATOR"]}>
            <StaffDetailRoute />
          </RequireAuth>
        }
      />
      <Route
        path={ROUTES.users}
        element={
          <RequireAuth roles={["ADMINISTRATOR"]}>
            <UsersRoute />
          </RequireAuth>
        }
      />

      <Route path="*" element={<CatchAll />} />
    </Routes>
  );
}

export function TokTickITApp({
  /** Tests mount with MemoryRouter; the browser gets real URLs. */
  initialEntries,
}: {
  initialEntries?: string[];
}) {
  const routes = (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
  return initialEntries ? (
    <MemoryRouter initialEntries={initialEntries}>{routes}</MemoryRouter>
  ) : (
    <BrowserRouter>{routes}</BrowserRouter>
  );
}

export default TokTickITApp;
