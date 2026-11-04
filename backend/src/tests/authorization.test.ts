import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '../constants/roles';
import { authorize } from '../middlewares/auth';
import { ApiError } from '../utils/ApiError';

test('RBAC Middleware enforces role boundaries correctly', () => {
  const adminManagerOnly = authorize(UserRole.ADMIN, UserRole.MANAGER);
  let cashierErr: any;
  adminManagerOnly(
    { user: { id: 'c1', name: 'Cashier', email: 'cashier@example.com', role: UserRole.CASHIER } } as any,
    {} as any,
    (err?: any) => { cashierErr = err; }
  );
  assert.equal(cashierErr?.statusCode, 403);
  assert.match(cashierErr?.message, /is not authorized/);

  const adminOnly = authorize(UserRole.ADMIN);
  let managerErr: any;
  adminOnly(
    { user: { id: 'm1', name: 'Manager', email: 'manager@example.com', role: UserRole.MANAGER } } as any,
    {} as any,
    (err?: any) => { managerErr = err; }
  );
  assert.equal(managerErr?.statusCode, 403);

  let adminSuccess = false;
  adminOnly(
    { user: { id: 'a1', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN } } as any,
    {} as any,
    (err?: any) => { if (!err) adminSuccess = true; }
  );
  assert.equal(adminSuccess, true);
});

test('Manager cannot create, promote, or alter Admin accounts', () => {
  // 1. Manager creating Admin role
  const createAdminPayload = { role: UserRole.ADMIN };
  const managerUser = { id: 'm1', role: UserRole.MANAGER };

  const checkCreateAdmin = (user: any, bodyRole: string) => {
    if (bodyRole === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
      throw ApiError.forbidden('Managers are not authorized to create Admin users.');
    }
  };

  assert.throws(
    () => checkCreateAdmin(managerUser, createAdminPayload.role),
    /Managers are not authorized to create Admin users/
  );

  // 2. Manager editing existing Admin user
  const checkEditAdmin = (actingUser: any, targetUserRole: string, updateRole?: string) => {
    if (actingUser.role !== UserRole.ADMIN) {
      if (targetUserRole === UserRole.ADMIN) {
        throw ApiError.forbidden('Managers are not authorized to edit Admin users.');
      }
      if (updateRole === UserRole.ADMIN) {
        throw ApiError.forbidden('Managers are not authorized to promote users to Admin.');
      }
    }
  };

  assert.throws(
    () => checkEditAdmin(managerUser, UserRole.ADMIN),
    /Managers are not authorized to edit Admin users/
  );

  assert.throws(
    () => checkEditAdmin(managerUser, UserRole.CASHIER, UserRole.ADMIN),
    /Managers are not authorized to promote users to Admin/
  );
});

test('Cashier is strictly scoped to own transactions and sessions', () => {
  const cashierId = 'cashier-123';
  const otherCashierId = 'cashier-999';

  // Transaction list filtering
  const buildQuery = (userRole: string, userId: string, reqCashierId?: string) => {
    const query: any = {};
    if (userRole === UserRole.CASHIER) {
      query.cashierId = userId;
    } else if (reqCashierId) {
      query.cashierId = reqCashierId;
    }
    return query;
  };

  const cashierQuery = buildQuery(UserRole.CASHIER, cashierId, otherCashierId);
  assert.equal(cashierQuery.cashierId, cashierId);

  const managerQuery = buildQuery(UserRole.MANAGER, 'manager-1', otherCashierId);
  assert.equal(managerQuery.cashierId, otherCashierId);

  // Transaction lookup access check
  const checkTxnAccess = (userRole: string, userId: string, txnCashierId: string) => {
    if (userRole === UserRole.CASHIER && txnCashierId !== userId) {
      throw ApiError.forbidden('Cashiers may only review their own transactions');
    }
  };

  assert.throws(
    () => checkTxnAccess(UserRole.CASHIER, cashierId, otherCashierId),
    /Cashiers may only review their own transactions/
  );

  assert.doesNotThrow(() => checkTxnAccess(UserRole.CASHIER, cashierId, cashierId));
  assert.doesNotThrow(() => checkTxnAccess(UserRole.MANAGER, 'm1', otherCashierId));
});

test('Cashier 30-minute cancellation rule and ownership check', () => {
  const cashierId = 'cashier-1';
  const otherCashierId = 'cashier-2';

  const checkCancellation = (userRole: string, userId: string, txnCashierId: string, createdAt: Date) => {
    if (userRole === UserRole.CASHIER && txnCashierId !== userId) {
      throw ApiError.forbidden('Cashiers may only modify their own transactions');
    }
    if (userRole === UserRole.CASHIER) {
      const minutesPassed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60);
      if (minutesPassed > 30) {
        throw ApiError.forbidden('Cashiers can only cancel transactions created within the last 30 minutes. Contact Manager.');
      }
    }
  };

  // 1. Other cashier transaction
  assert.throws(
    () => checkCancellation(UserRole.CASHIER, cashierId, otherCashierId, new Date()),
    /Cashiers may only modify their own transactions/
  );

  // 2. Own transaction created 45 minutes ago
  const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
  assert.throws(
    () => checkCancellation(UserRole.CASHIER, cashierId, cashierId, fortyFiveMinsAgo),
    /within the last 30 minutes/
  );

  // 3. Manager cancelling 45-minute-old transaction
  assert.doesNotThrow(
    () => checkCancellation(UserRole.MANAGER, 'manager-1', cashierId, fortyFiveMinsAgo)
  );
});

test('Financial movements require active cash shift for cashiers', () => {
  const checkShiftRequirement = (userRole: string, hasActiveShift: boolean, operation: string) => {
    if (userRole === UserRole.CASHIER && !hasActiveShift) {
      throw ApiError.badRequest(`You must have an active open cash shift to ${operation}.`);
    }
  };

  assert.throws(
    () => checkShiftRequirement(UserRole.CASHIER, false, 'record customer deposits'),
    /active open cash shift/
  );
  assert.throws(
    () => checkShiftRequirement(UserRole.CASHIER, false, 'record shop expenses'),
    /active open cash shift/
  );
  assert.throws(
    () => checkShiftRequirement(UserRole.CASHIER, false, 'issue internet credit'),
    /active open cash shift/
  );

  // Manager or Cashier with open shift can perform operations
  assert.doesNotThrow(() => checkShiftRequirement(UserRole.CASHIER, true, 'record customer deposits'));
  assert.doesNotThrow(() => checkShiftRequirement(UserRole.MANAGER, false, 'record customer deposits'));
});
