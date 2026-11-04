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

    if (!Number.isFinite(amount)) throw ApiError.badRequest('Amount must be finite');
    // This API serves USD-to-UGX only. The confirmed 1% policy supersedes
    // legacy tiers for new exchanges. Historical rules/snapshots are retained.
    return amount / 100;
  }
}
