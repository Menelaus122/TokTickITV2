import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetchStatusHistory, type StatusChange } from "../api.js";
import { RoleBadge, StatusBadge } from "./Badge.js";
import { ErrorState, LoadingState } from "./States.js";

// Lab 4, Issue 6 — the Status History of a Ticket, drawn as a timeline (ui-spec
// §1.4, §6, §6.1; specification.md FR-13, BR-21 to BR-23).
//
// One component serves both screens, so the Requester sees exactly what staff
// see. It is read-only: the history is written only by a change of status, on the
// server, and no screen can edit it. The first line, "Ticket created", comes from
// the Ticket's own `createdAt`, and is the only line a Ticket that predates Lab 4
// has (BR-22). It is an <ol>, so the order is announced.

export interface StatusHistoryRegionProps {
  ticketId: number;
  /** The Ticket's creation time: the timeline's first line. */
  ticketCreatedAt: string;
  /** Changes when the Ticket has changed status, so the timeline is read again without a reload (FR-14). */
  refreshToken?: number;
}

type LoadState = "loading" | "ready" | "error";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function StatusHistoryRegion({ ticketId, ticketCreatedAt, refreshToken = 0 }: StatusHistoryRegionProps) {
  const headingId = useId();
  const [state, setState] = useState<LoadState>("loading");
  const [entries, setEntries] = useState<StatusChange[]>([]);
  // After the first read, a refresh keeps the timeline on screen while it asks again, so it does not flash.
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setState("loading");
    try {
      setEntries(await fetchStatusHistory(ticketId));
      loadedOnce.current = true;
      setState("ready");
    } catch {
      loadedOnce.current = false;
      setEntries([]);
      setState("error");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return (
    <section className="tt-card tt-history" aria-labelledby={headingId} data-region="status-history">
      <h2 className="tt-h2" id={headingId}>
        Status History
      </h2>

      {state === "loading" && <LoadingState rows={2} label="Loading the status history…" />}
      {state === "error" && <ErrorState message="Cannot load the status history right now." onRetry={() => void load()} />}

      {state === "ready" && (
        <ol className="tt-timeline">
          <li className="tt-timeline__step">
            <span className="tt-timeline__what">Ticket created</span>
            <time dateTime={ticketCreatedAt}>{formatTime(ticketCreatedAt)}</time>
          </li>
          {entries.map((entry) => (
            <li key={entry.id} className="tt-timeline__step" data-change-id={entry.id}>
              <span className="tt-timeline__what">
                <StatusBadge value={entry.fromStatus} />
                <span aria-hidden="true"> → </span>
                <span className="visually-hidden"> to </span>
                <StatusBadge value={entry.toStatus} />
              </span>
              <span className="tt-timeline__who">
                {entry.changedBy.fullName} <RoleBadge value={entry.changedBy.role} />
              </span>
              <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default StatusHistoryRegion;
