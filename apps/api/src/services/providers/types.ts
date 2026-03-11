export interface CashAccountData {
  type: "cash";
  balances: {
    amount: string;
    currency: string;
    balanceType: string;
  }[];
}

export interface InvestmentAccountData {
  type: "investment";
  balances: {
    amount: string;
    currency: string;
    balanceType: string;
    gainAmount: string;
    gainPercentage: string;
  }[];
}

export type AccountData = CashAccountData | InvestmentAccountData;

export interface BankDataProvider {
  fetchAccountData(externalId: string): Promise<AccountData>;
}
