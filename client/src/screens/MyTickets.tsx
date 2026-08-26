import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRequester } from "../context/RequesterContext.js";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  PriorityBadge,
  ResponsiveList,
  StatusBadge,
} from "../components/index.js";

// My Tickets (ui-spec.md 10).
//
// Every list read is scoped to the current Development Requester by the server;
// this screen simply asks for "my tickets" and never sees anyone else's.

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
  sort: string;
  pageSize: number;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  categoryId: "",
  relatedSystemId: "",
  requestedPriority: "",
  currentStatus: "",
  sort: "createdAt:desc",
  pageSize: 10,
};

/** True when anything narrows the list — the empty/no-results distinction. */
export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.categoryId !== "" ||
    filters.relatedSystemId !== "" ||
    filters.requestedPriority !== "" ||
    filters.currentStatus !== ""
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MyTickets({
  onOpenTicket,
  onCreateTicket,
}: {
  onOpenTicket?: (ticket: TicketListItem) => void;
  onCreateTicket?: () => void;
}) {
  const { requester } = useRequester();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Any change to what is being asked for returns to the first page, otherwise
  // a narrowed result set can leave the user stranded on a page that no longer
  // exists.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filters.categoryId,
    filters.relatedSystemId,
    filters.requestedPriority,
    filters.currentStatus,
    filters.sort,
    filters.pageSize,
  ]);

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

  const [sortBy, sortDir] = filters.sort.split(":") as [
    TicketListParams["sortBy"],
    TicketListParams["sortDir"],
  ];

  const params = useMemo<TicketListParams>(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
      relatedSystemId: filters.relatedSystemId ? Number(filters.relatedSystemId) : undefined,
      requestedPriority: (filters.requestedPriority || undefined) as RequestedPriority | undefined,
      currentStatus: (filters.currentStatus || undefined) as "NEW" | undefined,
      sortBy,
      sortDir,
      page,
      pageSize: filters.pageSize,
    }),
    [
      debouncedSearch,
      filters.categoryId,
      filters.relatedSystemId,
      filters.requestedPriority,
      filters.currentStatus,
      filters.pageSize,
      sortBy,
      sortDir,
      page,
    ],
  );

  const load = useCallback(async () => {
    if (!requester) return;
    setStatus("loading");
    try {
      setResult(await fetchMyTickets(requester.id, params));
      setStatus("ready");
    } catch {
      // Nothing from a previous requester or a previous query may linger on a
      // failed load.
      setResult(null);
      setStatus("error");
    }
  }, [requester, params]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
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
          <option value="NEW">NEW</option>
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
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>

              <span data-testid="page-status">
                Page {meta.page} of {Math.max(1, meta.totalPages)}
              </span>

              <Button
                variant="secondary"
                disabled={!meta.hasNext}
                onClick={() => setPage((current) => current + 1)}
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
