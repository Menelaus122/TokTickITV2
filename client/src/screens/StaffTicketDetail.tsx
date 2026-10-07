import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  AssignableUser,
  Attachment,
  COMMENT_MAX,
  REASON_MIN,
  REASON_REQUIRED,
  RequestedPriority,
  Role,
  StaffTicketDetail as Detail,
  ThreadEntry,
  changeTicketStatus,
  downloadAttachment,
  fetchAssignableUsers,
  fetchComments,
  fetchNotes,
  fetchStaffTicket,
  postComment,
  postNote,
  setItPriority,
  setTicketOwner,
} from "../api.js";
import {
  AttachmentSection,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  OwnerPresentation,
  PriorityBadge,
  ReadOnlyField,
  RoleBadge,
  STATUS_LABEL,
  SelectInput,
  StatusBadge,
  SuccessCallout,
  TextArea,
  WarningCallout,
  type TicketStatus,
} from "../components/index.js";
import { ConversationThread } from "../components/ConversationThread.js";
import { ActionsTakenRegion } from "../components/ActionsTakenRegion.js";
import { StatusHistoryRegion } from "../components/StatusHistoryRegion.js";

// Lab 3, Issue 9 — IT Staff Ticket Detail (ui-spec §7; FR-31 to FR-37).
//
// Regions in a fixed order: what the Requester submitted (read-only), the
// operational fields IT Staff may change, Actions Taken (Lab 4, ui-spec §4), the
// Lab 2 attachments, the two threads, and the Status History (Lab 4, ui-spec §6.1).
//
// The server is the authority on every rule. The "Move to" list is exactly the
// response's permittedTransitions, and "Not available now" is exactly its
// blockedTransitions with the API's own words (Lab 4, FR-09); anything the screen
// prevents locally the API refuses again. Every change sends the version the
// screen was showing, so one made against an older ticket is refused as stale
// (BR-26) and the screen offers to show what is true now (ui-spec §1.5).

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const OWNER_REQUIRED: TicketStatus[] = ["RESOLVED", "CLOSED"];

/** The operational control whose request is in flight; the others wait (FR-37). */
type Busy = "claim" | "owner" | "priority" | "status" | null;
/** What the person is told after a request: a success, a failure, a gate refusal, or a stale save (ui-spec §1.5). */
type Feedback =
  | { tone: "success" | "error" | "gate"; message: string }
  | { tone: "stale"; latest: Detail }
  | null;

/** The two refusals of a move to RESOLVED that come from the gate (BR-18). */
const GATE_CODES = ["ACTION_REQUIRED", "FOLLOW_UP_PENDING"];
type LoadState = "loading" | "ready" | "not-found" | "forbidden" | "error";

export interface StaffTicketDetailProps {
  ticketId: number;
  currentUserId: number;
  /** Who is signed in, shown as Performed by while recording an action (Lab 4, BR-05). */
  currentUser?: { fullName: string; role: Role };
  onBack?: () => void;
  /** Injected in tests; defaults to downloading through the staff route. */
  onDownload?: (attachment: Attachment) => void;
}

function describeOwner(ticket: Detail, staff: AssignableUser[], ownerId: number | null): string {
  if (ownerId === null) return "nobody";
  return staff.find((user) => user.id === ownerId)?.fullName ?? ticket.owner?.fullName ?? "the chosen owner";
}

export function StaffTicketDetail({ ticketId, currentUserId, currentUser, onBack, onDownload }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [staff, setStaff] = useState<AssignableUser[]>([]);

  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmingClaim, setConfirmingClaim] = useState(false);
  const [ownerChoice, setOwnerChoice] = useState("");
  const [priorityChoice, setPriorityChoice] = useState<RequestedPriority>("MEDIUM");
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [downloadErrors, setDownloadErrors] = useState<{ filename: string; message: string }[]>([]);
  /** Changes when the ticket has changed status, so the timeline is read again without a reload (FR-14). */
  const [historyToken, setHistoryToken] = useState(0);
  const ownerRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<ThreadEntry[]>([]);
  const [commentsState, setCommentsState] = useState<"loading" | "ready" | "error">("loading");
  const [notes, setNotes] = useState<ThreadEntry[]>([]);
  const [notesState, setNotesState] = useState<"loading" | "ready" | "error">("loading");

  /**
   * Shows a ticket from the server and resets every control to match it. After a conflict the
   * person's reason is kept, and so is the move they chose when the ticket still offers it
   * (BR-54): what they typed is theirs, and the ticket changing under them is not their fault.
   */
  const show = useCallback((next: Detail, keepForm = false) => {
    setTicket(next);
    setOwnerChoice(next.owner ? String(next.owner.id) : "");
    setPriorityChoice(next.itPriority);
    setMoveTo((chosen) => (keepForm && next.permittedTransitions.includes(chosen as TicketStatus) ? chosen : ""));
    if (!keepForm) setReason("");
    setReasonError(undefined);
    setConfirmingClaim(false);
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      show(await fetchStaffTicket(ticketId));
      setState("ready");
    } catch (error) {
      setTicket(null);
      const status = error instanceof ApiError ? error.status : 0;
      setState(status === 404 ? "not-found" : status === 403 ? "forbidden" : "error");
    }
  }, [ticketId, show]);

  useEffect(() => {
    void load();
  }, [load]);

  // The picker's choices. If they fail, the ticket still works; only
  // reassignment to a named colleague is unavailable.
  useEffect(() => {
    void fetchAssignableUsers().then(setStaff, () => setStaff([]));
  }, []);

  // Each thread loads on its own, so one failing leaves the rest usable.
  const loadComments = useCallback(async () => {
    setCommentsState("loading");
    try {
      setComments(await fetchComments(ticketId));
      setCommentsState("ready");
    } catch {
      setComments([]);
      setCommentsState("error");
    }
  }, [ticketId]);

  const loadNotes = useCallback(async () => {
    setNotesState("loading");
    try {
      setNotes(await fetchNotes(ticketId));
      setNotesState("ready");
    } catch {
      setNotes([]);
      setNotesState("error");
    }
  }, [ticketId]);

  useEffect(() => {
    void loadComments();
    void loadNotes();
  }, [loadComments, loadNotes]);

  /**
   * Runs one operation: busy while in flight, then success or a safe failure. A stale save
   * (409 STALE_UPDATE) keeps the form as it is and offers to show the ticket as it is now, so
   * nothing the person typed is lost (BR-26, BR-54). Any other conflict means the ticket changed
   * under us, so it is reloaded and the screen shows what is true now beside the explanation.
   */
  async function run(action: Exclude<Busy, null>, request: () => Promise<Detail>, success: (next: Detail) => string) {
    setBusy(action);
    setFeedback(null);
    try {
      const next = await request();
      show(next);
      setFeedback({ tone: "success", message: success(next) });
      // A claim can move a New ticket to Open, and a move is always a step in the history.
      setHistoryToken((token) => token + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "STALE_UPDATE" && error.current) {
        setFeedback({ tone: "stale", latest: error.current as Detail });
        return;
      }
      if (error instanceof ApiError && error.status === 400 && error.fields.reason) {
        setReasonError(error.fields.reason);
      }
      const gate = error instanceof ApiError && error.status === 409 && GATE_CODES.includes(error.code);
      setFeedback({
        tone: gate ? "gate" : "error",
        message: error instanceof ApiError && error.status !== 500 ? error.message : "That did not work. Please try again.",
      });
      if (error instanceof ApiError && error.status === 409) {
        try {
          show(await fetchStaffTicket(ticketId), gate);
        } catch {
          // The explanation above still stands; the next action reloads.
        }
      }
    } finally {
      setBusy(null);
    }
  }

  /**
   * Reads the ticket again after an action was recorded or edited, because the resolution gate reads the
   * actions (BR-17): Resolved may now be available, or may no longer be. What the person had chosen and
   * typed is kept. If it cannot be read, the screen stays as it is, and the API still enforces the gate.
   */
  async function refreshTicket() {
    try {
      show(await fetchStaffTicket(ticketId), true);
    } catch {
      // The next action or a reload shows what is true; nothing here is lost.
    }
  }

  /** Show latest: reads the ticket again and shows it, keeping what the person typed (ui-spec §1.5). */
  async function showLatest() {
    try {
      show(await fetchStaffTicket(ticketId), true);
      setFeedback(null);
    } catch {
      setFeedback({ tone: "error", message: "The latest version could not be loaded. Please try again." });
    }
  }

  /** Go to Actions Taken: the region's heading takes focus, wherever on the page it is (ui-spec §9). */
  function goToActions() {
    const heading = document.querySelector<HTMLElement>('[data-region="actions-taken"] h2');
    heading?.scrollIntoView?.({ block: "start" });
    heading?.focus();
  }

  /** Claim this ticket: focus goes to the owner control, where the claim or the assignment is made. */
  function goToOwner() {
    ownerRef.current?.querySelector<HTMLElement>("button, select")?.focus();
  }

  if (state === "loading") return <LoadingState rows={8} label="Loading the ticket…" />;
  if (state === "not-found") {
    return (
      <EmptyState
        title="Ticket not found."
        body="It may have been removed, or the link is wrong."
        action={onBack && <Button variant="secondary" onClick={onBack}>Back to the queue</Button>}
      />
    );
  }
  if (state === "forbidden") {
    return <ErrorState message="You do not have permission to open this ticket. Only IT Staff can." />;
  }
  if (state === "error" || !ticket) {
    return <ErrorState message="Cannot load this ticket. Make sure the TokTickIT API is running, then try again." onRetry={load} />;
  }

  const current = ticket;
  const unassigned = current.owner === null;
  const isNew = current.currentStatus === "NEW";
  const ownerId = current.owner?.id ?? null;
  const chosenOwnerId = ownerChoice === "" ? null : Number(ownerChoice);
  const reasonNeeded = moveTo !== "" && REASON_REQUIRED.includes(moveTo as TicketStatus);
  const ownerMissing = moveTo !== "" && OWNER_REQUIRED.includes(moveTo as TicketStatus) && unassigned;
  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length >= REASON_MIN && trimmedReason.length <= COMMENT_MAX;
  const working = busy !== null;

  // The owner picker: active IT Staff and Administrators, plus the current
  // owner even when inactive, so the select can show who holds the ticket.
  const ownerOptions = [
    { value: "", label: unassigned ? "Choose an owner" : "Unassign (no owner)" },
    ...staff.map((user) => ({ value: String(user.id), label: `${user.fullName}${user.role === "ADMINISTRATOR" ? " (Administrator)" : ""}` })),
    ...(current.owner && !staff.some((user) => user.id === current.owner!.id)
      ? [{ value: String(current.owner.id), label: `${current.owner.fullName} (inactive)` }]
      : []),
  ];

  function claim() {
    void run(
      "claim",
      () => setTicketOwner(current.id, currentUserId, null, current.version),
      (next) => (isNew ? `You claimed ${next.ticketNumber}, and it moved to Open.` : `You claimed ${next.ticketNumber}.`),
    );
  }

  function changeOwner() {
    void run(
      "owner",
      () => setTicketOwner(current.id, chosenOwnerId, ownerId, current.version),
      (next) => (chosenOwnerId === null ? `${next.ticketNumber} is now unassigned.` : `${next.ticketNumber} is now owned by ${describeOwner(next, staff, chosenOwnerId)}.`),
    );
  }

  function changePriority() {
    void run("priority", () => setItPriority(current.id, priorityChoice, current.version), (next) => `IT Priority is now ${next.itPriority}.`);
  }

  function applyStatus(event: FormEvent) {
    event.preventDefault();
    if (moveTo === "") return;
    if (reasonNeeded && !reasonValid) {
      setReasonError(`The reason must be between ${REASON_MIN} and ${COMMENT_MAX} characters.`);
      return;
    }
    const target = moveTo as TicketStatus;
    void run(
      "status",
      async () => {
        const result = await changeTicketStatus(current.id, target, reasonNeeded ? trimmedReason : undefined, current.version);
        // The reason joins the public thread straight away (BR-36).
        if (result.comment) setComments((existing) => [...existing, result.comment!]);
        return result.ticket;
      },
      (next) => `Status changed to ${STATUS_LABEL[next.currentStatus]}.`,
    );
  }

  async function handleDownload(attachment: Attachment) {
    if (onDownload) return onDownload(attachment);
    try {
      await downloadAttachment(attachment, "/api/staff/attachments");
      setDownloadErrors((existing) => existing.filter((e) => e.filename !== attachment.originalFilename));
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "The file could not be downloaded.";
      setDownloadErrors((existing) => [
        ...existing.filter((e) => e.filename !== attachment.originalFilename),
        { filename: attachment.originalFilename, message },
      ]);
    }
  }

  return (
    <>
      {onBack && (
        <Button variant="tertiary" onClick={onBack}>
          ‹ Back to the queue
        </Button>
      )}

      <div className="tt-staff-detail">
        {/* 1 — What the Requester submitted: plain text, nothing to enable (FR-31). */}
        <section className="tt-card tt-staff-detail__submitted" aria-labelledby="submitted-heading" data-region="submitted">
          <div className="tt-staff-detail__region-head">
            <h2 className="tt-h2" id="submitted-heading">What the Requester submitted</h2>
            <span className="tt-badge tt-badge--readonly">Read-only</span>
          </div>
          <div className="tt-detail__header">
            <h1 className="tt-h1" data-testid="detail-ticket-number">{current.ticketNumber}</h1>
            <StatusBadge value={current.currentStatus} />
          </div>
          <dl className="tt-detail">
            <dt>Ticket Date</dt>
            <dd>{new Date(current.createdAt).toLocaleString()}</dd>
            <dt>Requester</dt>
            <dd>
              {current.requester.fullName} <RoleBadge value={current.requester.role} />
            </dd>
            <dt>Category</dt>
            <dd>{current.categoryName}</dd>
            <dt>Related System</dt>
            <dd>{current.relatedSystemName}</dd>
            <dt>Summary</dt>
            <dd data-testid="detail-summary">{current.summary}</dd>
            <dt>Description</dt>
            <dd className="tt-detail__description">{current.description}</dd>
          </dl>
        </section>

        {/* 2 — Operational: the only fields IT Staff may change. */}
        <section className="tt-card tt-staff-detail__operational" aria-labelledby="operational-heading" data-region="operational">
          <div className="tt-staff-detail__region-head">
            <h2 className="tt-h2" id="operational-heading">Operational</h2>
            <span className="tt-badge">Editable</span>
          </div>

          {feedback?.tone === "success" && <SuccessCallout>{feedback.message}</SuccessCallout>}
          {feedback?.tone === "error" && (
            <div className="tt-callout tt-callout--error" role="alert" data-state="error">
              <span aria-hidden="true">!</span>
              <div>{feedback.message}</div>
            </div>
          )}
          {feedback?.tone === "gate" && (
            <WarningCallout role="alert">
              <p>{feedback.message}</p>
              <Button variant="secondary" onClick={goToActions}>
                Go to Actions Taken
              </Button>
            </WarningCallout>
          )}
          {feedback?.tone === "stale" && (
            <WarningCallout role="alert">
              <p>
                This ticket changed while you were working on it — for example a colleague moved it, or the Requester marked the problem as
                appearing resolved. It is now <strong>{STATUS_LABEL[feedback.latest.currentStatus]}</strong>
                {feedback.latest.owner ? `, owned by ${feedback.latest.owner.fullName}` : ", with no owner"}. Review it and try again.
              </p>
              <Button variant="secondary" onClick={() => void showLatest()}>
                Show latest
              </Button>
            </WarningCallout>
          )}

          {current.requesterResolvedAt && (
            <WarningCallout>
              <span data-signal="appears-resolved">
                The Requester says the problem appears resolved ({new Date(current.requesterResolvedAt).toLocaleString()}).
              </span>
            </WarningCallout>
          )}

          {/* Ticket Owner — claim when unassigned, otherwise reassign (BR-24, BR-25). */}
          <div className="tt-staff-detail__group" data-control="owner" ref={ownerRef}>
            <h3 className="tt-h3">Ticket Owner</h3>
            <p>
              <OwnerPresentation owner={current.owner} currentUserId={currentUserId} />
            </p>

            {unassigned &&
              (confirmingClaim ? (
                <div className="tt-staff-detail__confirm" role="group" aria-label="Confirm claim">
                  <p>
                    Claim {current.ticketNumber}? You will become its Ticket Owner
                    {isNew ? ", and because it is New it will move to Open at the same time." : "."}
                  </p>
                  <div className="tt-actions">
                    <Button variant="secondary" disabled={working} onClick={() => setConfirmingClaim(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" busy={busy === "claim"} busyLabel="Claiming…" disabled={working} onClick={claim}>
                      Confirm claim
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="primary" disabled={working} onClick={() => setConfirmingClaim(true)}>
                  Claim
                </Button>
              ))}

            <SelectInput
              label={unassigned ? "Assign to" : "Reassign to"}
              value={ownerChoice}
              options={ownerOptions}
              disabled={working || current.currentStatus === "CANCELLED"}
              help={current.currentStatus === "CANCELLED" ? "A cancelled ticket cannot change owner." : undefined}
              onChange={(event) => setOwnerChoice(event.target.value)}
            />
            <Button
              variant="secondary"
              busy={busy === "owner"}
              busyLabel="Saving…"
              disabled={working || chosenOwnerId === ownerId || current.currentStatus === "CANCELLED"}
              onClick={changeOwner}
            >
              {chosenOwnerId === null ? "Unassign" : unassigned ? "Assign" : "Reassign"}
            </Button>
          </div>

          {/* Priorities — Requested sits directly above IT, so they compare at a glance (BR-28). */}
          <div className="tt-staff-detail__group" data-control="priority">
            <h3 className="tt-h3">Priority</h3>
            <ReadOnlyField
              label="Requested Priority"
              value={current.requestedPriority}
              help="Set by the Requester. It never changes."
            />
            <SelectInput
              label="IT Priority"
              value={priorityChoice}
              options={PRIORITIES.map((value) => ({ value, label: value }))}
              disabled={working}
              onChange={(event) => setPriorityChoice(event.target.value as RequestedPriority)}
            />
            <Button
              variant="secondary"
              busy={busy === "priority"}
              busyLabel="Saving…"
              disabled={working || priorityChoice === current.itPriority}
              onClick={changePriority}
            >
              Update IT Priority
            </Button>
          </div>

          {/* Status — only the server's permittedTransitions are offered (FR-34). */}
          <form className="tt-staff-detail__group" data-control="status" onSubmit={applyStatus} noValidate>
            <h3 className="tt-h3">Status</h3>
            <p>
              Current: <StatusBadge value={current.currentStatus} /> <PriorityBadge value={current.itPriority} />
            </p>
            {current.permittedTransitions.length === 0 ? (
              current.blockedTransitions.length === 0 ? (
                <p className="tt-muted" data-state="terminal">
                  This ticket is {STATUS_LABEL[current.currentStatus].toLowerCase()} and cannot change.
                </p>
              ) : (
                <p className="tt-field__help">No move is available yet.</p>
              )
            ) : (
              <>
                <SelectInput
                  label="Move to"
                  value={moveTo}
                  placeholder="Choose a status"
                  options={current.permittedTransitions.map((value) => ({ value, label: STATUS_LABEL[value] }))}
                  disabled={working}
                  onChange={(event) => {
                    setMoveTo(event.target.value);
                    setReasonError(undefined);
                  }}
                />
                {reasonNeeded && (
                  <TextArea
                    label="Reason"
                    required
                    rows={3}
                    value={reason}
                    error={reasonError}
                    help={`${REASON_MIN}–${COMMENT_MAX} characters. Posted as a Public Comment, so the Requester can read it.`}
                    disabled={working}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReasonError(undefined);
                    }}
                  />
                )}
                {ownerMissing && (
                  <p className="tt-field__help" data-state="owner-required">
                    Claim or assign the ticket before moving it to {STATUS_LABEL[moveTo as TicketStatus]}.
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  busy={busy === "status"}
                  busyLabel="Applying…"
                  disabled={working || moveTo === "" || ownerMissing || (reasonNeeded && !reasonValid)}
                >
                  Apply
                </Button>
              </>
            )}

            {/* The moves the matrix allows that the ticket cannot make yet, with the API's own reason (FR-09). */}
            {current.blockedTransitions.length > 0 && (
              <div className="tt-staff-detail__blocked" data-state="blocked">
                <h4 className="tt-h3" id="not-available-heading">
                  Not available now
                </h4>
                <ul aria-labelledby="not-available-heading">
                  {current.blockedTransitions.map((blocked) => (
                    <li key={blocked.to}>
                      <strong>{STATUS_LABEL[blocked.to]}</strong>
                      {" — "}
                      {blocked.message}{" "}
                      {blocked.code === "OWNER_REQUIRED" ? (
                        <Button variant="tertiary" onClick={goToOwner}>
                          Claim this ticket
                        </Button>
                      ) : (
                        <Button variant="tertiary" onClick={goToActions}>
                          Go to Actions Taken
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </section>
      </div>

      {/* 3 — Actions Taken: what was done, recorded and edited here (Lab 4, ui-spec §4). */}
      <ActionsTakenRegion
        ticketId={current.id}
        ticketStatus={current.currentStatus}
        ticketCreatedAt={current.createdAt}
        mode="staff"
        currentUser={currentUser}
        onChanged={() => void refreshTicket()}
      />

      {/* 4 — Lab 2 attachments: listed and downloadable, never added or removed here (BR-18). */}
      <AttachmentSection
        attachments={current.attachments}
        rejected={downloadErrors}
        onDownload={(attachment) => void handleDownload(attachment)}
        onDismissRejection={(filename) => setDownloadErrors((existing) => existing.filter((e) => e.filename !== filename))}
      />

      {/* 5 — The two threads, never adjacent composers (ui-spec §7.1, AC-39). */}
      <ConversationThread
        variant="public"
        status={commentsState}
        entries={comments}
        onRetry={() => void loadComments()}
        onPost={async (body) => {
          const comment = await postComment(ticketId, body);
          setComments((existing) => [...existing, comment]);
        }}
      />
      <ConversationThread
        variant="internal"
        status={notesState}
        entries={notes}
        onRetry={() => void loadNotes()}
        onPost={async (body) => {
          const note = await postNote(ticketId, body);
          setNotes((existing) => [...existing, note]);
        }}
      />

      {/* 6 — Status History: the last region, read-only (Lab 4, ui-spec §6.1). */}
      <StatusHistoryRegion ticketId={ticketId} ticketCreatedAt={current.createdAt} refreshToken={historyToken} />
    </>
  );
}

export default StaffTicketDetail;
