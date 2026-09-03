import type { PrismaClient } from "@prisma/client";

// Resolves the current Development Requester from the request (BR-14).
//
// Identity enters the server in exactly one place: the X-Requester-Id header.
// It is never read from a request body or query string, so a client cannot
// claim to be someone else by editing a payload. In Lab 3 this module is what
// gets replaced by a real authenticated identity, and nothing that calls it has
// to change (BR-46).

export const REQUESTER_HEADER = "x-requester-id";

export type RequesterContext =
  | { ok: true; requesterId: number }
  | { ok: false; status: number; code: string; message: string };

export async function resolveRequester(
  prisma: PrismaClient,
  headerValue: string | string[] | undefined,
): Promise<RequesterContext> {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (raw === undefined || raw.trim() === "") {
    return {
      ok: false,
      status: 400,
      code: "REQUESTER_CONTEXT_REQUIRED",
      message: "Select a Development Requester before using this endpoint.",
    };
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      status: 400,
      code: "REQUESTER_CONTEXT_REQUIRED",
      message: "The Development Requester context is not a valid id.",
    };
  }

  const requester = await prisma.requesterUser.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!requester) {
    return {
      ok: false,
      status: 400,
      code: "REQUESTER_INVALID",
      message: "The selected Development Requester no longer exists.",
    };
  }

  // BR-12 — never quietly fall back to some other requester.
  if (!requester.isActive) {
    return {
      ok: false,
      status: 400,
      code: "REQUESTER_INACTIVE",
      message: "The selected Development Requester is no longer active.",
    };
  }

  return { ok: true, requesterId: requester.id };
}
