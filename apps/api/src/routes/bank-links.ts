import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { client, getAccessToken } from "../services/gocardless";
import { randomUUID } from "crypto";

const router = Router();
const prisma = new PrismaClient();

// Initiate bank linking
router.post("/api/bank-links", async (req, res) => {
  const { institutionId, userId, redirectUrl } = req.body;

  if (!institutionId || !userId || !redirectUrl) {
    res.status(400).json({
      error: "institutionId, userId, and redirectUrl are required",
    });
    return;
  }

  try {
    await getAccessToken();

    const referenceId = randomUUID();
    const requisition = await client.initSession({
      redirectUrl,
      institutionId,
      referenceId,
    });

    await prisma.bankConnection.create({
      data: {
        userId,
        institutionId,
        requisitionId: requisition.id,
        referenceId,
        status: "pending",
      },
    });

    res.json({
      link: requisition.link,
      requisitionId: requisition.id,
    });
  } catch (err) {
    console.error("Failed to initiate bank link:", err);
    res.status(500).json({ error: "Failed to initiate bank link" });
  }
});

// Callback after user authorizes at their bank
router.get("/api/bank-links/callback", async (req, res) => {
  const { ref: referenceId } = req.query;

  if (!referenceId || typeof referenceId !== "string") {
    res.status(400).json({ error: "ref query param required" });
    return;
  }

  try {
    await getAccessToken();

    const connection = await prisma.bankConnection.findUniqueOrThrow({
      where: { referenceId },
    });

    const requisition = await client.requisition.getRequisitionById(
      connection.requisitionId
    );

    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: { status: "linked" },
    });

    const accountRecords = await Promise.all(
      requisition.accounts.map((externalId: string) =>
        prisma.bankAccount.create({
          data: {
            externalId,
            bankConnectionId: connection.id,
          },
        })
      )
    );

    res.json({
      connectionId: connection.id,
      accounts: accountRecords.map((a) => a.externalId),
    });
  } catch (err) {
    console.error("Failed to process bank link callback:", err);
    res.status(500).json({ error: "Failed to process callback" });
  }
});

export default router;
