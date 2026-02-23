/**
 * DANGEROUS: wipes packages, destinations, and related images from the database.
 *
 * Usage:
 *   I_UNDERSTAND_THIS_DELETES_DATA=YES pnpm tsx scripts/reset-packages-destinations.ts
 */

import { prisma } from "@/lib/prisma";

async function main() {
  if (process.env.I_UNDERSTAND_THIS_DELETES_DATA !== "YES") {
    throw new Error(
      "Refusing to run. Set I_UNDERSTAND_THIS_DELETES_DATA=YES to confirm."
    );
  }

  // Delete images linked to packages/destinations first (FK constraints)
  await prisma.image.deleteMany({
    where: {
      OR: [{ packageId: { not: null } }, { destinationId: { not: null } }],
    },
  });

  await prisma.booking.deleteMany({});
  await prisma.packageSchedule.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.destination.deleteMany({});

  console.log("✅ Wiped packages, destinations, schedules, bookings, and related images.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

