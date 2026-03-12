import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { fetchAndStoreTransactions } from "../services/transactions";

const router = Router();
const prisma = new PrismaClient();

// Fetch and store transactions for a single account
router.post("/api/accounts/:accountId/transactions/refresh", async (req, res) => {
  const { accountId } = req.params;
  const { dateFrom, dateTo } = req.body;

  try {
    const transactions = await fetchAndStoreTransactions(accountId, dateFrom, dateTo);
    await prisma.bankAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
    res.json({ transactions });
  } catch (err) {
    console.error("Failed to refresh transactions:", err);
    res.status(500).json({ error: "Failed to refresh transactions" });
  }
});

export default router;
