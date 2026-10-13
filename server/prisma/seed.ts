import { getPrisma } from "../src/prisma.js";
import { runSeed, SEED_PASSWORD, FIRST_LOGIN_EMAIL } from "./seedData.js";

// `npm run prisma:seed`. The data and the converging logic live in seedData.ts
// so the migration and regression suite can run the same seed it documents.

async function main() {
  const prisma = getPrisma();
  const { usersByRole, ticketsByStatus, actions, statusChanges } = await runSeed(prisma);

  const users = Object.entries(usersByRole)
    .map(([role, n]) => `${role} ${n.active} active / ${n.inactive} inactive`)
    .join(", ");
  const tickets = Object.entries(ticketsByStatus)
    .map(([status, n]) => `${status} ${n}`)
    .join(", ");

  console.log(`Seed complete.`);
  console.log(`  Users:   ${users}`);
  console.log(`  Tickets: ${tickets}`);
  console.log(`  Actions Taken: ${actions}; status changes recorded: ${statusChanges}`);
  console.log(`  Local-development password for every seeded account: ${SEED_PASSWORD}`);
  console.log(`  ${FIRST_LOGIN_EMAIL} must change it at first sign-in; no other account does.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
