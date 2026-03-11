import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Get aggregated balance summary for a user
router.get("/api/balances/summary", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { bankConnection: { userId } },
      include: {
        balances: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
        },
      },
    });

    let total = 0;
    const breakdown = accounts.map((account) => {
      const latestBalance = account.balances[0] ?? null;
      const amount = latestBalance ? Number(latestBalance.amount) : 0;
      const currency = latestBalance?.currency ?? null;

      if (account.includedInTotal && latestBalance) {
        total += amount;
      }

      return {
        accountId: account.id,
        externalId: account.externalId,
        name: account.name,
        ownerName: account.ownerName,
        includedInTotal: account.includedInTotal,
        amount,
        currency,
      };
    });

    res.json({ total, accounts: breakdown });
  } catch (err) {
    console.error("Failed to fetch balance summary:", err);
    res.status(500).json({ error: "Failed to fetch balance summary" });
  }
});

// Toggle include/exclude for an account
router.patch("/api/accounts/:accountId/include", async (req, res) => {
  const { accountId } = req.params;
  const { included } = req.body;

  if (typeof included !== "boolean") {
    res.status(400).json({ error: "included (boolean) is required in body" });
    return;
  }

  try {
    const account = await prisma.bankAccount.update({
      where: { id: accountId },
      data: { includedInTotal: included },
    });

    res.json({ accountId: account.id, includedInTotal: account.includedInTotal });
  } catch (err) {
    console.error("Failed to update account include flag:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

export default router;
