import { Router } from "express";
import { client, getAccessToken } from "../services/gocardless";
import logger from "../logger.js";

const router = Router();

router.get("/api/banks", async (req, res) => {
  const country = req.query.country;

  if (!country || typeof country !== "string" || country.length !== 2) {
    res.status(400).json({ error: "country query param required (2-letter code)" });
    return;
  }

  try {
    await getAccessToken();
    const institutions = await client.institution.getInstitutions({
      country: country.toUpperCase(),
    });

    const result = institutions.map((inst: { id: string; name: string; logo: string }) => ({
      id: inst.id,
      name: inst.name,
      logo: inst.logo,
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to fetch institutions");
    res.status(500).json({ error: "Failed to fetch institutions" });
  }
});

export default router;
