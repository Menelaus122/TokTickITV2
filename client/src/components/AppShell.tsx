import { ReactNode, useEffect, useId, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";
import { ROUTES } from "../routes.js";

// Application shell (ui-spec.md 7).
//
// Identity, navigation with active-page indication, and the current
// Development Requester, on every screen inside the application.

export const NAV_ITEMS = [
  { to: ROUTES.list, label: "My Tickets" },
  { to: ROUTES.create, label: "Create Ticket" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { requester, changeRequester } = useRequester();
  const location = useLocation();
  const navigate = useNavigate();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigating closes the mobile menu, otherwise it stays open over the screen
  // the user just asked for.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navigation = (
    <nav className="tt-shell__nav" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // "end" keeps My Tickets from matching /tickets/new as well.
          end={item.to === "/tickets"}
          className={({ isActive }) =>
            `tt-shell__link${isActive ? " tt-shell__link--active" : ""}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="tt-shell">
      <header className="tt-shell__header">
        <span className="tt-shell__brand">TokTickIT</span>

        {/* Visible from tablet up; the mobile menu below carries the same
            links so there is one source of truth for what navigation is. */}
        <div className="tt-shell__desktop-nav">{navigation}</div>

        {requester && (
          <div className="tt-shell__requester">
            <span className="tt-shell__requester-name" data-testid="current-requester">
              {requester.fullName}
            </span>
            <button
              type="button"
              className="tt-btn tt-btn--tertiary tt-shell__change"
              onClick={() => {
                changeRequester();
                // Aimed at the list, not at wherever the user happened to be.
                // Deliberately changing identity should not drop them back on
                // the previous Requester's ticket, which would then 404.
                navigate(ROUTES.select, { replace: true, state: { from: ROUTES.list } });
              }}
            >
              Change Requester
            </button>
          </div>
        )}

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
        </div>
      )}

      {/* A standing reminder that the identity above is a test fixture, not a
          logged-in user (BR-03). */}
      <p className="tt-shell__notice" role="note">
        Development Requester — testing only, not a login.
      </p>

      <main>{children}</main>
    </div>
  );
}

export default AppShell;
