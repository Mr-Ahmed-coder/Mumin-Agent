import { Schema, model, Document } from 'mongoose';

export interface ICustomerStats {
  totalTransactions: number;
  totalAmountExchanged: number;
  totalProfitGenerated: number;
  lastVisitAt?: Date;
  averageTransactionAmount: number;
}

export interface ICustomer extends Document {
  customerNumber: string;
  name: string;
  phone: string;
  nationalId?: string;
  address?: string;
  notes?: string;
  status: 'ACTIVE' | 'BLOCKED';
  stats: ICustomerStats;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerNumber: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    nationalId: { type: String, trim: true, index: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
    stats: {
      totalTransactions: { type: Number, default: 0 },
      totalAmountExchanged: { type: Number, default: 0 },
      totalProfitGenerated: { type: Number, default: 0 },
      lastVisitAt: { type: Date },
      averageTransactionAmount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Customer = model<ICustomer>('Customer', CustomerSchema);
