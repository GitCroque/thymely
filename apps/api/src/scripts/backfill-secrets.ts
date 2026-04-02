import "dotenv/config";

import { backfillEncryptedSecrets } from "../lib/security/backfill";
import { prisma } from "../prisma";

async function main() {
  await prisma.$connect();
  await backfillEncryptedSecrets();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
