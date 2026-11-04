import { Types } from 'mongoose';
import {
  DepositMovementType,
  IDepositMovement,
} from '../models/CustomerDeposit';
import { ApiError } from '../utils/ApiError';

export interface CustomerDepositMovementTarget {
  totalDepositedUGX: number;
  totalWithdrawnUGX: number;
  currentBalanceUGX: number;
  ledger: IDepositMovement[];
}

interface ApplyMovementInput {
  operationId?: Types.ObjectId;
  reversesOperationId?: Types.ObjectId;
  type: DepositMovementType;
  amountUGX: number;
  recordedBy: Types.ObjectId;
  occurredAt?: Date;
  notes?: string;
}

export const applyCustomerDepositMovement = (
  record: CustomerDepositMovementTarget,
  input: ApplyMovementInput
): IDepositMovement => {
  if (!Number.isInteger(input.amountUGX) || input.amountUGX <= 0) {
    throw ApiError.badRequest('Amount must be a positive whole UGX value');
  }
  if (record.totalDepositedUGX - record.totalWithdrawnUGX !== record.currentBalanceUGX) {
    throw ApiError.badRequest('Customer deposit balances are inconsistent and require administrator review');
  }
  if (input.type === 'WITHDRAWAL' && input.amountUGX > record.currentBalanceUGX) {
    throw ApiError.badRequest('Withdrawal cannot exceed the customer current UGX balance');
  }

  if (input.type === 'DEPOSIT') {
    record.totalDepositedUGX += input.amountUGX;
    record.currentBalanceUGX += input.amountUGX;
  } else {
    record.totalWithdrawnUGX += input.amountUGX;
    record.currentBalanceUGX -= input.amountUGX;
  }

  const movement: IDepositMovement = {
    ...(input.operationId ? { operationId: input.operationId } : {}),
    ...(input.reversesOperationId ? { reversesOperationId: input.reversesOperationId } : {}),
    type: input.type,
    amountUGX: input.amountUGX,
    occurredAt: input.occurredAt || new Date(),
    recordedBy: input.recordedBy,
    notes: input.notes,
    balanceAfterTransactionUGX: record.currentBalanceUGX,
  };
  record.ledger.push(movement);
  return movement;
};
