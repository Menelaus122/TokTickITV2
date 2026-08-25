import { ReactNode } from "react";

// The five shared states every data-driven region must define (ui-spec.md 6).
//
// Empty and NoResults are separate components on purpose. They are different
// situations with different copy and different actions (BR-44): "you have
// nothing yet" invites creating something, "nothing matched" invites clearing
// filters. Collapsing them into one component is how that distinction gets
// quietly lost.

// --- Loading ---------------------------------------------------------------

export function LoadingState({ rows = 5, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="tt-state" role="status" aria-live="polite" data-state="loading">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="tt-skeleton" key={i} aria-hidden="true" />
      ))}
    </div>
  );
}

// --- Empty -----------------------------------------------------------------

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, body, icon = "📭", action }: EmptyStateProps) {
  return (
    <div className="tt-state" data-state="empty">
      <div className="tt-state__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="tt-state__title">{title}</p>
      {body && <p className="tt-state__body">{body}</p>}
      {action}
    </div>
  );
}

// --- No results ------------------------------------------------------------

export interface NoResultsStateProps {
  title?: string;
  body?: string;
  onClearFilters?: () => void;
  action?: ReactNode;
}

export function NoResultsState({
  title = "No results match your filters.",
  body = "Try a different search or clear your filters.",
  onClearFilters,
  action,
}: NoResultsStateProps) {
  return (
    <div className="tt-state" data-state="no-results">
      <div className="tt-state__icon" aria-hidden="true">
        🔍
      </div>
      <p className="tt-state__title">{title}</p>
      <p className="tt-state__body">{body}</p>
      {action ??
        (onClearFilters && (
          <button type="button" className="tt-btn tt-btn--tertiary" onClick={onClearFilters}>
            Clear Filters
          </button>
        ))}
    </div>
  );
}

// --- Error -----------------------------------------------------------------

// The message passed in must already be safe: no stack traces, SQL, file paths,
// or internal identifiers (FR-33). This component does not sanitise, it only
// presents, so callers are responsible for what they hand it.
export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = "Try again" }: ErrorStateProps) {
  return (
    <div className="tt-callout tt-callout--error" role="alert" data-state="error">
      <span aria-hidden="true">⚠</span>
      <div>
        <p className="tt-callout__title">Something went wrong</p>
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="tt-btn tt-btn--secondary" onClick={onRetry}>
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Success ---------------------------------------------------------------

export function SuccessCallout({ children }: { children: ReactNode }) {
  return (
    <div className="tt-callout tt-callout--success" role="status" data-state="success">
      <span aria-hidden="true">✓</span>
      <div>{children}</div>
    </div>
  );
}

// --- Warning ---------------------------------------------------------------

// Amber is reserved for genuine warnings and is never ordinary decoration
// (ui-spec.md 1).
export function WarningCallout({ children }: { children: ReactNode }) {
  return (
    <div className="tt-callout tt-callout--warning" role="status" data-state="warning">
      <span aria-hidden="true">!</span>
      <div>{children}</div>
    </div>
  );
}
