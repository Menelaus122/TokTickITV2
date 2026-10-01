import { ReactNode, useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import type { Role } from "../api.js";
import { ROUTES } from "../routes.js";
import { RoleBadge } from "./Badge.js";

// Application shell (ui-spec §2; Lab 2 ui-spec §7).
//
// Identity, role-specific navigation with active-page indication, and the
// signed-in user with Change Password and Logout. A role never sees a
// destination it may not open (FR-14); the router refuses it as well, because
// hiding a link is not authorization.

export const NAV_BY_ROLE: Record<Role, { to: string; label: string }[]> = {
  REQUESTER: [
    { to: ROUTES.list, label: "My Tickets" },
    { to: ROUTES.create, label: "Create Ticket" },
  ],
  IT_STAFF: [{ to: ROUTES.queue, label: "Ticket Queue" }],
  ADMINISTRATOR: [{ to: ROUTES.users, label: "User Management" }],
};

/** The Requester's navigation, kept under its Lab 2 name for the Lab 2 tests. */
export const NAV_ITEMS = NAV_BY_ROLE.REQUESTER;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Navigating closes the mobile menu, otherwise it stays open over the screen
  // the user just asked for.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const items = user ? NAV_BY_ROLE[user.role] : [];

  const navigation = (
    <nav className="tt-shell__nav" aria-label="Main">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // "end" keeps My Tickets from matching /tickets/new as well.
          end={item.to === ROUTES.list}
          className={({ isActive }) => `tt-shell__link${isActive ? " tt-shell__link--active" : ""}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      navigate(ROUTES.login, { replace: true });
    }
  }

  // Rendered twice, once in the header and once in the mobile menu; CSS shows
  // the one that fits, so only the header copy carries the test id.
  const userBlock = (inMenu: boolean) =>
    user && (
      <div className="tt-shell__user">
        <span className="tt-shell__user-name" data-testid={inMenu ? undefined : "current-user"}>
          {user.fullName}
        </span>
        <RoleBadge value={user.role} />
        <NavLink to={ROUTES.password} className="tt-shell__action">
          Change Password
        </NavLink>
        <button type="button" className="tt-shell__action" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    );

  return (
    <div className="tt-shell">
      <header className="tt-shell__header">
        {/* A plain Link: the wordmark is not navigation, so it never takes
            the active-page marker away from the real menu item. */}
        <Link to={user ? NAV_BY_ROLE[user.role][0].to : ROUTES.login} className="tt-shell__brand">
          TokTickIT
        </Link>

        {/* Visible from tablet up; the mobile menu below carries the same
            links so there is one source of truth for what navigation is. */}
        <div className="tt-shell__desktop-nav">{navigation}</div>

        {userBlock(false)}

        <button
          type="button"
          className="tt-btn tt-btn--tertiary tt-shell__menu-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
      </header>

      {menuOpen && (
        <div className="tt-shell__mobile-nav" id={menuId}>
          {navigation}
          {userBlock(true)}
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}

export default AppShell;
