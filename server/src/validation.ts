// Server-side validation for ticket creation.
//
// The client validates the same rules for fast feedback, but this module is the
// authority (BR-29). Everything here is pure so it can be unit-tested at its
// boundaries without a database or an HTTP request.

export const SUMMARY_MIN = 5;
export const SUMMARY_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;

export const REQUESTED_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type RequestedPriority = (typeof REQUESTED_PRIORITIES)[number];

export interface TicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export type FieldErrors = Record<string, string>;

export type ValidationResult =
  | { ok: true; value: TicketInput }
  | { ok: false; fields: FieldErrors };

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Trims a value if it is a string; anything else becomes null. */
function trimmed(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/** Accepts a positive integer, or a string that is exactly one. */
function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateTicketInput(body: unknown): ValidationResult {
  const raw = asRecord(body);
  const fields: FieldErrors = {};

  // BR-25 — trim before measuring, and store what was measured.
  const summary = trimmed(raw.summary);
  if (summary === null || summary.length === 0) {
    fields.summary = "Summary is required.";
  } else if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX) {
    fields.summary = `Summary must be between ${SUMMARY_MIN} and ${SUMMARY_MAX} characters.`;
  }

  const description = trimmed(raw.description);
  if (description === null || description.length === 0) {
    fields.description = "Description is required.";
  } else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    fields.description = `Description must be between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`;
  }

  const categoryId = positiveInteger(raw.categoryId);
  if (categoryId === null) fields.categoryId = "Category is required.";

  const relatedSystemId = positiveInteger(raw.relatedSystemId);
  if (relatedSystemId === null) fields.relatedSystemId = "Related System is required.";

  // BR-07 — an explicit choice, with no default to fall back on.
  const priority = trimmed(raw.requestedPriority);
  if (priority === null || priority.length === 0) {
    fields.requestedPriority = "Requested Priority is required.";
  } else if (!REQUESTED_PRIORITIES.includes(priority as RequestedPriority)) {
    fields.requestedPriority = `Requested Priority must be one of ${REQUESTED_PRIORITIES.join(", ")}.`;
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    value: {
      categoryId: categoryId as number,
      relatedSystemId: relatedSystemId as number,
      summary: summary as string,
      description: description as string,
      requestedPriority: priority as RequestedPriority,
    },
  };
}
