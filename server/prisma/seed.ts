import { getPrisma } from "../src/prisma.js";

// Lab 2 seed — reference data and Development Requesters.
//
// Everything here is written with upsert on a unique column, so running the
// seed twice never creates a duplicate row (specification.md 7.5). Unlike the
// Lab 1 seed, the update branch is not empty: it re-applies the intended state
// so a row that drifted (a requester manually deactivated, say) converges back
// instead of silently staying wrong. Running twice still ends in exactly the
// same database, which is what idempotent means here.
//
// No Tickets or Attachments are seeded. Those are created through the API in
// Issue 5 onwards, so ticket creation is always exercised for real.

// The four required Ticket Categories.
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

// At least six Related Systems — the service, application, device, or platform
// a ticket is about.
const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

// Development Requesters — BR-03: testing identities, not accounts. No
// passwords, no roles. At least four active and at least one inactive; the
// inactive one must never reach the selector (BR-09).
const REQUESTERS = [
  {
    fullName: "Anucha Wongsawat",
    email: "anucha.wong@kmutt.ac.th",
    department: "Civil Engineering",
    isActive: true,
  },
  {
    fullName: "Kanya Srisai",
    email: "kanya.sris@kmutt.ac.th",
    department: "Registrar",
    isActive: true,
  },
  {
    fullName: "Pornchai Thana",
    email: "pornchai.than@kmutt.ac.th",
    department: "Library",
    isActive: true,
  },
  {
    fullName: "Suchada Meesuk",
    email: "suchada.mees@kmutt.ac.th",
    department: "Finance",
    isActive: true,
  },
  {
    // Inactive on purpose: proves the selector filters by isActive (AC-01).
    fullName: "Wichai Boonmee",
    email: "wichai.boon@kmutt.ac.th",
    department: "Facilities",
    isActive: false,
  },
];

async function main() {
  const prisma = getPrisma();

  // Categories — unique name keeps the upsert idempotent.
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  // Related Systems — same pattern.
  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  // Development Requesters — email is the unique key, and the one that becomes
  // the natural login field in Lab 3.
  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: {
        fullName: requester.fullName,
        department: requester.department,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  const [categories, relatedSystems, active, inactive] = await Promise.all([
    prisma.category.count(),
    prisma.relatedSystem.count(),
    prisma.requesterUser.count({ where: { isActive: true } }),
    prisma.requesterUser.count({ where: { isActive: false } }),
  ]);

  console.log(
    `Seed complete — ${categories} categories, ${relatedSystems} related systems, ` +
      `${active} active and ${inactive} inactive development requesters.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
