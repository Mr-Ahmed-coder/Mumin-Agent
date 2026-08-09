import { Schema, model, Document, Types } from 'mongoose';

export interface ICashAdjustment {
  amount: number;
  reason: string;
  addedBy?: Types.ObjectId;
  withdrawnBy?: Types.ObjectId;
  createdAt: Date;
}

export interface ICashSession extends Document {
  cashierId: Types.ObjectId;
  sessionNumber: string;
  currency: 'UGX';
  status: 'OPEN' | 'CLOSED';
  openingCash: number; // UGX
  cashAdded: ICashAdjustment[];
  cashWithdrawn: ICashAdjustment[];
  closingCashSystem: number; // UGX
  closingCashActual?: number; // UGX
  discrepancy?: number; // UGX
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

const CashSessionSchema = new Schema<ICashSession>(
  {
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
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const CashSession = model<ICashSession>('CashSession', CashSessionSchema);
