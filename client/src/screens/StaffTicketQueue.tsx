import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  AssignableUser,
  Category,
  PERMITTED_PAGE_SIZES,
  QueueParams,
  QueueResponse,
  QueueSort,
  QueueTicket,
  RequestedPriority,
  fetchAssignableUsers,
  fetchCategories,
  fetchQueue,
} from "../api.js";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  OwnerPresentation,
  PriorityBadge,
  STATUS_LABEL,
  SelectInput,
  StatusBadge,
  TICKET_STATUSES,
  TextInput,
  type TicketStatus,
} from "../components/index.js";
import { ROUTES } from "../routes.js";

// Lab 3, Issue 8 — the IT Staff Ticket Queue (ui-spec §6; FR-26 to FR-30).
//
// One shared queue of every Requester's tickets. The server owns search,
// filtering, sorting, and paging (api-spec §5.1); this screen only turns its
// controls into that query and renders the page that comes back.

export const SEARCH_DEBOUNCE_MS = 300;

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "itPriority", label: "IT Priority" },
  { value: "createdAt", label: "Created Date" },
  { value: "updatedAt", label: "Last Updated" },
];

// The seven desktop columns, in order (ui-spec §6.2, D-03). Requested Priority
// and Last Updated are the two that fold under the summary on a tablet.
export const QUEUE_COLUMNS = [
  "Ticket Number",
  "Summary",
  "Requested Priority",
  "IT Priority",
  "Current Status",
  "Ticket Owner",
  "Last Updated",
] as const;

interface Filters {
  search: string;
  status: string;
  itPriority: string;
  categoryId: string;
  owner: string;
  sort: QueueSort;
  direction: "asc" | "desc";
  pageSize: number;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "",
  itPriority: "",
  categoryId: "",
  owner: "any",
  sort: "itPriority",
  direction: "desc",
  pageSize: 10,
};

/** True when anything narrows the queue — the empty/no-results distinction. */
function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "" ||
    filters.itPriority !== "" ||
    filters.categoryId !== "" ||
    filters.owner !== "any"
  );
}

const HOUR = 3_600_000;

/**
 * "Last Updated": relative under 24 hours, a date beyond that (ui-spec §6.2).
 * The exact timestamp goes in the cell's title.
 */
export function formatLastUpdated(iso: string, now: number = Date.now()): string {
  const elapsed = now - new Date(iso).getTime();
  if (elapsed >= 0 && elapsed < 24 * HOUR) {
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function exactTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function LastUpdated({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={exactTime(iso)}>
      {formatLastUpdated(iso)}
    </time>
  );
}

function ResolvedSignal() {
  return (
    <span className="tt-queue__resolved" data-signal="appears-resolved">
      <span aria-hidden="true">✓</span> Requester says resolved
    </span>
  );
}

type LoadState = "loading" | "ready" | "forbidden" | "error";

export function StaffTicketQueue({ currentUserId }: { currentUserId: number }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

  const [result, setResult] = useState<QueueResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<AssignableUser[]>([]);

  // Typing should not fire a request per keystroke. A changed question starts
  // again from page 1, so a narrowed queue never strands the user on a page
  // that no longer exists; the page resets in the same update as the question,
  // so no request for the new question on the old page is ever sent.
  const appliedSearch = useRef("");
  useEffect(() => {
    const term = filters.search.trim();
    const timer = setTimeout(() => {
      if (term === appliedSearch.current) return;
      appliedSearch.current = term;
      setDebouncedSearch(term);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    // The filter options are not the queue: if they fail, the queue still
    // loads and the Category and named-owner choices are simply absent.
    void fetchCategories().then(setCategories, () => setCategories([]));
    void fetchAssignableUsers().then(setStaff, () => setStaff([]));
  }, []);

  const params = useMemo<QueueParams>(
    () => ({
      q: debouncedSearch || undefined,
      status: (filters.status || undefined) as TicketStatus | undefined,
      itPriority: (filters.itPriority || undefined) as RequestedPriority | undefined,
      categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
      owner: filters.owner === "any" ? undefined : filters.owner,
      sort: filters.sort,
      direction: filters.direction,
      page,
      pageSize: filters.pageSize,
    }),
    [debouncedSearch, filters.status, filters.itPriority, filters.categoryId, filters.owner, filters.sort, filters.direction, filters.pageSize, page],
  );

  // Only the latest request may set what is shown: an earlier one that
  // answers late would otherwise replace the right page with a stale one.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setState("loading");
    try {
      const response = await fetchQueue(params);
      if (request !== latestRequest.current) return;
      setResult(response);
      setState("ready");
    } catch (error) {
      if (request !== latestRequest.current) return;
      // Nothing from an earlier page may linger beside a failure.
      setResult(null);
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    // Search returns to page 1 when its debounced term changes, above.
    if (key !== "search") setPage(1);
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  const filtering = hasActiveFilters(filters);
  const tickets = result?.tickets ?? [];

  const ownerOptions = [
    { value: "any", label: "Any" },
    { value: "unassigned", label: "Unassigned" },
    { value: "me", label: "Assigned to me" },
    ...staff.map((user) => ({ value: String(user.id), label: user.fullName })),
  ];

  const numberLink = (ticket: QueueTicket) => (
    <Link className="tt-queue__number" to={ROUTES.staffDetail(ticket.id)}>
      {ticket.ticketNumber}
    </Link>
  );

  return (
    <Card title="Ticket Queue">
      {/* Below 768 px the filters fold behind this toggle (ui-spec §6.4). */}
      <button
        type="button"
        className="tt-btn tt-btn--secondary tt-queue__filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls={filtersId}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        Filters
      </button>

      <div id={filtersId} className={`tt-toolbar tt-queue__filters${filtersOpen ? " tt-queue__filters--open" : ""}`}>
        <div className="tt-queue__search">
          <TextInput
            type="search"
            label="Search number or summary"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </div>
        <SelectInput
          label="Status"
          value={filters.status}
          placeholder="All Statuses"
          options={TICKET_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }))}
          onChange={(event) => update("status", event.target.value)}
        />
        <SelectInput
          label="IT Priority"
          value={filters.itPriority}
          placeholder="All IT Priorities"
          options={PRIORITIES.map((value) => ({ value, label: value }))}
          onChange={(event) => update("itPriority", event.target.value)}
        />
        <SelectInput
          label="Category"
          value={filters.categoryId}
          placeholder="All Categories"
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={(event) => update("categoryId", event.target.value)}
        />
        <SelectInput
          label="Owner"
          value={filters.owner}
          options={ownerOptions}
          onChange={(event) => update("owner", event.target.value)}
        />
        <SelectInput
          label="Sort by"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(event) => update("sort", event.target.value as QueueSort)}
        />
        <SelectInput
          label="Direction"
          value={filters.direction}
          options={[
            { value: "desc", label: "Descending" },
            { value: "asc", label: "Ascending" },
          ]}
          onChange={(event) => update("direction", event.target.value as "asc" | "desc")}
        />
        {filtering && (
          <Button variant="tertiary" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {state === "loading" && <LoadingState rows={5} label="Loading the ticket queue…" />}

      {state === "forbidden" && (
        <div className="tt-callout tt-callout--error" role="alert" data-state="forbidden">
          <span aria-hidden="true">⚠</span>
          <div>You do not have access to the ticket queue.</div>
        </div>
      )}

      {state === "error" && (
        <ErrorState message="Cannot load the ticket queue. Make sure the TokTickIT API is running, then try again." onRetry={load} />
      )}

      {state === "ready" && tickets.length === 0 && !filtering && (
        <EmptyState title="No tickets in the queue yet." body="New tickets from Requesters will appear here." />
      )}

      {state === "ready" && tickets.length === 0 && filtering && (
        <NoResultsState
          title="No tickets match your filters"
          body="Try a different search or clear your filters."
          onClearFilters={clearFilters}
        />
      )}

      {state === "ready" && tickets.length > 0 && result && (
        <>
          <table className="tt-table tt-queue-table">
            <caption className="visually-hidden">Ticket queue</caption>
            <thead>
              <tr>
                {QUEUE_COLUMNS.map((column, index) => (
                  <th key={column} scope="col" className={`tt-queue__col-${index + 1}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="tt-queue__col-1">{numberLink(ticket)}</td>
                  <td className="tt-queue__col-2">
                    <span className="tt-queue__summary" title={ticket.summary}>
                      {ticket.summary}
                    </span>
                    {ticket.requesterResolvedAt && <ResolvedSignal />}
                    {/* Tablet only: columns 3 and 7 fold beneath the summary. */}
                    <span className="tt-queue__secondary" aria-hidden="true">
                      <PriorityBadge value={ticket.requestedPriority} /> <LastUpdated iso={ticket.updatedAt} />
                    </span>
                  </td>
                  <td className="tt-queue__col-3">
                    <PriorityBadge value={ticket.requestedPriority} />
                  </td>
                  <td className="tt-queue__col-4">
                    <PriorityBadge value={ticket.itPriority} />
                  </td>
                  <td className="tt-queue__col-5">
                    <StatusBadge value={ticket.currentStatus} />
                  </td>
                  <td className="tt-queue__col-6">
                    <OwnerPresentation owner={ticket.owner} currentUserId={currentUserId} />
                  </td>
                  <td className="tt-queue__col-7">
                    <LastUpdated iso={ticket.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Below 768 px: one definition list per ticket, not a squeezed table. */}
          <div className="tt-cards" data-testid="queue-cards">
            {tickets.map((ticket) => (
              <article className="tt-card-row" key={ticket.id}>
                <dl className="tt-queue-card">
                  <div className="tt-card-row__head">
                    <dt className="visually-hidden">Ticket Number</dt>
                    <dd>{numberLink(ticket)}</dd>
                    <dt className="visually-hidden">Current Status</dt>
                    <dd>
                      <StatusBadge value={ticket.currentStatus} />
                    </dd>
                  </div>
                  <div>
                    <dt className="visually-hidden">Summary</dt>
                    <dd>
                      {ticket.summary}
                      {ticket.requesterResolvedAt && <ResolvedSignal />}
                    </dd>
                  </div>
                  <div className="tt-queue-card__line tt-queue-card__group">
                    <dt>Requested</dt>
                    <dd>
                      <PriorityBadge value={ticket.requestedPriority} />
                    </dd>
                    <dt>IT</dt>
                    <dd>
                      <PriorityBadge value={ticket.itPriority} />
                    </dd>
                  </div>
                  <div className="tt-queue-card__line tt-queue-card__group">
                    <dt>Owner</dt>
                    <dd>
                      <OwnerPresentation owner={ticket.owner} currentUserId={currentUserId} />
                    </dd>
                  </div>
                  <div className="tt-queue-card__line tt-muted">
                    <dt>Updated</dt>
                    <dd>
                      <LastUpdated iso={ticket.updatedAt} />
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <nav className="tt-pagination" aria-label="Ticket queue pagination">
            <Button variant="secondary" disabled={result.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span data-testid="page-status">
              Page {result.page} of {Math.max(1, result.totalPages)}
            </span>
            <Button variant="secondary" disabled={result.page >= result.totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
            <span className="tt-muted" data-testid="result-count">
              Showing {tickets.length} of {result.totalItems}
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
        </>
      )}
    </Card>
  );
}

export default StaffTicketQueue;
