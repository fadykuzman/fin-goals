-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "bankConnectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_requisitionId_key" ON "BankConnection"("requisitionId");

-- CreateIndex
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_externalId_key" ON "BankAccount"("externalId");

-- CreateIndex
CREATE INDEX "BankAccount_bankConnectionId_idx" ON "BankAccount"("bankConnectionId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
