import "dotenv/config";
import express from "express";
import banksRouter from "./routes/banks";
import bankLinksRouter from "./routes/bank-links";
import accountsRouter from "./routes/accounts";
import balancesRouter from "./routes/balances";
import bankConnectionsRouter from "./routes/bank-connections";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(banksRouter);
app.use(bankLinksRouter);
app.use(accountsRouter);
app.use(balancesRouter);
app.use(bankConnectionsRouter);

app.listen(PORT, () => {
  console.log(`@fin-goals/api running on http://localhost:${PORT}`);
});
