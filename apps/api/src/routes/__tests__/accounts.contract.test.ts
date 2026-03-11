import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

describe("Accounts routes - contract test", () => {
  let connectionId: string;
  let bankAccountId: string;

  beforeAll(async () => {
    const connection = await prisma.bankConnection.create({
      data: {
        userId: "test-user-routes",
        institutionId: "TEST_BANK",
        requisitionId: randomUUID(),
        referenceId: randomUUID(),
        status: "linked",
      },
    });
    connectionId = connection.id;

    const account = await prisma.bankAccount.create({
      data: {
        externalId: randomUUID(),
        bankConnectionId: connection.id,
      },
    });
    bankAccountId = account.id;
  });

  afterAll(async () => {
    await prisma.balance.deleteMany({ where: { bankAccountId } });
    await prisma.bankAccount.deleteMany({ where: { bankConnectionId: connectionId } });
    await prisma.bankConnection.delete({ where: { id: connectionId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("should store and retrieve balances for a single account", async () => {
    const now = new Date();

    const balance = await prisma.balance.create({
      data: {
        bankAccountId,
        amount: "1500.00",
        currency: "EUR",
        balanceType: "interimAvailable",
        fetchedAt: now,
      },
    });

    expect(balance.bankAccountId).toBe(bankAccountId);
    expect(Number(balance.amount)).toBe(1500);
    expect(balance.currency).toBe("EUR");
    expect(balance.balanceType).toBe("interimAvailable");
  });

  it("should find all accounts for a user with linked status", async () => {
    const accounts = await prisma.bankAccount.findMany({
      where: {
        bankConnection: {
          userId: "test-user-routes",
          status: "linked",
        },
      },
    });

    expect(accounts.length).toBeGreaterThanOrEqual(1);
    expect(accounts.some((a) => a.id === bankAccountId)).toBe(true);
  });

  it("should not return accounts for non-linked connections", async () => {
    const pendingConnection = await prisma.bankConnection.create({
      data: {
        userId: "test-user-routes",
        institutionId: "TEST_BANK",
        requisitionId: randomUUID(),
        referenceId: randomUUID(),
        status: "pending",
      },
    });

    const pendingAccount = await prisma.bankAccount.create({
      data: {
        externalId: randomUUID(),
        bankConnectionId: pendingConnection.id,
      },
    });

    const linkedAccounts = await prisma.bankAccount.findMany({
      where: {
        bankConnection: {
          userId: "test-user-routes",
          status: "linked",
        },
      },
    });

    expect(linkedAccounts.some((a) => a.id === pendingAccount.id)).toBe(false);

    // Clean up
    await prisma.bankAccount.deleteMany({ where: { bankConnectionId: pendingConnection.id } });
    await prisma.bankConnection.delete({ where: { id: pendingConnection.id } });
  });

  it("should retrieve latest balance for an account", async () => {
    const older = new Date("2026-03-01T10:00:00Z");
    const newer = new Date("2026-03-02T10:00:00Z");

    await prisma.balance.createMany({
      data: [
        { bankAccountId, amount: "1000.00", currency: "EUR", balanceType: "expected", fetchedAt: older },
        { bankAccountId, amount: "1100.00", currency: "EUR", balanceType: "expected", fetchedAt: newer },
      ],
    });

    const latest = await prisma.balance.findFirst({
      where: { bankAccountId, balanceType: "expected" },
      orderBy: { fetchedAt: "desc" },
    });

    expect(latest).not.toBeNull();
    expect(Number(latest!.amount)).toBe(1100);
  });
});
