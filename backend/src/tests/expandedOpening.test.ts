import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { getOpeningAccountCatalog, prepareOpeningAccounts, reconcileUSDCash } from '../services/openingAccounts.service';
import { buildReconciliationPreview, reconcileAccounts } from '../services/reconciliation.service';
import { CashSession } from '../models/CashSession';
import { WalletProvider } from '../constants/wallets';
import { env } from '../config/env';
import { openExpandedCashSession, getOpeningAccounts, closeCashSession } from '../controllers/cash.controller';

const handlerFailure = (handler: any, req: any) => new Promise<any>((resolve, reject) => {
  handler(req, { status: () => { reject(new Error('Unexpected success response')); } }, resolve);
});

test('expanded account handlers refuse production even when called directly', async () => {
  const previous = env.NODE_ENV;
  env.NODE_ENV = 'production';
  try {
    assert.equal((await handlerFailure(getOpeningAccounts, {})).statusCode, 404);
    assert.equal((await handlerFailure(openExpandedCashSession, {})).statusCode, 404);
  } finally { env.NODE_ENV = previous; }
});

test('expanded opening derives owner from authentication and refuses an existing active shift', async () => {
  const previous = env.NODE_ENV, exists = CashSession.exists;
  env.NODE_ENV = 'development';
  let checked: any;
  (CashSession as any).exists = async (query: any) => { checked = query; return { _id: 'existing' }; };
  try {
    const error = await handlerFailure(openExpandedCashSession, { user: { id: 'authenticated-cashier' }, body: request });
    assert.equal(error.statusCode, 400);
    assert.deepEqual(checked, { cashierId: 'authenticated-cashier', status: 'OPEN' });
  } finally { env.NODE_ENV = previous; CashSession.exists = exists; }
});

test('expanded closing refuses incomplete ledgers and checks cashier ownership first', async () => {
  const original = CashSession.findOne;
  const cashierId = new Types.ObjectId();
  (CashSession as any).findOne = () => ({ sort: async () => ({ cashierId, status: 'OPEN', openingVersion: 2 }) });
  try {
    const blocked = await handlerFailure(closeCashSession, { user: { id: String(cashierId) }, body: { actualBalances: [] } });
    assert.equal(blocked.statusCode, 400);
    assert.match(blocked.message, /Closing is blocked/);
    assert.equal((await handlerFailure(closeCashSession, { user: { id: String(new Types.ObjectId()) }, body: {} })).statusCode, 403);
  } finally { CashSession.findOne = original; }
});

const catalog = getOpeningAccountCatalog('');
const request = { accounts: catalog.map(a => ({ accountId: a.id, amount: 0 })), exchangeRateId: new Types.ObjectId().toString() };

test('all configured wallets and both cash accounts accept independent zero balances', () => {
  const balances = prepareOpeningAccounts(request, catalog);
  assert.equal(balances.length, 9);
  assert.equal(balances.find(a => a.id === 'CASH_UGX')?.currency, 'UGX');
  assert.ok(balances.filter(a => a.id !== 'CASH_UGX').every(a => a.currency === 'USD'));
  assert.equal(new Set(balances.map(a => a.id)).size, balances.length);
});

test('catalog permits custom wallet providers without changing enums', () => {
  const custom = getOpeningAccountCatalog(JSON.stringify([...catalog, { id: 'CUSTOM_BANK', name: 'Custom Bank', kind: 'WALLET', currency: 'USD' }]));
  assert.equal(prepareOpeningAccounts({ ...request, accounts: [...request.accounts, { accountId: 'CUSTOM_BANK', amount: 42.50 }] }, custom).at(-1)?.amount, 42.5);
  assert.throws(() => getOpeningAccountCatalog(JSON.stringify([...catalog, catalog[0]])));
});

test('opening rejects invalid amounts, duplicate/unknown accounts, missing cash and bad rates', () => {
  for (const amount of [-1, NaN, Infinity, 1.001]) {
    assert.throws(() => prepareOpeningAccounts({ ...request, accounts: request.accounts.map(a => ({ ...a, amount })) }, catalog));
  }
  assert.throws(() => prepareOpeningAccounts({ ...request, accounts: [...request.accounts, request.accounts[0]] }, catalog));
  assert.throws(() => prepareOpeningAccounts({ ...request, accounts: request.accounts.slice(2) }, catalog));
  assert.throws(() => prepareOpeningAccounts({ ...request, exchangeRateId: 'bad' }, catalog));
  assert.throws(() => prepareOpeningAccounts({ ...request, accounts: [...request.accounts, { accountId: 'MISSING', amount: 0 }] }, catalog));
});

test('expanded session retains immutable account snapshots and rate without changing legacy closing fields', async () => {
  const session = new CashSession({ cashierId: new Types.ObjectId(), sessionNumber: 'TEST-EXPANDED',
    openingVersion: 2, openingCash: 0, openingBalances: [], accountOpenings: prepareOpeningAccounts(request, catalog),
    openingExchangeRate: { rateId: request.exchangeRateId, rate: 3800, baseCurrency: 'USD', targetCurrency: 'UGX', recordedAt: new Date() } });
  await session.validate();
  assert.equal(session.toObject().openingExchangeRate?.rate, 3800);
  assert.equal(session.accountOpenings?.length, 9);
  assert.equal(CashSession.schema.path('accountOpenings').options.immutable, true);
  assert.ok(CashSession.schema.indexes().some(([fields, options]) => fields.activeShiftKey === 1 && options.unique && options.sparse));
});

test('multiple wallet actual inputs match stable IDs independently of input order', () => {
  const sessionId = new Types.ObjectId(), cashierId = new Types.ObjectId();
  const accounts = [WalletProvider.TELESOM_ZAAD, WalletProvider.GOLIS_SAHAL].map(provider => ({
    _id: new Types.ObjectId(), accountType: 'MOBILE_MONEY', provider, currency: 'USD', amount: 100,
    cashSessionId: sessionId, cashierId, createdBy: cashierId, openedAt: new Date(),
  }));
  const preview = buildReconciliationPreview({ _id: sessionId, openingBalances: accounts, openingCash: 0, cashAdded: [], cashWithdrawn: [] } as any,
    [{ walletProvider: WalletProvider.GOLIS_SAHAL, amountReceivedUSD: 25 }]);
  const actuals = preview.map(a => ({ accountId: a.accountId, accountType: a.accountType, provider: a.provider, currency: a.currency, amount: a.expectedClosingBalance })).reverse();
  assert.deepEqual(reconcileAccounts(preview, actuals).map(a => a.actualClosingBalance), [100, 125]);
  assert.throws(() => reconcileAccounts(preview, [actuals[0], actuals[0]]));
  assert.throws(() => reconcileAccounts(preview, actuals.map(a => ({ ...a, accountId: 'unknown' }))));
  assert.throws(() => reconcileAccounts(preview, actuals.map(a => ({ ...a, currency: 'UGX' })) as any));
  assert.ok(reconcileAccounts(preview, actuals.map(({ accountId, ...legacy }) => legacy)).every(a => a.status === 'BALANCED'));
});

test('USD Cash uses recorded USD inflows/outflows/adjustments and actual minus expected', () => {
  const movements = [
    { accountId: 'CASH_USD', currency: 'USD', direction: 'IN' as const, amount: 25.25, authorized: true, reference: 'receipt-1' },
    { accountId: 'CASH_USD', currency: 'USD', direction: 'OUT' as const, amount: 10, authorized: true, reference: 'payout-1' },
    { accountId: 'CASH_USD', currency: 'USD', direction: 'OUT' as const, amount: 0.25, authorized: true, reference: 'adjustment-1' },
  ];
  assert.equal(reconcileUSDCash(100, 115, movements, true).status, 'BALANCED');
  assert.equal(reconcileUSDCash(100, 110, movements, true).difference, -5);
  assert.equal(reconcileUSDCash(100, 120, movements, true).status, 'OVERAGE');
  assert.throws(() => reconcileUSDCash(100, 100, [], false));
  assert.throws(() => reconcileUSDCash(100, 115, [...movements, movements[0]], true));
  assert.throws(() => reconcileUSDCash(100, 115, [{ ...movements[0], currency: 'UGX' }], true));
  assert.throws(() => reconcileUSDCash(100, 115, [{ ...movements[0], authorized: false }], true));
});
