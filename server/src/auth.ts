import express, { type NextFunction, type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { loginThrottle } from "./loginThrottle.js";
import { checkNewPassword, hashPassword, verifyPasswordForLogin } from "./password.js";
import {
  SESSION_COOKIE,
  SESSION_USER_SELECT,
  type SessionUser,
  createSession,
  deleteOtherSessions,
  deleteSessionByToken,
  findSession,
  sessionCookieOptions,
} from "./session.js";

// Lab 3, Issue 3 — authentication (docs/lab-03/api-spec.md §2).
//
// Identity enters the server in exactly one place, the tt_sid cookie (BR-13).
// Authorization by role is Issue 4; this module only establishes who is asking.

export interface AuthContext {
  sessionId: number;
  user: SessionUser;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function sendError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return res.status(status).json({ error: fields ? { code, message, fields } : { code, message } });
}

function sessionToken(req: Request): string | null {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...attributes } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, attributes);
}

// Resolves the session behind the cookie, if any, into req.auth. A request with
// no cookie costs nothing; whether it may proceed is each route's guard's call.
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  const token = sessionToken(req);
  if (token === null) return next();
  try {
    const session = await findSession(getPrisma(), token);
    if (session) req.auth = session;
    next();
  } catch (error) {
    next(error);
  }
}

// BR-14 — while a password change is required, the session may only read the
// current user, change the password, or log out. Login and the health check
// are public and do not act through the session, so they stay reachable.
const ALLOWED_DURING_PASSWORD_CHANGE = new Set([
  "GET /api/auth/me",
  "POST /api/auth/password",
  "POST /api/auth/logout",
  "POST /api/auth/login",
  "GET /api/health",
]);

export function enforcePasswordChange(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.user.mustChangePassword) return next();
  if (ALLOWED_DURING_PASSWORD_CHANGE.has(`${req.method} ${req.path}`)) return next();
  return sendError(
    res,
    403,
    "PASSWORD_CHANGE_REQUIRED",
    "Set a new password before using the rest of TokTickIT.",
  );
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return sendError(res, 401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  return next();
}

// Deliberately one message for an unknown email, a wrong password, and an
// account with no password yet (BR-16, BR-66).
const INVALID_CREDENTIALS = "Email or password is incorrect.";
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = express.Router();

authRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// §2.1 — POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  // BR-45 — emails are compared lowercased. Passwords are never trimmed.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const fields: Record<string, string> = {};
  if (email === "") fields.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email)) fields.email = "Enter a valid email address.";
  if (password === "") fields.password = "Enter your password.";
  if (Object.keys(fields).length > 0) {
    // A malformed request is not a guess at a password, so it is not counted.
    return sendError(res, 400, "VALIDATION_FAILED", "One or more fields are invalid.", fields);
  }

  // BR-67 — reserve this attempt BEFORE the first await. A locked email, or one
  // whose failures plus attempts already in flight reach the limit, is refused
  // here, the right password included; otherwise a burst of simultaneous
  // guesses would all pass the check before any was counted. The reservation
  // never touches the database, so a refused unknown email and a refused real
  // one are answered identically.
  const attempt = loginThrottle.beginAttempt(email, Date.now());
  if (!attempt.allowed) {
    const minutes = Math.ceil(attempt.retryAfterSeconds / 60);
    res.set("Retry-After", String(attempt.retryAfterSeconds));
    return sendError(
      res,
      429,
      "TOO_MANY_ATTEMPTS",
      `Too many sign-in attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    );
  }

  // Every reserved attempt reports exactly one outcome, in the finally block:
  // a failure counts, a success clears, and anything else (an inactive
  // account's correct password, a server error) just gives the slot back.
  let outcome: "failure" | "success" | "neutral" = "neutral";
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...SESSION_USER_SELECT, passwordHash: true },
    });

    // BR-08 — the password is checked before anything else about the account,
    // so only someone who already knows it can learn the account is inactive.
    const passwordMatches = await verifyPasswordForLogin(password, user?.passwordHash ?? null);
    if (!user || !passwordMatches) {
      // Counted the same whether or not the email exists (BR-16, BR-67).
      outcome = "failure";
      return sendError(res, 401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
    }
    // The right password for an inactive account is not a failed guess, so it
    // is not counted either.
    if (!user.isActive) {
      return sendError(res, 403, "ACCOUNT_INACTIVE", "This account is not active. Contact an administrator.");
    }

    outcome = "success";

    // One browser holds one session: a login replaces whatever it held before.
    const previous = sessionToken(req);
    if (previous !== null) await deleteSessionByToken(prisma, previous);

    const token = await createSession(prisma, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    const { passwordHash: _hash, ...permitted } = user;
    return res.status(201).json({ user: permitted });
  } catch {
    return sendError(res, 500, "INTERNAL_ERROR", "Sign-in failed. Please try again.");
  } finally {
    loginThrottle.endAttempt(email, outcome, Date.now());
  }
});

// §2.2 — POST /api/auth/logout. Logging out twice is not an error.
authRouter.post("/logout", async (req: Request, res: Response) => {
  const token = sessionToken(req);
  try {
    // Deletes the row even when it has expired, so nothing is left behind.
    if (token !== null) await deleteSessionByToken(getPrisma(), token);
    clearSessionCookie(res);
    return res.status(204).end();
  } catch {
    return sendError(res, 500, "INTERNAL_ERROR", "Sign-out failed. Please try again.");
  }
});

// §2.3 — GET /api/auth/me
authRouter.get("/me", requireSession, (req: Request, res: Response) => {
  return res.status(200).json({ user: req.auth!.user });
});

// §2.4 — POST /api/auth/password
authRouter.post("/password", requireSession, async (req: Request, res: Response) => {
  const { user, sessionId } = req.auth!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = body.newPassword;
  const confirmPassword = body.confirmPassword;

  // Every field problem is reported at once, beneath its own field (FR-04).
  const fields: Record<string, string> = {};
  if (currentPassword === "") fields.currentPassword = "Enter your current password.";
  const rule = checkNewPassword(newPassword, user.email);
  if (rule !== null) fields.newPassword = rule;
  else if (newPassword === currentPassword) fields.newPassword = "Choose a password different from your current one.";
  if (confirmPassword !== newPassword) fields.confirmPassword = "The passwords do not match.";
  if (Object.keys(fields).length > 0) {
    return sendError(res, 400, "VALIDATION_FAILED", "One or more fields are invalid.", fields);
  }

  try {
    const prisma = getPrisma();
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPasswordForLogin(currentPassword, stored.passwordHash))) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Your current password is incorrect.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword as string), mustChangePassword: false },
    });
    await deleteOtherSessions(prisma, user.id, sessionId);

    return res.status(200).json({ changed: true });
  } catch {
    return sendError(res, 500, "INTERNAL_ERROR", "The password could not be changed. Please try again.");
  }
});
