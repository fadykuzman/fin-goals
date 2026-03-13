import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { client, getAccessToken } from "../services/gocardless";
import { PinTanClient } from "node-fints";
import { randomUUID } from "crypto";
import { getUserByFirebaseUid } from "../services/users.js";

const router = Router();
const prisma = new PrismaClient();

// Initiate bank linking
router.post("/api/bank-links", async (req, res) => {
  const { institutionId, redirectUrl } = req.body;

  if (!institutionId || !redirectUrl) {
    res.status(400).json({
      error: "institutionId and redirectUrl are required",
    });
    return;
  }

  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  try {
    await getAccessToken();

    const referenceId = randomUUID();

    const requisition = await client.initSession({
      redirectUrl,
      institutionId,
      referenceId,
      maxHistoricalDays: 90,
      accessValidForDays: 30,
      userLanguage: "EN",
      ssn: "",
      redirectImmediate: false,
      accountSelection: false,
    });

    // Store pending connection so the callback can look up the userId by referenceId
    await prisma.bankConnection.create({
      data: {
        userId: user.id,
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
  console.log("Callback hit. Full URL:", req.originalUrl);
  console.log("Query params:", req.query);

  const { ref: referenceId } = req.query;

  if (!referenceId || typeof referenceId !== "string") {
    res.status(400).send(errorPage("Missing reference ID."));
    return;
  }

  try {
    // Look up the pending connection by referenceId (server-side state, see ADR-004)
    const pendingConnection = await prisma.bankConnection.findUnique({
      where: { referenceId },
    });

    if (!pendingConnection || pendingConnection.status !== "pending") {
      res.status(400).send(errorPage("Unknown or already completed bank link."));
      return;
    }

    await getAccessToken();

    // Find the requisition at GoCardless using the reference ID
    const requisitions = await client.requisition.getRequisitions();
    const requisition = requisitions.results.find(
      (r: any) => r.reference === referenceId
    );

    if (!requisition || !requisition.accounts?.length) {
      res.status(400).send(errorPage("Bank authorization was not completed."));
      return;
    }

    // Fetch account details from GoCardless
    const accountDetails = await Promise.all(
      requisition.accounts.map(async (externalId: string) => {
        try {
          const details = await client.account(externalId).getDetails();
          return {
            externalId,
            name: details.account?.name || null,
            ownerName: details.account?.ownerName || null,
          };
        } catch {
          return { externalId, name: null, ownerName: null };
        }
      })
    );

    // Update pending connection to linked and create accounts
    const connection = await prisma.bankConnection.update({
      where: { id: pendingConnection.id },
      data: {
        status: "linked",
        accounts: {
          create: accountDetails,
        },
      },
      include: { accounts: true },
    });

    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bank Linked</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{text-align:center;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#2e7d32;margin-bottom:0.5rem}p{color:#555}</style>
</head><body><div class="card"><h1>Bank Connected</h1>
<p>${connection.accounts.length} account(s) linked successfully.</p>
<p>You can now return to the app.</p></div></body></html>`);
  } catch (err) {
    console.error("Failed to process bank link callback:", err);
    res.status(500).send(errorPage("Failed to link your bank. Please try again from the app."));
  }
});

// Initiate FinTS bank linking (credential-based, no redirect)
router.post("/api/bank-links/fints", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const url = process.env.FINTS_URL || "";
  const blz = process.env.FINTS_BLZ || "";
  const name = process.env.FINTS_USERNAME || "";
  const pin = process.env.FINTS_PIN || "";
  const productId = process.env.FINTS_PRODUCT_ID || "";

  if (!url || !blz || !name || !pin || !productId) {
    res.status(500).json({ error: "FinTS credentials not configured on server" });
    return;
  }

  try {
    const fintsClient = new PinTanClient({ url, blz, name, pin, productId });
    const accounts = await fintsClient.accounts();

    if (!accounts.length) {
      res.status(400).json({ error: "No accounts found via FinTS" });
      return;
    }

    const referenceId = randomUUID();
    const requisitionId = `fints-${referenceId}`;

    const connection = await prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: "fints",
        institutionId: `ING_${blz}`,
        requisitionId,
        referenceId,
        status: "linked",
        accounts: {
          create: accounts.map((a) => ({
            externalId: a.iban,
            name: a.accountName || null,
            ownerName: a.accountOwnerName || null,
            accountType: "cash",
          })),
        },
      },
      include: { accounts: true },
    });

    res.json({
      connectionId: connection.id,
      accounts: connection.accounts.map((a) => ({
        id: a.id,
        externalId: a.externalId,
        name: a.name,
        ownerName: a.ownerName,
        accountType: a.accountType,
      })),
    });
  } catch (err) {
    console.error("Failed to link via FinTS:", err);
    res.status(500).json({ error: "Failed to connect via FinTS" });
  }
});

// Manual bank linking (no external provider)
router.post("/api/bank-links/manual", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const { accounts } = req.body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    res.status(400).json({ error: "accounts array is required and must not be empty" });
    return;
  }

  for (const a of accounts) {
    if (!a.name) {
      res.status(400).json({ error: "Each account must have a name" });
      return;
    }
    if (a.accountType && !["cash", "investment"].includes(a.accountType)) {
      res.status(400).json({ error: "accountType must be 'cash' or 'investment'" });
      return;
    }
  }

  try {
    const referenceId = randomUUID();

    const connection = await prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: "manual",
        institutionId: "MANUAL",
        requisitionId: `manual-${referenceId}`,
        referenceId,
        status: "linked",
        accounts: {
          create: accounts.map((a: { name: string; accountType?: string }) => ({
            externalId: `manual-${randomUUID()}`,
            name: a.name,
            accountType: a.accountType || "cash",
          })),
        },
      },
      include: { accounts: true },
    });

    res.json({
      connectionId: connection.id,
      accounts: connection.accounts.map((a) => ({
        id: a.id,
        externalId: a.externalId,
        name: a.name,
        accountType: a.accountType,
      })),
    });
  } catch (err) {
    console.error("Failed to create manual bank link:", err);
    res.status(500).json({ error: "Failed to create manual bank link" });
  }
});

function errorPage(message: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
.card{text-align:center;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#c62828;margin-bottom:0.5rem}p{color:#555}</style>
</head><body><div class="card"><h1>Something went wrong</h1>
<p>${message}</p></div></body></html>`;
}

export default router;
