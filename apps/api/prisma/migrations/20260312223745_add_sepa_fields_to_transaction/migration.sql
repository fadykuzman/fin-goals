-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "creditorId" TEXT,
ADD COLUMN     "mandateReference" TEXT,
ADD COLUMN     "remittanceInformation" TEXT;
