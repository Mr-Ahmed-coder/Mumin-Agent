import { Schema, model, Document, Types } from 'mongoose';

export type InternetCreditStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface IInternetCreditPayment {
  amountUGX: number;
  paidAt: Date;
  recordedBy: Types.ObjectId;
  notes?: string;
  balanceAfterPaymentUGX: number;
}

export interface IInternetCredit extends Document {
  customerName: string;
  phone?: string;
  originalAmountUGX: number;
  amountPaidUGX: number;
  remainingBalanceUGX: number;
  description?: string;
  dateGiven: Date;
  status: InternetCreditStatus;
  payments: IInternetCreditPayment[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IInternetCreditPayment>(
  {
    amountUGX: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, default: Date.now, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
    balanceAfterPaymentUGX: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const internetCreditSchema = new Schema<IInternetCredit>(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    originalAmountUGX: { type: Number, required: true, min: 1 },
    amountPaidUGX: { type: Number, default: 0, min: 0 },
    remainingBalanceUGX: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    dateGiven: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

internetCreditSchema.index({ customerName: 'text', phone: 'text' });

export const InternetCredit = model<IInternetCredit>('InternetCredit', internetCreditSchema);
