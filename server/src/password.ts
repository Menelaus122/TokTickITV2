import bcrypt from "bcryptjs";

// Password hashing — Lab 3 BR-06, D-10.
//
// bcryptjs is pure JavaScript, so the suite runs on Windows without a native
// build toolchain. Cost 10 is a local-lab setting that keeps the test suite
// usable; specification.md D-10 records it as such.

export const BCRYPT_COST = 10;

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
