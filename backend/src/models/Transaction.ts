import { Schema, model, Document, Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';

export interface ITransaction extends Document {
  transactionNumber: string;
  cashSessionId?: Types.ObjectId;
  customerId: Types.ObjectId;
  customerPhone: string;
  walletProvider: WalletProvider;
  
  // Dual Currency Fields
  amountReceivedUSD: number;     // Customer sends USD balance
  serviceFeeUSD: number;         // System service fee in USD
  exchangeableAmountUSD: number; // USD amount available for conversion = amountReceivedUSD - serviceFeeUSD
  exchangeRateUGX: number;       // Applied USD -> UGX exchange rate at time of transaction
  cashPaidUGX: number;           // Physical UGX cash handed to customer = exchangeableAmountUSD * exchangeRateUGX
  profitUSD: number;             // Direct service fee profit in USD

  // Backward Compatibility Properties
  amountReceived: number;
  serviceFee: number;
  cashPaid: number;
  profit: number;

  referenceNumber: string;
  cashierId: Types.ObjectId;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING_VERIFICATION';
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionNumber: { type: String, required: true, unique: true, index: true },
    cashSessionId: { type: Schema.Types.ObjectId, ref: 'CashSession', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerPhone: { type: String, required: true, index: true },
    walletProvider: { type: String, enum: Object.values(WalletProvider), required: true, index: true },
    
    // Dual Currency Core Fields
    amountReceivedUSD: { type: Number, required: true, min: 0.01 },
    serviceFeeUSD: { type: Number, required: true, min: 0 },
    exchangeableAmountUSD: { type: Number, required: true, min: 0 },
    exchangeRateUGX: { type: Number, required: true, min: 0.0001 },
    cashPaidUGX: { type: Number, required: true, min: 0 },
    profitUSD: { type: Number, required: true, min: 0 },

    // Legacy fallback fields for backwards compatibility
    amountReceived: { type: Number },
    serviceFee: { type: Number },
    cashPaid: { type: Number },
    profit: { type: Number },

    referenceNumber: { type: String, required: true, trim: true, index: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['COMPLETED', 'CANCELLED', 'PENDING_VERIFICATION'], default: 'COMPLETED', index: true },
    notes: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure legacy fields populate if not set
TransactionSchema.pre('save', function (next) {
  if (this.amountReceived === undefined) this.amountReceived = this.amountReceivedUSD;
  if (this.serviceFee === undefined) this.serviceFee = this.serviceFeeUSD;
  if (this.cashPaid === undefined) this.cashPaid = this.cashPaidUGX;
  if (this.profit === undefined) this.profit = this.profitUSD;
  next();
});

export const Transaction = model<ITransaction>('Transaction', TransactionSchema);
