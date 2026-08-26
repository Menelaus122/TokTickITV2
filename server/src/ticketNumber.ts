import type { Prisma } from "@prisma/client";

// Official Ticket Number generation (BR-01, BR-04).
//
// Format: TT-<YYYY>-<NNNNN> — literal TT, the four-digit creation year, and a
// five-digit sequence that restarts at 00001 each calendar year.

export const TICKET_NUMBER_PATTERN = /^TT-\d{4}-\d{5}$/;

const SEQUENCE_DIGITS = 5;
export const MAX_SEQUENCE = 10 ** SEQUENCE_DIGITS - 1;

export function formatTicketNumber(year: number, sequence: number): string {
  return `TT-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}

/** Reads the sequence back out of a ticket number, or null if malformed. */
export function parseSequence(ticketNumber: string): number | null {
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) return null;
  return Number(ticketNumber.slice(-SEQUENCE_DIGITS));
}

export function parseYear(ticketNumber: string): number | null {
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) return null;
  return Number(ticketNumber.slice(3, 7));
}

/**
 * Computes the next number for `year` from the rows already in the database.
 *
 * Because the sequence is zero-padded to a fixed width, sorting the strings
 * descending gives the same answer as sorting the sequence numerically, so one
 * indexed lookup finds the current maximum.
 *
 * The caller runs this inside the transaction that inserts the row and retries
 * on a unique-constraint violation. That retry, plus the unique index on
 * ticketNumber, is what makes the number safe under concurrency — an in-process
 * counter would break the moment a second server process existed
 * (specification.md 7.4).
 */
export async function nextTicketNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const latest = await tx.ticket.findFirst({
    where: { ticketNumber: { startsWith: `TT-${year}-` } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  const current = latest ? (parseSequence(latest.ticketNumber) ?? 0) : 0;
  const next = current + 1;

  if (next > MAX_SEQUENCE) {
    throw new Error(`Ticket number sequence exhausted for ${year}`);
  }

  return formatTicketNumber(year, next);
}
