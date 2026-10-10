import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, fetchRequesterDashboard, type DashboardTicket, type RequesterDashboard as Board } from "../api.js";
import { Button, ErrorState, StatusBadge } from "../components/index.js";
import { MetricCard } from "../components/MetricCard.js";
import { ROUTES } from "../routes.js";

// Lab 4, Issue 7 — the Requester Dashboard (ui-spec §3.1, §3.5; specification.md FR-15, FR-18
// to FR-20, BR-32, BR-33, BR-39, BR-40).
//
// Every number and every row is the server's (BR-30): this screen draws what it is given and
// computes nothing, so a figure on a card can never disagree with the list it opens. Each card
// is a link to My Tickets filtered the way the API says, and each row opens its Ticket. It
// does not repeat My Tickets: no search, no filters, no table (FR-18). It loads once on
// arrival and again on Refresh, which keeps the old numbers on screen until the new ones come.

type LoadState = "loading" | "ready" | "forbidden" | "error";

const LOAD_FAILED = "The dashboard could not be loaded.";
const NO_ACCESS = "You do not have access to this dashboard.";

/** "Welcome, Pornchai": the first word of the name, or the whole name when it is one word. */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** A date for a row, in the browser's time zone (BR-41); the year only when it is not this year's. */
function formatWhen(iso: string, withTime: boolean): string {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return date.toLocaleString(undefined, options);
}

function TicketRow({ ticket, withTime }: { ticket: DashboardTicket; withTime: boolean }) {
  return (
    <li>
      <Link to={ROUTES.detail(ticket.id)} className="tt-dash-row">
        <span className="tt-dash-row__number">{ticket.ticketNumber}</span>
        <span className="tt-dash-row__summary" title={ticket.summary}>
          {ticket.summary}
        </span>
        <StatusBadge value={ticket.currentStatus} />
        <time dateTime={ticket.updatedAt}>{formatWhen(ticket.updatedAt, withTime)}</time>
      </Link>
    </li>
  );
}

/** Skeletons shaped like the cards and the lists, so nothing jumps when the numbers arrive (ui-spec §3.5). */
function DashboardSkeleton() {
  return (
    <div className="tt-dash__loading" role="status" aria-live="polite" data-state="loading">
      <span className="visually-hidden">Loading your dashboard…</span>
      <div className="tt-dash__cards" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div className="tt-skeleton tt-skeleton--card" key={i} />
        ))}
      </div>
      <div className="tt-skeleton tt-skeleton--list" aria-hidden="true" />
      <div className="tt-skeleton tt-skeleton--list" aria-hidden="true" />
    </div>
  );
}

export function RequesterDashboard({ fullName }: { fullName: string }) {
  const attentionId = useId();
  const recentId = useId();
  const actionsId = useId();

  const [state, setState] = useState<LoadState>("loading");
  const [board, setBoard] = useState<Board | null>(null);
  /** A refresh is in flight: the old numbers stay, and the button waits. */
  const [refreshing, setRefreshing] = useState(false);
  /** A refresh failed: the old numbers stay, with the failure above them. */
  const [refreshFailed, setRefreshFailed] = useState(false);

  // One request at a time, and nothing from a screen that has gone away.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const hadBoard = board !== null;
    if (hadBoard) {
      setRefreshing(true);
      setRefreshFailed(false);
    } else {
      setState("loading");
    }
    try {
      const next = await fetchRequesterDashboard();
      if (!mounted.current) return;
      setBoard(next);
      setState("ready");
      setRefreshFailed(false);
    } catch (error) {
      if (!mounted.current) return;
      if (hadBoard) {
        // The numbers on screen were true a moment ago; they stay, and the failure says so.
        setRefreshFailed(true);
      } else {
        setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [board]);

  useEffect(() => {
    void load();
    // Once on arrival; Refresh and Try again ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "forbidden") return <ErrorState message={NO_ACCESS} />;

  const waiting = state === "loading" || refreshing;

  return (
    <div className="tt-dash">
      <div className="tt-dash__head">
        <h1 className="tt-h1">Welcome, {firstNameOf(fullName)}</h1>
        {state !== "error" && (
          <Button variant="secondary" busy={waiting} busyLabel="Refreshing…" onClick={() => void load()}>
            Refresh
          </Button>
        )}
      </div>

      {state === "loading" && <DashboardSkeleton />}

      {state === "error" && <ErrorState message={LOAD_FAILED} onRetry={() => void load()} />}

      {state === "ready" && board && (
        <>
          {refreshFailed && <ErrorState message={LOAD_FAILED} onRetry={() => void load()} />}

          <section className="tt-dash__cards" aria-label="Your tickets at a glance">
            <MetricCard label="Open Tickets" value={board.metrics.openTickets.value} to={board.metrics.openTickets.href} />
            <MetricCard label="Waiting for You" value={board.metrics.waitingForYou.value} to={board.metrics.waitingForYou.href} />
            <MetricCard label="Resolved" value={board.metrics.resolved.value} to={board.metrics.resolved.href} />
            <MetricCard label="Closed" value={board.metrics.closed.value} to={board.metrics.closed.href} />
          </section>

          <section className="tt-card tt-dash__list" aria-labelledby={attentionId}>
            <div className="tt-dash__list-head">
              <h2 className="tt-h2" id={attentionId}>
                Needs your attention
              </h2>
            </div>
            {board.needsAttention.length === 0 ? (
              <p className="tt-muted">Nothing is waiting on you.</p>
            ) : (
              <ul className="tt-dash__rows">
                {board.needsAttention.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} withTime={false} />
                ))}
              </ul>
            )}
          </section>

          <section className="tt-card tt-dash__list" aria-labelledby={recentId}>
            <div className="tt-dash__list-head">
              <h2 className="tt-h2" id={recentId}>
                Recently updated
              </h2>
              <Link to={ROUTES.list} className="tt-dash__view-all">
                View all <span aria-hidden="true">→</span>
              </Link>
            </div>
            {board.recentTickets.length === 0 ? (
              <div className="tt-dash__empty">
                <p className="tt-muted">You have no tickets yet.</p>
                <Link to={ROUTES.create} className="tt-btn tt-btn--primary">
                  Create Ticket
                </Link>
              </div>
            ) : (
              <ul className="tt-dash__rows">
                {board.recentTickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} withTime />
                ))}
              </ul>
            )}
          </section>

          <section className="tt-card tt-dash__actions" aria-labelledby={actionsId}>
            <h2 className="tt-h2" id={actionsId}>
              Quick actions
            </h2>
            <div className="tt-dash__buttons">
              <Link to={ROUTES.create} className="tt-btn tt-btn--primary">
                Create Ticket
              </Link>
              <Link to={ROUTES.list} className="tt-btn tt-btn--secondary">
                View My Tickets
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default RequesterDashboard;
