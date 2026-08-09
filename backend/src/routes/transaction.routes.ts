import { Router } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  cancelTransaction,
} from '../controllers/transaction.controller';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createTransactionSchema,
  cancelTransactionSchema,
} from '../dtos/transaction.dto';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createTransactionSchema), createTransaction);
router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/:id/cancel', validateRequest(cancelTransactionSchema), cancelTransaction);

export default router;
