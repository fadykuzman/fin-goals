import { getAccountBalances, getAccountTransactions } from "../gocardless.js";
import type { BankDataProvider, CashAccountData, TransactionData } from "./types.js";

export class GoCardlessProvider implements BankDataProvider {
  async fetchAccountData(externalId: string): Promise<CashAccountData> {
    const response = await getAccountBalances(externalId);

    return {
      type: "cash",
      balances: response.balances.map(
        (b: { balanceAmount: { amount: string; currency: string }; balanceType: string }) => ({
          amount: b.balanceAmount.amount,
          currency: b.balanceAmount.currency,
          balanceType: b.balanceType,
        })
      ),
    };
  }

  async fetchTransactions(
    externalId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<TransactionData[]> {
    const response = await getAccountTransactions(externalId, dateFrom, dateTo);

    const booked = response.transactions?.booked ?? [];

    return booked.map(
      (t: {
        transactionId?: string;
        internalTransactionId?: string;
        transactionAmount: { amount: string; currency: string };
        remittanceInformationUnstructured?: string;
        bookingDate: string;
      }) => ({
        externalId: t.transactionId || t.internalTransactionId || "",
        amount: t.transactionAmount.amount,
        currency: t.transactionAmount.currency,
        description: t.remittanceInformationUnstructured || "",
        date: t.bookingDate,
      })
    );
  }
}
