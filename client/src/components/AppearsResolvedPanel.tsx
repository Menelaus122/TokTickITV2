import { FormEvent, useState } from "react";
import { APPEARS_RESOLVED_MIN, ApiError, COMMENT_MAX } from "../api.js";
import { Button } from "./Button.js";
import { TextArea } from "./Inputs.js";

// Lab 3, Issue 7 — "Problem Appears Resolved" (ui-spec §5.1; BR-05, BR-29,
// BR-30).
//
// The Requester's opinion, never a status: there is no status control here,
// and the helper text says who does resolve. Unset, it is a bordered panel with
// a required comment; set, a success callout with the date and an Undo.

export const ONLY_STAFF_RESOLVE = "Only IT Staff can resolve or close a ticket.";

export interface AppearsResolvedPanelProps {
  resolvedAt: string | null;
  onMark: (comment: string) => Promise<void>;
  onUndo: () => Promise<void>;
}

function failureMessage(failure: unknown, field: string) {
  if (failure instanceof ApiError) return failure.fields[field] ?? failure.message;
  return "That could not be saved. Please try again.";
}

export function AppearsResolvedPanel({ resolvedAt, onMark, onUndo }: AppearsResolvedPanelProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function mark(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const body = comment.trim();
    if (body.length === 0) return setError("Comment is required.");
    if (body.length < APPEARS_RESOLVED_MIN || body.length > COMMENT_MAX) {
      return setError(`Comment must be between ${APPEARS_RESOLVED_MIN} and ${COMMENT_MAX} characters.`);
    }
    setError(undefined);
    setBusy(true);
    try {
      await onMark(body);
      setComment("");
    } catch (failure) {
      setError(failureMessage(failure, "comment"));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy) return;
    setError(undefined);
    setBusy(true);
    try {
      await onUndo();
    } catch (failure) {
      setError(failureMessage(failure, "appearsResolved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tt-card tt-resolved" aria-label="Problem Appears Resolved" data-testid="appears-resolved">
      {resolvedAt ? (
        <div className="tt-callout tt-callout--success" role="status" data-state="appears-resolved">
          <span aria-hidden="true">✓</span>
          <div>
            You marked this as appearing resolved on{" "}
            {new Date(resolvedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.
            <div>
              <Button variant="tertiary" onClick={() => void undo()} busy={busy} busyLabel="Undoing…">
                Undo
              </Button>
            </div>
            {error && (
              <p className="tt-field__error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={mark} noValidate>
          <h2 className="tt-h2">Does this look resolved to you?</h2>
          <TextArea
            label="Comment"
            required
            rows={3}
            value={comment}
            error={error}
            help="Tell IT Staff what you saw. It is posted as a Public Comment."
            onChange={(event) => setComment(event.target.value)}
          />
          <Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">
            Mark as appears resolved
          </Button>
        </form>
      )}
      <p className="tt-resolved__helper">{ONLY_STAFF_RESOLVE}</p>
    </section>
  );
}

export default AppearsResolvedPanel;
