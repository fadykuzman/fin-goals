import { PrismaClient } from "@prisma/client";
import { getAccountBalances } from "./gocardless.js";

const prisma = new PrismaClient();

interface GoCardlessBalance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
}

export async function fetchAndStoreBalances(bankAccountId: string) {
  const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
  });

  const response = await getAccountBalances(bankAccount.externalId);
  const balances: GoCardlessBalance[] = response.balances;

  const now = new Date();

  const created = await Promise.all(
    balances.map((b) =>
      prisma.balance.create({
        data: {
          bankAccountId: bankAccount.id,
          amount: b.balanceAmount.amount,
          currency: b.balanceAmount.currency,
          balanceType: b.balanceType,
          fetchedAt: now,
        },
      })
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
      },
    },
  });

  const results = await Promise.all(
    accounts.map((account) => fetchAndStoreBalances(account.id))
  );

  return results.flat();
}
