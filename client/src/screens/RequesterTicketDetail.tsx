import { useCallback, useEffect, useState } from "react";
import {
  Attachment,
  AttachmentError,
  ThreadEntry,
  TicketDetail,
  downloadAttachment,
  fetchComments,
  fetchTicketDetail,
  postComment,
  setAppearsResolved,
  removeAttachment,
  uploadAttachment,
} from "../api.js";
import {
  AttachmentSection,
  checkFileBeforeUpload,
} from "../components/AttachmentSection.js";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PriorityBadge,
  StatusBadge,
} from "../components/index.js";
import { ConversationThread } from "../components/ConversationThread.js";
import { AppearsResolvedPanel } from "../components/AppearsResolvedPanel.js";

// Requester Ticket Detail (ui-spec.md 11).
//
// Every ticket field is read-only — rendered as plain text, not as disabled
// inputs, so there is no control to enable by accident (FR-25). The actions on
// this screen belong to attachments and, since Lab 3 Issue 7, to the Public
// Comments thread and the "Problem Appears Resolved" panel (FR-19). There is
// no Internal Notes region and nothing that hints at one (AC-17).

export interface RequesterTicketDetailProps {
  ticketId: number;
  onBack?: () => void;
  /** Injected in tests; defaults to opening the download URL. */
  onDownload?: (attachment: Attachment) => void;
}

export function RequesterTicketDetail({
  ticketId,
  onBack,
  onDownload,
}: RequesterTicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [rejected, setRejected] = useState<{ filename: string; message: string }[]>([]);
  const [comments, setComments] = useState<ThreadEntry[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setTicket(await fetchTicketDetail(ticketId));
      setStatus("ready");
    } catch (error) {
      setTicket(null);
      // A ticket owned by someone else is indistinguishable from one that does
      // not exist, by design (BR-16).
      setStatus(error instanceof AttachmentError && error.code === "NOT_FOUND" ? "not-found" : "error");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Loaded on its own, so a thread that fails to load leaves the ticket and
  // its attachments usable, with a retry on the thread alone.
  const loadComments = useCallback(async () => {
    setCommentsStatus("loading");
    try {
      setComments(await fetchComments(ticketId));
      setCommentsStatus("ready");
    } catch {
      setComments([]);
      setCommentsStatus("error");
    }
  }, [ticketId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handlePostComment(body: string) {
    const comment = await postComment(ticketId, body);
    setComments((current) => [...current, comment]);
  }

  async function handleMarkResolved(comment: string) {
    const result = await setAppearsResolved(ticketId, { appearsResolved: true, comment });
    setTicket((current) => (current ? { ...current, requesterResolvedAt: result.ticket.requesterResolvedAt } : current));
    // The accompanying Public Comment joins the thread straight away.
    if (result.comment) setComments((current) => [...current, result.comment!]);
  }

  async function handleUndoResolved() {
    const result = await setAppearsResolved(ticketId, { appearsResolved: false });
    setTicket((current) => (current ? { ...current, requesterResolvedAt: result.ticket.requesterResolvedAt } : current));
  }

  function reject(filename: string, message: string) {
    setRejected((current) => [...current.filter((r) => r.filename !== filename), { filename, message }]);
  }

  async function handleUpload(file: File) {
    if (!ticket) return;

    // Fast local feedback; the server re-validates and stays the authority.
    const localProblem = checkFileBeforeUpload(file);
    if (localProblem) {
      reject(file.name, localProblem);
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAttachment(ticket.id, file);
      setTicket({ ...ticket, attachments: [...ticket.attachments, attachment] });
      setRejected((current) => current.filter((r) => r.filename !== file.name));
    } catch (error) {
      // A failed upload is reported on its own row and leaves the rest of the
      // screen untouched (FR-31).
      reject(
        file.name,
        error instanceof AttachmentError ? error.message : "The file could not be attached.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(attachment: Attachment, reason: string) {
    if (!ticket) return;

    setRemovingId(attachment.id);
    try {
      const updated = await removeAttachment(attachment.id, reason);
      setTicket({
        ...ticket,
        attachments: ticket.attachments.map((a) => (a.id === updated.id ? updated : a)),
      });
    } catch (error) {
      reject(
        attachment.originalFilename,
        error instanceof AttachmentError ? error.message : "The attachment could not be removed.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDownload(attachment: Attachment) {
    if (onDownload) return onDownload(attachment);

    try {
      await downloadAttachment(attachment);
    } catch (error) {
      // Reported on the failing row only; the rest of the screen is untouched.
      reject(
        attachment.originalFilename,
        error instanceof AttachmentError ? error.message : "The file could not be downloaded.",
      );
    }
  }

  if (status === "loading") return <LoadingState rows={6} label="Loading the ticket…" />;

  if (status === "not-found") {
    return (
      <EmptyState
        title="Ticket not found."
        body="It may not exist, or it belongs to a different Requester."
        action={onBack && <Button variant="secondary" onClick={onBack}>Back to My Tickets</Button>}
      />
    );
  }

  if (status === "error" || !ticket) {
    return (
      <ErrorState
        message="Cannot load this ticket. Make sure the TokTickIT API is running, then try again."
        onRetry={load}
      />
    );
  }

  return (
    <>
      {onBack && (
        <Button variant="tertiary" onClick={onBack}>
          ‹ Back to My Tickets
        </Button>
      )}

      <Card>
        <div className="tt-detail__header">
          <h1 className="tt-h1" data-testid="detail-ticket-number">
            {ticket.ticketNumber}
          </h1>
          <StatusBadge value={ticket.currentStatus} />
          <PriorityBadge value={ticket.requestedPriority} />
        </div>

        {/* Read-only as plain text: there is no input on this screen to
            accidentally enable. */}
        <dl className="tt-detail">
          <dt>Ticket Date</dt>
          <dd>{new Date(ticket.ticketDate).toLocaleString()}</dd>

          <dt>Requester</dt>
          <dd>{ticket.requester.fullName}</dd>

          <dt>Category</dt>
          <dd>{ticket.category.name}</dd>

          <dt>Related System</dt>
          <dd>{ticket.relatedSystem.name}</dd>

          <dt>Requested Priority</dt>
          <dd>
            <PriorityBadge value={ticket.requestedPriority} />
          </dd>

          <dt>Current Status</dt>
          <dd>
            <StatusBadge value={ticket.currentStatus} />
          </dd>

          <dt>Summary</dt>
          <dd data-testid="detail-summary">{ticket.summary}</dd>

          <dt>Description</dt>
          <dd className="tt-detail__description">{ticket.description}</dd>
        </dl>
      </Card>

      <AttachmentSection
        attachments={ticket.attachments}
        uploading={uploading}
        busyId={removingId}
        rejected={rejected}
        onUpload={handleUpload}
        onDownload={(attachment) => void handleDownload(attachment)}
        onRemove={handleRemove}
        onDismissRejection={(filename) =>
          setRejected((current) => current.filter((r) => r.filename !== filename))
        }
      />

      <AppearsResolvedPanel
        resolvedAt={ticket.requesterResolvedAt}
        onMark={handleMarkResolved}
        onUndo={handleUndoResolved}
      />

      <ConversationThread
        variant="public"
        status={commentsStatus}
        entries={comments}
        onRetry={() => void loadComments()}
        onPost={handlePostComment}
      />
    </>
  );
}

export default RequesterTicketDetail;
