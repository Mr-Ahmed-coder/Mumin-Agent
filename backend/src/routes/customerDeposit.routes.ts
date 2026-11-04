import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { recordCustomerDepositSchema, recordCustomerWithdrawalSchema } from '../dtos/customerDeposit.dto';
import { getCustomerDeposit, listCustomerDeposits, recordCustomerDeposit, recordCustomerWithdrawal } from '../controllers/customerDeposit.controller';
import { UserRole } from '../constants/roles';

const router = Router();
router.use(authenticate);
router.get('/', listCustomerDeposits);
router.get('/:id', getCustomerDeposit);
router.post('/deposit', authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), validateRequest(recordCustomerDepositSchema), recordCustomerDeposit);
router.post('/:id/withdrawals', authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), validateRequest(recordCustomerWithdrawalSchema), recordCustomerWithdrawal);
export default router;
