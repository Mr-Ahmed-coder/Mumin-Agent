import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { createInternetCreditSchema, customerInternetCreditHistorySchema, recordInternetCreditPaymentSchema } from '../dtos/internetCredit.dto';
import { createInternetCredit, getCustomerInternetCreditHistory, getInternetCredit, listInternetCredits, recordInternetCreditPayment } from '../controllers/internetCredit.controller';
import { UserRole } from '../constants/roles';

const router = Router();
router.use(authenticate);
router.get('/', listInternetCredits);
router.get('/customer-history', validateRequest(customerInternetCreditHistorySchema), getCustomerInternetCreditHistory);
router.get('/:id', getInternetCredit);
router.post('/', authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), validateRequest(createInternetCreditSchema), createInternetCredit);
router.post('/:id/payments', authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER), validateRequest(recordInternetCreditPaymentSchema), recordInternetCreditPayment);
export default router;
