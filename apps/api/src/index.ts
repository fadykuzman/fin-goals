import express from "express";
import banksRouter from "./routes/banks";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(banksRouter);

app.listen(PORT, () => {
  console.log(`@fin-goals/api running on http://localhost:${PORT}`);
});
