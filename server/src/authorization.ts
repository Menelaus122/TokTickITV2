import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, Role } from "@prisma/client";
import { REQUESTER_HEADER, resolveRequester, type RequesterContext } from "./requesterContext.js";

// Lab 3, Issue 4 — authorization and safe errors (docs/lab-03/api-spec.md
// §1.1, §1.3, §7; specification.md BR-17 to BR-23, BR-65).
//
// Every guard here runs on the server. A hidden button in the client is
// feedback for a person, never the boundary (labsheet §4.3).

function forbidden(res: Response, message: string) {
  return res.status(403).json({ error: { code: "FORBIDDEN", message } });
}

// The BR-18 matrix by route family. A missing session is always 401 and is
// checked first, so a caller learns "sign in" before "you may not" (BR-21,
// api-spec §7). Mounted on a path prefix, it guards every route under it,
// including ones a later issue has not written yet.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Sign in to continue." } });
    }
    if (!roles.includes(req.auth.user.role)) {
      return forbidden(res, "Your role does not allow this.");
    }
    return next();
  };
}

// BR-65 — a state-changing request that names a foreign Origin is refused
// before any handler runs. SameSite=Lax already keeps the cookie off a
// cross-site POST; this is the second control, needed because the upload
// endpoint accepts multipart/form-data, which any HTML form can send (D-13).
// A request with no Origin header (curl, Supertest, server-to-server) carries
// no cookie a browser attached on another site's behalf, so it passes.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function rejectForeignOrigin(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    if (origin === undefined || allowed.has(origin)) return next();
    return forbidden(res, "This request did not come from TokTickIT.");
  };
}

// Who a Requester-scoped request acts for (BR-03, BR-13).
//
// With a session, the session decides, and nothing the client sends — the
// X-Requester-Id header, a requesterId in the body or query — can change it.
// A session whose role is not REQUESTER is refused, because IT Staff and
// Administrators have no "own tickets" in Lab 3 (BR-18).
//
// Without a session, the Lab 2 header still works, so the Lab 2 screens keep
// working until Issue 6 replaces the Development Requester selector with
// sign-in and removes this fallback.
export async function resolveRequesterIdentity(prisma: PrismaClient, req: Request): Promise<RequesterContext> {
  if (req.auth) {
    if (req.auth.user.role !== "REQUESTER") {
      return { ok: false, status: 403, code: "FORBIDDEN", message: "Only Requesters have tickets of their own." };
    }
    return { ok: true, requesterId: req.auth.user.id };
  }
  // Every handler awaits this BEFORE its own try block, and Express 4 does not
  // pass a rejected promise to the error handler: a database failure here used
  // to become an unhandled rejection that ended the whole process. It is turned
  // into an ordinary safe 500 instead, for this request only.
  try {
    return await resolveRequester(prisma, req.headers[REQUESTER_HEADER]);
  } catch {
    return { ok: false, status: 500, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
  }
}

// Unknown /api routes answer in the same error envelope as everything else,
// not with Express's HTML page.
export function apiNotFound(_req: Request, res: Response) {
  return res.status(404).json({ error: { code: "NOT_FOUND", message: "That resource does not exist." } });
}

// The last line of defence for safe errors (FR-47, §6.2). The client's own
// mistakes keep a 4xx: body-parser marks each one with a status — 400 for
// malformed JSON, 413 for a body over its limit, 415 for an unsupported
// charset or encoding. Anything else that escaped a handler is the server's
// and gets a 500 carrying no stack trace, SQL, or path.
const CLIENT_ERROR_CODES: Record<number, [string, string]> = {
  413: ["REQUEST_TOO_LARGE", "The request body is too large."],
  415: ["UNSUPPORTED_MEDIA_TYPE", "The request body's format is not supported."],
};

export function safeErrors(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const [code, message] = CLIENT_ERROR_CODES[status] ?? ["VALIDATION_FAILED", "The request body is not valid JSON."];
    return res.status(status).json({ error: { code, message } });
  }
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}
