import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { fetchAndStoreBalances, refreshAllBalances } from "../services/balances";
import { TanRequiredError } from "../services/providers/fints-provider.js";
import { getUserByFirebaseUid } from "../services/users.js";
import { randomUUID } from "crypto";
import logger from "../logger.js";

const router = Router();
const prisma = new PrismaClient();

// In-memory store for pending FinTS TAN operations (exported for use by transactions route)
export const pendingFinTSOperations = new Map<string, {
  error: TanRequiredError;
  userId: string;
  dateFrom?: string;
  dateTo?: string;
  expiresAt: number;
}>();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingFinTSOperations) {
    if (session.expiresAt < now) {
      pendingFinTSOperations.delete(key);
    }
  }
}, 5 * 60 * 1000);

// --- Static routes (must be before :accountId parameterized routes) ---

// Refresh balances for all accounts of a user
router.post("/api/accounts/balances/refresh", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const balances = await refreshAllBalances(user.id);
    res.json({ status: "success", balances });
  } catch (err) {
    if (err instanceof TanRequiredError) {
      const referenceId = randomUUID();
      pendingFinTSOperations.set(referenceId, {
        error: err,
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      res.json({
        status: "tan_required",
        referenceId,
        tanChallenge: err.tanChallenge || "Please approve the operation in your banking app",
      });
      return;
    }
    logger.error({ err }, "Failed to refresh all balances");
    res.status(500).json({ error: "Failed to refresh balances" });
  }
});

// Poll for FinTS TAN approval on balance/transaction operations
router.post("/api/accounts/fints/poll", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const { referenceId } = req.body;
  if (!referenceId) {
    res.status(400).json({ error: "referenceId is required" });
    return;
  }

  const session = pendingFinTSOperations.get(referenceId);
  if (!session) {
    res.status(404).json({ error: "No pending operation found — it may have expired" });
    return;
  }

  if (session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (session.expiresAt < Date.now()) {
    pendingFinTSOperations.delete(referenceId);
    res.status(410).json({ error: "Operation expired — please try again" });
    return;
  }

  const { error: tanError } = session;

  try {
    logger.info({ referenceId, operation: tanError.operation }, "FinTS operation poll: checking TAN");
    if (tanError.operation === "balance") {
      const response = await tanError.client.getAccountBalanceWithTan(tanError.tanReference);

      if (response.requiresTan) {
        logger.debug({ referenceId }, "FinTS operation poll: balance still pending");
        res.json({ status: "pending" });
        return;
      }

      pendingFinTSOperations.delete(referenceId);

      if (!response.success || !response.balance) {
        logger.error({ referenceId }, "FinTS balance fetch failed after TAN");
        res.status(502).json({ error: "FinTS balance fetch failed after TAN approval" });
        return;
      }

      // Persist updated bankingInformation if changed
      if (response.bankingInformationUpdated) {
        await prisma.bankConnection.update({
          where: { id: tanError.connectionId },
          data: { providerData: JSON.parse(JSON.stringify(tanError.client.config.bankingInformation)) },
        });
      }

      // Store the balance
      const balance = await prisma.balance.create({
        data: {
          bankAccountId: tanError.accountId,
          amount: String(response.balance.balance),
          currency: response.balance.currency,
          balanceType: "bookedBalance",
        },
      });

      logger.info({ referenceId, balance: response.balance.balance }, "FinTS operation poll: balance stored");
      res.json({ status: "success", balances: [balance] });
    } else {
      // transactions
      const response = await tanError.client.getAccountStatementsWithTan(tanError.tanReference);

      if (response.requiresTan) {
        logger.debug({ referenceId }, "FinTS operation poll: transactions still pending");
        res.json({ status: "pending" });
        return;
      }

      pendingFinTSOperations.delete(referenceId);

      if (!response.success) {
        logger.error({ referenceId }, "FinTS transaction fetch failed after TAN");
        res.status(502).json({ error: "FinTS transaction fetch failed after TAN approval" });
        return;
      }

      // Persist updated bankingInformation if changed
      if (response.bankingInformationUpdated) {
        await prisma.bankConnection.update({
          where: { id: tanError.connectionId },
          data: { providerData: JSON.parse(JSON.stringify(tanError.client.config.bankingInformation)) },
        });
      }

      // Store transactions (dedup by externalId)
      const account = await prisma.bankAccount.findUniqueOrThrow({
        where: { id: tanError.accountId },
      });

      const created = [];
      for (const stmt of response.statements) {
        for (const tx of stmt.transactions) {
          const externalId = tx.bankReference || tx.customerReference || `${account.externalId}-${tx.entryDate.toISOString()}-${tx.amount}`;

          const existing = await prisma.transaction.findUnique({
            where: { externalId },
          });
          if (existing) continue;

          const record = await prisma.transaction.create({
            data: {
              bankAccountId: account.id,
              externalId,
              amount: String(tx.amount),
              currency: stmt.closingBalance.currency,
              description: tx.purpose || tx.bookingText || "",
              date: tx.entryDate,
            },
          });
          created.push(record);
        }
      }

      await prisma.bankAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });

      logger.info({ referenceId, transactionCount: created.length }, "FinTS operation poll: transactions stored");
      res.json({ status: "success", transactions: created });
    }
  } catch (err) {
    pendingFinTSOperations.delete(referenceId);
    logger.error({ err }, "Failed to poll FinTS TAN operation");
    res.status(500).json({ error: "Failed to complete FinTS operation" });
  }
});

// --- Parameterized routes ---

// Refresh balances for a single account
router.post("/api/accounts/:accountId/balances/refresh", async (req, res) => {
  const { accountId } = req.params;
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const balances = await fetchAndStoreBalances(accountId);
    res.json({ status: "success", balances });
  } catch (err) {
    if (err instanceof TanRequiredError) {
      const referenceId = randomUUID();
      pendingFinTSOperations.set(referenceId, {
        error: err,
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      res.json({
        status: "tan_required",
        referenceId,
        tanChallenge: err.tanChallenge || "Please approve the operation in your banking app",
      });
      return;
    }
    logger.error({ err }, "Failed to refresh balances");
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
