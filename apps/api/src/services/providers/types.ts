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

export interface TransactionData {
  externalId: string;
  amount: string;
  currency: string;
  description: string;
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface BankDataProvider {
  fetchAccountData(externalId: string): Promise<AccountData>;
  fetchTransactions(externalId: string, dateFrom?: string, dateTo?: string): Promise<TransactionData[]>;
}
