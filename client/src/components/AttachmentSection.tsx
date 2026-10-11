import { useRef, useState } from "react";
import {
  Attachment,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_BYTES,
  PERMITTED_EXTENSIONS,
} from "../api.js";
import { AttachmentBadge, Button, ErrorCallout, IconButton, TextArea } from "./index.js";
import { useModal } from "./useModal.js";

// Attachment list and lifecycle (ui-spec.md 11.1 and 11.2).
//
// A removed attachment keeps its row and its metadata but loses every control
// that could reach the bytes (BR-40). The API refuses the download too, so this
// is presentation reinforcing the rule rather than being the rule.

export const REMOVAL_REASON_MIN = 5;
export const REMOVAL_REASON_MAX = 200;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Client-side pre-check. The server re-validates and remains the authority. */
export function checkFileBeforeUpload(file: File): string | null {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();

  if (!PERMITTED_EXTENSIONS.includes(extension)) {
    return `Only ${PERMITTED_EXTENSIONS.join(", ")} files are permitted.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Each file must be 5 MB or smaller.";
  }
  return null;
}

export interface AttachmentSectionProps {
  attachments: Attachment[];
  busyId?: number | null;
  uploading?: boolean;
  /** Rejections shown as their own rows, keyed by filename. */
  rejected?: { filename: string; message: string }[];
  /** Omitted where the role may not add files (IT Staff, BR-18): no Add control is drawn. */
  onUpload?: (file: File) => void;
  onDownload: (attachment: Attachment) => void;
  /**
   * Omitted where the role may not remove files (IT Staff, BR-18): no Remove control is drawn. It resolves when
   * the file is removed, and rejects with a message for the dialog to show, which then stays open (BR-54).
   */
  onRemove?: (attachment: Attachment, reason: string) => Promise<void> | void;
  onDismissRejection?: (filename: string) => void;
}

interface RemovalDialogProps {
  attachment: Attachment;
  onRemove?: AttachmentSectionProps["onRemove"];
  onClose: () => void;
  restoreFocusTo: () => HTMLElement | null;
}

/**
 * Soft removal is irreversible through the UI, so it is confirmed and the reason is required (BR-39).
 * The dialog stays open while the request runs, and after a failure, with the reason the person typed
 * and the message inside it, so a retry is one press (BR-53, BR-54). It is a modal dialog the keyboard
 * can use: see useModal.
 */
function RemovalDialog({ attachment, onRemove, onClose, restoreFocusTo }: RemovalDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  /** True from the moment Remove attachment is pressed until the server has answered (BR-53). */
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useModal(dialog, { onEscape: () => !busy && onClose(), restoreFocusTo });

  async function confirm() {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (trimmed.length < REMOVAL_REASON_MIN || trimmed.length > REMOVAL_REASON_MAX) {
      setReasonError(`The removal reason must be between ${REMOVAL_REASON_MIN} and ${REMOVAL_REASON_MAX} characters.`);
      return;
    }
    setReasonError(undefined);
    setFailure(undefined);
    inFlight.current = true;
    setBusy(true);
    try {
      await onRemove?.(attachment, trimmed);
      onClose();
    } catch (error) {
      // The dialog stays, with the reason.
      setFailure(error instanceof Error ? error.message : "The attachment could not be removed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="tt-dialog" role="dialog" aria-modal="true" aria-label="Remove attachment?" ref={dialog} tabIndex={-1}>
      <div className="tt-card">
        <h3 className="tt-h2">Remove attachment?</h3>
        <p>
          <strong>{attachment.originalFilename}</strong>
        </p>
        <p className="tt-muted">The file will stay on the ticket as a record but can no longer be downloaded.</p>

        <TextArea
          label="Removal reason"
          required
          rows={3}
          value={reason}
          error={reasonError}
          help={`${REMOVAL_REASON_MIN}-${REMOVAL_REASON_MAX} characters.`}
          disabled={busy}
          onChange={(event) => setReason(event.target.value)}
        />

        {failure && <ErrorCallout>{failure}</ErrorCallout>}

        <div className="tt-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            busy={busy}
            busyLabel="Removing…"
            disabled={reason.trim().length < REMOVAL_REASON_MIN}
            onClick={() => void confirm()}
          >
            Remove attachment
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AttachmentSection({
  attachments,
  busyId = null,
  uploading = false,
  rejected = [],
  onUpload,
  onDownload,
  onRemove,
  onDismissRejection,
}: AttachmentSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const activeCount = attachments.filter((a) => a.removedAt === null).length;
  const atLimit = activeCount >= MAX_ACTIVE_ATTACHMENTS;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload?.(file);
    // Reset so choosing the same file twice still fires a change event.
    event.target.value = "";
  }

  return (
    <section className="tt-card" aria-labelledby="attachments-heading">
      <div className="tt-attachments__header">
        <h2 className="tt-h2" id="attachments-heading" tabIndex={-1}>
          Attachments ({activeCount} of {MAX_ACTIVE_ATTACHMENTS} active)
        </h2>

        {onUpload && (
          <>
            <Button
              variant="secondary"
              busy={uploading}
              busyLabel="Uploading…"
              disabled={atLimit}
              title={atLimit ? `Maximum ${MAX_ACTIVE_ATTACHMENTS} active attachments` : undefined}
              onClick={() => fileInput.current?.click()}
            >
              Add attachment
            </Button>

            <input
              ref={fileInput}
              type="file"
              className="tt-visually-hidden"
              aria-label="Choose a file to attach"
              accept={PERMITTED_EXTENSIONS.join(",")}
              disabled={uploading}
              onChange={handleFile}
            />
          </>
        )}
      </div>

      {onUpload && (
        <p className="tt-muted">
          {PERMITTED_EXTENSIONS.join(", ")} · max 5 MB each · up to {MAX_ACTIVE_ATTACHMENTS} active
        </p>
      )}

      {rejected.map((rejection) => (
        <p
          className="tt-attachment tt-attachment--invalid"
          role="alert"
          key={rejection.filename}
          data-state="rejected"
        >
          <span>
            <strong>{rejection.filename}</strong> — {rejection.message}
          </span>
          {onDismissRejection && (
            <Button variant="tertiary" onClick={() => onDismissRejection(rejection.filename)}>
              Dismiss
            </Button>
          )}
        </p>
      ))}

      {attachments.length === 0 && rejected.length === 0 && (
        <p className="tt-muted" data-state="empty">
          No attachments on this ticket yet.
        </p>
      )}

      <ul className="tt-attachments">
        {attachments.map((attachment) => {
          const removed = attachment.removedAt !== null;
          return (
            <li
              key={attachment.id}
              className={`tt-attachment${removed ? " tt-attachment--removed" : ""}`}
              data-state={removed ? "removed" : "active"}
              data-testid={`attachment-${attachment.id}`}
            >
              <span className="tt-attachment__name">{attachment.originalFilename}</span>
              <span className="tt-muted">
                {formatSize(attachment.sizeBytes)} ·{" "}
                {new Date(attachment.uploadedAt).toLocaleDateString()}
              </span>
              <AttachmentBadge removed={removed} />

              {removed ? (
                // No download and no remove control on a removed row.
                <span className="tt-muted tt-attachment__reason">
                  Removed {new Date(attachment.removedAt as string).toLocaleDateString()} —{" "}
                  {attachment.removalReason}
                </span>
              ) : (
                <span className="tt-attachment__actions">
                  <IconButton
                    label={`Download ${attachment.originalFilename}`}
                    icon="↓"
                    onClick={() => onDownload(attachment)}
                  />
                  {onRemove && (
                    <Button
                      variant="destructive"
                      busy={busyId === attachment.id}
                      busyLabel="Removing…"
                      onClick={() => setRemoving(attachment)}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {removing && (
        <RemovalDialog
          attachment={removing}
          onRemove={onRemove}
          onClose={() => setRemoving(null)}
          restoreFocusTo={() => document.getElementById("attachments-heading")}
        />
      )}
    </section>
  );
}

export default AttachmentSection;
