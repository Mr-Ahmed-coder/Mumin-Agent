import { Schema, model, Document, Types } from 'mongoose';

export type DepositMovementType = 'DEPOSIT' | 'WITHDRAWAL';

export interface IDepositMovement {
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
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAWAL'], required: true },
    amountUGX: { type: Number, required: true, min: 1 },
    occurredAt: { type: Date, default: Date.now, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
    balanceAfterTransactionUGX: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const customerDepositSchema = new Schema<ICustomerDeposit>(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    totalDepositedUGX: { type: Number, default: 0, min: 0 },
    totalWithdrawnUGX: { type: Number, default: 0, min: 0 },
    currentBalanceUGX: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    ledger: { type: [movementSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

customerDepositSchema.index({ customerName: 'text', phone: 'text' });

export const CustomerDeposit = model<ICustomerDeposit>('CustomerDeposit', customerDepositSchema);
