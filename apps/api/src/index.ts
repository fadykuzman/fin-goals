import "dotenv/config";
import express from "express";
import cron from "node-cron";
import pinoHttp from "pino-http";
import logger from "./logger.js";
import { requireAuth } from "./middleware/auth.js";
import { cleanupUnverifiedUsers } from "./services/cleanup-unverified-users.js";
import banksRouter from "./routes/banks";
import bankLinksRouter from "./routes/bank-links";
import accountsRouter from "./routes/accounts";
import balancesRouter from "./routes/balances";
import bankConnectionsRouter from "./routes/bank-connections";
import goalsRouter from "./routes/goals";
import transactionsRouter from "./routes/transactions";
import familiesRouter from "./routes/families";
import invitesRouter from "./routes/invites";
import usersRouter from "./routes/users";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore(req) {
      return !req.url?.startsWith("/api/") && req.url !== "/health";
    },
  },
  serializers: {
    req(req) {
      const serialized = {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: { ...req.headers },
      };
      if (serialized.headers.authorization) {
        serialized.headers.authorization =
          serialized.headers.authorization.slice(0, 12) + "******";
      }
      return serialized;
    },
  },
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// All /api/* routes require authentication, except the bank-links callback
// (hit via browser redirect after bank authorization — no Bearer token available)
app.use("/api", (req, res, next) => {
  if (req.path === "/bank-links/callback") return next();
  return requireAuth(req, res, next);
});

app.use(banksRouter);
app.use(bankLinksRouter);
app.use(accountsRouter);
app.use(balancesRouter);
app.use(bankConnectionsRouter);
app.use(goalsRouter);
app.use(familiesRouter);
app.use(invitesRouter);
app.use(transactionsRouter);
app.use(usersRouter);

const CLEANUP_CRON_SCHEDULE = process.env.CLEANUP_CRON_SCHEDULE || "0 0 * * *";
cron.schedule(CLEANUP_CRON_SCHEDULE, () => {
  logger.info("Running unverified user cleanup");
  cleanupUnverifiedUsers().catch((err) =>
    logger.error({ err }, "Cleanup failed")
  );
});

app.listen(PORT, () => {
  logger.info(`@fin-goals/api running on http://localhost:${PORT}`);
});
