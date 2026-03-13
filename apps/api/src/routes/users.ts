import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../firebase.js";
import logger from "../logger.js";

const router = Router();
const prisma = new PrismaClient();

// Register a new user
router.post("/api/register", async (req, res) => {
  const firebaseUid = req.uid!;
  const { displayName, email } = req.body;

  if (!displayName || !email) {
    res.status(400).json({ error: "displayName and email are required" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { firebaseUid } });
    if (existing) {
      res.status(409).json({ error: "User already registered" });
      return;
    }

    const user = await prisma.user.create({
      data: { firebaseUid, displayName, email },
    });

    res.status(201).json({ user });
  } catch (err) {
    logger.error({ err }, "Failed to register user");
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Delete the authenticated user's account and all associated data
// Handles 4 cases based on family membership (#43)
router.delete("/api/account", async (req, res) => {
  const firebaseUid = req.uid!;

  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) {
      // No local user — just delete Firebase user
      await auth.deleteUser(firebaseUid);
      res.status(204).end();
      return;
    }

    // Check family membership
    const membership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: {
        family: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (membership) {
      const family = membership.family;
      const isOwner = family.ownerId === user.id;

      // Case 3: Owner with other members — block deletion
      if (isOwner && family._count.members > 1) {
        res.status(409).json({
          error: "Must transfer ownership before deleting account",
        });
        return;
      }

      // Case 2: Owner, sole member — delete family first
      if (isOwner && family._count.members === 1) {
        await prisma.$transaction(async (tx) => {
          await tx.family.delete({ where: { id: family.id } });
          await tx.user.delete({ where: { id: user.id } });
        });
      } else {
        // Case 4: Non-owner member
        await prisma.$transaction(async (tx) => {
          // Transfer family-visible goals to family owner
          await tx.goal.updateMany({
            where: { userId: user.id, visibility: "family" },
            data: { userId: family.ownerId },
          });

          // Remove GoalAccount links where the account belongs to this user
          const userAccountIds = await tx.bankAccount.findMany({
            where: { bankConnection: { userId: user.id } },
            select: { id: true },
          });
          if (userAccountIds.length > 0) {
            await tx.goalAccount.deleteMany({
              where: { accountId: { in: userAccountIds.map((a) => a.id) } },
            });
          }

          // Remove family membership
          await tx.familyMember.delete({
            where: {
              familyId_userId: { familyId: family.id, userId: user.id },
            },
          });

          // Delete user (cascades bank connections, accounts, personal goals, etc.)
          await tx.user.delete({ where: { id: user.id } });
        });
      }
    } else {
      // Case 1: No family — simple cascade delete
      await prisma.user.delete({ where: { id: user.id } });
    }

    await auth.deleteUser(firebaseUid);
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
