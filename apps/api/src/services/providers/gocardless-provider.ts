import { getAccountBalances } from "../gocardless.js";
import type { BankDataProvider, CashAccountData } from "./types.js";

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
}
