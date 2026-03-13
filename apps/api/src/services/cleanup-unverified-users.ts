import { auth } from "../firebase.js";
import { PrismaClient } from "@prisma/client";
import logger from "../logger.js";

const prisma = new PrismaClient();

const UNVERIFIED_DAYS = parseInt(
  process.env.CLEANUP_UNVERIFIED_DAYS || "3",
  10
);

export async function cleanupUnverifiedUsers(): Promise<void> {
  const cutoff = Date.now() - UNVERIFIED_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);

    for (const user of listResult.users) {
      if (user.emailVerified) continue;

      const createdAt = new Date(user.metadata.creationTime).getTime();
      if (createdAt >= cutoff) continue;

      try {
        await auth.deleteUser(user.uid);
        await prisma.user.deleteMany({ where: { firebaseUid: user.uid } });
        deletedCount++;
        logger.info({ uid: user.uid, email: user.email }, "Deleted unverified user");
      } catch (error) {
        logger.error({ err: error, uid: user.uid }, "Failed to delete unverified user");
      }
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  logger.info({ deletedCount, thresholdDays: UNVERIFIED_DAYS }, "Unverified user cleanup complete");
}
