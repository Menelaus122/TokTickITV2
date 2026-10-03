import { EMAIL_PATTERN } from "./auth.js";

// Lab 3, Issue 10 — the Administrator's user rules (specification.md §5.7,
// BR-45 to BR-52; api-spec §6).
//
// Pure, so field validation and the two safety rules are unit-tested without a
// database (user-rules.test.ts). admin.ts reads the current state under a
// lock and asks changeRefusal() what to do with it.

export const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
export type Role = (typeof ROLES)[number];

export const FULL_NAME_MAX = 100;
export const EMAIL_MAX = 254;

export interface UserFields {
  fullName?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

export type FieldsResult = { ok: true; value: UserFields } | { ok: false; fields: Record<string, string> };

/**
 * Validates the editable user fields. `required` lists the ones that must be
 * present (all four on create); any other field is validated only when sent.
 * The email is trimmed and lowercased, because it is compared that way (BR-45).
 * Fields outside these four are never read, so passwordHash or
 * mustChangePassword in a body changes nothing.
 */
export function checkUserFields(raw: unknown, required: readonly (keyof UserFields)[] = []): FieldsResult {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const has = (key: keyof UserFields) => key in body && body[key] !== undefined;
  const fields: Record<string, string> = {};
  const value: UserFields = {};

  if (has("fullName") || required.includes("fullName")) {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (fullName === "") fields.fullName = "Enter the user's full name.";
    else if ([...fullName].length > FULL_NAME_MAX) fields.fullName = `Full name must be at most ${FULL_NAME_MAX} characters.`;
    else value.fullName = fullName;
  }

  if (has("email") || required.includes("email")) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email === "") fields.email = "Enter an email address.";
    else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) fields.email = "Enter a valid email address.";
    else value.email = email;
  }

  if (has("role") || required.includes("role")) {
    // Exactly one role: a string naming one of the three, never a list (BR-17).
    if (typeof body.role !== "string" || !ROLES.includes(body.role as Role)) {
      fields.role = "Choose one role: Requester, IT Staff, or Administrator.";
    } else value.role = body.role as Role;
  }

  if (has("isActive") || required.includes("isActive")) {
    if (typeof body.isActive !== "boolean") fields.isActive = "Say whether the account is active.";
    else value.isActive = body.isActive;
  }

  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, value };
}

export type Refusal = "SELF_DEACTIVATION" | "LAST_ADMINISTRATOR";

export interface ChangeContext {
  callerId: number;
  target: { id: number; role: Role; isActive: boolean };
  change: { role?: Role; isActive?: boolean };
  /** Active Administrators other than the target, counted under the lock. */
  otherActiveAdministrators: number;
}

/**
 * Whether a role or activation change must be refused.
 *
 * BR-48 first: an Administrator never deactivates themselves or changes their
 * own role. Then BR-49: a change that takes the target out of the active
 * Administrators is refused when nobody else would be left. Because the
 * caller is an active Administrator, BR-49 can only bite when the caller's
 * own state changed under them — two Administrators deactivating each other at
 * once — which is why the count is taken under a lock.
 */
export function changeRefusal({ callerId, target, change, otherActiveAdministrators }: ChangeContext): Refusal | null {
  const roleChanges = change.role !== undefined && change.role !== target.role;
  const deactivates = change.isActive === false && target.isActive;

  if (target.id === callerId && (roleChanges || deactivates)) return "SELF_DEACTIVATION";

  const wasActiveAdministrator = target.role === "ADMINISTRATOR" && target.isActive;
  const staysActiveAdministrator = (change.role ?? target.role) === "ADMINISTRATOR" && (change.isActive ?? target.isActive);
  if (wasActiveAdministrator && !staysActiveAdministrator && otherActiveAdministrators === 0) return "LAST_ADMINISTRATOR";

  return null;
}
