import { FinTSClient, FinTSConfig } from "lib-fints";
import { PrismaClient } from "@prisma/client";
import type { AccountData, BankDataProvider, TransactionData } from "./types.js";
import { decrypt } from "../crypto.js";
import logger from "../../logger.js";

export class TanRequiredError extends Error {
  constructor(
    public readonly client: FinTSClient,
    public readonly tanReference: string,
    public readonly tanChallenge: string | undefined,
    public readonly operation: "balance" | "transactions",
    public readonly accountId: string,
    public readonly connectionId: string,
  ) {
    super("TAN required for FinTS operation");
    this.name = "TanRequiredError";
  }
}

const prisma = new PrismaClient();

export class FinTSProvider implements BankDataProvider {
  async fetchAccountData(externalId: string): Promise<AccountData> {
    const productId = process.env.FINTS_PRODUCT_ID || "";
    const productVersion = process.env.FINTS_PRODUCT_VERSION || "1.0";

    // Look up the bank account to find its connection's persisted session and credentials
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { externalId },
      include: { bankConnection: true },
    });

    if (!bankAccount) {
      throw new Error(`Bank account not found for externalId: ${externalId}`);
    }

    const { providerData, encryptedUsername, encryptedPin } = bankAccount.bankConnection;
    if (!providerData) {
      throw new Error(`No persisted FinTS session for connection ${bankAccount.bankConnectionId}`);
    }
    if (!encryptedUsername || !encryptedPin) {
      throw new Error(`No stored credentials for FinTS connection ${bankAccount.bankConnectionId}`);
    }

    const username = decrypt(encryptedUsername);
    const pin = decrypt(encryptedPin);

    const config = FinTSConfig.fromBankingInformation(
      productId,
      productVersion,
      providerData as any,
      username,
      pin,
    );
    const client = new FinTSClient(config);

    if (!bankAccount.accountNumber) {
      throw new Error(`No account number stored for bank account ${bankAccount.id} — re-link required`);
    }

    if (bankAccount.accountType === "investment") {
      return this.fetchPortfolioBalance(client, config, bankAccount);
    }

    logger.info({ externalId, accountNumber: bankAccount.accountNumber }, "FinTS: fetching balance");
    const balanceResponse = await client.getAccountBalance(bankAccount.accountNumber);

    if (balanceResponse.requiresTan) {
      logger.info({ externalId }, "FinTS: TAN required for balance fetch");
      throw new TanRequiredError(
        client,
        balanceResponse.tanReference!,
        balanceResponse.tanChallenge,
        "balance",
        bankAccount.id,
        bankAccount.bankConnectionId,
      );
    }

    if (!balanceResponse.success || !balanceResponse.balance) {
      logger.error({ externalId, bankAnswers: balanceResponse.bankAnswers }, "FinTS balance fetch failed");
      throw new Error(`FinTS balance fetch failed for ${externalId}`);
    }

    logger.info({ externalId, balance: balanceResponse.balance.balance, currency: balanceResponse.balance.currency }, "FinTS: balance fetched");

    // Persist updated bankingInformation if it changed
    if (balanceResponse.bankingInformationUpdated) {
      logger.debug({ externalId }, "FinTS: updating persisted bankingInformation");
      await prisma.bankConnection.update({
        where: { id: bankAccount.bankConnectionId },
        data: { providerData: JSON.parse(JSON.stringify(config.bankingInformation)) },
      });
    }

    return {
      type: "cash",
      balances: [
        {
          amount: String(balanceResponse.balance.balance),
          currency: balanceResponse.balance.currency,
          balanceType: "bookedBalance",
        },
      ],
    };
  }

  private async fetchPortfolioBalance(
    client: FinTSClient,
    config: FinTSConfig,
    bankAccount: { id: string; externalId: string; accountNumber: string | null; bankConnectionId: string },
  ): Promise<AccountData> {
    const { externalId, accountNumber } = bankAccount;

    logger.info({ externalId, accountNumber }, "FinTS: fetching portfolio");
    const portfolioResponse = await client.getPortfolio(accountNumber!);

    if (portfolioResponse.requiresTan) {
      logger.info({ externalId }, "FinTS: TAN required for portfolio fetch");
      throw new TanRequiredError(
        client,
        portfolioResponse.tanReference!,
        portfolioResponse.tanChallenge,
        "balance",
        bankAccount.id,
        bankAccount.bankConnectionId,
      );
    }

    if (!portfolioResponse.success || !portfolioResponse.portfolioStatement) {
      logger.error({ externalId, bankAnswers: portfolioResponse.bankAnswers }, "FinTS portfolio fetch failed");
      throw new Error(`FinTS portfolio fetch failed for ${externalId}`);
    }

    const { totalValue, currency } = portfolioResponse.portfolioStatement;
    logger.info({ externalId, totalValue, currency }, "FinTS: portfolio fetched");

    if (portfolioResponse.bankingInformationUpdated) {
      logger.debug({ externalId }, "FinTS: updating persisted bankingInformation");
      await prisma.bankConnection.update({
        where: { id: bankAccount.bankConnectionId },
        data: { providerData: JSON.parse(JSON.stringify(config.bankingInformation)) },
      });
    }

    return {
      type: "cash",
      balances: [
        {
          amount: String(totalValue ?? 0),
          currency: currency ?? "EUR",
          balanceType: "portfolioValue",
        },
      ],
    };
  }

  async fetchTransactions(externalId: string, dateFrom?: string, dateTo?: string): Promise<TransactionData[]> {
    const productId = process.env.FINTS_PRODUCT_ID || "";
    const productVersion = process.env.FINTS_PRODUCT_VERSION || "1.0";

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { externalId },
      include: { bankConnection: true },
    });

    if (!bankAccount) {
      throw new Error(`Bank account not found for externalId: ${externalId}`);
    }

    const { providerData, encryptedUsername, encryptedPin } = bankAccount.bankConnection;
    if (!providerData) {
      throw new Error(`No persisted FinTS session for connection ${bankAccount.bankConnectionId}`);
    }
    if (!encryptedUsername || !encryptedPin) {
      throw new Error(`No stored credentials for FinTS connection ${bankAccount.bankConnectionId}`);
    }

    const username = decrypt(encryptedUsername);
    const pin = decrypt(encryptedPin);

    const config = FinTSConfig.fromBankingInformation(
      productId,
      productVersion,
      providerData as any,
      username,
      pin,
    );
    const client = new FinTSClient(config);

    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;

    if (!bankAccount.accountNumber) {
      throw new Error(`No account number stored for bank account ${bankAccount.id} — re-link required`);
    }

    logger.info({ externalId, accountNumber: bankAccount.accountNumber, dateFrom, dateTo }, "FinTS: fetching transactions");
    const stmtResponse = await client.getAccountStatements(bankAccount.accountNumber, from, to);

    if (stmtResponse.requiresTan) {
      logger.info({ externalId }, "FinTS: TAN required for transaction fetch");
      throw new TanRequiredError(
        client,
        stmtResponse.tanReference!,
        stmtResponse.tanChallenge,
        "transactions",
        bankAccount.id,
        bankAccount.bankConnectionId,
      );
    }

    if (!stmtResponse.success) {
      logger.error({ externalId, bankAnswers: stmtResponse.bankAnswers }, "FinTS statement fetch failed");
      throw new Error(`FinTS statement fetch failed for ${externalId}`);
    }

    // Persist updated bankingInformation if it changed
    if (stmtResponse.bankingInformationUpdated) {
      logger.debug({ externalId }, "FinTS: updating persisted bankingInformation");
      await prisma.bankConnection.update({
        where: { id: bankAccount.bankConnectionId },
        data: { providerData: JSON.parse(JSON.stringify(config.bankingInformation)) },
      });
    }

    const txCount = stmtResponse.statements.reduce((sum, s) => sum + s.transactions.length, 0);
    logger.info({ externalId, statementCount: stmtResponse.statements.length, transactionCount: txCount }, "FinTS: transactions fetched");

    return stmtResponse.statements.flatMap((stmt) =>
      stmt.transactions.map((tx) => ({
        externalId: tx.bankReference || tx.customerReference || `${externalId}-${tx.entryDate.toISOString()}-${tx.amount}`,
        amount: String(tx.amount),
        currency: stmt.closingBalance.currency,
        description: tx.purpose || tx.bookingText || "",
        date: tx.entryDate.toISOString().split("T")[0],
      }))
    );
  }
}
