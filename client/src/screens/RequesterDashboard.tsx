import { useId } from "react";
import { Link } from "react-router-dom";
import { fetchRequesterDashboard, type DashboardTicket } from "../api.js";
import { StatusBadge } from "../components/index.js";
import { MetricCard } from "../components/MetricCard.js";
import { ROUTES } from "../routes.js";
import { DashboardFrame, DashboardSkeleton, firstNameOf, formatWhen, useDashboard } from "./dashboardParts.js";

// Lab 4, Issue 7 — the Requester Dashboard (ui-spec §3.1, §3.5; specification.md FR-15, FR-18
// to FR-20, BR-32, BR-33, BR-39, BR-40).
//
// Every number and every row is the server's (BR-30): this screen draws what it is given and
// computes nothing, so a figure on a card can never disagree with the list it opens. Each card
// is a link to My Tickets filtered the way the API says, and each row opens its Ticket. It
// does not repeat My Tickets: no search, no filters, no table (FR-18). Loading, refreshing, and
// failing are the same for every dashboard (dashboardParts.tsx).

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

export function RequesterDashboard({ fullName }: { fullName: string }) {
  const attentionId = useId();
  const recentId = useId();
  const actionsId = useId();
  const dashboard = useDashboard(fetchRequesterDashboard);

  return (
    <DashboardFrame title={`Welcome, ${firstNameOf(fullName)}`} dashboard={dashboard} skeleton={<DashboardSkeleton lists={2} />}>
      {(board) => (
        <>
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
    </DashboardFrame>
  );
}

export default RequesterDashboard;
