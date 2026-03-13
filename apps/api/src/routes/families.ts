import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserByFirebaseUid } from "../services/users.js";

const router = Router();
const prisma = new PrismaClient();

// Get the user's family (via membership)
router.get("/api/families", async (req, res) => {
  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const membership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      include: { family: true },
    });

    if (!membership) {
      res.json({ family: null, isOwner: false });
      return;
    }

    res.json({
      family: membership.family,
      isOwner: membership.family.ownerId === user.id,
    });
  } catch (error) {
    console.error("Error fetching family:", error);
    res.status(500).json({ error: "Failed to fetch family" });
  }
});

// Create a family
router.post("/api/families", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const family = await prisma.family.create({
      data: {
        name,
        ownerId: user.id,
        members: {
          create: { userId: user.id },
        },
      },
      include: { members: true },
    });

    res.status(201).json(family);
  } catch (error) {
    console.error("Error creating family:", error);
    res.status(500).json({ error: "Failed to create family" });
  }
});

// Update family name
router.patch("/api/families/:familyId", async (req, res) => {
  const { familyId } = req.params;
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    if (family.ownerId !== user.id) {
      res.status(403).json({ error: "Only the owner can update the family" });
      return;
    }

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: { name },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating family:", error);
    res.status(500).json({ error: "Failed to update family" });
  }
});

// Delete family
router.delete("/api/families/:familyId", async (req, res) => {
  const { familyId } = req.params;

  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: { _count: { select: { members: true } } },
    });

    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    if (family.ownerId !== user.id) {
      res.status(403).json({ error: "Only the owner can delete the family" });
      return;
    }

    if (family._count.members > 1) {
      res.status(409).json({ error: "Cannot delete family with other members. Remove all other members first." });
      return;
    }

    await prisma.family.delete({ where: { id: familyId } });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting family:", error);
    res.status(500).json({ error: "Failed to delete family" });
  }
});

export default router;
