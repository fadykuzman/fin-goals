import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { client, getAccessToken } from "../services/gocardless";
import { FinTSClient, FinTSConfig, AccountType } from "lib-fints";
import { randomUUID } from "crypto";
import { getUserByFirebaseUid } from "../services/users.js";
import { encrypt } from "../services/crypto.js";
import logger from "../logger.js";

const router = Router();
const prisma = new PrismaClient();

// In-memory store for pending FinTS TAN sessions (referenceId → client + context)
const pendingFinTSSessions = new Map<string, {
  client: FinTSClient;
  tanReference: string;
  userId: string;
  blz: string;
  encryptedUsername: string;
  encryptedPin: string;
  expiresAt: number;
}>();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingFinTSSessions) {
    if (session.expiresAt < now) {
      pendingFinTSSessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
    logger.error({ err }, "Failed to initiate bank link");
    res.status(500).json({ error: "Failed to initiate bank link" });
  }
});

// Callback after user authorizes at their bank
router.get("/api/bank-links/callback", async (req, res) => {
  logger.info({ url: req.originalUrl, query: req.query }, "Bank link callback hit");

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
    logger.error({ err }, "Failed to process bank link callback");
    res.status(500).send(errorPage("Failed to link your bank. Please try again from the app."));
  }
});

// Initiate FinTS bank linking (credential-based, per-user)
router.post("/api/bank-links/fints", async (req, res) => {
  const user = await getUserByFirebaseUid(req.uid!);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  const { username, pin, blz } = req.body;
  const url = process.env.FINTS_URL || "";
  const productId = process.env.FINTS_PRODUCT_ID || "";
  const productVersion = process.env.FINTS_PRODUCT_VERSION || "1.0";

  if (!username || !pin || !blz) {
    res.status(400).json({ error: "username, pin, and blz are required" });
    return;
  }

  if (!url || !productId) {
    res.status(500).json({ error: "FinTS server configuration missing" });
    return;
  }

  try {
    logger.info({ blz, userId: user.id }, "FinTS linking: starting first sync");
    const config = FinTSConfig.forFirstTimeUse(productId, productVersion, url, blz, username, pin);
    const fintsClient = new FinTSClient(config);

    // First sync: discover TAN methods
    let syncResponse = await fintsClient.synchronize();
    if (!syncResponse.success) {
      logger.error({ bankAnswers: syncResponse.bankAnswers }, "FinTS first sync failed");
      const bankMessage = syncResponse.bankAnswers.find((a) => a.code !== 9800)?.text;
      res.status(502).json({ error: bankMessage || "FinTS synchronization failed" });
      return;
    }

    // Select first available TAN method
    const tanMethodIds = syncResponse.bankingInformation?.bpd?.availableTanMethodIds;
    if (!tanMethodIds?.length) {
      logger.error("FinTS: no TAN methods available");
      res.status(502).json({ error: "No TAN methods available from bank" });
      return;
    }
    logger.info({ tanMethodId: tanMethodIds[0] }, "FinTS: selected TAN method");
    fintsClient.selectTanMethod(tanMethodIds[0]);

    // Second sync: retrieve account list
    logger.info("FinTS linking: starting second sync");
    syncResponse = await fintsClient.synchronize();

    const encryptedUsername = encrypt(username);
    const encryptedPin = encrypt(pin);

    if (syncResponse.requiresTan) {
      // Store session for polling — user must approve TAN on their banking app
      const referenceId = randomUUID();
      logger.info({ referenceId, userId: user.id }, "FinTS linking: TAN required, awaiting approval");
      pendingFinTSSessions.set(referenceId, {
        client: fintsClient,
        tanReference: syncResponse.tanReference!,
        userId: user.id,
        blz,
        encryptedUsername,
        encryptedPin,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute timeout
      });

      res.json({
        status: "tan_required",
        referenceId,
        tanChallenge: syncResponse.tanChallenge || "Please approve the login in your banking app",
      });
      return;
    }

    if (!syncResponse.success) {
      logger.error({ bankAnswers: syncResponse.bankAnswers }, "FinTS second sync failed");
      res.status(502).json({ error: "FinTS synchronization failed" });
      return;
    }

    // No TAN needed — complete linking immediately
    logger.info({ userId: user.id }, "FinTS linking: no TAN needed, completing immediately");
    const bankingInfo = syncResponse.bankingInformation;
    const accounts = bankingInfo?.upd?.bankAccounts;
    if (!accounts?.length) {
      res.status(400).json({ error: "No accounts found via FinTS" });
      return;
    }

    const referenceId = randomUUID();
    const requisitionId = `fints-${referenceId}`;

    logger.info({
      accounts: accounts.map(a => ({
        accountNumber: a.accountNumber, accountType: a.accountType
      }))
    }, "FinTS: account types from UPD");

    const connection = await prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: "fints",
        institutionId: `ING_${blz}`,
        requisitionId,
        referenceId,
        status: "linked",
        providerData: JSON.parse(JSON.stringify(bankingInfo)),
        encryptedUsername,
        encryptedPin,
        accounts: {
          create: accounts.map((a) => ({
            externalId: a.iban || a.accountNumber,
            accountNumber: a.accountNumber,
            name: a.product || a.accountNumber,
            ownerName: a.holder1 || null,
            accountType: (a.accountType ===
              AccountType.SecuritiesAccount ||
              /depot/i.test(a.product || "")) ?
              "investment" : "cash",
          })),
        },
      },
      include: { accounts: true },
    });

    logger.info({ connectionId: connection.id, accountCount: connection.accounts.length }, "FinTS linking complete");

    res.json({
      status: "linked",
      connectionId: connection.id,
      accounts: connection.accounts.map((a) => ({
        id: a.id,
        externalId: a.externalId,
        name: a.name,
        ownerName: a.ownerName,
        accountType: a.accountType,
      })),
    });
  } catch (err: any) {
    logger.error({ err, message: err?.message, stack: err?.stack }, "Failed to link via FinTS");
    res.status(500).json({ error: "Failed to connect via FinTS" });
  }
});

// Poll for FinTS TAN approval (decoupled TAN)
router.post("/api/bank-links/fints/poll", async (req, res) => {
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

  const session = pendingFinTSSessions.get(referenceId);
  if (!session) {
    res.status(404).json({ error: "No pending FinTS session found — it may have expired" });
    return;
  }

  if (session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (session.expiresAt < Date.now()) {
    pendingFinTSSessions.delete(referenceId);
    res.status(410).json({ error: "FinTS session expired — please start again" });
    return;
  }

  try {
    logger.info({ referenceId }, "FinTS poll: checking TAN approval");
    // Poll decoupled TAN — no TAN string needed, user approves on their app
    const syncResponse = await session.client.synchronizeWithTan(session.tanReference);

    if (syncResponse.requiresTan) {
      // Still waiting for approval
      logger.debug({ referenceId }, "FinTS poll: still pending");
      res.json({ status: "pending" });
      return;
    }

    // TAN approved — clean up session
    pendingFinTSSessions.delete(referenceId);

    if (!syncResponse.success) {
      logger.error({ bankAnswers: syncResponse.bankAnswers }, "FinTS sync after TAN failed");
      res.status(502).json({ error: "FinTS synchronization failed after TAN approval" });
      return;
    }

    logger.info({ referenceId }, "FinTS poll: TAN approved, creating connection");
    const bankingInfo = syncResponse.bankingInformation;
    const accounts = bankingInfo?.upd?.bankAccounts;
    if (!accounts?.length) {
      res.status(400).json({ error: "No accounts found via FinTS" });
      return;
    }

    const connReferenceId = randomUUID();
    const requisitionId = `fints-${connReferenceId}`;


    const connection = await prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: "fints",
        institutionId: `ING_${session.blz}`,
        requisitionId,
        referenceId: connReferenceId,
        status: "linked",
        providerData: JSON.parse(JSON.stringify(bankingInfo)),
        encryptedUsername: session.encryptedUsername,
        encryptedPin: session.encryptedPin,
        accounts: {
          create: accounts.map((a) => ({
            externalId: a.iban || a.accountNumber,
            accountNumber: a.accountNumber,
            name: a.product || a.accountNumber,
            ownerName: a.holder1 || null,
            accountType: (a.accountType ===
              AccountType.SecuritiesAccount ||
              /depot/i.test(a.product || ""))
              ? "investment" : "cash",
          })),
        },
      },
      include: { accounts: true },
    });

    logger.info({ connectionId: connection.id, accountCount: connection.accounts.length }, "FinTS poll: linking complete");

    res.json({
      status: "linked",
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
    pendingFinTSSessions.delete(referenceId);
    logger.error({ err }, "Failed to poll FinTS TAN");
    res.status(500).json({ error: "Failed to complete FinTS linking" });
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
    logger.error({ err }, "Failed to create manual bank link");
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
