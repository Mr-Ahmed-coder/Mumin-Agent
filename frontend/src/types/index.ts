export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  branchId?: string;
  createdAt: string;
}

export type WalletProvider =
  | 'HORMUUD_EVC_PLUS'
  | 'TELESOM_ZAAD'
  | 'GOLIS_SAHAL'
  | 'EDAHAB'
  | 'PREMIER_WALLET'
  | 'MYCASH'
  | 'OTHER';

export const WALLET_LABELS: Record<WalletProvider, string> = {
  HORMUUD_EVC_PLUS: 'Hormuud EVC Plus',
  TELESOM_ZAAD: 'Telesom ZAAD',
  GOLIS_SAHAL: 'Golis Sahal',
  EDAHAB: 'eDahab',
  PREMIER_WALLET: 'Premier Wallet',
  MYCASH: 'MyCash',
  OTHER: 'Other Wallet',
};

export interface Customer {
  _id: string;
  customerNumber: string;
  name: string;
  phone: string;
  nationalId?: string;
  address?: string;
  notes?: string;
  status: 'ACTIVE' | 'BLOCKED';
  stats: {
    totalTransactions: number;
    totalAmountExchanged: number;
    totalProfitGenerated: number;
    lastVisitAt?: string;
    averageTransactionAmount: number;
  };
  createdAt: string;
}

export interface ExchangeRate {
  _id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  effectiveDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  updatedBy?: User | string;
  createdAt: string;
}

export interface Transaction {
  _id: string;
  transactionNumber: string;
  customerId: Customer | string;
  customerPhone: string;
  walletProvider: WalletProvider;

  // Dual Currency Engine Fields
  amountReceivedUSD: number;
  serviceFeeUSD: number;
  exchangeableAmountUSD: number;
  exchangeRateUGX: number;
  cashPaidUGX: number;
  profitUSD: number;

  // Legacy Fallback Properties
  amountReceived: number;
  serviceFee: number;
  cashPaid: number;
  profit: number;

  referenceNumber: string;
  cashierId: User | string;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING_VERIFICATION';
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface FeeRule {
  _id: string;
  name: string;
  walletProvider: WalletProvider | 'ALL';
  minAmount: number;
  maxAmount: number | null;
  feeType: 'FIXED' | 'PERCENTAGE';
  feeValue: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CashSession {
  _id: string;
  sessionNumber: string;
  currency: 'UGX';
  cashierId: User | string;
  status: 'OPEN' | 'CLOSED';
  openingCash: number;
  openingBalances?: Array<{
    accountType: 'PHYSICAL_CASH' | 'EVC' | 'MOBILE_MONEY';
    provider: 'CASH_DRAWER' | WalletProvider;
    currency: 'UGX' | 'USD';
    amount: number;
  }>;
  closingCashSystem: number;
  closingCashActual?: number;
  discrepancy?: number;
  currentCashBalance?: number;
  totalTransactionsCount?: number;
  totalCashPaidOut?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

export interface InternetCreditPayment {
  _id: string;
  amountUGX: number;
  paidAt: string;
  recordedBy: User | string;
  notes?: string;
  balanceAfterPaymentUGX: number;
}

export interface InternetCredit {
  _id: string;
  customerName: string;
  phone?: string;
  originalAmountUGX: number;
  amountPaidUGX: number;
  remainingBalanceUGX: number;
  description?: string;
  dateGiven: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  payments: InternetCreditPayment[];
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDepositMovement {
  _id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amountUGX: number;
  occurredAt: string;
  recordedBy: User | string;
  notes?: string;
  balanceAfterTransactionUGX: number;
}

export interface CustomerDeposit {
  _id: string;
  customerName: string;
  phone: string;
  totalDepositedUGX: number;
  totalWithdrawnUGX: number;
  currentBalanceUGX: number;
  notes?: string;
  ledger: CustomerDepositMovement[];
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  todayTransactionsCount: number;
  todayVolume: number;
  todayProfit: number;
  todayCashPaidOut: number;
  todayNewCustomers: number;
  openCashiersCount: number;
  cashAvailable: number;
}

export interface AuditLog {
  _id: string;
  userName?: string;
  userRole?: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  details?: any;
  createdAt: string;
}
