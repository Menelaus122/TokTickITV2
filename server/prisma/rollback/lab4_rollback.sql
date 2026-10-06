-- Lab 4 rollback (docs/lab-04/specification.md §7.6, BR-49).
--
-- Undoes 20261006093537_lab4_actions_taken_and_workflow and nothing else. Every
-- statement removes something that migration added, or restores the one thing it
-- dropped, so no Lab 1-3 row is touched: the Lab 3 tables come back row for row
-- (MIG-05 proves it on a database in the Lab 3 state).
--
-- Before you run it:
--   1. Take a dump:  docker exec toktickit-db pg_dump -U toktickit toktickit > backup.sql
--   2. Know what it loses: every Action Taken and every status-history row, and
--      every Ticket's version. That is the point of a rollback, and it is why the
--      dump comes first.
--
-- It does NOT undo the Lab 4 seed. The seed also writes into Lab 3 tables: it adds
-- two accounts to "User", and the Actions Taken it records move "Ticket"."updatedAt".
-- On a database that was seeded after migrating, those stay behind, and the dump
-- from step 1 is the recovery instead.
--
-- How to run it, then remove the migration from Prisma's history so the two agree:
--   docker exec -i toktickit-server npx prisma db execute --file prisma/rollback/lab4_rollback.sql --schema prisma/schema.prisma
--   docker exec toktickit-db psql -U toktickit -d toktickit -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20261006093537_lab4_actions_taken_and_workflow'"
--
-- Not `prisma migrate resolve --rolled-back`: Prisma refuses it for a migration
-- that succeeded (P3012, "not in a failed state"). With the history row gone,
-- `prisma migrate status` lists the migration as not yet applied, and
-- `prisma migrate deploy` applies it again cleanly; both were run to check this.

DROP TABLE "TicketStatusChange";

DROP TABLE "ActionTaken";

DROP INDEX "Ticket_ownerId_currentStatus_idx";

DROP INDEX "Ticket_requesterId_currentStatus_idx";

ALTER TABLE "Ticket" DROP COLUMN "version";

CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
