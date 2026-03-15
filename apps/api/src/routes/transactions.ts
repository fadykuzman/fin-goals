import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { fetchAndStoreTransactions } from "../services/transactions";
import { TanRequiredError } from "../services/providers/fints-provider.js";
import { getUserByFirebaseUid } from "../services/users.js";
import { randomUUID } from "crypto";
import logger from "../logger.js";

// Share the pending operations map from accounts route
import { pendingFinTSOperations } from "./accounts.js";

const router = Router();
const prisma = new PrismaClient();

// Fetch and store transactions for a single account
router.post("/api/accounts/:accountId/transactions/refresh", async (req, res) => {
  const { accountId } = req.params;
  const { dateFrom, dateTo } = req.body;
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const account = await prisma.bankAccount.findUniqueOrThrow({ where: { id: accountId } });
    if (account.accountType === "investment") {
      res.json({ status: "success", transactions: [] });
      return;
    }

    const transactions = await fetchAndStoreTransactions(accountId, dateFrom, dateTo);
    await prisma.bankAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
    res.json({ status: "success", transactions });
  } catch (err) {
    if (err instanceof TanRequiredError) {
      const referenceId = randomUUID();
      pendingFinTSOperations.set(referenceId, {
        error: err,
        userId: user.id,
        dateFrom,
        dateTo,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      res.json({
        status: "tan_required",
        referenceId,
        tanChallenge: err.tanChallenge || "Please approve the operation in your banking app",
      });
      return;
    }
    logger.error({ err }, "Failed to refresh transactions");
    res.status(500).json({ error: "Failed to refresh transactions" });
  }
});

export default router;
