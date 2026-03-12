import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { calculateGoalProgress } from "../services/goals.js";

const router = Router();
const prisma = new PrismaClient();

function parseMatchPatterns(matchPattern: string): string[] {
  return matchPattern.split(",").map((p) => p.trim()).filter(Boolean);
}

function buildMatchFilter(accountIds: string[], patterns: string[]) {
  return {
    bankAccountId: { in: accountIds },
    OR: patterns.map((p) => ({
      description: { contains: p, mode: "insensitive" as const },
    })),
    amount: { lt: 0 },
  };
}

// Create a goal
router.post("/api/goals", async (req, res) => {
  const { name, goalType, targetAmount, initialAmount, matchPattern, currency, deadline, interval, userId } = req.body;

  if (!name || targetAmount === undefined || !currency || !deadline || !interval || !userId) {
    res.status(400).json({ error: "name, targetAmount, currency, deadline, interval, and userId are required" });
    return;
  }

  if (goalType === "transaction_based" && !matchPattern) {
    res.status(400).json({ error: "matchPattern is required for transaction-based goals" });
    return;
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        name,
        goalType: goalType || "balance_based",
        targetAmount: String(targetAmount),
        initialAmount: initialAmount !== undefined ? String(initialAmount) : "0",
        matchPattern: matchPattern || null,
        currency,
        deadline: new Date(deadline),
        interval,
        userId,
      },
    });

    res.status(201).json({ goal });
  } catch (err) {
    console.error("Failed to create goal:", err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// List goals for a user
router.get("/api/goals", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  try {
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: {
        accounts: {
          include: {
            account: {
              include: {
                balances: {
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await Promise.all(goals.map(async (goal) => {
      let progress;

      if (goal.goalType === "transaction_based" && goal.matchPattern) {
        const accountIds = goal.accounts.map((ga) => ga.accountId);
        const patterns = parseMatchPatterns(goal.matchPattern);
        const matchedTransactions = accountIds.length > 0 && patterns.length > 0
          ? await prisma.transaction.findMany({ where: buildMatchFilter(accountIds, patterns) })
          : [];
        progress = calculateGoalProgress({
          goalType: "transaction_based",
          targetAmount: goal.targetAmount,
          initialAmount: goal.initialAmount,
          deadline: goal.deadline,
          interval: goal.interval,
          matchedTransactions,
        });
      } else {
        progress = calculateGoalProgress({
          goalType: "balance_based",
          targetAmount: goal.targetAmount,
          initialAmount: goal.initialAmount,
          deadline: goal.deadline,
          interval: goal.interval,
          accounts: goal.accounts,
        });
      }

      return {
        id: goal.id,
        name: goal.name,
        goalType: goal.goalType,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        matchPattern: goal.matchPattern,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        accountCount: goal.accounts.length,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        ...progress,
      };
    }));

    res.json({ goals: result });
  } catch (err) {
    console.error("Failed to list goals:", err);
    res.status(500).json({ error: "Failed to list goals" });
  }
});

// Get goal detail with linked accounts and progress
router.get("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;

  try {
    const goal = await prisma.goal.findUniqueOrThrow({
      where: { id: goalId },
      include: {
        accounts: {
          include: {
            account: {
              include: {
                balances: {
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                },
                bankConnection: { select: { institutionId: true } },
              },
            },
          },
        },
      },
    });

    const linkedAccounts = goal.accounts.map((ga) => {
      const latest = ga.account.balances[0] ?? null;
      return {
        accountId: ga.account.id,
        name: ga.account.name || ga.account.ownerName || ga.account.bankConnection.institutionId,
        accountType: ga.account.accountType,
        amount: latest ? Number(latest.amount) : 0,
        currency: latest?.currency ?? null,
      };
    });

    let progress;
    let matchedTransactions: Array<{
      id: string;
      amount: number;
      currency: string;
      description: string;
      date: Date;
      accountName: string | null;
    }> | undefined;

    if (goal.goalType === "transaction_based" && goal.matchPattern) {
      const accountIds = goal.accounts.map((ga) => ga.accountId);
      const patterns = parseMatchPatterns(goal.matchPattern);
      const txs = accountIds.length > 0 && patterns.length > 0
        ? await prisma.transaction.findMany({
            where: buildMatchFilter(accountIds, patterns),
            include: { bankAccount: { select: { name: true, ownerName: true, bankConnection: { select: { institutionId: true } } } } },
            orderBy: { date: "desc" },
          })
        : [];
      progress = calculateGoalProgress({
        goalType: "transaction_based",
        targetAmount: goal.targetAmount,
        initialAmount: goal.initialAmount,
        deadline: goal.deadline,
        interval: goal.interval,
        matchedTransactions: txs,
      });
      matchedTransactions = txs.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        currency: tx.currency,
        description: tx.description,
        date: tx.date,
        accountName: tx.bankAccount.name || tx.bankAccount.ownerName || tx.bankAccount.bankConnection.institutionId,
      }));
    } else {
      progress = calculateGoalProgress({
        goalType: "balance_based",
        targetAmount: goal.targetAmount,
        initialAmount: goal.initialAmount,
        deadline: goal.deadline,
        interval: goal.interval,
        accounts: goal.accounts,
      });
    }

    res.json({
      goal: {
        id: goal.id,
        name: goal.name,
        goalType: goal.goalType,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        matchPattern: goal.matchPattern,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        accounts: linkedAccounts,
        ...(matchedTransactions && { matchedTransactions }),
        ...progress,
      },
    });
  } catch (err) {
    console.error("Failed to get goal:", err);
    res.status(500).json({ error: "Failed to get goal" });
  }
});

// Update a goal
router.patch("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;
  const { name, goalType, targetAmount, initialAmount, matchPattern, currency, deadline, interval } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (goalType !== undefined) data.goalType = goalType;
  if (targetAmount !== undefined) data.targetAmount = String(targetAmount);
  if (initialAmount !== undefined) data.initialAmount = String(initialAmount);
  if (matchPattern !== undefined) data.matchPattern = matchPattern || null;
  if (currency !== undefined) data.currency = currency;
  if (deadline !== undefined) data.deadline = new Date(deadline);
  if (interval !== undefined) data.interval = interval;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const goal = await prisma.goal.update({
      where: { id: goalId },
      data,
    });

    res.json({ goal });
  } catch (err) {
    console.error("Failed to update goal:", err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// Delete a goal
router.delete("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;

  try {
    await prisma.goal.delete({ where: { id: goalId } });
    res.json({ deleted: true });
  } catch (err) {
    console.error("Failed to delete goal:", err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

// Link accounts to a goal
router.post("/api/goals/:goalId/accounts", async (req, res) => {
  const { goalId } = req.params;
  const { accountIds } = req.body;

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    res.status(400).json({ error: "accountIds (non-empty array) is required" });
    return;
  }

  try {
    await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    const created = await prisma.goalAccount.createMany({
      data: accountIds.map((accountId: string) => ({ goalId, accountId })),
      skipDuplicates: true,
    });

    res.status(201).json({ linked: created.count });
  } catch (err) {
    console.error("Failed to link accounts to goal:", err);
    res.status(500).json({ error: "Failed to link accounts to goal" });
  }
});

// Unlink an account from a goal
router.delete("/api/goals/:goalId/accounts/:accountId", async (req, res) => {
  const { goalId, accountId } = req.params;

  try {
    await prisma.goalAccount.delete({
      where: { goalId_accountId: { goalId, accountId } },
    });

    res.json({ unlinked: true });
  } catch (err) {
    console.error("Failed to unlink account from goal:", err);
    res.status(500).json({ error: "Failed to unlink account from goal" });
  }
});

export default router;
