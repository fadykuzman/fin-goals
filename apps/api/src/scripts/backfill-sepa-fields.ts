import { PrismaClient } from "@prisma/client";
import { parseSepaDescription } from "../services/transactions.js";

const prisma = new PrismaClient();

async function backfill() {
  const transactions = await prisma.transaction.findMany();
  let updated = 0;

  for (const tx of transactions) {
    const sepa = parseSepaDescription(tx.description);
    if (!sepa.mandateReference && !sepa.creditorId && !sepa.remittanceInformation) continue;

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        description: sepa.description,
        mandateReference: sepa.mandateReference,
        creditorId: sepa.creditorId,
        remittanceInformation: sepa.remittanceInformation,
      },
    });
    updated++;
  }

  console.log(`Backfilled ${updated} of ${transactions.length} transactions`);
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
