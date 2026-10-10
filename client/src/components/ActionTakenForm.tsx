import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { ACTION_LIMITS, ApiError, type ActionTaken, type Role } from "../api.js";
import { RoleBadge } from "./Badge.js";
import { Button } from "./Button.js";
import { ReadOnlyField, TextArea, TextInput } from "./Inputs.js";
import { ErrorCallout, WarningCallout } from "./States.js";

// Lab 4, Issue 5 — the form for recording and for editing one Action Taken
// (ui-spec §4.2, §4.3). Both modes are the same form, so a field cannot behave
// differently in one of them.
//
// The rules below are the server's, repeated for fast feedback. The server is
// still the authority and answers every one of them again (FR-05).

export interface ActionFormValues {
  /** Local date and time as a datetime-local input holds it: "2026-10-05T10:30". */
  actionAt: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

type FieldName = "actionAt" | "description" | "result" | "followUpNote" | "attachmentNotes";
type FieldErrors = Partial<Record<FieldName, string>>;
const FIELD_NAMES: readonly FieldName[] = ["actionAt", "description", "result", "followUpNote", "attachmentNotes"];

/** BR-06 — the server allows this much for a slow clock, so the screen refuses no more than it does. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const SAVE_FAILED = "The action could not be saved. Check your connection and try again. Everything you typed is still in the form.";
const FORBIDDEN = "You do not have access to record actions.";
const STALE = "Someone else edited this action while you were working on it. Your changes are still in the form.";

function lengthMessage(label: string, min: number, max: number) {
  return `${label} must be between ${min} and ${max} characters.`;
}

function checkText(label: string, text: string, min: number, max: number): string | undefined {
  const length = text.trim().length;
  if (length === 0) return `${label} is required.`;
  return length < min || length > max ? lengthMessage(label, min, max) : undefined;
}

function validate(values: ActionFormValues, ticketCreatedAt: string, now = Date.now()): FieldErrors {
  const errors: FieldErrors = {};

  const at = values.actionAt === "" ? NaN : new Date(values.actionAt).getTime();
  if (Number.isNaN(at)) errors.actionAt = "Action Date/Time is required.";
  else if (at > now + FUTURE_TOLERANCE_MS) errors.actionAt = "Action Date/Time cannot be in the future.";
  else if (at < new Date(ticketCreatedAt).getTime()) errors.actionAt = "Action Date/Time cannot be before the ticket was created.";

  const description = checkText("Action Description", values.description, ACTION_LIMITS.descriptionMin, ACTION_LIMITS.descriptionMax);
  if (description) errors.description = description;
  const result = checkText("Result", values.result, ACTION_LIMITS.resultMin, ACTION_LIMITS.resultMax);
  if (result) errors.result = result;

  if (values.followUpRequired) {
    const note = values.followUpNote.trim().length === 0
      ? "Follow-up Note is required when follow-up is needed."
      : checkText("Follow-up Note", values.followUpNote, ACTION_LIMITS.followUpNoteMin, ACTION_LIMITS.followUpNoteMax);
    if (note) errors.followUpNote = note;
  }

  if (values.attachmentNotes.trim().length > ACTION_LIMITS.attachmentNotesMax) {
    errors.attachmentNotes = `Attachment Notes must be at most ${ACTION_LIMITS.attachmentNotesMax} characters.`;
  }
  return errors;
}

export interface ActionTakenFormProps {
  mode: "create" | "edit";
  initial: ActionFormValues;
  /** Who performed it: the signed-in user when recording, the original performer when editing (BR-05). */
  performer: { fullName: string; role?: Role };
  /** The Ticket's creation time: an action cannot be dated before it (BR-06). */
  ticketCreatedAt: string;
  /** Saves the values; rejects to leave the form open with what was typed (BR-54). */
  onSave: (values: ActionFormValues) => Promise<void>;
  onCancel: () => void;
  /** Tells the region a request is in flight, so it can hold its other controls still (BR-53). */
  onBusyChange?: (busy: boolean) => void;
  /** Replaces the form with the record as it is now, after the person has confirmed losing their edits. */
  onShowLatest?: (latest: ActionTaken) => void;
}

export function ActionTakenForm({ mode, initial, performer, ticketCreatedAt, onSave, onCancel, onBusyChange, onShowLatest }: ActionTakenFormProps) {
  const radioName = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const [values, setValues] = useState<ActionFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<{ tone: "warning" | "error"; message: string; latest?: ActionTaken } | null>(null);
  /** The inline "replace your changes?" question after a conflict; never a dialog (ui-spec §9). */
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [refocusLatest, setRefocusLatest] = useState(0);

  // After a refusal, the first invalid field takes focus (ui-spec §9).
  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  // Once the question has closed, focus goes back to the button that opened it.
  useEffect(() => {
    if (refocusLatest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[data-control="show-latest"]')?.focus();
  }, [refocusLatest]);

  const set = <K extends keyof ActionFormValues>(key: K, value: ActionFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    // A message belongs to what was wrong; changing the field answers it.
    if (key in errors) setErrors(({ [key as FieldName]: _gone, ...rest }) => rest);
  };

  /** Closes the question and gives focus back to the button that opened it. */
  function dismissConfirm() {
    setConfirming(false);
    setRefocusLatest((n) => n + 1);
  }

  function refuse(found: FieldErrors) {
    setErrors(found);
    setFocusRequest((n) => n + 1);
  }

  function explain(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        const fromServer: FieldErrors = {};
        for (const name of FIELD_NAMES) if (error.fields[name]) fromServer[name] = error.fields[name];
        if (Object.keys(fromServer).length > 0) return refuse(fromServer);
      }
      if (error.status === 403) return setProblem({ tone: "error", message: FORBIDDEN });
      // A conflict is its own message, never a generic failure (ui-spec §1.5).
      if (error.status === 409 && error.code === "STALE_UPDATE") {
        setConfirming(false);
        return setProblem({ tone: "warning", message: STALE, latest: error.current as ActionTaken | undefined });
      }
      if (error.status === 409) return setProblem({ tone: "warning", message: `${error.message} Everything you typed is still in the form.` });
    }
    setProblem({ tone: "error", message: SAVE_FAILED });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setProblem(null);
    const found = validate(values, ticketCreatedAt);
    if (Object.keys(found).length > 0) return refuse(found);

    setErrors({});
    inFlight.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      await onSave(values);
    } catch (error) {
      explain(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form
      ref={formRef}
      className="tt-action-form"
      aria-label={mode === "create" ? "Record an action" : "Edit action"}
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      {problem &&
        (problem.tone === "warning" ? (
          <WarningCallout role="alert">
            {problem.message}
            {problem.latest && onShowLatest && (
              <div className="tt-action-form__latest">
                {confirming ? (
                  <div
                    role="group"
                    aria-label="Replace your changes?"
                    className="tt-staff-detail__confirm"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        dismissConfirm();
                      }
                    }}
                  >
                    <p>Replace what you typed with the latest version? Your changes will be lost.</p>
                    <div className="tt-actions">
                      <Button variant="secondary" autoFocus onClick={dismissConfirm}>
                        Keep editing
                      </Button>
                      <Button variant="primary" onClick={() => onShowLatest(problem.latest!)}>
                        Replace my changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" data-control="show-latest" onClick={() => setConfirming(true)}>
                    Show latest
                  </Button>
                )}
              </div>
            )}
          </WarningCallout>
        ) : (
          <ErrorCallout>{problem.message}</ErrorCallout>
        ))}

      <TextInput
        label="Action Date/Time"
        required
        type="datetime-local"
        autoFocus={mode === "create"}
        value={values.actionAt}
        error={errors.actionAt}
        disabled={busy}
        onChange={(event) => set("actionAt", event.target.value)}
      />
      <TextArea
        label="Action Description"
        required
        rows={4}
        value={values.description}
        error={errors.description}
        disabled={busy}
        onChange={(event) => set("description", event.target.value)}
      />
      <TextArea
        label="Result"
        required
        rows={2}
        value={values.result}
        error={errors.result}
        disabled={busy}
        onChange={(event) => set("result", event.target.value)}
      />

      <div className="tt-action-form__performer">
        <ReadOnlyField label="Performed by" value={performer.fullName} />
        {performer.role && <RoleBadge value={performer.role} />}
      </div>

      <fieldset className="tt-fieldset" disabled={busy}>
        <legend className="tt-field__label">
          Follow-Up Required?
          <span className="tt-field__required" aria-hidden="true">*</span>
        </legend>
        <label className="tt-radio">
          <input
            type="radio"
            name={radioName}
            value="no"
            checked={!values.followUpRequired}
            onChange={() => set("followUpRequired", false)}
          />
          No
        </label>
        <label className="tt-radio">
          <input
            type="radio"
            name={radioName}
            value="yes"
            checked={values.followUpRequired}
            onChange={() => set("followUpRequired", true)}
          />
          Yes
        </label>
      </fieldset>

      {values.followUpRequired && (
        <TextArea
          label="Follow-up Note"
          required
          rows={3}
          value={values.followUpNote}
          error={errors.followUpNote}
          disabled={busy}
          onChange={(event) => set("followUpNote", event.target.value)}
        />
      )}

      <TextArea
        label="Attachment Notes"
        rows={2}
        help="Say which file, screenshot, or image to look for. This does not upload a file."
        value={values.attachmentNotes}
        error={errors.attachmentNotes}
        disabled={busy}
        onChange={(event) => set("attachmentNotes", event.target.value)}
      />

      <div className="tt-actions">
        <Button variant="tertiary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">
          {mode === "create" ? "Save action" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export default ActionTakenForm;
