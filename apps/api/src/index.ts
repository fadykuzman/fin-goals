import "dotenv/config";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import banksRouter from "./routes/banks";
import bankLinksRouter from "./routes/bank-links";
import accountsRouter from "./routes/accounts";
import balancesRouter from "./routes/balances";
import bankConnectionsRouter from "./routes/bank-connections";
import goalsRouter from "./routes/goals";
import transactionsRouter from "./routes/transactions";
import usersRouter from "./routes/users";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
app.use(transactionsRouter);
app.use(usersRouter);

app.listen(PORT, () => {
  console.log(`@fin-goals/api running on http://localhost:${PORT}`);
});
