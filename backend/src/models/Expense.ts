import { Schema, model, Document, Types } from 'mongoose';

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: 'RENT' | 'UTILITIES' | 'SALARY' | 'SUPPLIES' | 'MISC';
  cashSessionId?: Types.ObjectId;
  recordedBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      enum: ['RENT', 'UTILITIES', 'SALARY', 'SUPPLIES', 'MISC'],
      default: 'MISC',
    },
    cashSessionId: { type: Schema.Types.ObjectId, ref: 'CashSession' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Expense = model<IExpense>('Expense', ExpenseSchema);
