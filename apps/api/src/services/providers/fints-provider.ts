import { PinTanClient } from "node-fints";
import type { BankDataProvider, CashAccountData } from "./types.js";

export class FinTSProvider implements BankDataProvider {
  async fetchAccountData(externalId: string): Promise<CashAccountData> {
    const client = new PinTanClient({
      url: process.env.FINTS_URL || "https://fints.ing.de/fints/",
      blz: process.env.FINTS_BLZ || "",
      name: process.env.FINTS_USERNAME || "",
      pin: process.env.FINTS_PIN || "",
      productId: process.env.FINTS_PRODUCT_ID || "",
    });

    const accounts = await client.accounts();
    const account = accounts.find((a) => a.iban === externalId);
    if (!account) {
      throw new Error(`FinTS account not found for IBAN: ${externalId}`);
    }

    const balance = await client.balance(account);

    return {
      type: "cash",
      balances: [
        {
          amount: String(balance.bookedBalance),
          currency: balance.currency,
          balanceType: "bookedBalance",
        },
      ],
    };
  }
}
