import "dotenv/config";
import express from "express";
import banksRouter from "./routes/banks";
import bankLinksRouter from "./routes/bank-links";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(banksRouter);
app.use(bankLinksRouter);

app.listen(PORT, () => {
  console.log(`@fin-goals/api running on http://localhost:${PORT}`);
});
