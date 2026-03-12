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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// All /api/* routes require authentication
app.use("/api", requireAuth);

app.use(banksRouter);
app.use(bankLinksRouter);
app.use(accountsRouter);
app.use(balancesRouter);
app.use(bankConnectionsRouter);
app.use(goalsRouter);
app.use(transactionsRouter);

app.listen(PORT, () => {
  console.log(`@fin-goals/api running on http://localhost:${PORT}`);
});
