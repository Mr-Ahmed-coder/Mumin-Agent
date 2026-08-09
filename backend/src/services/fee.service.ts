import { FeeRule, IFeeRule } from '../models/FeeRule';
import { WalletProvider } from '../constants/wallets';
import { ApiError } from '../utils/ApiError';

export class FeeService {
  /**
   * Calculates fee for a given wallet provider and transaction amount
   */
  static async calculateFee(amount: number, provider: WalletProvider): Promise<number> {
    if (amount <= 0) {
      throw ApiError.badRequest('Transaction amount must be greater than 0');
    }

    // Find applicable active fee rule (matching specific wallet or 'ALL')
    const rules = await FeeRule.find({
      status: 'ACTIVE',
      $or: [{ walletProvider: provider }, { walletProvider: 'ALL' }],
      minAmount: { $lte: amount },
    }).sort({ minAmount: -1 }); // Pick highest matching tier

    const matchingRule = rules.find(
      (rule) => rule.maxAmount === null || rule.maxAmount >= amount
    );

    if (!matchingRule) {
      // Default fallback fee calculation if no dynamic rule configured
      if (amount <= 100) return 1;
      if (amount <= 500) return 2.5;
      if (amount <= 1000) return 5;
      return Math.round(amount * 0.01 * 100) / 100;
    }

    if (matchingRule.feeType === 'FIXED') {
      return matchingRule.feeValue;
    } else {
      // PERCENTAGE
      return Math.round((amount * matchingRule.feeValue) / 100 * 100) / 100;
    }
  }
}
