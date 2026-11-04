import { Schema, model } from 'mongoose';

const leg = new Schema({
  accountId: { type: String, required: true, immutable: true },
  currency: { type: String, enum: ['USD', 'UGX'], required: true, immutable: true },
  direction: { type: String, enum: ['IN', 'OUT'], required: true, immutable: true },
  amountMinor: { type: Number, required: true, min: 1, immutable: true, validate: Number.isSafeInteger },
}, { _id: false });

// Both sides live in ONE append-only event. Event context applies to every leg.
const schema = new Schema({
  cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  shiftId: { type: Schema.Types.ObjectId, ref: 'CashSession', required: true, immutable: true },
  requestKey: { type: String, required: true, immutable: true },
  fingerprint: { type: String, required: true, immutable: true },
  reference: { type: String, required: true, immutable: true },
  referenceKey: { type: String, immutable: true },
  category: { type: String, required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  reason: { type: String, immutable: true },
  recordId: { type: Schema.Types.ObjectId, immutable: true },
  transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', immutable: true },
  reversesOperationId: { type: Schema.Types.ObjectId, ref: 'FinancialOperation', immutable: true },
  exchangeRate: { type: new Schema({
    rateId: Schema.Types.ObjectId, rate: Number, baseCurrency: String, targetCurrency: String,
  }, { _id: false }), immutable: true },
  feeUSD: { type: Number, default: 0, immutable: true },
  feeUGX: { type: Number, default: 0, immutable: true },
  // Fee metadata is NOT another money movement; retained payout is the fee.
  legs: { type: [leg], required: true, immutable: true, validate: (value: unknown[]) => value.length > 0 },
}, { versionKey: false });
schema.index({ cashierId: 1, requestKey: 1 }, { unique: true });
schema.index({ shiftId: 1, occurredAt: 1 });
schema.index({ reversesOperationId: 1 }, { unique: true, sparse: true });
schema.index({ referenceKey: 1 }, { unique: true, sparse: true });
for (const method of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  schema.pre(method as any, function () { throw new Error('Financial operations are append-only; record an authorized reversal'); });
}
schema.pre('save', function () { if (!this.isNew) throw new Error('Financial operations are append-only'); });
export const FinancialOperation = model('FinancialOperation', schema);
