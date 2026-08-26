import { useRef, useState } from "react";
import {
  Attachment,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_BYTES,
  PERMITTED_EXTENSIONS,
} from "../api.js";
import { AttachmentBadge, Button, IconButton, TextArea } from "./index.js";

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
  onUpload: (file: File) => void;
  onDownload: (attachment: Attachment) => void;
  onRemove: (attachment: Attachment, reason: string) => void;
  onDismissRejection?: (filename: string) => void;
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
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();

  const activeCount = attachments.filter((a) => a.removedAt === null).length;
  const atLimit = activeCount >= MAX_ACTIVE_ATTACHMENTS;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    // Reset so choosing the same file twice still fires a change event.
    event.target.value = "";
  }

  function confirmRemoval() {
    const trimmed = reason.trim();
    if (trimmed.length < REMOVAL_REASON_MIN || trimmed.length > REMOVAL_REASON_MAX) {
      setReasonError(
        `The removal reason must be between ${REMOVAL_REASON_MIN} and ${REMOVAL_REASON_MAX} characters.`,
      );
      return;
    }
    if (removing) onRemove(removing, trimmed);
    closeDialog();
  }

  function closeDialog() {
    setRemoving(null);
    setReason("");
    setReasonError(undefined);
  }

  return (
    <section className="tt-card" aria-labelledby="attachments-heading">
      <div className="tt-attachments__header">
        <h2 className="tt-h2" id="attachments-heading">
          Attachments ({activeCount} of {MAX_ACTIVE_ATTACHMENTS} active)
        </h2>

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
          onChange={handleFile}
        />
      </div>

      <p className="tt-muted">
        {PERMITTED_EXTENSIONS.join(", ")} · max 5 MB each · up to {MAX_ACTIVE_ATTACHMENTS} active
      </p>

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
                  <Button
                    variant="destructive"
                    busy={busyId === attachment.id}
                    onClick={() => setRemoving(attachment)}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {removing && (
        // Soft removal is irreversible through the UI, so it is confirmed and
        // the reason is required (BR-39).
        <div className="tt-dialog" role="dialog" aria-modal="true" aria-label="Remove attachment?">
          <div className="tt-card">
            <h3 className="tt-h2">Remove attachment?</h3>
            <p>
              <strong>{removing.originalFilename}</strong>
            </p>
            <p className="tt-muted">
              The file will stay on the ticket as a record but can no longer be downloaded.
            </p>

            <TextArea
              label="Removal reason"
              required
              rows={3}
              value={reason}
              error={reasonError}
              help={`${REMOVAL_REASON_MIN}-${REMOVAL_REASON_MAX} characters.`}
              onChange={(event) => setReason(event.target.value)}
            />

            <div className="tt-actions">
              <Button variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length < REMOVAL_REASON_MIN}
                onClick={confirmRemoval}
              >
                Remove attachment
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AttachmentSection;
