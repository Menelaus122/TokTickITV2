import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Category,
  PERMITTED_PAGE_SIZES,
  RelatedSystem,
  RequestedPriority,
  TicketListItem,
  TicketListParams,
  TicketListResponse,
  fetchCategories,
  fetchMyTickets,
  fetchRelatedSystems,
} from "../api.js";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  PriorityBadge,
  ResponsiveList,
  STATUS_LABEL,
  StatusBadge,
  TICKET_STATUSES,
  type TicketStatus,
} from "../components/index.js";
import { parseTicketListUrl, toTicketListUrl, type TicketListState } from "../ticketListUrl.js";

// My Tickets (ui-spec.md 10).
//
// Every list read is scoped to the signed-in Requester by the server; this
// screen simply asks for "my tickets" and never sees anyone else's.
//
// Lab 4, Issue 7 (ui-spec §7, FR-21): the filters live in the address. The screen reads them
// from the query string and writes every change back, so a dashboard card, a reload, and a
// bookmark all show the same list. The wrapper at the foot of this file is the one that
// connects the screen to the address; the screen itself still works with no router, as Lab 2's
// tests mount it.

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "updatedAt:asc", label: "Least recently updated" },
] as const;

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const SEARCH_DEBOUNCE_MS = 300;

interface Filters {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: string;
  currentStatus: string;
  /** Lab 4 (D-12): the open group, which a single status cannot say. */
  group?: "" | "open";
  sort: string;
  pageSize: number;
}

/** True when anything narrows the list — the empty/no-results distinction. */
export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.categoryId !== "" ||
    filters.relatedSystemId !== "" ||
    filters.requestedPriority !== "" ||
    filters.currentStatus !== "" ||
    filters.group === "open"
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export interface MyTicketsProps {
  onOpenTicket?: (ticket: TicketListItem) => void;
  onCreateTicket?: () => void;
  /**
   * The address' query string, when the address is where the filters live (ui-spec §7). The
   * screen reads its filters from it, and `onQueryChange` is how it writes them back. Without
   * it the screen keeps the same string itself, as Lab 2's did.
   */
  query?: string;
  onQueryChange?: (query: string) => void;
}

export function MyTickets({ onOpenTicket, onCreateTicket, query, onQueryChange }: MyTicketsProps) {
  // The filters are one string, the query, whether the address holds it or the screen does.
  const [ownQuery, setOwnQuery] = useState("");
  const queryString = query ?? ownQuery;
  const state = useMemo(() => parseTicketListUrl(queryString), [queryString]);
  const writeQuery = query !== undefined ? (onQueryChange ?? (() => undefined)) : setOwnQuery;
  function commit(next: TicketListState) {
    writeQuery(toTicketListUrl(next));
  }
  // The write for a typed search happens a moment later, so it has to be made from what the
  // address says then, not from what it said when the person started typing: a filter chosen
  // in between must not be undone by it.
  const latest = useRef({ state, writeQuery });
  latest.current = { state, writeQuery };

  // The text in the search box is what the person has typed; the term in the address is what
  // has been asked for, a moment after they stopped. The ref says which term this screen last
  // wrote, so an address that changes for any other reason (Back, a link, Clear Filters) is
  // the only change that replaces what is in the box, and a write that lands while the person
  // is still typing never takes their next letters away.
  const [searchText, setSearchText] = useState(state.search);
  const written = useRef(state.search);
  useEffect(() => {
    if (state.search === written.current) return;
    written.current = state.search;
    setSearchText(state.search);
  }, [state.search]);

  // Typing should not fire a request per keystroke. Any change to what is being asked for
  // returns to the first page, otherwise a narrowed result set can leave the user stranded on
  // a page that no longer exists; the page resets in the same update as the question, so no
  // request for the new question on the old page is ever sent.
  useEffect(() => {
    const term = searchText.trim();
    if (term === state.search) return;
    const timer = setTimeout(() => {
      written.current = term;
      latest.current.writeQuery(toTicketListUrl({ ...latest.current.state, search: term, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, state.search]);

  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  useEffect(() => {
    // Filter options come from the database like every other reference list.
    // A failure here is not fatal to the list itself, so it is not surfaced as
    // the screen's error state.
    void Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([loadedCategories, loadedSystems]) => {
        setCategories(loadedCategories);
        setSystems(loadedSystems);
      })
      .catch(() => {
        setCategories([]);
        setSystems([]);
      });
  }, []);

  // What the controls show: the address' state, with the box showing what has been typed.
  const filters: Filters = {
    search: searchText,
    categoryId: state.categoryId,
    relatedSystemId: state.relatedSystemId,
    requestedPriority: state.requestedPriority,
    currentStatus: state.status,
    group: state.group,
    sort: `${state.sortBy}:${state.sortDir}`,
    pageSize: state.pageSize,
  };

  const params = useMemo<TicketListParams>(
    () => ({
      search: state.search || undefined,
      categoryId: state.categoryId ? Number(state.categoryId) : undefined,
      relatedSystemId: state.relatedSystemId ? Number(state.relatedSystemId) : undefined,
      requestedPriority: (state.requestedPriority || undefined) as RequestedPriority | undefined,
      currentStatus: (state.status || undefined) as TicketStatus | undefined,
      group: state.group || undefined,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      page: state.page,
      pageSize: state.pageSize,
    }),
    [state],
  );

  // Only the latest request may set what is shown: an earlier one that
  // answers late would otherwise replace the right page with a stale one.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setStatus("loading");
    try {
      const response = await fetchMyTickets(params);
      if (request !== latestRequest.current) return;
      setResult(response);
      setStatus("ready");
    } catch {
      if (request !== latestRequest.current) return;
      // Nothing from a previous query may linger on a failed load.
      setResult(null);
      setStatus("error");
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    // Search is written a moment after the typing stops, above.
    if (key === "search") {
      setSearchText(value as string);
      return;
    }
    const next: TicketListState = { ...state, page: 1 };
    if (key === "categoryId") next.categoryId = value as string;
    if (key === "relatedSystemId") next.relatedSystemId = value as string;
    if (key === "requestedPriority") next.requestedPriority = value as string;
    if (key === "currentStatus") next.status = value as string;
    if (key === "pageSize") next.pageSize = Number(value);
    if (key === "sort") {
      const [sortBy, sortDir] = (value as string).split(":");
      next.sortBy = sortBy as TicketListState["sortBy"];
      next.sortDir = sortDir as TicketListState["sortDir"];
    }
    commit(next);
  }

  function goToPage(page: number) {
    commit({ ...state, page });
  }

  function removeGroup() {
    commit({ ...state, group: "", page: 1 });
  }

  function clearFilters() {
    // Everything, the sort and the page size included, as it always did; the box empties
    // because the address no longer has a search term.
    written.current = "";
    setSearchText("");
    writeQuery("");
  }

  const filtering = hasActiveFilters(filters);
  const tickets = result?.data ?? [];
  const meta = result?.meta;

  return (
    <Card title="My Tickets">
      <div className="tt-toolbar">
        <input
          type="search"
          className="tt-field__control"
          aria-label="Search tickets"
          placeholder="Search ticket number or summary"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />

        <select
          className="tt-field__control"
          aria-label="Filter by Category"
          value={filters.categoryId}
          onChange={(event) => update("categoryId", event.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          className="tt-field__control"
          aria-label="Filter by Related System"
          value={filters.relatedSystemId}
          onChange={(event) => update("relatedSystemId", event.target.value)}
        >
          <option value="">All Related Systems</option>
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>

        <select
          className="tt-field__control"
          aria-label="Filter by Requested Priority"
          value={filters.requestedPriority}
          onChange={(event) => update("requestedPriority", event.target.value)}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>

        <select
          className="tt-field__control"
          aria-label="Filter by Current Status"
          value={filters.currentStatus}
          onChange={(event) => update("currentStatus", event.target.value)}
        >
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>

        <select
          className="tt-field__control"
          aria-label="Sort tickets"
          value={filters.sort}
          onChange={(event) => update("sort", event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* The open group is not one of the controls above, so it is shown as its own chip,
            which removes itself (ui-spec §7). */}
        {filters.group === "open" && (
          <span className="tt-chip">
            <span>Open tickets</span>
            <button type="button" className="tt-chip__remove" aria-label="Remove the Open tickets filter" onClick={removeGroup}>
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        )}

        {/* Only offered when something is actually narrowing the list. */}
        {filtering && (
          <Button variant="tertiary" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}

        {onCreateTicket && (
          <Button variant="primary" onClick={onCreateTicket}>
            Create Ticket
          </Button>
        )}
      </div>

      {status === "loading" && <LoadingState rows={5} label="Loading your tickets…" />}

      {status === "error" && (
        <ErrorState
          message="Cannot load your tickets. Make sure the TokTickIT API is running, then try again."
          onRetry={load}
        />
      )}

      {status === "ready" && tickets.length === 0 && !filtering && (
        <EmptyState
          title="You have no tickets yet."
          body="Create your first ticket to get started."
          action={
            onCreateTicket && (
              <Button variant="primary" onClick={onCreateTicket}>
                Create Ticket
              </Button>
            )
          }
        />
      )}

      {status === "ready" && tickets.length === 0 && filtering && (
        <NoResultsState
          title="No tickets match your filters."
          body="Try a different search or clear your filters."
          onClearFilters={clearFilters}
        />
      )}

      {status === "ready" && tickets.length > 0 && (
        <>
          <ResponsiveList
            items={tickets}
            caption="Your tickets"
            columns={[
              "Ticket Number",
              "Summary",
              "Category",
              "Priority",
              "Status",
              "Last Updated",
            ]}
            keyOf={(ticket) => ticket.id}
            renderRow={(ticket) => (
              <>
                <td>
                  <button
                    type="button"
                    className="tt-btn tt-btn--tertiary"
                    onClick={() => onOpenTicket?.(ticket)}
                  >
                    {ticket.ticketNumber}
                  </button>
                </td>
                <td title={ticket.summary}>{ticket.summary}</td>
                <td>{ticket.category.name}</td>
                <td>
                  <PriorityBadge value={ticket.requestedPriority} />
                </td>
                <td>
                  <StatusBadge value={ticket.currentStatus} />
                </td>
                <td>{formatDate(ticket.updatedAt)}</td>
              </>
            )}
            renderCard={(ticket) => (
              <>
                <p className="tt-card-row__head">
                  <button
                    type="button"
                    className="tt-btn tt-btn--tertiary"
                    onClick={() => onOpenTicket?.(ticket)}
                  >
                    {ticket.ticketNumber}
                  </button>
                  <StatusBadge value={ticket.currentStatus} />
                </p>
                <p>{ticket.summary}</p>
                <p className="tt-muted">
                  {ticket.category.name} · {ticket.relatedSystem.name}{" "}
                  <PriorityBadge value={ticket.requestedPriority} />
                </p>
                <p className="tt-muted">Updated {formatDate(ticket.updatedAt)}</p>
              </>
            )}
          />

          {meta && (
            <nav className="tt-pagination" aria-label="Ticket list pagination">
              <Button
                variant="secondary"
                disabled={!meta.hasPrev}
                onClick={() => goToPage(Math.max(1, state.page - 1))}
              >
                Previous
              </Button>

              <span data-testid="page-status">
                Page {meta.page} of {Math.max(1, meta.totalPages)}
              </span>

              <Button
                variant="secondary"
                disabled={!meta.hasNext}
                onClick={() => goToPage(state.page + 1)}
              >
                Next
              </Button>

              <span className="tt-muted" data-testid="result-count">
                Showing {tickets.length} of {meta.totalItems}
              </span>

              <select
                className="tt-field__control"
                aria-label="Tickets per page"
                value={filters.pageSize}
                onChange={(event) => update("pageSize", Number(event.target.value))}
              >
                {PERMITTED_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </nav>
          )}
        </>
      )}
    </Card>
  );
}

export default MyTickets;

/**
 * My Tickets as the route mounts it: the filters are the address' query string, and a change
 * replaces the address instead of adding to the history, so Back still leaves the page rather
 * than stepping through each filter the person tried.
 */
export function MyTicketsWithUrl(props: Pick<MyTicketsProps, "onOpenTicket" | "onCreateTicket">) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <MyTickets
      {...props}
      query={location.search}
      onQueryChange={(query) => navigate({ pathname: location.pathname, search: query ? `?${query}` : "" }, { replace: true })}
    />
  );
}
