import { Schema, model, Document, Types } from 'mongoose';

export interface IExchangeRate extends Document {
  baseCurrency: 'USD';
  targetCurrency: 'UGX';
  rate: number;
  effectiveDate: Date;
  status: 'ACTIVE' | 'INACTIVE';
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExchangeRateSchema = new Schema<IExchangeRate>(
  {
    baseCurrency: { type: String, enum: ['USD'], default: 'USD', required: true },
    targetCurrency: { type: String, enum: ['UGX'], default: 'UGX', required: true },
    rate: { type: Number, required: true, min: 0.0001 },
    effectiveDate: { type: Date, default: Date.now, required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ExchangeRateSchema.index({ baseCurrency: 1, targetCurrency: 1, effectiveDate: -1 });
ExchangeRateSchema.index(
  { baseCurrency: 1, targetCurrency: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

export const ExchangeRate = model<IExchangeRate>('ExchangeRate', ExchangeRateSchema);
