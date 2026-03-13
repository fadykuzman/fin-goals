-- CreateEnum
CREATE TYPE "GoalVisibility" AS ENUM ('personal', 'family');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "visibility" "GoalVisibility" NOT NULL DEFAULT 'personal';
