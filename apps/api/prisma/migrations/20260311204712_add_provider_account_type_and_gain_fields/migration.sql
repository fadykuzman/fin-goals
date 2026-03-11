-- AlterTable
ALTER TABLE "Balance" ADD COLUMN     "gainAmount" DECIMAL(65,30),
ADD COLUMN     "gainPercentage" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'cash';

-- AlterTable
ALTER TABLE "BankConnection" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'gocardless';
