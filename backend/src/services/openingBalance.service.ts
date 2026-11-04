import { Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';
import { IOpeningBalance } from '../models/CashSession';

interface CreateOpeningBalancesInput {
  cashSessionId: Types.ObjectId;
  cashierId: Types.ObjectId;
  createdBy: Types.ObjectId;
  openedAt: Date;
  openingCashUGX: number;
  evcOpeningBalanceUSD: number;
  mobileMoneyOpeningBalanceUSD: number;
  mobileMoneyProvider: WalletProvider;
}

export const createOpeningBalances = ({
  cashSessionId,
  cashierId,
  createdBy,
  openedAt,
  openingCashUGX,
  evcOpeningBalanceUSD,
  mobileMoneyOpeningBalanceUSD,
  mobileMoneyProvider,
}: CreateOpeningBalancesInput): IOpeningBalance[] => [
  {
    accountType: 'PHYSICAL_CASH',
    provider: 'CASH_DRAWER',
    currency: 'UGX',
    amount: openingCashUGX,
    openedAt,
    cashSessionId,
    cashierId,
    createdBy,
  },
  {
    accountType: 'EVC',
    provider: WalletProvider.HORMUUD_EVC_PLUS,
    currency: 'USD',
    amount: evcOpeningBalanceUSD,
    openedAt,
    cashSessionId,
    cashierId,
    createdBy,
  },
  {
    accountType: 'MOBILE_MONEY',
    provider: mobileMoneyProvider,
    currency: 'USD',
    amount: mobileMoneyOpeningBalanceUSD,
    openedAt,
    cashSessionId,
    cashierId,
    createdBy,
  },
];
