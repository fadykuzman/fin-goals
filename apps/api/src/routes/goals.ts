import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Create a goal
router.post("/api/goals", async (req, res) => {
  const { name, targetAmount, initialAmount, currency, deadline, interval, userId } = req.body;

  if (!name || targetAmount === undefined || !currency || !deadline || !interval || !userId) {
    res.status(400).json({ error: "name, targetAmount, currency, deadline, interval, and userId are required" });
    return;
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        name,
        targetAmount: String(targetAmount),
        initialAmount: initialAmount !== undefined ? String(initialAmount) : "0",
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

    const result = goals.map((goal) => {
      const linkedBalance = goal.accounts.reduce((sum, ga) => {
        const latest = ga.account.balances[0];
        return sum + (latest ? Number(latest.amount) : 0);
      }, 0);
      const currentAmount = Number(goal.initialAmount) + linkedBalance;

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        currentAmount,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        accountCount: goal.accounts.length,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      };
    });

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
        name: ga.account.name,
        accountType: ga.account.accountType,
        amount: latest ? Number(latest.amount) : 0,
        currency: latest?.currency ?? null,
      };
    });

    const linkedBalance = linkedAccounts.reduce((sum, a) => sum + a.amount, 0);
    const currentAmount = Number(goal.initialAmount) + linkedBalance;

    res.json({
      goal: {
        id: goal.id,
        name: goal.name,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        currentAmount,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        accounts: linkedAccounts,
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
  const { name, targetAmount, initialAmount, currency, deadline, interval } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (targetAmount !== undefined) data.targetAmount = String(targetAmount);
  if (initialAmount !== undefined) data.initialAmount = String(initialAmount);
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
