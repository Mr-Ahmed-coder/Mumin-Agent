import { Types } from 'mongoose';
import {
  IInternetCreditPayment,
  InternetCreditStatus,
} from '../models/InternetCredit';
import { ApiError } from '../utils/ApiError';

export interface InternetCreditPaymentTarget {
  originalAmountUGX: number;
  amountPaidUGX: number;
  remainingBalanceUGX: number;
  status: InternetCreditStatus;
  payments: IInternetCreditPayment[];
}

interface ApplyPaymentInput {
  operationId?: Types.ObjectId;
  amountUGX: number;
  recordedBy: Types.ObjectId;
  paidAt?: Date;
  notes?: string;
}

export const applyInternetCreditPayment = (
  record: InternetCreditPaymentTarget,
  input: ApplyPaymentInput
): IInternetCreditPayment => {
  if (!Number.isInteger(input.amountUGX) || input.amountUGX <= 0) {
    throw ApiError.badRequest('Payment must be a positive whole UGX amount');
  }
  if (record.status === 'PAID' || record.remainingBalanceUGX === 0) {
    throw ApiError.badRequest('Paid internet credit records cannot receive additional payments');
  }
  if (record.amountPaidUGX + record.remainingBalanceUGX !== record.originalAmountUGX) {
    throw ApiError.badRequest('Internet credit balances are inconsistent and require administrator review');
  }
  if (input.amountUGX > record.remainingBalanceUGX) {
    throw ApiError.badRequest('Payment cannot exceed the remaining UGX balance');
  }

  const newPaid = record.amountPaidUGX + input.amountUGX;
  const newRemaining = record.originalAmountUGX - newPaid;
  const payment: IInternetCreditPayment = {
    ...(input.operationId ? { operationId: input.operationId } : {}),
    amountUGX: input.amountUGX,
    paidAt: input.paidAt || new Date(),
    recordedBy: input.recordedBy,
    notes: input.notes,
    balanceAfterPaymentUGX: newRemaining,
  };

  record.amountPaidUGX = newPaid;
  record.remainingBalanceUGX = newRemaining;
  record.status = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  record.payments.push(payment);
  return payment;
};
