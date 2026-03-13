import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { auth } from "../firebase.js";

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

// Delete the authenticated user's account and all associated data
// TODO: Add family ownership checks when family feature is implemented (#37)
router.delete("/api/account", async (req, res) => {
  const firebaseUid = req.uid!;

  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }

    await auth.deleteUser(firebaseUid);
    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete account:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
