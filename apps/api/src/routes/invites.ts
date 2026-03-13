import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserByFirebaseUid } from "../services/users.js";
import { sendFamilyInviteEmail } from "../services/email.js";
import logger from "../logger.js";

const router = Router();
const prisma = new PrismaClient();

const INVITE_EXPIRY_DAYS = 7;

// Expire overdue invites for a given query
async function expireOverdueInvites() {
  await prisma.familyInvite.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
}

// Send an invite (owner only)
router.post("/api/families/:familyId/invites", async (req, res) => {
  const { familyId } = req.params;
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "email is required" });
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
      res.status(403).json({ error: "Only the owner can send invites" });
      return;
    }

    // Check if invitee is already a member
    const existingMember = await prisma.familyMember.findFirst({
      where: { familyId, user: { email: email.toLowerCase() } },
    });
    if (existingMember) {
      res.status(409).json({ error: "This person is already a family member" });
      return;
    }

    // Check for existing pending invite
    const existingInvite = await prisma.familyInvite.findFirst({
      where: {
        familyId,
        email: email.toLowerCase(),
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      res.status(409).json({ error: "A pending invite already exists for this email" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.familyInvite.create({
      data: {
        familyId,
        invitedById: user.id,
        email: email.toLowerCase(),
        expiresAt,
      },
    });

    // Send email (best-effort — don't fail the request if email fails)
    try {
      await sendFamilyInviteEmail(email.toLowerCase(), user.displayName, family.name);
    } catch (emailError) {
      logger.error({ err: emailError, email: email.toLowerCase() }, "Failed to send invite email");
    }

    res.status(201).json(invite);
  } catch (error) {
    logger.error({ err: error }, "Error sending invite");
    res.status(500).json({ error: "Failed to send invite" });
  }
});

// List pending invites for a family (owner only)
router.get("/api/families/:familyId/invites", async (req, res) => {
  const { familyId } = req.params;

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
      res.status(403).json({ error: "Only the owner can view invites" });
      return;
    }

    await expireOverdueInvites();

    const invites = await prisma.familyInvite.findMany({
      where: { familyId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    res.json(invites);
  } catch (error) {
    logger.error({ err: error }, "Error listing family invites");
    res.status(500).json({ error: "Failed to list invites" });
  }
});

// List pending invites for the authenticated user (by email)
router.get("/api/invites", async (req, res) => {
  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await expireOverdueInvites();

    const invites = await prisma.familyInvite.findMany({
      where: { email: user.email.toLowerCase(), status: "pending" },
      include: {
        family: { select: { id: true, name: true } },
        invitedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(invites);
  } catch (error) {
    logger.error({ err: error }, "Error listing user invites");
    res.status(500).json({ error: "Failed to list invites" });
  }
});

// Accept an invite
router.post("/api/invites/:inviteId/accept", async (req, res) => {
  const { inviteId } = req.params;

  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const invite = await prisma.familyInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    if (invite.email !== user.email.toLowerCase()) {
      res.status(403).json({ error: "This invite is not for you" });
      return;
    }

    if (invite.expiresAt < new Date()) {
      await prisma.familyInvite.update({
        where: { id: inviteId },
        data: { status: "expired" },
      });
      res.status(410).json({ error: "This invite has expired" });
      return;
    }

    if (invite.status !== "pending") {
      res.status(409).json({ error: `Invite has already been ${invite.status}` });
      return;
    }

    // Check if user is already in a family
    const existingMembership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
    });
    if (existingMembership) {
      res.status(409).json({ error: "You are already in a family. Leave your current family first." });
      return;
    }

    // Accept: add as member + update invite status in a transaction
    await prisma.$transaction([
      prisma.familyMember.create({
        data: { familyId: invite.familyId, userId: user.id },
      }),
      prisma.familyInvite.update({
        where: { id: inviteId },
        data: { status: "accepted" },
      }),
    ]);

    res.json({ message: "Invite accepted" });
  } catch (error) {
    logger.error({ err: error }, "Error accepting invite");
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

// Decline an invite
router.post("/api/invites/:inviteId/decline", async (req, res) => {
  const { inviteId } = req.params;

  try {
    const user = await getUserByFirebaseUid(req.uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const invite = await prisma.familyInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    if (invite.email !== user.email.toLowerCase()) {
      res.status(403).json({ error: "This invite is not for you" });
      return;
    }

    if (invite.status !== "pending") {
      res.status(409).json({ error: `Invite has already been ${invite.status}` });
      return;
    }

    await prisma.familyInvite.update({
      where: { id: inviteId },
      data: { status: "declined" },
    });

    res.json({ message: "Invite declined" });
  } catch (error) {
    logger.error({ err: error }, "Error declining invite");
    res.status(500).json({ error: "Failed to decline invite" });
  }
});

export default router;
