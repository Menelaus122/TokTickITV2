import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { parseQueueUrl, toQueueUrl, type QueueState } from "../queueUrl.js";

// Lab 3, Issue 8 — the IT Staff Ticket Queue (ui-spec §6; FR-26 to FR-30).
//
// One shared queue of every Requester's tickets. The server owns search,
// filtering, sorting, and paging (api-spec §5.1); this screen only turns its
// controls into that query and renders the page that comes back.
//
// Lab 4, Issue 8 (ui-spec §7, FR-21): the filters live in the address. The screen reads them
// from the query string and writes every change back, so a dashboard card, a reload, and a
// bookmark all show the same queue. The wrapper at the foot of this file connects the screen to
// the address; the screen itself still works with no address to read, as Lab 3's tests mount it.

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
  /** Lab 4 (D-12): the open group, which a single status cannot say. */
  group?: "" | "open";
  itPriority: string;
  categoryId: string;
  owner: string;
  sort: QueueSort;
  direction: "asc" | "desc";
  pageSize: number;
}

/** True when anything narrows the queue — the empty/no-results distinction. */
function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "" ||
    filters.group === "open" ||
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

export interface StaffTicketQueueProps {
  currentUserId: number;
  /**
   * The address' query string, when the address is where the filters live (ui-spec §7). The screen
   * reads its filters from it, and `onQueryChange` is how it writes them back. Without it the
   * screen keeps the same string itself, as Lab 3's did.
   */
  query?: string;
  onQueryChange?: (query: string) => void;
}

export function StaffTicketQueue({ currentUserId, query, onQueryChange }: StaffTicketQueueProps) {
  // The filters are one string, the query, whether the address holds it or the screen does.
  const [ownQuery, setOwnQuery] = useState("");
  const queryString = query ?? ownQuery;
  const state = useMemo(() => parseQueueUrl(queryString), [queryString]);
  const writeQuery = query !== undefined ? (onQueryChange ?? (() => undefined)) : setOwnQuery;
  function commit(next: QueueState) {
    writeQuery(toQueueUrl(next));
  }
  // The write for a typed search happens a moment later, so it has to be made from what the
  // address says then, not from what it said when the person started typing: a filter chosen in
  // between must not be undone by it.
  const latest = useRef({ state, writeQuery });
  latest.current = { state, writeQuery };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

  // The text in the search box is what the person has typed; the term in the address is what has
  // been asked for, a moment after they stopped. The ref says which term this screen last wrote, so
  // an address that changes for any other reason (Back, a link, Clear Filters) is the only change
  // that replaces what is in the box, and a write that lands while the person is still typing never
  // takes their next letters away.
  const [searchText, setSearchText] = useState(state.search);
  const written = useRef(state.search);
  useEffect(() => {
    if (state.search === written.current) return;
    written.current = state.search;
    setSearchText(state.search);
  }, [state.search]);

  // Typing should not fire a request per keystroke. A changed question starts again from page 1,
  // so a narrowed queue never strands the user on a page that no longer exists; the page resets in
  // the same update as the question, so no request for the new question on the old page is ever sent.
  useEffect(() => {
    const term = searchText.trim();
    if (term === state.search) return;
    const timer = setTimeout(() => {
      written.current = term;
      latest.current.writeQuery(toQueueUrl({ ...latest.current.state, search: term, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, state.search]);

  const [result, setResult] = useState<QueueResponse | null>(null);
  const [loadState, setState] = useState<LoadState>("loading");

  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<AssignableUser[]>([]);

  useEffect(() => {
    // The filter options are not the queue: if they fail, the queue still
    // loads and the Category and named-owner choices are simply absent.
    void fetchCategories().then(setCategories, () => setCategories([]));
    void fetchAssignableUsers().then(setStaff, () => setStaff([]));
  }, []);

  // What the controls show: the address' state, with the box showing what has been typed.
  const filters: Filters = {
    search: searchText,
    status: state.status,
    group: state.group,
    itPriority: state.itPriority,
    categoryId: state.categoryId,
    owner: state.owner,
    sort: state.sort,
    direction: state.direction,
    pageSize: state.pageSize,
  };

  const params = useMemo<QueueParams>(
    () => ({
      q: state.search || undefined,
      status: (state.status || undefined) as TicketStatus | undefined,
      group: state.group || undefined,
      itPriority: (state.itPriority || undefined) as RequestedPriority | undefined,
      categoryId: state.categoryId ? Number(state.categoryId) : undefined,
      owner: state.owner === "any" ? undefined : state.owner,
      sort: state.sort,
      direction: state.direction,
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
    // Search is written a moment after the typing stops, above.
    if (key === "search") {
      setSearchText(value as string);
      return;
    }
    const next: QueueState = { ...state, page: 1 };
    if (key === "status") next.status = value as string;
    if (key === "itPriority") next.itPriority = value as string;
    if (key === "categoryId") next.categoryId = value as string;
    if (key === "owner") next.owner = value as string;
    if (key === "sort") next.sort = value as QueueSort;
    if (key === "direction") next.direction = value as "asc" | "desc";
    if (key === "pageSize") next.pageSize = Number(value);
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
      {/* The open group is not one of the controls below, so it is shown as its own chip, which
          removes itself (ui-spec §7). It sits outside the filters so it stays in view when they
          are folded away on a phone. */}
      {filters.group === "open" && (
        <div className="tt-queue__chips">
          <span className="tt-chip">
            <span>Open tickets</span>
            <button type="button" className="tt-chip__remove" aria-label="Remove the Open tickets filter" onClick={removeGroup}>
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        </div>
      )}

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

      {loadState === "loading" && <LoadingState rows={5} label="Loading the ticket queue…" />}

      {loadState === "forbidden" && (
        <div className="tt-callout tt-callout--error" role="alert" data-state="forbidden">
          <span aria-hidden="true">⚠</span>
          <div>You do not have access to the ticket queue.</div>
        </div>
      )}

      {loadState === "error" && (
        <ErrorState message="Cannot load the ticket queue. Make sure the TokTickIT API is running, then try again." onRetry={load} />
      )}

      {loadState === "ready" && tickets.length === 0 && !filtering && (
        <EmptyState title="No tickets in the queue yet." body="New tickets from Requesters will appear here." />
      )}

      {loadState === "ready" && tickets.length === 0 && filtering && (
        <NoResultsState
          title="No tickets match your filters"
          body="Try a different search or clear your filters."
          onClearFilters={clearFilters}
        />
      )}

      {loadState === "ready" && tickets.length > 0 && result && (
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
            <Button variant="secondary" disabled={result.page <= 1} onClick={() => goToPage(Math.max(1, state.page - 1))}>
              Previous
            </Button>
            <span data-testid="page-status">
              Page {result.page} of {Math.max(1, result.totalPages)}
            </span>
            <Button variant="secondary" disabled={result.page >= result.totalPages} onClick={() => goToPage(state.page + 1)}>
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


/**
 * The Ticket Queue as the route mounts it: the filters are the address' query string, and a change
 * replaces the address instead of adding to the history, so Back still leaves the page rather than
 * stepping through each filter the person tried.
 */
export function StaffTicketQueueWithUrl({ currentUserId }: { currentUserId: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <StaffTicketQueue
      currentUserId={currentUserId}
      query={location.search}
      onQueryChange={(query) => navigate({ pathname: location.pathname, search: query ? `?${query}` : "" }, { replace: true })}
    />
  );
}

export default StaffTicketQueue;
