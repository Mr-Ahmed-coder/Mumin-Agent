import { Schema, model, Document, Types } from 'mongoose';

export type InternetCreditStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface IInternetCreditPayment {
  operationId?: Types.ObjectId;
  kind?: 'PAYMENT' | 'REVERSAL';
  reversesOperationId?: Types.ObjectId;
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
    kind: { type: String, enum: ['PAYMENT', 'REVERSAL'], immutable: true },
    reversesOperationId: { type: Schema.Types.ObjectId, ref: 'FinancialOperation', immutable: true },
    operationId: { type: Schema.Types.ObjectId, ref: 'FinancialOperation', immutable: true },
    amountUGX: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: { validator: Number.isInteger, message: 'Payment must be a whole UGX amount' },
    },
    paidAt: { type: Date, default: Date.now, required: true, immutable: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    notes: { type: String, trim: true, maxlength: 500, immutable: true },
    balanceAfterPaymentUGX: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
      validate: { validator: Number.isInteger, message: 'Payment balance must be a whole UGX amount' },
    },
  },
  { _id: true }
);

const internetCreditSchema = new Schema<IInternetCredit>(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    originalAmountUGX: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Original credit must be a whole UGX amount' },
    },
    amountPaidUGX: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Amount paid must be a whole UGX amount' },
    },
    remainingBalanceUGX: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Remaining balance must be a whole UGX amount' },
    },
    description: { type: String, trim: true, maxlength: 500 },
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

internetCreditSchema.pre('validate', function (next) {
  const expectedRemaining = this.originalAmountUGX - this.amountPaidUGX;
  const expectedStatus: InternetCreditStatus =
    this.amountPaidUGX === 0 ? 'UNPAID' : expectedRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';

  if (expectedRemaining !== this.remainingBalanceUGX) {
    this.invalidate('remainingBalanceUGX', 'Remaining balance must equal original credit minus payments');
  }
  if (expectedStatus !== this.status) {
    this.invalidate('status', 'Status must match the current UGX balance');
  }
  next();
});

export const InternetCredit = model<IInternetCredit>('InternetCredit', internetCreditSchema);
