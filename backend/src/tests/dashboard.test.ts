import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '../constants/roles';
import { buildDashboardCashierScope } from '../controllers/dashboard.controller';
import { authorize } from '../middlewares/auth';

test('cashier dashboard queries are restricted to the authenticated cashier', () => {
  assert.deepEqual(buildDashboardCashierScope(UserRole.CASHIER, 'cashier-1'), {
    cashierId: 'cashier-1',
  });
  assert.deepEqual(buildDashboardCashierScope(UserRole.MANAGER, 'manager-1'), {});
  assert.deepEqual(buildDashboardCashierScope(UserRole.ADMIN, 'admin-1'), {});
});

test('cashier cannot access management dashboard charts', () => {
  const middleware = authorize(UserRole.ADMIN, UserRole.MANAGER);
  let error: any;
  middleware(
    {
      user: {
        id: 'cashier-1',
        name: 'Cashier',
        email: 'cashier@example.com',
        role: UserRole.CASHIER,
      },
    } as any,
    {} as any,
    (nextError?: any) => { error = nextError; }
  );
  assert.equal(error?.statusCode, 403);
});
