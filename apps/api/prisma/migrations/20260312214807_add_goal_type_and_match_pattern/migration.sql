-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('balance_based', 'transaction_based');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "goalType" "GoalType" NOT NULL DEFAULT 'balance_based',
ADD COLUMN     "matchPattern" TEXT;
