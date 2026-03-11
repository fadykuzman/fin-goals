import { PrismaClient } from "@prisma/client";
import { getProvider } from "./providers/registry.js";

const prisma = new PrismaClient();

export async function fetchAndStoreBalances(bankAccountId: string) {
  const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { bankConnection: true },
  });

  const provider = getProvider(bankAccount.bankConnection.provider);
  const data = await provider.fetchAccountData(bankAccount.externalId);

  const now = new Date();

  const balanceRecords =
    data.type === "investment"
      ? data.balances.map((b) => ({
          bankAccountId: bankAccount.id,
          amount: b.amount,
          currency: b.currency,
          balanceType: b.balanceType,
          gainAmount: b.gainAmount,
          gainPercentage: b.gainPercentage,
          fetchedAt: now,
        }))
      : data.balances.map((b) => ({
          bankAccountId: bankAccount.id,
          amount: b.amount,
          currency: b.currency,
          balanceType: b.balanceType,
          gainAmount: null,
          gainPercentage: null,
          fetchedAt: now,
        }));

  const created = await Promise.all(
    balanceRecords.map((record) =>
      prisma.balance.create({ data: record })
    )
  );

  return created;
}

export async function refreshAllBalances(userId: string) {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      bankConnection: {
        userId,
        status: "linked",
        provider: { not: "manual" },
      },
    },
  });

  const results = await Promise.all(
    accounts.map((account) => fetchAndStoreBalances(account.id))
  );

  return results.flat();
}
