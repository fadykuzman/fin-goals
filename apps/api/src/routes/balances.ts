import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserByFirebaseUid } from "../services/users.js";
import logger from "../logger.js";

const prisma = new PrismaClient();
const router = Router();

// Get aggregated balance summary for a user
router.get("/api/balances/summary", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const filter = req.query.filter as string | undefined;
  if (filter && filter !== "personal" && filter !== "family") {
    res.status(400).json({ error: "filter must be 'personal' or 'family'" });
    return;
  }

  try {
    // Find user's family membership
    const membership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: {
        family: {
          include: {
            members: {
              include: { user: { select: { id: true, displayName: true } } },
            },
          },
        },
      },
    });

    // Determine which user IDs to include
    let memberUsers: { id: string; displayName: string }[];
    if (!membership) {
      // No family — always return just the user's own accounts
      memberUsers = [{ id: user.id, displayName: user.displayName }];
    } else if (filter === "personal") {
      memberUsers = [{ id: user.id, displayName: user.displayName }];
    } else if (filter === "family") {
      memberUsers = membership.family.members
        .filter((m) => m.userId !== user.id)
        .map((m) => ({ id: m.user.id, displayName: m.user.displayName }));
    } else {
      // No filter — all members including the user
      memberUsers = membership.family.members.map((m) => ({
        id: m.user.id,
        displayName: m.user.displayName,
      }));
    }

    const userIds = memberUsers.map((m) => m.id);

    // Fetch accounts with latest balances for all target users
    const accounts = await prisma.bankAccount.findMany({
      where: { bankConnection: { userId: { in: userIds } } },
      include: {
        balances: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
        },
        bankConnection: {
          select: { userId: true },
        },
      },
    });

    // Group by member
    let total = 0;
    const memberMap = new Map<string, { displayName: string; subtotal: number; accounts: any[] }>();

    for (const mu of memberUsers) {
      memberMap.set(mu.id, { displayName: mu.displayName, subtotal: 0, accounts: [] });
    }

    for (const account of accounts) {
      const ownerId = account.bankConnection.userId;
      const isCurrentUser = ownerId === user.id;
      const latestBalance = account.balances[0] ?? null;
      const amount = latestBalance ? Number(latestBalance.amount) : 0;
      const currency = latestBalance?.currency ?? null;

      // Current user's accounts respect includedInTotal; family members' accounts always included
      const countsTowardTotal = isCurrentUser ? account.includedInTotal && !!latestBalance : !!latestBalance;

      if (countsTowardTotal) {
        total += amount;
      }

      const member = memberMap.get(ownerId);
      if (member) {
        if (countsTowardTotal) {
          member.subtotal += amount;
        }
        member.accounts.push({
          accountId: account.id,
          externalId: account.externalId,
          name: account.name,
          ownerName: account.ownerName,
          includedInTotal: isCurrentUser ? account.includedInTotal : true,
          amount,
          currency,
        });
      }
    }

    const members = memberUsers.map((mu) => {
      const entry = memberMap.get(mu.id)!;
      return {
        userId: mu.id,
        displayName: entry.displayName,
        isCurrentUser: mu.id === user.id,
        subtotal: entry.subtotal,
        accounts: entry.accounts,
      };
    });

    res.json({ total, members });
  } catch (err) {
    logger.error({ err }, "Failed to fetch balance summary");
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
    logger.error({ err }, "Failed to update account include flag");
    res.status(500).json({ error: "Failed to update account" });
  }
});

export default router;
