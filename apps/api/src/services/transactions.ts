import { PrismaClient } from "@prisma/client";
import { getProvider } from "./providers/registry.js";

const prisma = new PrismaClient();

function defaultDateFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split("T")[0];
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function fetchAndStoreTransactions(
  bankAccountId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { bankConnection: true },
  });

  const provider = getProvider(bankAccount.bankConnection.provider);
  const transactions = await provider.fetchTransactions(
    bankAccount.externalId,
    dateFrom || defaultDateFrom(),
    dateTo || todayDate()
  );

  const created = [];

  for (const tx of transactions) {
    if (!tx.externalId) continue;

    const existing = await prisma.transaction.findUnique({
      where: { externalId: tx.externalId },
    });

    if (existing) continue;

    const record = await prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        externalId: tx.externalId,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        date: new Date(tx.date),
      },
    });

    created.push(record);
  }

  return created;
}
