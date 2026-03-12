import { PrismaClient } from "@prisma/client";
import { getProvider } from "./providers/registry.js";

const prisma = new PrismaClient();

interface SepaFields {
  description: string;
  mandateReference: string | null;
  creditorId: string | null;
  remittanceInformation: string | null;
}

const SEPA_PATTERN =
  /^mandatereference:(.*?),creditorid:(.*?),remittanceinformation:(.*)$/i;

export function parseSepaDescription(raw: string): SepaFields {
  const match = raw.match(SEPA_PATTERN);
  if (!match) {
    return { description: raw, mandateReference: null, creditorId: null, remittanceInformation: null };
  }

  const mandateReference = match[1].trim() || null;
  const creditorId = match[2].trim() || null;
  const remittanceInformation = match[3].trim() || null;

  return {
    description: remittanceInformation || raw,
    mandateReference,
    creditorId,
    remittanceInformation,
  };
}

function defaultDateFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split("T")[0];
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function fetchAndStoreTransactions(
  bankAccountId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { bankConnection: true },
  });

  const provider = getProvider(bankAccount.bankConnection.provider);
  const transactions = await provider.fetchTransactions(
    bankAccount.externalId,
    dateFrom || defaultDateFrom(),
    dateTo || todayDate()
  );

  const created = [];

  for (const tx of transactions) {
    if (!tx.externalId) continue;

    const existing = await prisma.transaction.findUnique({
      where: { externalId: tx.externalId },
    });

    if (existing) continue;

    const sepa = parseSepaDescription(tx.description);

    const record = await prisma.transaction.create({
      data: {
        bankAccountId: bankAccount.id,
        externalId: tx.externalId,
        amount: tx.amount,
        currency: tx.currency,
        description: sepa.description,
        mandateReference: sepa.mandateReference,
        creditorId: sepa.creditorId,
        remittanceInformation: sepa.remittanceInformation,
        date: new Date(tx.date),
      },
    });

    created.push(record);
  }

  return created;
}
