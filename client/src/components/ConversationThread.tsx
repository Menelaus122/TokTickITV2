import { FormEvent, useState } from "react";
import { ApiError, COMMENT_MAX, type ThreadEntry } from "../api.js";
import { RoleBadge } from "./Badge.js";
import { Button } from "./Button.js";
import { TextArea } from "./Inputs.js";
import { ErrorState, LoadingState } from "./States.js";

// Lab 3, Issue 7 — one conversation thread (ui-spec §5.2, §7.1, §1.4).
//
// The same component draws both threads so they behave alike, and the variant
// makes them look and read unlike each other, so a note can never be mistaken
// for a reply (FR-31, AC-39):
//
//   public    a plain card, "Public Comments", button "Post comment"
//   internal  the §1.4 internal region: read-only background, dashed edge, a
//             lock and the caption "Internal — not visible to the Requester",
//             which is also the region's accessible name; button "Post
//             internal note"
//
// The Requester screen only ever renders the public variant (AC-17). Bodies
// are rendered as text, never as HTML (BR-43).

export type ThreadVariant = "public" | "internal";

const COPY: Record<ThreadVariant, { title: string; label: string; post: string; empty: string; noun: string }> = {
  public: { title: "Public Comments", label: "Add a comment", post: "Post comment", empty: "No comments yet.", noun: "Comment" },
  internal: { title: "Internal Notes", label: "Add an internal note", post: "Post internal note", empty: "No internal notes yet.", noun: "Note" },
};

export const INTERNAL_CAPTION = "Internal — not visible to the Requester";

export interface ConversationThreadProps {
  variant: ThreadVariant;
  status: "loading" | "ready" | "error";
  entries: ThreadEntry[];
  onRetry: () => void;
  /** Posts a trimmed body; rejects with ApiError to show the server's reason. */
  onPost: (body: string) => Promise<void>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ConversationThread({ variant, status, entries, onRetry, onPost }: ConversationThreadProps) {
  const copy = COPY[variant];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [posting, setPosting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (posting) return;
    // Fast local feedback with the server's own limits; the server re-checks.
    const body = draft.trim();
    if (body.length === 0) return setError(`${copy.noun} is required.`);
    if (body.length > COMMENT_MAX) return setError(`${copy.noun} must be at most ${COMMENT_MAX} characters.`);

    setError(undefined);
    setPosting(true);
    try {
      await onPost(body);
      setDraft("");
    } catch (failure) {
      // The draft is kept so nothing typed is lost to a failed request.
      setError(
        failure instanceof ApiError
          ? failure.fields.body ?? failure.message
          : `The ${copy.noun.toLowerCase()} could not be posted. Please try again.`,
      );
    } finally {
      setPosting(false);
    }
  }

  const internal = variant === "internal";
  return (
    <section
      className={`tt-card tt-thread tt-thread--${variant}`}
      aria-label={internal ? `${copy.title} — ${INTERNAL_CAPTION}` : copy.title}
      data-thread={variant}
    >
      <h2 className="tt-h2">{copy.title}</h2>
      {internal && (
        <p className="tt-thread__caption">
          <span aria-hidden="true">🔒</span> {INTERNAL_CAPTION}
        </p>
      )}

      {status === "loading" && <LoadingState rows={2} label={`Loading ${copy.title.toLowerCase()}…`} />}
      {status === "error" && (
        <ErrorState message={`Cannot load the ${copy.title.toLowerCase()} right now.`} onRetry={onRetry} />
      )}
      {status === "ready" &&
        (entries.length === 0 ? (
          <p className="tt-thread__empty">{copy.empty}</p>
        ) : (
          <ol className="tt-thread__list">
            {entries.map((entry) => (
              <li key={entry.id} className="tt-thread__entry">
                <div className="tt-thread__meta">
                  <strong>{entry.author.fullName}</strong>
                  <RoleBadge value={entry.author.role} />
                  <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                </div>
                <p className="tt-thread__body">{entry.body}</p>
              </li>
            ))}
          </ol>
        ))}

      {status === "ready" && (
        <form className="tt-thread__composer" onSubmit={submit} noValidate>
          <TextArea
            label={copy.label}
            required
            rows={3}
            value={draft}
            error={error}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="primary" busy={posting} busyLabel="Posting…">
            {copy.post}
          </Button>
        </form>
      )}
    </section>
  );
}

export default ConversationThread;
