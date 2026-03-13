import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUserByFirebaseUid(firebaseUid: string) {
  return prisma.user.findUnique({ where: { firebaseUid } });
}
