import type { Prisma } from "@prisma/client";

// Lab 4, Issue 6 — the Ticket's row lock (specification.md BR-29).
//
// Every write to a Ticket runs in a transaction that locks the Ticket's row first
// and then decides from what it reads under the lock. Two simultaneous writers
// are serialised: the second sees the first's result and is judged against it,
// never against a read that is already out of date. The lock order is always
// Ticket first, then User, and nothing takes them the other way round.

export type Db = Prisma.TransactionClient;

/** Holds the Ticket's row until the transaction ends. Does nothing if there is no such Ticket. */
export async function lockTicketRow(tx: Db, id: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
}
