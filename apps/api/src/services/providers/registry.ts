import type { BankDataProvider, AccountData } from "./types.js";
import { GoCardlessProvider } from "./gocardless-provider.js";
import { FinTSProvider } from "./fints-provider.js";

const manualProvider: BankDataProvider = {
  async fetchAccountData(): Promise<AccountData> {
    throw new Error("Manual accounts do not support automatic balance fetching");
  },
};

const providers: Record<string, BankDataProvider> = {
  gocardless: new GoCardlessProvider(),
  fints: new FinTSProvider(),
  manual: manualProvider,
};

export function getProvider(name: string): BankDataProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown bank data provider: ${name}`);
  }
  return provider;
}
