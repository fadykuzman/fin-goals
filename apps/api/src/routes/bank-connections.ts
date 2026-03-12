import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// List bank connections for a user
router.get("/api/bank-connections", async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  try {
    const connections = await prisma.bankConnection.findMany({
      where: { userId },
      include: {
        accounts: {
          select: { id: true, externalId: true, name: true, ownerName: true, lastSyncedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      connections: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        institutionId: c.institutionId,
        status: c.status,
        createdAt: c.createdAt,
        accounts: c.accounts,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch bank connections:", err);
    res.status(500).json({ error: "Failed to fetch bank connections" });
  }
});

// Delete a bank connection (cascades to accounts and balances)
router.delete("/api/bank-connections/:connectionId", async (req, res) => {
  const { connectionId } = req.params;

  try {
    const connection = await prisma.bankConnection.findUnique({
      where: { id: connectionId },
      include: { accounts: { select: { id: true } } },
    });

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const accountIds = connection.accounts.map((a) => a.id);

    await prisma.$transaction([
      prisma.balance.deleteMany({ where: { bankAccountId: { in: accountIds } } }),
      prisma.bankAccount.deleteMany({ where: { bankConnectionId: connectionId } }),
      prisma.bankConnection.delete({ where: { id: connectionId } }),
    ]);

    res.json({ deleted: connectionId });
  } catch (err) {
    console.error("Failed to delete bank connection:", err);
    res.status(500).json({ error: "Failed to delete bank connection" });
  }
});

export default router;
