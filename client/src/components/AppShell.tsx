import { ReactNode } from "react";
import { useRequester } from "../context/RequesterContext.js";

// Application shell (ui-spec.md 7).
//
// Issue 4 gives it the two things the Development Requester context needs: the
// current Requester's name on every screen, and a Change Requester action.
// Navigation and active-page indication arrive with Issue 8; the markup below
// leaves the slot for them rather than pretending they exist.

export function AppShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const { requester, changeRequester } = useRequester();

  return (
    <div className="tt-shell">
      <header className="tt-shell__header">
        <span className="tt-shell__brand">TokTickIT</span>

        {nav && <nav className="tt-shell__nav">{nav}</nav>}

        {requester && (
          <div className="tt-shell__requester">
            <span className="tt-shell__requester-name" data-testid="current-requester">
              {requester.fullName}
            </span>
            <button
              type="button"
              className="tt-btn tt-btn--tertiary tt-shell__change"
              onClick={changeRequester}
            >
              Change Requester
            </button>
          </div>
        )}
      </header>

      {/* A standing reminder that the identity above is a test fixture, not a
          logged-in user (BR-03). It stays visible on every screen. */}
      <p className="tt-shell__notice" role="note">
        Development Requester — testing only, not a login.
      </p>

      <main>{children}</main>
    </div>
  );
}

export default AppShell;
