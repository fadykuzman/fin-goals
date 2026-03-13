import { auth } from "../firebase.js";
import { PrismaClient } from "@prisma/client";

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
        console.log(
          `[cleanup] Deleted unverified user ${user.uid} (${user.email})`
        );
      } catch (error) {
        console.error(
          `[cleanup] Failed to delete user ${user.uid}:`,
          error
        );
      }
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(
    `[cleanup] Done. Deleted ${deletedCount} unverified user(s) older than ${UNVERIFIED_DAYS} day(s).`
  );
}
