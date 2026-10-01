import bcrypt from "bcryptjs";

// Password hashing and rules — Lab 3 BR-06, BR-07, D-10.
//
// bcryptjs is pure JavaScript, so the suite runs on Windows without a native
// build toolchain. Cost 10 is a local-lab setting that keeps the test suite
// usable; specification.md D-10 records it as such.

export const BCRYPT_COST = 10;

export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_CHARS = 72;
// bcrypt reads at most 72 BYTES and silently ignores the rest. A Thai character
// is three bytes in UTF-8, so a 25-character Thai password already exceeds it.
// Checking characters alone would let two passwords that differ only after the
// 72nd byte verify as the same password (BR-07).
export const PASSWORD_MAX_BYTES = 72;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// A null hash never matches (BR-66). The migration leaves migrated accounts
// without a hash because SQL cannot compute one (D-22), and this is what makes
// that intermediate state a locked door rather than an open one.
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash === null) return false;
  return bcrypt.compare(password, hash);
}

// Login uses this instead of verifyPassword. When there is no hash to compare
// against — an unknown email, or a migrated account with no password yet — it
// still runs one bcrypt comparison, so the response time does not reveal which
// emails exist (BR-16).
let dummyHash: string | null = null;

export async function verifyPasswordForLogin(password: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    dummyHash ??= await bcrypt.hash("toktickit-timing-equaliser", BCRYPT_COST);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

// BR-07. Returns the message to show beneath the new-password field, or null
// when the password is acceptable. Passwords are never trimmed: a space is a
// character the user chose.
export function checkNewPassword(password: unknown, email: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Enter a new password.";
  }
  // Count code points, not UTF-16 units, so an emoji is one character.
  const chars = [...password].length;
  if (chars < PASSWORD_MIN_CHARS) {
    return `Password must be at least ${PASSWORD_MIN_CHARS} characters.`;
  }
  if (chars > PASSWORD_MAX_CHARS) {
    return `Password must be at most ${PASSWORD_MAX_CHARS} characters.`;
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return "Password is too long. Thai and other non-Latin characters count as more than one character.";
  }
  if (password.toLowerCase() === email.trim().toLowerCase()) {
    return "Password must not be your email address.";
  }
  return null;
}
