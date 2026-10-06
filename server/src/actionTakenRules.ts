import type { TicketStatus } from "./listQuery.js";

// Lab 4, Issue 4 — the rules of an Action Taken, as pure functions
// (docs/lab-04/specification.md BR-03 to BR-08, BR-10, BR-12, BR-27, BR-28, D-18;
// docs/lab-04/api-spec.md §2.2, §2.3).
//
// Nothing here touches the database or reads the clock: the caller passes the
// current time and the Ticket's creation time, so every boundary is exact and
// the rules are unit-tested without a server (UNIT-01 to UNIT-06).

export const LIMITS = {
  descriptionMin: 5, // BR-03
  descriptionMax: 2000,
  resultMin: 2,
  resultMax: 1000,
  followUpNoteMin: 5, // BR-04
  followUpNoteMax: 1000,
  attachmentNotesMax: 500,
} as const;

/** BR-06 — how far ahead of the server an Action Date/Time may be, to allow for a slow clock. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** BR-10 — an action is recorded or edited only on a Ticket in one of these statuses. */
export const ACTIVE_STATUSES: readonly TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

export const isActiveStatus = (status: TicketStatus): boolean => ACTIVE_STATUSES.includes(status);

/** The fields a person can set. Performed by, the Ticket, and the timestamps are never in here (BR-05). */
export interface ActionFields {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

/** One message per offending field, keyed by the field's name in the request. */
export type FieldErrors = Record<string, string>;

export interface CheckContext {
  /** The server's clock. */
  now: Date;
  /** The Ticket's `createdAt`: an action cannot be dated before the Ticket existed (BR-06). */
  ticketCreatedAt: Date;
}

// A complete ISO 8601 date and time with an explicit zone. A bare local time has
// no single meaning once it is stored in UTC, so it is refused rather than guessed.
// Each part of the time is held to its real range: `new Date` turns 24:00 into
// midnight of the next day, and that would store a date the person did not write.
const ISO_WITH_ZONE =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Whether a year, a month (1 to 12), and a day make a day that exists. `new Date`
 * does not refuse 31 February: it rolls it over to 3 March, so the calendar has
 * to be checked before the text is parsed.
 */
function isRealDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= (month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]);
}

const NUL = "\u0000";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Counted with `.length`, as Lab 3's comments are. It counts UTF-16 units, so it
// can only ever be stricter than the database's VARCHAR, which counts code points.
function checkText(
  value: unknown,
  label: string,
  min: number,
  max: number,
): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return { ok: false, message: value === undefined || value === null ? `${label} is required.` : `${label} must be text.` };
  }
  // BR-12, BR-52 — PostgreSQL text cannot hold NUL, and it must never reach it.
  if (value.includes(NUL)) return { ok: false, message: `${label} contains a character that is not allowed.` };
  const text = value.trim();
  if (text.length === 0) return { ok: false, message: `${label} is required.` };
  if (text.length < min || text.length > max) return { ok: false, message: `${label} must be between ${min} and ${max} characters.` };
  return { ok: true, text };
}

function checkActionAt(value: unknown, ctx: CheckContext): { ok: true; at: Date } | { ok: false; message: string } {
  if (value === undefined || value === null || value === "") return { ok: false, message: "Action Date/Time is required." };
  const parts = typeof value === "string" ? ISO_WITH_ZONE.exec(value) : null;
  if (!parts || !isRealDay(Number(parts[1]), Number(parts[2]), Number(parts[3]))) {
    return { ok: false, message: "Enter a valid date and time, with a time zone." };
  }
  const at = new Date(value as string);
  if (Number.isNaN(at.getTime())) return { ok: false, message: "Enter a valid date and time, with a time zone." };
  if (at.getTime() > ctx.now.getTime() + FUTURE_TOLERANCE_MS) {
    return { ok: false, message: "Action Date/Time cannot be in the future." };
  }
  if (at.getTime() < ctx.ticketCreatedAt.getTime()) {
    return { ok: false, message: "Action Date/Time cannot be before the ticket was created." };
  }
  return { ok: true, at };
}

// The one place the rules of BR-03 and BR-04 live, so a create and an edit
// cannot drift apart. `input` holds the candidate value of every field.
function checkFields(input: Record<string, unknown>, ctx: CheckContext): { ok: true; value: ActionFields } | { ok: false; fields: FieldErrors } {
  const fields: FieldErrors = {};

  const at = checkActionAt(input.actionAt, ctx);
  if (!at.ok) fields.actionAt = at.message;

  const description = checkText(input.description, "Action Description", LIMITS.descriptionMin, LIMITS.descriptionMax);
  if (!description.ok) fields.description = description.message;

  const result = checkText(input.result, "Result", LIMITS.resultMin, LIMITS.resultMax);
  if (!result.ok) fields.result = result.message;

  // Only a real boolean: "true" and 1 are refused rather than guessed at.
  const followUpRequired = input.followUpRequired;
  if (typeof followUpRequired !== "boolean") fields.followUpRequired = "Choose whether follow-up is required.";

  // BR-04, D-18 — required for Yes; for No it is not read, so it is cleared. A
  // NUL is refused either way, because BR-52 is about the request itself.
  let followUpNote: string | null = null;
  const note = input.followUpNote;
  if (typeof note === "string" && note.includes(NUL)) {
    fields.followUpNote = "Follow-up Note contains a character that is not allowed.";
  } else if (followUpRequired === true) {
    const checked = checkText(note, "Follow-up Note", LIMITS.followUpNoteMin, LIMITS.followUpNoteMax);
    if (checked.ok) followUpNote = checked.text;
    else fields.followUpNote = checked.message === "Follow-up Note is required." ? "Follow-up Note is required when follow-up is needed." : checked.message;
  }

  // Optional: absent, null, or blank is stored as null.
  let attachmentNotes: string | null = null;
  const attachment = input.attachmentNotes;
  if (attachment !== undefined && attachment !== null) {
    if (typeof attachment !== "string") fields.attachmentNotes = "Attachment Notes must be text.";
    else if (attachment.includes(NUL)) fields.attachmentNotes = "Attachment Notes contains a character that is not allowed.";
    else if (attachment.trim().length > LIMITS.attachmentNotesMax) {
      fields.attachmentNotes = `Attachment Notes must be at most ${LIMITS.attachmentNotesMax} characters.`;
    } else attachmentNotes = attachment.trim() === "" ? null : attachment.trim();
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      actionAt: (at as { ok: true; at: Date }).at,
      description: (description as { ok: true; text: string }).text,
      result: (result as { ok: true; text: string }).text,
      followUpRequired: followUpRequired as boolean,
      followUpNote,
      attachmentNotes,
    },
  };
}

/** The create rules (api-spec §2.2): every required field present and valid. */
export function checkNewAction(body: unknown, ctx: CheckContext): { ok: true; value: ActionFields } | { ok: false; fields: FieldErrors } {
  // A body that is not an object has no fields, so every required one is reported.
  return checkFields(isRecord(body) ? body : {}, ctx);
}

const EDITABLE = ["actionAt", "description", "result", "followUpRequired", "followUpNote", "attachmentNotes"] as const;

const sameField = (a: ActionFields, b: ActionFields): boolean =>
  a.actionAt.getTime() === b.actionAt.getTime() &&
  a.description === b.description &&
  a.result === b.result &&
  a.followUpRequired === b.followUpRequired &&
  a.followUpNote === b.followUpNote &&
  a.attachmentNotes === b.attachmentNotes;

/**
 * The edit rules (api-spec §2.3). The rules of a create apply to the MERGED
 * record: a field that is not sent keeps its stored value, so Yes sent onto a
 * record with no note needs a note in the same request, and No clears one.
 * `performedBy`, the Ticket, and the timestamps are never read (BR-05, BR-09).
 */
export function checkActionEdit(
  stored: ActionFields,
  body: unknown,
  ctx: CheckContext,
): { ok: true; value: ActionFields; expectedVersion: number; changed: boolean } | { ok: false; fields: FieldErrors } {
  const sent = isRecord(body) ? body : {};

  // BR-27 — the edit must say which version it was made against.
  const expectedVersion = sent.expectedVersion;
  const versionError: FieldErrors =
    typeof expectedVersion === "number" && Number.isInteger(expectedVersion) && expectedVersion >= 1
      ? {}
      : { expectedVersion: "Send the version of the action you are editing." };

  const merged: Record<string, unknown> = { actionAt: stored.actionAt.toISOString() };
  for (const field of EDITABLE) {
    if (field === "actionAt") {
      if (sent.actionAt !== undefined) merged.actionAt = sent.actionAt;
    } else {
      merged[field] = sent[field] !== undefined ? sent[field] : stored[field];
    }
  }

  const checked = checkFields(merged, ctx);
  if (!checked.ok) return { ok: false, fields: { ...versionError, ...checked.fields } };
  if (Object.keys(versionError).length > 0) return { ok: false, fields: versionError };
  return { ok: true, value: checked.value, expectedVersion: expectedVersion as number, changed: !sameField(stored, checked.value) };
}

/** BR-08 — the reading order: oldest Action Date/Time first, ties by id. It is NOT the gate's "latest" (BR-17). */
export function compareReadingOrder(a: { actionAt: Date; id: number }, b: { actionAt: Date; id: number }): number {
  return a.actionAt.getTime() - b.actionAt.getTime() || a.id - b.id;
}

const REQUEST_KEY = /^[A-Za-z0-9_-]{8,64}$/;

/** BR-28 — a client-generated id for one submission: 8 to 64 of letters, digits, hyphen, underscore. */
export function isValidRequestKey(value: unknown): value is string {
  return typeof value === "string" && REQUEST_KEY.test(value);
}

/** The request key in a body: absent or null is fine, a present one must be valid. */
export function readRequestKey(body: unknown): { ok: true; key: string | null } | { ok: false; message: string } {
  const key = isRecord(body) ? body.requestKey : undefined;
  if (key === undefined || key === null) return { ok: true, key: null };
  return isValidRequestKey(key) ? { ok: true, key } : { ok: false, message: "The request key must be 8 to 64 letters, digits, hyphens, or underscores." };
}
