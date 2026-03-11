-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceType" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Balance_bankAccountId_idx" ON "Balance"("bankAccountId");

-- CreateIndex
CREATE INDEX "Balance_bankAccountId_fetchedAt_idx" ON "Balance"("bankAccountId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
