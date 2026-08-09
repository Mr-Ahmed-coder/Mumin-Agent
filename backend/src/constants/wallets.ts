export enum WalletProvider {
  HORMUUD_EVC_PLUS = 'HORMUUD_EVC_PLUS',
  TELESOM_ZAAD = 'TELESOM_ZAAD',
  GOLIS_SAHAL = 'GOLIS_SAHAL',
  EDAHAB = 'EDAHAB',
  PREMIER_WALLET = 'PREMIER_WALLET',
  MYCASH = 'MYCASH',
  OTHER = 'OTHER',
}

export const WALLET_NAMES: Record<WalletProvider, string> = {
  [WalletProvider.HORMUUD_EVC_PLUS]: 'Hormuud EVC Plus',
  [WalletProvider.TELESOM_ZAAD]: 'Telesom ZAAD',
  [WalletProvider.GOLIS_SAHAL]: 'Golis Sahal',
  [WalletProvider.EDAHAB]: 'eDahab',
  [WalletProvider.PREMIER_WALLET]: 'Premier Wallet',
  [WalletProvider.MYCASH]: 'MyCash',
  [WalletProvider.OTHER]: 'Other Wallet',
};
