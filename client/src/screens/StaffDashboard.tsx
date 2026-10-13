import { useId } from "react";
import { Link } from "react-router-dom";
import { fetchStaffDashboard, type DashboardAction, type DashboardStatusRow, type StaffDashboardTicket } from "../api.js";
import { FollowUpPill, OwnerPresentation, PriorityBadge, STATUS_LABEL, StatusBadge } from "../components/index.js";
import { MetricCard } from "../components/MetricCard.js";
import { ROUTES } from "../routes.js";
import { DashboardFrame, DashboardSkeleton, firstNameOf, formatWhen, useDashboard } from "./dashboardParts.js";

// Lab 4, Issue 8 — the IT Staff and Administrator Dashboard (ui-spec §3.2, §3.3, §3.5; specification.md
// FR-16, FR-17, FR-18, FR-20, BR-34 to BR-36, BR-38 to BR-40, D-11).
//
// Every number and every row is the server's (BR-30): this screen draws what it is given and
// computes nothing, so a card can never disagree with the queue it opens. Each card, each status
// row, and each list's View all is a link to the Ticket Queue filtered the way the API says; each
// row opens its Ticket. The Administrator's account counts are in the answer or they are not:
// the screen has no idea which role is calling, only whether the server sent them, so IT Staff
// can never be shown a region the server did not give them (BR-38). Those four counts are plain
// numbers, because no list could match an *active* count, and the one link beside them opens
// User Management with no filter and claims nothing (BR-40, D-12). There is no Create Ticket
// shortcut, since neither role may create a Ticket (D-11). Loading, refreshing, and failing are
// the same for every dashboard (dashboardParts.tsx).

function StatusCount({ row }: { row: DashboardStatusRow }) {
  return (
    <li>
      <Link to={row.href} className="tt-dash-status" aria-label={`${STATUS_LABEL[row.status]}: ${row.value}. View all`}>
        <StatusBadge value={row.status} />
        <span className="tt-dash-status__value">{row.value}</span>
      </Link>
    </li>
  );
}

function TicketRow({ ticket, currentUserId }: { ticket: StaffDashboardTicket; currentUserId: number }) {
  return (
    <li>
      <Link to={ROUTES.staffDetail(ticket.id)} className="tt-dash-row tt-dash-row--staff">
        <span className="tt-dash-row__number">{ticket.ticketNumber}</span>
        <span className="tt-dash-row__summary" title={ticket.summary}>
          {ticket.summary}
        </span>
        <time dateTime={ticket.updatedAt}>{formatWhen(ticket.updatedAt, true)}</time>
        <span className="tt-dash-row__meta">
          <StatusBadge value={ticket.currentStatus} />
          <PriorityBadge value={ticket.itPriority} />
          <OwnerPresentation owner={ticket.owner} currentUserId={currentUserId} />
        </span>
      </Link>
    </li>
  );
}

function ActionRow({ action }: { action: DashboardAction }) {
  return (
    <li>
      <Link to={ROUTES.staffDetail(action.ticketId)} className="tt-dash-row tt-dash-row--action">
        <span className="tt-dash-row__number">{action.ticketNumber}</span>
        <time dateTime={action.actionAt}>{formatWhen(action.actionAt, true)}</time>
        <span className="tt-dash-row__summary">{action.description}</span>
        <FollowUpPill required={action.followUpRequired} />
      </Link>
    </li>
  );
}

export function StaffDashboard({ fullName, currentUserId }: { fullName: string; currentUserId: number }) {
  const statusId = useId();
  const accountsId = useId();
  const mineId = useId();
  const urgentId = useId();
  const actionsId = useId();
  const quickId = useId();
  const dashboard = useDashboard(fetchStaffDashboard);

  return (
    <DashboardFrame title={`Welcome back, ${firstNameOf(fullName)}`} dashboard={dashboard} skeleton={<DashboardSkeleton lists={3} statusRow />}>
      {(board) => (
        <>
          <section className="tt-dash__cards" aria-label="Your queue at a glance">
            <MetricCard label="Unassigned" value={board.metrics.unassigned.value} to={board.metrics.unassigned.href} />
            <MetricCard label="Assigned to Me" value={board.metrics.assignedToMe.value} to={board.metrics.assignedToMe.href} />
            <MetricCard label="Waiting for Requester" value={board.metrics.waitingForRequester.value} to={board.metrics.waitingForRequester.href} />
            <MetricCard label="Urgent" value={board.metrics.urgent.value} to={board.metrics.urgent.href} />
          </section>

          <section className="tt-card tt-dash__statuses" aria-labelledby={statusId}>
            <h2 className="tt-h2" id={statusId}>
              By status
            </h2>
            <ul className="tt-dash__status-row">
              {board.byStatus.map((row) => (
                <StatusCount key={row.status} row={row} />
              ))}
            </ul>
          </section>

          {board.userCounts && (
            <section className="tt-card tt-accounts" aria-labelledby={accountsId}>
              <div className="tt-dash__list-head">
                <h2 className="tt-h2" id={accountsId}>
                  Accounts
                </h2>
                <Link to={ROUTES.users} className="tt-dash__view-all">
                  Open User Management <span aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="tt-muted">Active accounts by role, and inactive accounts counted separately.</p>
              <div className="tt-dash__cards tt-dash__cards--accounts">
                <MetricCard label="Requesters" value={board.userCounts.activeRequesters.value} />
                <MetricCard label="IT Staff" value={board.userCounts.activeItStaff.value} />
                <MetricCard label="Administrators" value={board.userCounts.activeAdministrators.value} />
                <MetricCard label="Inactive" value={board.userCounts.inactive.value} />
              </div>
            </section>
          )}

          <div className="tt-dash__pair">
            <section className="tt-card tt-dash__list" aria-labelledby={mineId}>
              <div className="tt-dash__list-head">
                <h2 className="tt-h2" id={mineId}>
                  My Tickets
                </h2>
                <Link to={board.metrics.assignedToMe.href} className="tt-dash__view-all">
                  View all <span aria-hidden="true">→</span>
                </Link>
              </div>
              {board.myTickets.length === 0 ? (
                <p className="tt-muted">No tickets are assigned to you.</p>
              ) : (
                <ul className="tt-dash__rows">
                  {board.myTickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} currentUserId={currentUserId} />
                  ))}
                </ul>
              )}
            </section>

            <section className="tt-card tt-dash__list" aria-labelledby={urgentId}>
              <div className="tt-dash__list-head">
                <h2 className="tt-h2" id={urgentId}>
                  Urgent Tickets
                </h2>
                <Link to={board.metrics.urgent.href} className="tt-dash__view-all">
                  View all <span aria-hidden="true">→</span>
                </Link>
              </div>
              {board.urgentTickets.length === 0 ? (
                <p className="tt-muted">No urgent tickets right now.</p>
              ) : (
                <ul className="tt-dash__rows">
                  {board.urgentTickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} currentUserId={currentUserId} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="tt-card tt-dash__list" aria-labelledby={actionsId}>
            <div className="tt-dash__list-head">
              <h2 className="tt-h2" id={actionsId}>
                My Recent Actions
              </h2>
            </div>
            {board.myRecentActions.length === 0 ? (
              <p className="tt-muted">You have not recorded any actions yet.</p>
            ) : (
              <ul className="tt-dash__rows">
                {board.myRecentActions.map((action) => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </ul>
            )}
          </section>

          <section className="tt-card tt-dash__actions" aria-labelledby={quickId}>
            <h2 className="tt-h2" id={quickId}>
              Quick actions
            </h2>
            <div className="tt-dash__buttons">
              <Link to={ROUTES.queue} className="tt-btn tt-btn--primary">
                Open Ticket Queue
              </Link>
              <Link to={board.metrics.unassigned.href} className="tt-btn tt-btn--secondary">
                Unassigned Tickets
              </Link>
              <Link to={board.metrics.assignedToMe.href} className="tt-btn tt-btn--secondary">
                My Queue
              </Link>
            </div>
          </section>
        </>
      )}
    </DashboardFrame>
  );
}

export default StaffDashboard;
