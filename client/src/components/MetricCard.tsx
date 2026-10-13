import { Link } from "react-router-dom";

// Lab 4, Issue 7 — the metric card (ui-spec §1.1; specification.md FR-18, BR-39, BR-40).
//
// A card that is also a link: the whole card is one <a>, so it takes the focus outline and the
// hover and active states of every other link, and its accessible name is "Open Tickets: 3. View
// all", so the number and the destination are announced together. A count that no list can
// reproduce has no destination, and is a plain <div> with no "View all", so there is never a
// dead or misleading link (BR-40). A value of 0 is drawn as 0 and keeps its link (BR-39), and
// the meaning is in the label and the number, never in a colour.

export interface MetricCardProps {
  label: string;
  value: number;
  /** The client route the card opens, with its query string; none for a count with no list behind it. */
  to?: string;
}

export function MetricCard({ label, value, to }: MetricCardProps) {
  const content = (
    <>
      <span className="tt-metric__label">{label}</span>
      <span className="tt-metric__value">{value}</span>
      {to && (
        <span className="tt-metric__link">
          View all <span aria-hidden="true">→</span>
        </span>
      )}
    </>
  );

  if (!to) return <div className="tt-metric">{content}</div>;
  return (
    <Link to={to} className="tt-metric tt-metric--link" aria-label={`${label}: ${value}. View all`}>
      {content}
    </Link>
  );
}

export default MetricCard;
