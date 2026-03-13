import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Register a new user
router.post("/api/register", async (req, res) => {
  const firebaseUid = req.uid!;
  const { displayName, email } = req.body;

  if (!displayName || !email) {
    res.status(400).json({ error: "displayName and email are required" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { firebaseUid } });
    if (existing) {
      res.status(409).json({ error: "User already registered" });
      return;
    }

    const user = await prisma.user.create({
      data: { firebaseUid, displayName, email },
    });

    res.status(201).json({ user });
  } catch (err) {
    console.error("Failed to register user:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

export default router;
