import { Types } from 'mongoose';
import {
  IAccountReconciliation,
  ICashSession,
  IConfirmedMovement,
  IOpeningBalance,
  ReconciliationStatus,
} from '../models/CashSession';
import { ApiError } from '../utils/ApiError';

export interface ReconciliationTransaction {
  walletProvider: string;
  amountReceivedUSD?: number;
  amountReceived?: number;
  cashPaidUGX?: number;
  cashPaid?: number;
}

export interface ActualBalanceInput {
  accountId?: string;
  accountType: IOpeningBalance['accountType'];
  provider: IOpeningBalance['provider'];
  currency: IOpeningBalance['currency'];
  amount: number;
}

export type AccountReconciliationPreview = Omit<
  IAccountReconciliation,
  'actualClosingBalance' | 'difference' | 'status' | 'accountType' | 'provider'
> & Pick<IOpeningBalance, 'accountType' | 'provider'>;

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const cashPaidUGX = (transaction: ReconciliationTransaction): number =>
  transaction.cashPaidUGX ?? transaction.cashPaid ?? 0;
const amountReceivedUSD = (transaction: ReconciliationTransaction): number =>
  transaction.amountReceivedUSD ?? transaction.amountReceived ?? 0;

const accountKey = (account: { accountType: string; provider: string; currency: string }) =>
  `${account.accountType}:${account.provider}:${account.currency}`;

export const reconciliationAccountId = (account: { accountId?: string; openingBalanceId?: Types.ObjectId; accountType: string; provider: string; currency: string }) =>
  account.accountId || account.openingBalanceId?.toString() || `${account.accountType}:${account.provider}:${account.currency}`;

const movement = (
  movementType: IConfirmedMovement['movementType'],
  direction: IConfirmedMovement['direction'],
  amount: number,
  currency: IConfirmedMovement['currency'],
  transactionCount: number
): IConfirmedMovement => ({ movementType, direction, amount, currency, transactionCount });

export const buildReconciliationPreview = (
  session: Pick<ICashSession, '_id' | 'openingCash' | 'openingBalances' | 'cashAdded' | 'cashWithdrawn'>,
  completedTransactions: ReconciliationTransaction[]
): AccountReconciliationPreview[] => {
  const totalCashAdded = sum(session.cashAdded.map((entry) => entry.amount));
  const totalCashWithdrawn = sum(session.cashWithdrawn.map((entry) => entry.amount));
  const totalCashPaidOut = sum(completedTransactions.map(cashPaidUGX));

  const openingBalances: IOpeningBalance[] = session.openingBalances.length
    ? session.openingBalances
    : [
        {
          accountType: 'PHYSICAL_CASH',
          provider: 'CASH_DRAWER',
          currency: 'UGX',
          amount: session.openingCash,
          openedAt: new Date(0),
          cashSessionId: session._id as Types.ObjectId,
          cashierId: new Types.ObjectId(),
          createdBy: new Types.ObjectId(),
        },
      ];

  return openingBalances.map((opening) => {
    if (opening.accountType === 'PHYSICAL_CASH') {
      const confirmedMovements = [
        movement('CASH_ADDED', 'IN', totalCashAdded, 'UGX', session.cashAdded.length),
        movement('CASH_WITHDRAWN', 'OUT', totalCashWithdrawn, 'UGX', session.cashWithdrawn.length),
        movement('CASH_PAID_OUT', 'OUT', totalCashPaidOut, 'UGX', completedTransactions.length),
      ];

      return {
        accountId: opening._id?.toString() || accountKey(opening),
        openingBalanceId: opening._id,
        accountType: opening.accountType,
        provider: opening.provider,
        currency: opening.currency,
        openingBalance: opening.amount,
        confirmedMovements,
        expectedClosingBalance: opening.amount + totalCashAdded - totalCashWithdrawn - totalCashPaidOut,
      };
    }

    const matchingTransactions = completedTransactions.filter(
      (transaction) => transaction.walletProvider === opening.provider
    );
    const received = sum(matchingTransactions.map(amountReceivedUSD));

    return {
      accountId: opening._id?.toString() || accountKey(opening),
      openingBalanceId: opening._id,
      accountType: opening.accountType,
      provider: opening.provider,
      currency: opening.currency,
      openingBalance: opening.amount,
      confirmedMovements: [
        movement('WALLET_RECEIVED', 'IN', received, 'USD', matchingTransactions.length),
      ],
      expectedClosingBalance: opening.amount + received,
    };
  });
};

export const reconciliationStatus = (difference: number): ReconciliationStatus =>
  difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORTAGE' : 'OVERAGE';

export const reconcileAccounts = (
  preview: AccountReconciliationPreview[],
  actualBalances: ActualBalanceInput[]
): IAccountReconciliation[] => {
  const actualByAccount = new Map(actualBalances.map((actual) => [actual.accountId || accountKey(actual), actual]));
  if (new Set(preview.map(reconciliationAccountId)).size !== preview.length) throw new Error('Duplicate reconciliation account IDs');

  if (actualByAccount.size !== actualBalances.length) {
    throw new Error('Each actual closing balance may be submitted only once');
  }

  if (actualBalances.length !== preview.length) {
    throw new Error('An actual closing balance is required for every applicable account');
  }

  const usedActuals = new Set<ActualBalanceInput>();
  return preview.map((account) => {
    const actual = actualByAccount.get(reconciliationAccountId(account)) ||
      actualBalances.find(a => !a.accountId && accountKey(a) === accountKey(account));
    if (!actual) {
      throw new Error(`Missing actual closing balance for ${account.accountType}`);
    }

    if (accountKey(actual) !== accountKey(account) || !Number.isFinite(actual.amount) || actual.amount < 0 ||
        (account.currency === 'UGX' && !Number.isInteger(actual.amount))) throw new Error('Actual balance does not match its account and currency');
    if (usedActuals.has(actual)) throw new Error('A separate actual balance is required for each account ID');
    usedActuals.add(actual);

    const difference = actual.amount - account.expectedClosingBalance;
    return {
      ...account,
      actualClosingBalance: actual.amount,
      difference,
      status: reconciliationStatus(difference),
    };
  });
};

export const assertOpenSessionModification = (
  status: ICashSession['status'],
  sessionCashierId: string,
  actorId: string
): void => {
  if (sessionCashierId !== actorId) {
    throw ApiError.forbidden('Cashiers may only modify their own cash session');
  }
  if (status !== 'OPEN') {
    throw ApiError.badRequest('This cash session has already been closed');
  }
};
