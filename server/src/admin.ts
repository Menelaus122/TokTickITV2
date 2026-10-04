import express, { type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { hashPassword, checkNewPassword } from "./password.js";
import { containsText, parseSearch } from "./queryParams.js";
import { single, absent } from "./listQuery.js";
import { routeId } from "./routeId.js";
import { ROLES, changeRefusal, checkUserFields, type Role } from "./userRules.js";

// Lab 3, Issue 10 — Administrator User Management (api-spec §6;
// specification.md §4.8, BR-45 to BR-52).
//
// Mounted under /api/admin, behind app.ts's requireRole("ADMINISTRATOR"), so
// every route here is Administrator only before it runs. There is no DELETE
// route: deactivation is the only removal (BR-50), and a delete request falls
// through to the JSON 404.

const SERVER_ERROR = { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } as const;
const USER_NOT_FOUND = { error: { code: "NOT_FOUND", message: "That user could not be found." } } as const;
const INVALID_ID = { error: { code: "INVALID_QUERY", message: "The user id is not valid." } } as const;
const EMAIL_IN_USE = {
  error: { code: "EMAIL_IN_USE", message: "That email is already in use.", fields: { email: "Another user already has this email." } },
} as const;

// Everything the list shows, and nothing that is password material (BR-52):
// no passwordHash and no session ever appears in a select here.
const ADMIN_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  department: true,
  mustChangePassword: true,
  lastLoginAt: true,
} as const;

const REFUSALS = {
  SELF_DEACTIVATION: "You cannot change your own role or deactivate yourself.",
  LAST_ADMINISTRATOR: "At least one active Administrator is required.",
} as const;

type Outcome = { status: number; body: unknown };

function validationFailed(fields: Record<string, string>) {
  return { error: { code: "VALIDATION_FAILED", message: "One or more fields are invalid.", fields } };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Locks every active Administrator's row until the transaction ends, so two
 * changes that each remove an Administrator are judged one after the other
 * (BR-49), and returns their ids.
 */
async function lockActiveAdministrators(tx: Prisma.TransactionClient): Promise<number[]> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM "User" WHERE role = 'ADMINISTRATOR' AND "isActive" = true ORDER BY id FOR UPDATE`;
  return rows.map((row) => row.id);
}

export const adminRouter = express.Router();

// GET /api/admin/users — search by name or email, filter by one role, name
// ascending; no pagination or sorting by design (api-spec §6.1, FR-39).
adminRouter.get("/users", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const search = parseSearch("q", single(req.query.q));
  if (!search.ok) return res.status(400).json({ error: { code: "INVALID_QUERY", message: search.message } });

  let role: Role | null = null;
  if (!absent(req.query.role)) {
    const text = single(req.query.role);
    if (text === undefined || !ROLES.includes(text as Role)) {
      return res.status(400).json({ error: { code: "INVALID_QUERY", message: `role must be one of ${ROLES.join(", ")}.` } });
    }
    role = text as Role;
  }

  try {
    const users = await getPrisma().user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search.value ? { OR: [{ fullName: containsText(search.value) }, { email: containsText(search.value) }] } : {}),
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: ADMIN_USER_SELECT,
    });
    return res.status(200).json({ users });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

// POST /api/admin/users — create with one role and an initial password; the
// account must change it at first login (api-spec §6.2, BR-46, AC-30).
adminRouter.post("/users", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const checked = checkUserFields(req.body, ["fullName", "email", "role", "isActive"]);
  const fields = checked.ok ? {} : { ...checked.fields };
  const password = (req.body as { initialPassword?: unknown } | undefined)?.initialPassword;
  const email = checked.ok ? checked.value.email! : "";
  const passwordProblem = checkNewPassword(password, email);
  if (passwordProblem) fields.initialPassword = passwordProblem;
  if (!checked.ok || passwordProblem) return res.status(400).json(validationFailed(fields));

  const prisma = getPrisma();
  try {
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return res.status(409).json(EMAIL_IN_USE);
    const { fullName, role, isActive } = checked.value;
    const user = await prisma.user.create({
      data: {
        fullName: fullName!,
        email,
        role: role!,
        isActive: isActive!,
        passwordHash: await hashPassword(password as string),
        // Never the caller's choice (BR-46).
        mustChangePassword: true,
      },
      select: ADMIN_USER_SELECT,
    });
    return res.status(201).json({ user });
  } catch (error) {
    // Two creates racing for one email: the unique index decides (BR-45).
    if (isUniqueViolation(error)) return res.status(409).json(EMAIL_IN_USE);
    return res.status(500).json(SERVER_ERROR);
  }
});

// PATCH /api/admin/users/:id — any subset of name, email, role, and activation
// (api-spec §6.3, BR-45, BR-48, BR-49, BR-51).
adminRouter.patch("/users/:id", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);
  const checked = checkUserFields(req.body);
  if (!checked.ok) return res.status(400).json(validationFailed(checked.fields));
  const change = checked.value;
  const callerId = req.auth!.user.id;

  const prisma = getPrisma();
  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const activeAdministrators = await lockActiveAdministrators(tx);
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
      if (!target) return { status: 404, body: USER_NOT_FOUND };

      const refusal = changeRefusal({
        callerId,
        target,
        change,
        otherActiveAdministrators: activeAdministrators.filter((adminId) => adminId !== id).length,
      });
      if (refusal) return { status: 409, body: { error: { code: refusal, message: REFUSALS[refusal] } } };

      if (change.email) {
        const holder = await tx.user.findUnique({ where: { email: change.email }, select: { id: true } });
        if (holder && holder.id !== id) return { status: 409, body: EMAIL_IN_USE };
      }

      const user = await tx.user.update({ where: { id }, data: change, select: ADMIN_USER_SELECT });
      // A deactivated account is signed out everywhere (BR-51). Its tickets
      // keep it as their owner (BR-26, D-19): nothing else is touched.
      if (change.isActive === false && target.isActive) await tx.session.deleteMany({ where: { userId: id } });
      return { status: 200, body: { user } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json(EMAIL_IN_USE);
    return res.status(500).json(SERVER_ERROR);
  }
});

// POST /api/admin/users/:id/initial-password — a new initial password; the
// user is signed out everywhere and must change it at next sign-in
// (api-spec §6.4, BR-47, AC-34).
adminRouter.post("/users/:id/initial-password", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const id = routeId(req.params.id);
  if (id === null) return res.status(400).json(INVALID_ID);

  const prisma = getPrisma();
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) return res.status(404).json(USER_NOT_FOUND);
    // Their own password goes through /api/auth/password, which needs the
    // current one (api-spec §6.4).
    if (target.id === req.auth!.user.id) {
      return res.status(409).json({
        error: { code: "SELF_DEACTIVATION", message: "Change your own password from Change Password, which asks for the current one." },
      });
    }

    const password = (req.body as { initialPassword?: unknown } | undefined)?.initialPassword;
    const problem = checkNewPassword(password, target.email);
    if (problem) return res.status(400).json(validationFailed({ initialPassword: problem }));

    const passwordHash = await hashPassword(password as string);
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } }),
      prisma.session.deleteMany({ where: { userId: id } }),
    ]);
    return res.status(200).json({ mustChangePassword: true });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});
