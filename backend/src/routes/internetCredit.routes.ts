import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { createInternetCreditSchema, recordInternetCreditPaymentSchema } from '../dtos/internetCredit.dto';
import { createInternetCredit, getInternetCredit, listInternetCredits, recordInternetCreditPayment } from '../controllers/internetCredit.controller';

const router = Router();
router.use(authenticate);
router.get('/', listInternetCredits);
router.get('/:id', getInternetCredit);
router.post('/', validateRequest(createInternetCreditSchema), createInternetCredit);
router.post('/:id/payments', validateRequest(recordInternetCreditPaymentSchema), recordInternetCreditPayment);
export default router;
