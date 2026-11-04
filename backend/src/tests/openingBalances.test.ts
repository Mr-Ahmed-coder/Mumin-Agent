import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { WalletProvider } from '../constants/wallets';
import { openCashSessionSchema } from '../dtos/cash.dto';
import { CashSession, IOpeningBalance } from '../models/CashSession';
import { createOpeningBalances } from '../services/openingBalance.service';

const createTestSession = (openingBalances?: IOpeningBalance[]) => {
  const cashSessionId = new Types.ObjectId();
  const cashierId = new Types.ObjectId();
  const createdBy = new Types.ObjectId();
  const openedAt = new Date('2026-08-19T08:00:00.000Z');
  const balances =
    openingBalances ||
    createOpeningBalances({
      cashSessionId,
      cashierId,
      createdBy,
      openedAt,
      openingCashUGX: 8_500_000,
      evcOpeningBalanceUSD: 1_500,
      mobileMoneyOpeningBalanceUSD: 800,
      mobileMoneyProvider: WalletProvider.TELESOM_ZAAD,
    });

  return {
    cashSessionId,
    cashierId,
    createdBy,
    openedAt,
    session: new CashSession({
      _id: cashSessionId,
      cashierId,
      sessionNumber: `CS-TEST-${cashSessionId.toString().slice(-6)}`,
      currency: 'UGX',
      status: 'OPEN',
      openingCash: 8_500_000,
      openingBalances: balances,
      closingCashSystem: 8_500_000,
      openedAt,
    }),
  };
};

test('creates three separate opening accounts with confirmed currencies', async () => {
  const { session } = createTestSession();
  await session.validate();

  assert.equal(session.openingBalances.length, 3);
  assert.deepEqual(
    session.openingBalances.map(({ accountType, provider, currency, amount }) => ({
      accountType,
      provider,
      currency,
      amount,
    })),
    [
      {
        accountType: 'PHYSICAL_CASH',
        provider: 'CASH_DRAWER',
        currency: 'UGX',
        amount: 8_500_000,
      },
      {
        accountType: 'EVC',
        provider: WalletProvider.HORMUUD_EVC_PLUS,
        currency: 'USD',
        amount: 1_500,
      },
      {
        accountType: 'MOBILE_MONEY',
        provider: WalletProvider.TELESOM_ZAAD,
        currency: 'USD',
        amount: 800,
      },
    ]
  );
});

test('serialized opening balances retain session, cashier, creator, and opening time', async () => {
  const { session, cashSessionId, cashierId, createdBy, openedAt } = createTestSession();
  await session.validate();

  const retrieved = session.toObject();
  for (const balance of retrieved.openingBalances) {
    assert.ok(balance._id, 'each opening balance needs a stable identifier');
    assert.equal(balance.cashSessionId.toString(), cashSessionId.toString());
    assert.equal(balance.cashierId.toString(), cashierId.toString());
    assert.equal(balance.createdBy.toString(), createdBy.toString());
    assert.equal(balance.openedAt.toISOString(), openedAt.toISOString());
  }
});

test('model validation rejects combined, duplicated, or currency-mismatched accounts', async () => {
  const { cashSessionId, cashierId, createdBy, openedAt } = createTestSession();
  const invalidBalances = createOpeningBalances({
    cashSessionId,
    cashierId,
    createdBy,
    openedAt,
    openingCashUGX: 8_500_000,
    evcOpeningBalanceUSD: 1_500,
    mobileMoneyOpeningBalanceUSD: 800,
    mobileMoneyProvider: WalletProvider.TELESOM_ZAAD,
  });
  invalidBalances[2].accountType = 'EVC';
  invalidBalances[2].currency = 'UGX';

  const invalid = createTestSession(invalidBalances as IOpeningBalance[]).session;
  await assert.rejects(
    invalid.validate(),
    /Opening balances must contain one UGX cash drawer, one USD EVC account, and one USD Mobile Money account/
  );
});

test('open-shift request validation enforces amounts and provider separation', () => {
  const valid = openCashSessionSchema.safeParse({
    body: {
      openingCash: 8_500_000,
      evcOpeningBalanceUSD: 1_500.25,
      mobileMoneyOpeningBalanceUSD: 800,
      mobileMoneyProvider: WalletProvider.TELESOM_ZAAD,
    },
  });
  assert.equal(valid.success, true);

  const invalid = openCashSessionSchema.safeParse({
    body: {
      openingCash: 8_500_000.5,
      evcOpeningBalanceUSD: -1,
      mobileMoneyOpeningBalanceUSD: 800,
      mobileMoneyProvider: WalletProvider.HORMUUD_EVC_PLUS,
    },
  });
  assert.equal(invalid.success, false);
});

test('legacy sessions without digital opening balances remain closable', async () => {
  const legacy = CashSession.hydrate({
    _id: new Types.ObjectId(),
    cashierId: new Types.ObjectId(),
    sessionNumber: 'CS-LEGACY-001',
    currency: 'UGX',
    status: 'OPEN',
    openingCash: 500_000,
    closingCashSystem: 500_000,
    openedAt: new Date('2026-08-01T08:00:00.000Z'),
  });

  legacy.status = 'CLOSED';
  await legacy.validate();
  assert.equal(legacy.status, 'CLOSED');
});
