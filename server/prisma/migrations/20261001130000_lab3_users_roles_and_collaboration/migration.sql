-- Lab 3 — users, roles, ticket workflow fields, sessions, comments, notes.
--
-- HAND-WRITTEN. Do not regenerate this file with `prisma migrate dev`.
--
-- Prisma Migrate has no rename detection. Left to itself it turns the
-- RequesterUser -> User and RequestedPriority -> Priority renames into
-- DROP TABLE "RequesterUser", DROP COLUMN "requestedPriority", and two
-- CREATEs, which deletes every Lab 2 Requester and every ticket's Requested
-- Priority (docs/lab-03/specification.md §7.6, D-21). Every statement below is
-- a rename, an addition, or a backfill, so no Lab 2 row is destroyed.
--
-- The object names match what Prisma generates for the Lab 3 schema, so a
-- later `prisma migrate diff` against schema.prisma reports no drift.


-- ---------------------------------------------------------------------------
-- 1. Renames (D-05, D-21)
-- ---------------------------------------------------------------------------

-- The table keeps every row and every id. Ticket_requesterId_fkey follows the
-- rename on its own, because Postgres references tables by OID, not by name.
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER SEQUENCE "RequesterUser_id_seq" RENAME TO "User_id_seq";

-- Ticket.requestedPriority keeps its values; the column follows the type.
ALTER TYPE "RequestedPriority" RENAME TO "Priority";

-- The Lab 2 selector's index. Superseded by User_role_isActive_idx below,
-- because every "active Requester" query now filters by role as well.
DROP INDEX "RequesterUser_isActive_idx";

-- BR-45 — emails are stored lowercased and compared case-insensitively. Lab 2
-- never normalised them, and User_email_key is case-sensitive, so a migrated
-- "Name@Example.com" would sit beside a later "name@example.com". If two Lab 2
-- emails differ only by case or surrounding spaces, this UPDATE violates
-- User_email_key and the whole migration rolls back rather than merging two
-- accounts silently. New rows are normalised by the API (Issues 3 and 10).
UPDATE "User" SET "email" = lower(trim("email"));


-- ---------------------------------------------------------------------------
-- 2. New enums and widened status (BR-17, BR-31)
-- ---------------------------------------------------------------------------

CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Adding enum values inside a transaction is allowed on PostgreSQL 12+ as long
-- as no statement in the same transaction uses the new values. None below does:
-- the status default stays NEW and no backfill touches currentStatus.
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';


-- ---------------------------------------------------------------------------
-- 3. User columns (BR-61, BR-66, D-22)
-- ---------------------------------------------------------------------------

-- Every new column is nullable or has a default, because the table already
-- holds the Lab 2 Requesters and a NOT NULL column without a default would
-- abort the migration. The defaults make each migrated row a REQUESTER who
-- must change their password, with no hash: locked until the seed assigns one.
ALTER TABLE "User"
    ADD COLUMN "passwordHash" TEXT,
    ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER',
    ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");


-- ---------------------------------------------------------------------------
-- 4. Ticket columns and the IT Priority backfill (BR-24, BR-28, BR-29, BR-63)
-- ---------------------------------------------------------------------------

-- itPriority starts nullable so the ADD COLUMN cannot fail on existing rows,
-- is backfilled from the Requester's own priority, and only then becomes
-- NOT NULL. If any row were missed, SET NOT NULL fails and the whole migration
-- rolls back rather than leaving a ticket without an IT Priority.
ALTER TABLE "Ticket"
    ADD COLUMN "ownerId" INTEGER,
    ADD COLUMN "itPriority" "Priority",
    ADD COLUMN "requesterResolvedAt" TIMESTAMP(3);

UPDATE "Ticket" SET "itPriority" = "requestedPriority";

ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;

CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "Ticket_currentStatus_itPriority_createdAt_idx"
    ON "Ticket"("currentStatus", "itPriority", "createdAt");

-- Restrict: an owner can never be deleted out from under a ticket (BR-50).
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 5. New tables (D-01, D-02, D-04)
-- ---------------------------------------------------------------------------

-- Only the SHA-256 of the session token is stored, as 64 hex characters (BR-10).
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Two tables rather than one with a visibility flag (BR-39).
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");

ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");

ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
