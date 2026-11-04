import { Schema, model, Document, Types } from 'mongoose';

export type DepositMovementType = 'DEPOSIT' | 'WITHDRAWAL';

export interface IDepositMovement {
  operationId?: Types.ObjectId;
  reversesOperationId?: Types.ObjectId;
  type: DepositMovementType;
  amountUGX: number;
  occurredAt: Date;
  recordedBy: Types.ObjectId;
  notes?: string;
  balanceAfterTransactionUGX: number;
}

export interface ICustomerDeposit extends Document {
  customerName: string;
  phone: string;
  totalDepositedUGX: number;
  totalWithdrawnUGX: number;
  currentBalanceUGX: number;
  notes?: string;
  ledger: IDepositMovement[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const movementSchema = new Schema<IDepositMovement>(
  {
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL'], required: true, immutable: true },
    operationId: { type: Schema.Types.ObjectId, ref: 'FinancialOperation', immutable: true },
    reversesOperationId: { type: Schema.Types.ObjectId, ref: 'FinancialOperation', immutable: true },
    amountUGX: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: { validator: Number.isInteger, message: 'Movement amount must be a whole UGX value' },
    },
    occurredAt: { type: Date, default: Date.now, required: true, immutable: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    notes: { type: String, trim: true, maxlength: 500, immutable: true },
    balanceAfterTransactionUGX: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
      validate: { validator: Number.isInteger, message: 'Movement balance must be a whole UGX value' },
    },
  },
  { _id: true }
);

const customerDepositSchema = new Schema<ICustomerDeposit>(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    totalDepositedUGX: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Total deposited must be a whole UGX value' },
    },
    totalWithdrawnUGX: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Total withdrawn must be a whole UGX value' },
    },
    currentBalanceUGX: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Current balance must be a whole UGX value' },
    },
    notes: { type: String, trim: true, maxlength: 500 },
    ledger: { type: [movementSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

customerDepositSchema.index({ customerName: 'text', phone: 'text' });

customerDepositSchema.pre('validate', function (next) {
  if (this.totalDepositedUGX - this.totalWithdrawnUGX !== this.currentBalanceUGX) {
    this.invalidate(
      'currentBalanceUGX',
      'Current balance must equal total deposits minus total withdrawals'
    );
  }
  next();
});

export const CustomerDeposit = model<ICustomerDeposit>('CustomerDeposit', customerDepositSchema);
