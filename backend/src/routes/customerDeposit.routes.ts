import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { recordCustomerDepositSchema, recordCustomerWithdrawalSchema } from '../dtos/customerDeposit.dto';
import { getCustomerDeposit, listCustomerDeposits, recordCustomerDeposit, recordCustomerWithdrawal } from '../controllers/customerDeposit.controller';

const router = Router();
router.use(authenticate);
router.get('/', listCustomerDeposits);
router.get('/:id', getCustomerDeposit);
router.post('/deposit', validateRequest(recordCustomerDepositSchema), recordCustomerDeposit);
router.post('/:id/withdrawals', validateRequest(recordCustomerWithdrawalSchema), recordCustomerWithdrawal);
export default router;
