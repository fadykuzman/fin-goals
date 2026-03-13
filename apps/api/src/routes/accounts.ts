import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { fetchAndStoreBalances, refreshAllBalances } from "../services/balances";
import { getUserByFirebaseUid } from "../services/users.js";
import logger from "../logger.js";

const router = Router();
const prisma = new PrismaClient();

// Refresh balances for a single account
router.post("/api/accounts/:accountId/balances/refresh", async (req, res) => {
  const { accountId } = req.params;

  try {
    const balances = await fetchAndStoreBalances(accountId);
    res.json({ balances });
  } catch (err) {
    logger.error({ err }, "Failed to refresh balances");
    res.status(500).json({ error: "Failed to refresh balances" });
  }
});

// Refresh balances for all accounts of a user
router.post("/api/accounts/balances/refresh", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const balances = await refreshAllBalances(user.id);
    res.json({ balances });
  } catch (err) {
    logger.error({ err }, "Failed to refresh all balances");
    res.status(500).json({ error: "Failed to refresh balances" });
  }
});

// Manually record a balance snapshot
router.post("/api/accounts/:accountId/balances", async (req, res) => {
  const { accountId } = req.params;
  const { amount, currency, gainAmount, gainPercentage } = req.body;

  if (amount === undefined || !currency) {
    res.status(400).json({ error: "amount and currency are required" });
    return;
  }

  try {
    const account = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: accountId },
    });

    const balance = await prisma.balance.create({
      data: {
        bankAccountId: account.id,
        amount: String(amount),
        currency,
        balanceType: "manual",
        gainAmount: gainAmount !== undefined ? String(gainAmount) : null,
        gainPercentage: gainPercentage !== undefined ? String(gainPercentage) : null,
      },
    });

    res.json({ balance });
  } catch (err) {
    logger.error({ err }, "Failed to create manual balance");
    res.status(500).json({ error: "Failed to create manual balance" });
  }
});

export default router;
