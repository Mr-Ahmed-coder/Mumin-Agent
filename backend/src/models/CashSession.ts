import { Schema, model, Document, Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';

export interface IOpeningBalance {
  _id?: Types.ObjectId;
  accountType: 'PHYSICAL_CASH' | 'EVC' | 'MOBILE_MONEY';
  provider: 'CASH_DRAWER' | WalletProvider;
  currency: 'UGX' | 'USD';
  amount: number;
  openedAt: Date;
  cashSessionId: Types.ObjectId;
  cashierId: Types.ObjectId;
  createdBy: Types.ObjectId;
}

export interface ICashAdjustment {
  amount: number;
  reason: string;
  addedBy?: Types.ObjectId;
  withdrawnBy?: Types.ObjectId;
  createdAt: Date;
}

export type ReconciliationStatus = 'BALANCED' | 'SHORTAGE' | 'OVERAGE';

export interface IConfirmedMovement {
  movementType: 'CASH_ADDED' | 'CASH_WITHDRAWN' | 'CASH_PAID_OUT' | 'WALLET_RECEIVED' | 'EXCHANGE' |
    'REVERSAL' | 'ADJUSTMENT' | 'EXPENSE' | 'CUSTOMER_DEPOSIT' | 'CUSTOMER_WITHDRAWAL' | 'CREDIT_REPAYMENT';
  direction: 'IN' | 'OUT';
  amount: number;
  currency: 'UGX' | 'USD';
  transactionCount: number;
}

export interface IAccountReconciliation {
  accountId?: string;
  openingBalanceId?: Types.ObjectId;
  accountType: IOpeningBalance['accountType'] | 'LEDGER_CASH' | 'LEDGER_WALLET';
  provider: string;
  accountName?: string;
  currency: IOpeningBalance['currency'];
  openingBalance: number;
  confirmedMovements: IConfirmedMovement[];
  expectedClosingBalance: number;
  actualClosingBalance: number;
  difference: number;
  status: ReconciliationStatus;
}

export interface IClosingRecord {
  _id?: Types.ObjectId;
  closedAt: Date;
  closedBy: Types.ObjectId;
  accounts: IAccountReconciliation[];
  notes?: string;
  movementRevision?: number;
}

export interface ICashSession extends Document {
  movementRevision?: number;
  ledgerVersion?: number;
  openingVersion?: number;
  activeShiftKey?: string;
  accountOpenings?: { id: string; name: string; kind: 'CASH' | 'WALLET'; currency: 'USD' | 'UGX'; amount: number }[];
  openingExchangeRate?: { rateId: Types.ObjectId; rate: number; baseCurrency: 'USD'; targetCurrency: 'UGX'; recordedAt: Date };
  cashierId: Types.ObjectId;
  sessionNumber: string;
  currency: 'UGX';
  status: 'OPEN' | 'CLOSED';
  openingCash: number; // UGX
  openingBalances: IOpeningBalance[];
  cashAdded: ICashAdjustment[];
  cashWithdrawn: ICashAdjustment[];
  closingCashSystem: number; // UGX
  closingCashActual?: number; // UGX
  discrepancy?: number; // UGX
  closingHistory: IClosingRecord[];
  openedAt: Date;
  closedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashAdjustmentSchema = new Schema({
  amount: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isInteger, message: 'Cash adjustment must be a whole UGX amount' },
  },
  reason: { type: String, required: true },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  withdrawnBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

const OpeningBalanceSchema = new Schema<IOpeningBalance>(
  {
    accountType: { type: String, enum: ['PHYSICAL_CASH', 'EVC', 'MOBILE_MONEY'], required: true },
    provider: {
      type: String,
      enum: ['CASH_DRAWER', ...Object.values(WalletProvider)],
      required: true,
    },
    currency: { type: String, enum: ['UGX', 'USD'], required: true },
    amount: { type: Number, required: true, min: 0 },
    openedAt: { type: Date, required: true, immutable: true },
    cashSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'CashSession',
      required: true,
      immutable: true,
    },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  { _id: true }
);

const ConfirmedMovementSchema = new Schema<IConfirmedMovement>(
  {
    movementType: {
      type: String,
      enum: ['CASH_ADDED', 'CASH_WITHDRAWN', 'CASH_PAID_OUT', 'WALLET_RECEIVED', 'EXCHANGE', 'REVERSAL',
        'ADJUSTMENT', 'EXPENSE', 'CUSTOMER_DEPOSIT', 'CUSTOMER_WITHDRAWAL', 'CREDIT_REPAYMENT'],
      required: true,
    },
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['UGX', 'USD'], required: true },
    transactionCount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const AccountReconciliationSchema = new Schema<IAccountReconciliation>(
  {
    accountId: { type: String },
    openingBalanceId: { type: Schema.Types.ObjectId },
    accountType: { type: String, enum: ['PHYSICAL_CASH', 'EVC', 'MOBILE_MONEY', 'LEDGER_CASH', 'LEDGER_WALLET'], required: true },
    accountName: { type: String },
    provider: {
      type: String,
      required: true,
    },
    currency: { type: String, enum: ['UGX', 'USD'], required: true },
    openingBalance: { type: Number, required: true, min: 0 },
    confirmedMovements: { type: [ConfirmedMovementSchema], required: true },
    expectedClosingBalance: { type: Number, required: true },
    actualClosingBalance: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },
    status: { type: String, enum: ['BALANCED', 'SHORTAGE', 'OVERAGE'], required: true },
  },
  { _id: false }
);

const ClosingRecordSchema = new Schema<IClosingRecord>(
  {
    closedAt: { type: Date, required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accounts: { type: [AccountReconciliationSchema], required: true },
    notes: { type: String, maxlength: 500 },
    movementRevision: { type: Number, min: 0 },
  },
  { _id: true }
);

const hasValidOpeningBalanceSet = function (
  this: ICashSession,
  balances: IOpeningBalance[]
): boolean {
  if (this.openingVersion === 2) return balances.length === 0;
  if (
    Array.isArray(balances) &&
    balances.length === 0 &&
    !this.isNew &&
    !this.isModified('openingBalances')
  ) {
    return true;
  }

  if (!Array.isArray(balances) || balances.length !== 3) return false;

  const byAccount = new Map(balances.map((balance) => [balance.accountType, balance]));
  if (byAccount.size !== 3) return false;

  const physicalCash = byAccount.get('PHYSICAL_CASH');
  const evc = byAccount.get('EVC');
  const mobileMoney = byAccount.get('MOBILE_MONEY');
  if (!physicalCash || !evc || !mobileMoney) return false;

  const metadataMatchesSession = balances.every(
    (balance) =>
      balance.cashSessionId?.toString() === this._id.toString() &&
      balance.cashierId?.toString() === this.cashierId.toString() &&
      balance.createdBy &&
      balance.openedAt instanceof Date &&
      !Number.isNaN(balance.openedAt.getTime()) &&
      Number.isFinite(balance.amount) &&
      balance.amount >= 0
  );

  return (
    metadataMatchesSession &&
    physicalCash.provider === 'CASH_DRAWER' &&
    physicalCash.currency === 'UGX' &&
    Number.isInteger(physicalCash.amount) &&
    physicalCash.amount === this.openingCash &&
    evc.provider === WalletProvider.HORMUUD_EVC_PLUS &&
    evc.currency === 'USD' &&
    mobileMoney.provider !== WalletProvider.HORMUUD_EVC_PLUS &&
    mobileMoney.provider !== 'CASH_DRAWER' &&
    mobileMoney.currency === 'USD'
  );
};

const CashSessionSchema = new Schema<ICashSession>(
  {
    movementRevision: { type: Number, default: 0 },
    ledgerVersion: { type: Number, enum: [1], immutable: true },
    openingVersion: { type: Number, enum: [1, 2], immutable: true },
    activeShiftKey: { type: String },
    accountOpenings: { type: [{
      _id: false,
      id: { type: String, required: true }, name: { type: String, required: true },
      kind: { type: String, enum: ['CASH', 'WALLET'], required: true },
      currency: { type: String, enum: ['USD', 'UGX'], required: true },
      amount: { type: Number, required: true, min: 0 },
    }], default: undefined, immutable: true },
    openingExchangeRate: { type: new Schema({
      rateId: { type: Schema.Types.ObjectId, ref: 'ExchangeRate', required: true },
      rate: { type: Number, required: true, min: 0.0001 },
      baseCurrency: { type: String, enum: ['USD'], required: true },
      targetCurrency: { type: String, enum: ['UGX'], required: true },
      recordedAt: { type: Date, required: true },
    }, { _id: false }), immutable: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionNumber: { type: String, required: true, unique: true },
    currency: { type: String, enum: ['UGX'], default: 'UGX', required: true, immutable: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
    openingCash: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Opening cash must be a whole UGX amount' },
    },
    openingBalances: {
      type: [OpeningBalanceSchema],
      default: [],
      validate: {
        validator: hasValidOpeningBalanceSet,
        message:
          'Opening balances must contain one UGX cash drawer, one USD EVC account, and one USD Mobile Money account associated with this session',
      },
    },
    cashAdded: [CashAdjustmentSchema],
    cashWithdrawn: [CashAdjustmentSchema],
    closingCashSystem: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'Expected closing cash must be a whole UGX amount' },
    },
    closingCashActual: {
      type: Number,
      validate: { validator: Number.isInteger, message: 'Actual closing cash must be a whole UGX amount' },
    },
    discrepancy: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'Cash difference must be a whole UGX amount' },
    },
    closingHistory: { type: [ClosingRecordSchema], default: [] },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

// Backfill association metadata when an older session is saved. New sessions
// always provide these values explicitly when the shift is opened.
CashSessionSchema.pre('validate', function (next) {
  if (this.openingVersion === 2) {
    const accounts = this.accountOpenings || [];
    const cashUGX = accounts.find(a => a.id === 'CASH_UGX');
    const cashUSD = accounts.find(a => a.id === 'CASH_USD');
    if (new Set(accounts.map(a => a.id)).size !== accounts.length || !cashUGX || !cashUSD ||
        cashUGX.currency !== 'UGX' || cashUSD.currency !== 'USD' || cashUGX.kind !== 'CASH' || cashUSD.kind !== 'CASH' ||
        cashUGX.amount !== this.openingCash || !this.openingExchangeRate ||
        accounts.some(a => a.kind === 'WALLET' && a.currency !== 'USD') ||
        accounts.some(a => !Number.isFinite(a.amount) || a.amount < 0 ||
          (a.currency === 'UGX' ? !Number.isSafeInteger(a.amount) : !Number.isSafeInteger(Math.round(a.amount * 100)) || Math.abs(a.amount * 100 - Math.round(a.amount * 100)) > 0.000001))) {
      this.invalidate('accountOpenings', 'Invalid expanded opening accounts or exchange rate');
    }
  }
  const openedAt = this.openedAt || this.createdAt || new Date();

  for (const balance of this.openingBalances || []) {
    if (!balance.openedAt) balance.openedAt = openedAt;
    if (!balance.cashSessionId) balance.cashSessionId = this._id;
    if (!balance.cashierId) balance.cashierId = this.cashierId;
    if (!balance.createdBy) balance.createdBy = this.cashierId;
  }

  next();
});

CashSessionSchema.index({ activeShiftKey: 1 }, { unique: true, sparse: true });
export const CashSession = model<ICashSession>('CashSession', CashSessionSchema);
