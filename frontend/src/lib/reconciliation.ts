export const reconciliationAccountId = (account: {
  accountId?: string; openingBalanceId?: string; accountType: string; provider: string; currency: string;
}) => account.accountId || account.openingBalanceId || `${account.accountType}:${account.provider}:${account.currency}`;
