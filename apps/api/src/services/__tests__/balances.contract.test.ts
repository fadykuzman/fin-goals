import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

describe("Balances service - contract test", () => {
  let bankAccountId: string;
  let connectionId: string;

  beforeAll(async () => {
    const connection = await prisma.bankConnection.create({
      data: {
        userId: "test-user",
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

  it("should store multiple balance types for an account", async () => {
    const now = new Date();

    const created = await Promise.all(
      [
        { amount: "1234.56", currency: "EUR", balanceType: "interimAvailable" },
        { amount: "1200.00", currency: "EUR", balanceType: "expected" },
      ].map((b) =>
        prisma.balance.create({
          data: {
            bankAccountId,
            amount: b.amount,
            currency: b.currency,
            balanceType: b.balanceType,
            fetchedAt: now,
          },
        })
      )
    );

    expect(created).toHaveLength(2);
    expect(created[0].currency).toBe("EUR");
    expect(created[0].balanceType).toBe("interimAvailable");
    expect(created[1].balanceType).toBe("expected");
  });

  it("should keep history across multiple fetches", async () => {
    const firstFetch = new Date("2026-03-01T10:00:00Z");
    const secondFetch = new Date("2026-03-02T10:00:00Z");

    await prisma.balance.create({
      data: {
        bankAccountId,
        amount: "500.00",
        currency: "EUR",
        balanceType: "interimAvailable",
        fetchedAt: firstFetch,
      },
    });

    await prisma.balance.create({
      data: {
        bankAccountId,
        amount: "600.00",
        currency: "EUR",
        balanceType: "interimAvailable",
        fetchedAt: secondFetch,
      },
    });

    const all = await prisma.balance.findMany({
      where: { bankAccountId, balanceType: "interimAvailable" },
      orderBy: { fetchedAt: "desc" },
    });

    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(Number(all[0].amount)).toBeGreaterThan(Number(all[1].amount));
  });

  it("should query latest balance per account", async () => {
    const latest = await prisma.balance.findFirst({
      where: { bankAccountId, balanceType: "interimAvailable" },
      orderBy: { fetchedAt: "desc" },
    });

    expect(latest).not.toBeNull();
    expect(latest!.bankAccountId).toBe(bankAccountId);
  });
});
