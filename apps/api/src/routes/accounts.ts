import { Router } from "express";
import { fetchAndStoreBalances, refreshAllBalances } from "../services/balances";

const router = Router();

// Refresh balances for a single account
router.post("/api/accounts/:accountId/balances/refresh", async (req, res) => {
  const { accountId } = req.params;

  try {
    const balances = await fetchAndStoreBalances(accountId);
    res.json({ balances });
  } catch (err) {
    console.error("Failed to refresh balances:", err);
    res.status(500).json({ error: "Failed to refresh balances" });
  }
});

// Refresh balances for all accounts of a user
router.post("/api/accounts/balances/refresh", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const balances = await refreshAllBalances(userId);
    res.json({ balances });
  } catch (err) {
    console.error("Failed to refresh all balances:", err);
    res.status(500).json({ error: "Failed to refresh balances" });
  }
});

export default router;
