import { Schema, model, Document, Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';

export interface IFeeRule extends Document {
  name: string;
  walletProvider: WalletProvider | 'ALL';
  minAmount: number;
  maxAmount: number | null; // null represents upper infinity (e.g., 500,001+)
  feeType: 'FIXED' | 'PERCENTAGE';
  feeValue: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeeRuleSchema = new Schema<IFeeRule>(
  {
    name: { type: String, required: true, trim: true },
    walletProvider: { type: String, required: true, default: 'ALL' },
    minAmount: { type: Number, required: true, min: 0 },
    maxAmount: { type: Number, default: null },
    feeType: { type: String, enum: ['FIXED', 'PERCENTAGE'], required: true },
    feeValue: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const FeeRule = model<IFeeRule>('FeeRule', FeeRuleSchema);
