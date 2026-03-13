import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { calculateGoalProgress } from "../services/goals.js";
import { getUserByFirebaseUid } from "../services/users.js";
import logger from "../logger.js";

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

/** Get the family the user belongs to (if any) */
async function getUserFamily(userId: string) {
  const membership = await prisma.familyMember.findFirst({
    where: { userId },
    include: { family: true },
  });
  return membership?.family ?? null;
}

/** Check if user can access a goal (owns it, or it's a family goal and user is in the same family) */
async function canAccessGoal(userId: string, goal: { userId: string; visibility: string }) {
  if (goal.userId === userId) return true;
  if (goal.visibility !== "family") return false;

  const [userFamily, ownerFamily] = await Promise.all([
    prisma.familyMember.findFirst({ where: { userId } }),
    prisma.familyMember.findFirst({ where: { userId: goal.userId } }),
  ]);

  return userFamily != null && ownerFamily != null && userFamily.familyId === ownerFamily.familyId;
}

const goalInclude = {
  accounts: {
    include: {
      account: {
        include: {
          balances: {
            orderBy: { fetchedAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
  },
};

// Create a goal
router.post("/api/goals", async (req, res) => {
  const { name, goalType, targetAmount, initialAmount, matchPattern, currency, deadline, interval, visibility } = req.body;

  if (!name || targetAmount === undefined || !currency || !deadline || !interval) {
    res.status(400).json({ error: "name, targetAmount, currency, deadline, and interval are required" });
    return;
  }

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  if (goalType === "transaction_based" && !matchPattern) {
    res.status(400).json({ error: "matchPattern is required for transaction-based goals" });
    return;
  }

  if (visibility === "family") {
    const family = await getUserFamily(user.id);
    if (!family) {
      res.status(400).json({ error: "You must be in a family to create a family goal" });
      return;
    }
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        name,
        goalType: goalType || "balance_based",
        visibility: visibility || "personal",
        targetAmount: String(targetAmount),
        initialAmount: initialAmount !== undefined ? String(initialAmount) : "0",
        matchPattern: matchPattern || null,
        currency,
        deadline: new Date(deadline),
        interval,
        userId: user.id,
      },
    });

    res.status(201).json({ goal });
  } catch (err) {
    logger.error({ err }, "Failed to create goal");
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// List goals for a user
router.get("/api/goals", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const filter = req.query.filter as string | undefined;

  try {
    let where;

    if (filter === "personal") {
      // Only the user's personal goals
      where = { userId: user.id, visibility: "personal" as const };
    } else if (filter === "family") {
      // All family-visible goals from the user's family
      const family = await getUserFamily(user.id);
      if (!family) {
        res.json({ goals: [] });
        return;
      }
      const familyMemberIds = (
        await prisma.familyMember.findMany({
          where: { familyId: family.id },
          select: { userId: true },
        })
      ).map((m) => m.userId);

      where = { userId: { in: familyMemberIds }, visibility: "family" as const };
    } else {
      // All: user's own goals + family goals from family members
      const family = await getUserFamily(user.id);
      if (!family) {
        // No family — just the user's own goals
        where = { userId: user.id };
      } else {
        const familyMemberIds = (
          await prisma.familyMember.findMany({
            where: { familyId: family.id },
            select: { userId: true },
          })
        ).map((m) => m.userId);

        where = {
          OR: [
            { userId: user.id },
            { userId: { in: familyMemberIds }, visibility: "family" as const },
          ],
        };
      }
    }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        ...goalInclude,
        user: { select: { id: true, displayName: true } },
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
        visibility: goal.visibility,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        matchPattern: goal.matchPattern,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        accountCount: goal.accounts.length,
        owner: { id: goal.user.id, displayName: goal.user.displayName },
        isOwner: goal.userId === user.id,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        ...progress,
      };
    }));

    res.json({ goals: result });
  } catch (err) {
    logger.error({ err }, "Failed to list goals");
    res.status(500).json({ error: "Failed to list goals" });
  }
});

// Get goal detail with linked accounts and progress
router.get("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

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
                bankConnection: { select: { institutionId: true, userId: true } },
              },
            },
          },
        },
        user: { select: { id: true, displayName: true } },
      },
    });

    if (!(await canAccessGoal(user.id, goal))) {
      res.status(403).json({ error: "You do not have access to this goal" });
      return;
    }

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
        visibility: goal.visibility,
        targetAmount: Number(goal.targetAmount),
        initialAmount: Number(goal.initialAmount),
        matchPattern: goal.matchPattern,
        currency: goal.currency,
        deadline: goal.deadline,
        interval: goal.interval,
        owner: { id: goal.user.id, displayName: goal.user.displayName },
        isOwner: goal.userId === user.id,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        accounts: linkedAccounts,
        ...(matchedTransactions && { matchedTransactions }),
        ...progress,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to get goal");
    res.status(500).json({ error: "Failed to get goal" });
  }
});

// Update a goal
router.patch("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;
  const { name, goalType, targetAmount, initialAmount, matchPattern, currency, deadline, interval, visibility } = req.body;

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const existingGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    if (!(await canAccessGoal(user.id, existingGoal))) {
      res.status(403).json({ error: "You do not have access to this goal" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (goalType !== undefined) data.goalType = goalType;
    if (targetAmount !== undefined) data.targetAmount = String(targetAmount);
    if (initialAmount !== undefined) data.initialAmount = String(initialAmount);
    if (matchPattern !== undefined) data.matchPattern = matchPattern || null;
    if (currency !== undefined) data.currency = currency;
    if (deadline !== undefined) data.deadline = new Date(deadline);
    if (interval !== undefined) data.interval = interval;

    if (visibility !== undefined) {
      if (visibility === "family") {
        const family = await getUserFamily(existingGoal.userId);
        if (!family) {
          res.status(400).json({ error: "Goal owner must be in a family to set visibility to family" });
          return;
        }
      }
      data.visibility = visibility;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    // If switching from family to personal, remove account links from non-owner users
    if (visibility === "personal" && existingGoal.visibility === "family") {
      await prisma.goalAccount.deleteMany({
        where: {
          goalId,
          account: {
            bankConnection: {
              userId: { not: existingGoal.userId },
            },
          },
        },
      });
    }

    const goal = await prisma.goal.update({
      where: { id: goalId },
      data,
    });

    res.json({ goal });
  } catch (err) {
    logger.error({ err }, "Failed to update goal");
    res.status(500).json({ error: "Failed to update goal" });
  }
});

// Delete a goal
router.delete("/api/goals/:goalId", async (req, res) => {
  const { goalId } = req.params;

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    if (!(await canAccessGoal(user.id, goal))) {
      res.status(403).json({ error: "You do not have access to this goal" });
      return;
    }

    await prisma.goal.delete({ where: { id: goalId } });
    res.json({ deleted: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete goal");
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

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    if (!(await canAccessGoal(user.id, goal))) {
      res.status(403).json({ error: "You do not have access to this goal" });
      return;
    }

    const created = await prisma.goalAccount.createMany({
      data: accountIds.map((accountId: string) => ({ goalId, accountId })),
      skipDuplicates: true,
    });

    res.status(201).json({ linked: created.count });
  } catch (err) {
    logger.error({ err }, "Failed to link accounts to goal");
    res.status(500).json({ error: "Failed to link accounts to goal" });
  }
});

// Unlink an account from a goal
router.delete("/api/goals/:goalId/accounts/:accountId", async (req, res) => {
  const { goalId, accountId } = req.params;

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    if (!(await canAccessGoal(user.id, goal))) {
      res.status(403).json({ error: "You do not have access to this goal" });
      return;
    }

    await prisma.goalAccount.delete({
      where: { goalId_accountId: { goalId, accountId } },
    });

    res.json({ unlinked: true });
  } catch (err) {
    logger.error({ err }, "Failed to unlink account from goal");
    res.status(500).json({ error: "Failed to unlink account from goal" });
  }
});

export default router;
