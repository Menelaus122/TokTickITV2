import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ApiError,
  createActionTaken,
  editActionTaken,
  fetchActionsTaken,
  type ActionTaken,
  type ActionTakenInput,
  type Role,
} from "../api.js";
import { ActionTakenForm, type ActionFormValues } from "./ActionTakenForm.js";
import { FollowUpPill, RoleBadge, STATUS_LABEL, type TicketStatus } from "./Badge.js";
import { Button } from "./Button.js";
import { EmptyState, ErrorState, LoadingState, SuccessCallout } from "./States.js";

// Lab 4, Issue 5 — the Actions Taken region of a Ticket Detail screen
// (ui-spec §1.2, §1.3, §4, §6; specification.md FR-01 to FR-08).
//
// One component serves both screens, so an entry reads the same to IT Staff and
// to the Requester. In "requester" mode it has no control of any kind and no hint
// of one (FR-04). The server is still the authority on every rule: nothing here
// is the boundary, and anything the screen prevents the API refuses again.

export interface ActionsTakenRegionProps {
  ticketId: number;
  ticketStatus: TicketStatus;
  /** The Ticket's creation time: an action cannot be dated before it (BR-06). */
  ticketCreatedAt: string;
  /** "staff" may add and edit; "requester" is read-only (FR-04). */
  mode: "staff" | "requester";
  /** The signed-in user, shown as Performed by while recording (BR-05). */
  currentUser?: { fullName: string; role: Role };
  /**
   * Called once an action has been recorded or edited. The resolution gate reads the actions
   * (BR-17), so the screen's status control has to ask the server what the ticket can do now.
   */
  onChanged?: () => void;
}

type LoadState = "loading" | "ready" | "error" | "forbidden";

/** Where focus goes after a save: the card's heading, or its Edit button. */
type FocusTarget = { id: number; on: "title" | "edit" };

/** Statuses on which no action may be recorded or edited (BR-10, D-14). */
const INACTIVE: readonly TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A date as a datetime-local input holds it: local time, to the minute. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * What a new form starts with: now, to the minute, as long as the ticket already
 * existed then. The input holds minutes only, so "now" is truncated, and on a ticket
 * created seconds ago that truncated minute is before the ticket (BR-06): the form
 * would refuse its own default. There the default is the next whole minute after the
 * ticket's creation, at most 59 seconds ahead, well inside the five minutes the
 * server allows.
 */
function defaultActionTime(now: Date, ticketCreatedAt: Date): Date {
  const thisMinute = new Date(now);
  thisMinute.setSeconds(0, 0);
  if (thisMinute.getTime() >= ticketCreatedAt.getTime()) return thisMinute;
  const nextMinute = new Date(ticketCreatedAt);
  if (nextMinute.getSeconds() !== 0 || nextMinute.getMilliseconds() !== 0) {
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  }
  return nextMinute;
}

/** BR-08 — the order for reading: oldest Action Date/Time first, ties by id. */
function readingOrder(a: ActionTaken, b: ActionTaken): number {
  return new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime() || a.id - b.id;
}

/** BR-17 — the most recently recorded: the highest createdAt, then the highest id. It is the one the gate reads. */
function latestRecordedId(actions: ActionTaken[]): number | null {
  let latest: ActionTaken | null = null;
  for (const entry of actions) {
    const later =
      latest === null ||
      new Date(entry.createdAt).getTime() > new Date(latest.createdAt).getTime() ||
      (new Date(entry.createdAt).getTime() === new Date(latest.createdAt).getTime() && entry.id > latest.id);
    if (later) latest = entry;
  }
  return latest?.id ?? null;
}

/** BR-28 — one key per submission, 8 to 64 of letters, digits, hyphen, and underscore. */
function newRequestKey(): string {
  const source = globalThis.crypto;
  if (source?.randomUUID) return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The form's values for an existing entry. */
function valuesOf(entry: ActionTaken): ActionFormValues {
  return {
    actionAt: toLocalInput(new Date(entry.actionAt)),
    description: entry.description,
    result: entry.result,
    followUpRequired: entry.followUpRequired,
    followUpNote: entry.followUpNote ?? "",
    attachmentNotes: entry.attachmentNotes ?? "",
  };
}

/** What a new action sends: trimmed text, an instant with its zone, and a note only when it applies (D-18). */
function toInput(values: ActionFormValues): ActionTakenInput {
  const input: ActionTakenInput = {
    actionAt: new Date(values.actionAt).toISOString(),
    description: values.description.trim(),
    result: values.result.trim(),
    followUpRequired: values.followUpRequired,
  };
  if (values.followUpRequired) input.followUpNote = values.followUpNote.trim();
  const notes = values.attachmentNotes.trim();
  if (notes) input.attachmentNotes = notes;
  return input;
}

/**
 * What an edit sends. Attachment Notes is always sent, empty when cleared, so
 * that clearing it clears it. The stored time goes back exactly as it came when
 * the person did not change it: the input holds minutes only, and rounding the
 * stored seconds away would be an edit nobody made.
 */
function toEditInput(values: ActionFormValues, entry: ActionTaken): ActionTakenInput {
  const untouched = values.actionAt === toLocalInput(new Date(entry.actionAt));
  const input: ActionTakenInput = {
    actionAt: untouched ? entry.actionAt : new Date(values.actionAt).toISOString(),
    description: values.description.trim(),
    result: values.result.trim(),
    followUpRequired: values.followUpRequired,
    attachmentNotes: values.attachmentNotes.trim(),
  };
  if (values.followUpRequired) input.followUpNote = values.followUpNote.trim();
  return input;
}

export function ActionsTakenRegion({ ticketId, ticketStatus, ticketCreatedAt, mode, currentUser, onChanged }: ActionsTakenRegionProps) {
  const headingId = useId();
  const helpId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [actions, setActions] = useState<ActionTaken[]>([]);
  /** The create form, when open, with the key its submission carries (BR-28). */
  const [creating, setCreating] = useState<{ key: string } | null>(null);
  /** The entry being edited. `round` changes to start the form over with fresh values. */
  const [editing, setEditing] = useState<{ id: number; round: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  /** A save is in flight: every other control in the region waits (BR-53). */
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setActions((await fetchActionsTaken(ticketId)).slice().sort(readingOrder));
      setState("ready");
    } catch (error) {
      setActions([]);
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  // After a save or a cancel, focus follows the card (ui-spec §4.2, §4.3).
  // It waits until the region is idle: the Edit button is disabled while a save is in flight, and a disabled button cannot take focus.
  useEffect(() => {
    if (focus === null || creating !== null || editing !== null || saving) return;
    const card = sectionRef.current?.querySelector(`[data-action-id="${focus.id}"]`);
    card?.querySelector<HTMLElement>(focus.on === "title" ? ".tt-action__title" : '[data-control="edit"]')?.focus();
    setFocus(null);
  }, [focus, actions, creating, editing, saving]);

  async function saveNew(values: ActionFormValues) {
    const entry = await createActionTaken(ticketId, toInput(values), creating!.key);
    setActions((current) => [...current.filter((existing) => existing.id !== entry.id), entry].sort(readingOrder));
    setCreating(null);
    setMessage("Action recorded.");
    setFocus({ id: entry.id, on: "title" });
    onChanged?.();
  }

  async function saveEdit(entry: ActionTaken, values: ActionFormValues) {
    const updated = await editActionTaken(ticketId, entry.id, entry.version, toEditInput(values, entry));
    const next = actions.map((existing) => (existing.id === updated.id ? updated : existing)).sort(readingOrder);
    // A change of date can move the card, and a move must never be silent (ui-spec §4.1).
    const moved = next.findIndex((e) => e.id === entry.id) !== actions.findIndex((e) => e.id === entry.id);
    setActions(next);
    setEditing(null);
    setMessage(moved ? "Changes saved. Moved to its new position by date." : "Changes saved.");
    setFocus({ id: entry.id, on: moved ? "title" : "edit" });
    onChanged?.();
  }

  /** The person chose to drop their edits for the record as it is now. */
  function showLatest(latest: ActionTaken) {
    setActions((current) => current.map((existing) => (existing.id === latest.id ? latest : existing)).sort(readingOrder));
    setEditing((current) => (current ? { id: current.id, round: current.round + 1 } : current));
  }

  const staff = mode === "staff";
  const active = !INACTIVE.includes(ticketStatus);
  const idle = creating === null && editing === null && !saving;
  // A control that is off because the ticket is closed to actions is tied to the sentence that says why.
  const why = active ? undefined : helpId;
  const latestId = latestRecordedId(actions);
  const addButton = (
    <Button
      variant="primary"
      aria-describedby={why}
      disabled={!active || !idle}
      onClick={() => {
        setMessage(null);
        setCreating({ key: newRequestKey() });
      }}
    >
      + Add action
    </Button>
  );

  return (
    <section className="tt-card tt-actions-taken" aria-labelledby={headingId} data-region="actions-taken" ref={sectionRef}>
      <div className="tt-actions-taken__head">
        {/* Focusable by script, so "Go to Actions Taken" in the status control can land here (ui-spec §9). */}
        <h2 className="tt-h2" id={headingId} tabIndex={-1}>
          Actions Taken{state === "ready" ? ` (${actions.length})` : ""}
        </h2>
        {staff && state === "ready" && actions.length > 0 && addButton}
      </div>

      {message && <SuccessCallout>{message}</SuccessCallout>}

      {state === "loading" && <LoadingState rows={2} label="Loading actions taken…" />}
      {state === "error" && <ErrorState message="Cannot load the actions taken right now." onRetry={() => void load()} />}
      {state === "forbidden" && <ErrorState message="You do not have access to record actions." />}

      {staff && creating && (
        <ActionTakenForm
          mode="create"
          initial={{
            actionAt: toLocalInput(defaultActionTime(new Date(), new Date(ticketCreatedAt))),
            description: "",
            result: "",
            followUpRequired: false,
            followUpNote: "",
            attachmentNotes: "",
          }}
          performer={currentUser ?? { fullName: "You" }}
          ticketCreatedAt={ticketCreatedAt}
          onSave={saveNew}
          onCancel={() => setCreating(null)}
          onBusyChange={setSaving}
        />
      )}

      {state === "ready" &&
        (actions.length === 0 ? (
          // "No actions recorded yet" beside the form that is recording one would contradict it.
          staff && creating ? null : staff ? (
            <EmptyState
              title="No actions recorded yet."
              body="Record what you do on this ticket so the Requester can see it."
              action={addButton}
            />
          ) : (
            <EmptyState title="IT Staff have not recorded any actions yet." />
          )
        ) : (
          <ul className="tt-actions-taken__list">
            {actions.map((entry) => {
              const footer = (
                <p className="tt-action__footer">
                  Recorded <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                  {entry.updatedBy && (
                    <>
                      {" · "}Edited by {entry.updatedBy.fullName}, <time dateTime={entry.updatedAt}>{formatTime(entry.updatedAt)}</time>
                    </>
                  )}
                </p>
              );

              // Edit replaces the card in place, so it stays where it was in the list (ui-spec §4.3).
              if (staff && editing?.id === entry.id) {
                return (
                  <li key={entry.id} className="tt-action tt-action--editing" data-action-id={entry.id}>
                    <ActionTakenForm
                      key={`${entry.id}-${editing.round}`}
                      mode="edit"
                      initial={valuesOf(entry)}
                      performer={{ fullName: entry.performedBy.fullName, role: entry.performedBy.role }}
                      ticketCreatedAt={ticketCreatedAt}
                      onSave={(values) => saveEdit(entry, values)}
                      onCancel={() => {
                        setEditing(null);
                        setFocus({ id: entry.id, on: "edit" });
                      }}
                      onBusyChange={setSaving}
                      onShowLatest={showLatest}
                    />
                    {footer}
                  </li>
                );
              }

              return (
                <li key={entry.id} className="tt-action" data-action-id={entry.id}>
                  <div className="tt-action__head">
                    <h3 className="tt-action__title" tabIndex={-1}>
                      <time dateTime={entry.actionAt}>{formatTime(entry.actionAt)}</time>
                    </h3>
                    <span className="tt-action__by">
                      {entry.performedBy.fullName} <RoleBadge value={entry.performedBy.role} />
                    </span>
                    {entry.id === latestId && <span className="tt-action__latest">Latest recorded</span>}
                    {staff && (
                      <Button
                        variant="secondary"
                        data-control="edit"
                        aria-label={`Edit action of ${formatTime(entry.actionAt)}`}
                        aria-describedby={why}
                        disabled={!active || !idle}
                        onClick={() => {
                          setMessage(null);
                          setEditing({ id: entry.id, round: 0 });
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                  <dl className="tt-action__fields">
                    <dt>Action Description</dt>
                    <dd>{entry.description}</dd>
                    <dt>Result</dt>
                    <dd>{entry.result}</dd>
                    <dt>Follow-Up Required?</dt>
                    <dd>
                      <FollowUpPill required={entry.followUpRequired} />
                    </dd>
                    {entry.followUpNote && (
                      <>
                        <dt>Follow-up Note</dt>
                        <dd>{entry.followUpNote}</dd>
                      </>
                    )}
                    {entry.attachmentNotes && (
                      <>
                        <dt>Attachment Notes</dt>
                        <dd>{entry.attachmentNotes}</dd>
                      </>
                    )}
                  </dl>
                  {footer}
                </li>
              );
            })}
          </ul>
        ))}

      {staff && !active && state === "ready" && (
        <p className="tt-field__help" id={helpId} data-state="not-active">
          This ticket is {STATUS_LABEL[ticketStatus]}, so no more actions can be recorded.
          {ticketStatus === "CANCELLED" ? "" : " Reopen it first."}
        </p>
      )}
    </section>
  );
}

export default ActionsTakenRegion;
