import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../api.js";
import { Button, ErrorState, ForbiddenState } from "../components/index.js";

// Lab 4, Issues 7 and 8 — what every dashboard has in common (ui-spec §3.1, §3.2, §3.5;
// specification.md FR-20, BR-39, BR-41).
//
// A dashboard loads once on arrival and again on Refresh. While it loads the first time the
// screen shows skeletons shaped like what is coming, so nothing jumps; a refused role gets one
// callout and nothing else; any other failure is a safe callout with Try again; and Refresh
// keeps the old numbers on screen until the new ones arrive, and keeps them, with the failure
// above them, if the refresh fails. Both dashboards behave this way because both use this.

export const LOAD_FAILED = "The dashboard could not be loaded.";

/** "Welcome, Pornchai": the first word of the name, or the whole name when it is one word. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** A date for a row, in the browser's time zone (BR-41); the year only when it is not this year's. */
export function formatWhen(iso: string, withTime: boolean): string {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return date.toLocaleString(undefined, options);
}

export type DashboardLoad = "loading" | "ready" | "forbidden" | "error";

export interface DashboardData<T> {
  state: DashboardLoad;
  data: T | null;
  /** A refresh is in flight: the old numbers stay, and the button waits. */
  refreshing: boolean;
  /** A refresh failed: the old numbers stay, with the failure above them. */
  refreshFailed: boolean;
  /** Loads again: Refresh, and Try again. One request at a time. */
  reload: () => void;
}

/** Loads a dashboard once on arrival, and again on `reload`, as the paragraph above says. */
export function useDashboard<T>(fetcher: () => Promise<T>): DashboardData<T> {
  const [state, setState] = useState<DashboardLoad>("loading");
  const [data, setData] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
    const hadData = data !== null;
    if (hadData) {
      setRefreshing(true);
      setRefreshFailed(false);
    } else {
      setState("loading");
    }
    try {
      const next = await fetcher();
      if (!mounted.current) return;
      setData(next);
      setState("ready");
      setRefreshFailed(false);
    } catch (error) {
      if (!mounted.current) return;
      if (hadData) {
        // The numbers on screen were true a moment ago; they stay, and the failure says so.
        setRefreshFailed(true);
      } else {
        setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [data, fetcher]);

  useEffect(() => {
    void load();
    // Once on arrival; Refresh and Try again ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, data, refreshing, refreshFailed, reload: () => void load() };
}

/** Skeletons shaped like the cards and the lists, so nothing jumps when the numbers arrive (ui-spec §3.5). */
export function DashboardSkeleton({ lists, statusRow = false }: { lists: number; statusRow?: boolean }) {
  return (
    <div className="tt-dash__loading" role="status" aria-live="polite" data-state="loading">
      <span className="visually-hidden">Loading your dashboard…</span>
      <div className="tt-dash__cards" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div className="tt-skeleton tt-skeleton--card" key={i} />
        ))}
      </div>
      {statusRow && <div className="tt-skeleton tt-skeleton--row" aria-hidden="true" />}
      {Array.from({ length: lists }, (_, i) => (
        <div className="tt-skeleton tt-skeleton--list" aria-hidden="true" key={i} />
      ))}
    </div>
  );
}

/**
 * The page of a dashboard: its greeting and Refresh, and whichever of the states it is in. The
 * content is drawn by the screen, from the data, only when there is data.
 */
export function DashboardFrame<T>({
  title,
  dashboard,
  skeleton,
  children,
}: {
  title: string;
  dashboard: DashboardData<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { state, data, refreshing, refreshFailed, reload } = dashboard;
  if (state === "forbidden") return <ForbiddenState what="this dashboard" />;

  const waiting = state === "loading" || refreshing;
  return (
    <div className="tt-dash">
      <div className="tt-dash__head">
        <h1 className="tt-h1">{title}</h1>
        {state !== "error" && (
          <Button variant="secondary" busy={waiting} busyLabel="Refreshing…" onClick={reload}>
            Refresh
          </Button>
        )}
      </div>

      {state === "loading" && skeleton}

      {state === "error" && <ErrorState message={LOAD_FAILED} onRetry={reload} />}

      {state === "ready" && data && (
        <>
          {refreshFailed && <ErrorState message={LOAD_FAILED} onRetry={reload} />}
          {children(data)}
        </>
      )}
    </div>
  );
}
