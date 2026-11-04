import { CashSession } from '../models/CashSession';
import { ApiError } from '../utils/ApiError';

export const rejectExpandedLegacyWrite = async (cashierId: string | undefined) => {
  if (await CashSession.exists({ cashierId, status: 'OPEN', $or: [{ openingVersion: 2 }, { ledgerVersion: 1 }] })) {
    throw ApiError.badRequest('This expanded shift requires the development account-operations API so account movements are recorded atomically');
  }
};
