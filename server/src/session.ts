import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions } from "express";
import type { PrismaClient, Role } from "@prisma/client";

// Server-side sessions — Lab 3 BR-09 to BR-12, D-01, D-02.
//
// The browser holds an opaque random token; the database holds only its
// SHA-256. Nothing here is signed, so there is no server secret to leak or to
// commit (§6.1): a token is valid only because its hash is in the Session table,
// and deleting the row is what logout means.

export const SESSION_COOKIE = "tt_sid";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // BR-11, D-12
const TOKEN_BYTES = 32;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

// An expired session is treated exactly as no session at all (BR-11).
export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // BR-09 — JavaScript cannot read the token
    sameSite: "lax", // D-13 — kept off cross-site requests
    path: "/",
    maxAge: SESSION_TTL_MS,
    // Plain HTTP in local development; Secure everywhere else (BR-09).
    secure: process.env.NODE_ENV === "production",
  };
}

// The permitted user shape (api-spec §1.6) plus the flag the client routes on.
export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

export const SESSION_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} as const;

export async function createSession(prisma: PrismaClient, userId: number): Promise<string> {
  const token = generateSessionToken();
  await prisma.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt: sessionExpiry() },
  });
  return token;
}

// Returns the session behind a cookie value, or null when there is none to
// honour: an unknown token, an expired one, or one whose user is no longer
// active. Expired rows are removed on sight.
export async function findSession(
  prisma: PrismaClient,
  token: string,
): Promise<{ sessionId: number; user: SessionUser } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, expiresAt: true, user: { select: SESSION_USER_SELECT } },
  });
  if (!session) return null;

  if (isSessionExpired(session.expiresAt)) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // Deactivation deletes a user's sessions (BR-51); this is the backstop in
  // case a row survives anyway.
  if (!session.user.isActive) return null;

  return { sessionId: session.id, user: session.user };
}

export async function deleteSessionByToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

// BR-15 — after a password change, only the session that made it survives.
export async function deleteOtherSessions(prisma: PrismaClient, userId: number, keepSessionId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
}
