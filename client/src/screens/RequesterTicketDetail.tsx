import { useCallback, useEffect, useState } from "react";
import {
  Attachment,
  AttachmentError,
  TicketDetail,
  fetchTicketDetail,
  removeAttachment,
  uploadAttachment,
} from "../api.js";
import { useRequester } from "../context/RequesterContext.js";
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

// Requester Ticket Detail (ui-spec.md 11).
//
// Every ticket field is read-only — rendered as plain text, not as disabled
// inputs, so there is no control to enable by accident (FR-25). The only
// actions on this screen belong to attachments.

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
  const { requester } = useRequester();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [rejected, setRejected] = useState<{ filename: string; message: string }[]>([]);

  const load = useCallback(async () => {
    if (!requester) return;
    setStatus("loading");
    try {
      setTicket(await fetchTicketDetail(requester.id, ticketId));
      setStatus("ready");
    } catch (error) {
      setTicket(null);
      // A ticket owned by someone else is indistinguishable from one that does
      // not exist, by design (BR-16).
      setStatus(error instanceof AttachmentError && error.code === "NOT_FOUND" ? "not-found" : "error");
    }
  }, [requester, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  function reject(filename: string, message: string) {
    setRejected((current) => [...current.filter((r) => r.filename !== filename), { filename, message }]);
  }

  async function handleUpload(file: File) {
    if (!requester || !ticket) return;

    // Fast local feedback; the server re-validates and stays the authority.
    const localProblem = checkFileBeforeUpload(file);
    if (localProblem) {
      reject(file.name, localProblem);
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAttachment(requester.id, ticket.id, file);
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
    if (!requester || !ticket) return;

    setRemovingId(attachment.id);
    try {
      const updated = await removeAttachment(requester.id, attachment.id, reason);
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

  function handleDownload(attachment: Attachment) {
    if (onDownload) return onDownload(attachment);
    if (attachment.downloadUrl) window.open(attachment.downloadUrl, "_blank", "noopener");
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
        onDownload={handleDownload}
        onRemove={handleRemove}
        onDismissRejection={(filename) =>
          setRejected((current) => current.filter((r) => r.filename !== filename))
        }
      />
    </>
  );
}

export default RequesterTicketDetail;
