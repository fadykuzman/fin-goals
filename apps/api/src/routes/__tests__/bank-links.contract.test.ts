import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { client, getAccessToken } from "../../services/gocardless";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

describe("Bank links - contract test", () => {
  const createdConnectionIds: string[] = [];

  afterAll(async () => {
    // Clean up test data
    for (const id of createdConnectionIds) {
      await prisma.bankAccount.deleteMany({ where: { bankConnectionId: id } });
      await prisma.bankConnection.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("should create a requisition and store a pending bank connection", async () => {
    await getAccessToken();

    const referenceId = randomUUID();
    const requisition = await client.initSession({
      redirectUrl: "http://localhost:3000/api/bank-links/callback",
      institutionId: "ING_INGDDEFF",
      referenceId,
      maxHistoricalDays: 90,
      accessValidForDays: 30,
      userLanguage: "EN",
      ssn: "",
      redirectImmediate: false,
      accountSelection: false,
    });

    expect(requisition.id).toBeDefined();
    expect(requisition.link).toBeDefined();
    expect(typeof requisition.link).toBe("string");

    // Store in DB like the endpoint does
    const connection = await prisma.bankConnection.create({
      data: {
        userId: "test-user",
        institutionId: "ING_INGDDEFF",
        requisitionId: requisition.id,
        referenceId,
        status: "pending",
      },
    });

    createdConnectionIds.push(connection.id);

    expect(connection.status).toBe("pending");
    expect(connection.requisitionId).toBe(requisition.id);
    expect(connection.referenceId).toBe(referenceId);
  });

  it("should look up a connection by referenceId", async () => {
    const referenceId = randomUUID();
    const connection = await prisma.bankConnection.create({
      data: {
        userId: "test-user",
        institutionId: "TEST_BANK",
        requisitionId: randomUUID(),
        referenceId,
        status: "pending",
      },
    });

    createdConnectionIds.push(connection.id);

    const found = await prisma.bankConnection.findUniqueOrThrow({
      where: { referenceId },
    });

    expect(found.id).toBe(connection.id);
    expect(found.referenceId).toBe(referenceId);
  });

  it("should update connection status and create bank accounts", async () => {
    const referenceId = randomUUID();
    const connection = await prisma.bankConnection.create({
      data: {
        userId: "test-user",
        institutionId: "TEST_BANK",
        requisitionId: randomUUID(),
        referenceId,
        status: "pending",
      },
    });

    createdConnectionIds.push(connection.id);

    // Simulate what the callback does
    const updated = await prisma.bankConnection.update({
      where: { id: connection.id },
      data: { status: "linked" },
    });

    expect(updated.status).toBe("linked");

    const fakeAccountIds = [randomUUID(), randomUUID()];
    const accounts = await Promise.all(
      fakeAccountIds.map((externalId) =>
        prisma.bankAccount.create({
          data: { externalId, bankConnectionId: connection.id },
        })
      )
    );

    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.externalId).sort()).toEqual(
      fakeAccountIds.sort()
    );
  });
});
