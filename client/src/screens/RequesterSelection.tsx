import { useState } from "react";
import { Requester } from "../api.js";
import { Button, SelectInput, ErrorState, LoadingState, WarningCallout } from "../components/index.js";

// Development Requester Selection screen (ui-spec.md 8).
//
// This screen precedes the application shell, because until a Requester is
// chosen there is no requester-scoped data to show. It is not a login screen
// and says so on its face (BR-03).

// The exact wording suggested by the labsheet. Kept verbatim so nobody can
// mistake this screen for authentication.
export const SELECTION_NOTICE =
  "Select a Development Requester to test requester-specific ticket behavior. " +
  "This is not a login screen. Authentication and role-based access will be " +
  "introduced in Lab 3.";

export type SelectionStatus = "loading" | "ready" | "error";

export interface RequesterSelectionProps {
  status: SelectionStatus;
  requesters: Requester[];
  errorMessage?: string;
  onRetry?: () => void;
  onContinue: (requester: Requester) => void;
}

export function RequesterSelection({
  status,
  requesters,
  errorMessage = "Cannot reach the TokTickIT API.",
  onRetry,
  onContinue,
}: RequesterSelectionProps) {
  const [selectedId, setSelectedId] = useState("");

  const selected = requesters.find((candidate) => String(candidate.id) === selectedId) ?? null;
  const isEmpty = status === "ready" && requesters.length === 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selected) onContinue(selected);
  }

  return (
    <div className="tt-page tt-selection">
      <div className="tt-card tt-selection__card">
        <h1 className="tt-h1">TokTickIT</h1>

        {/* Amber, because this caveat is a genuine warning, not a tagline. */}
        <WarningCallout>{SELECTION_NOTICE}</WarningCallout>

        {status === "loading" && <LoadingState rows={2} label="Loading development requesters…" />}

        {status === "error" && (
          // No dropdown is rendered in this state: offering an empty selector
          // would imply there are no requesters, which is a different problem.
          <ErrorState message={errorMessage} onRetry={onRetry} />
        )}

        {isEmpty && (
          <p className="tt-state__body" data-state="empty">
            No active Development Requesters found. Run the database seed and reload.
          </p>
        )}

        {status === "ready" && requesters.length > 0 ? (
          <form onSubmit={handleSubmit}>
            <SelectInput
              label="Development Requester"
              required
              placeholder="Choose a requester…"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              options={requesters.map((candidate) => ({
                value: candidate.id,
                label: candidate.department
                  ? `${candidate.fullName} — ${candidate.department}`
                  : candidate.fullName,
              }))}
            />

            {/* Disabled until a Requester is chosen, so Continue can never
                enter the application with no testing context. */}
            <Button type="submit" variant="primary" disabled={!selected}>
              Continue
            </Button>
          </form>
        ) : (
          // Loading, error, and empty all keep Continue visible but inert, so
          // the screen's primary action never vanishes and then reappears.
          <Button variant="primary" disabled>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

export default RequesterSelection;
