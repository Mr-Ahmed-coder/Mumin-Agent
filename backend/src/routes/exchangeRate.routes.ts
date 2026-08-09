import { Router } from 'express';
import {
  getActiveExchangeRate,
  getExchangeRateHistory,
  setActiveExchangeRate,
} from '../controllers/exchangeRate.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { createExchangeRateSchema } from '../dtos/exchangeRate.dto';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate);
router.get('/active', getActiveExchangeRate);
router.get('/history', authorize(UserRole.ADMIN, UserRole.MANAGER), getExchangeRateHistory);
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateRequest(createExchangeRateSchema),
  setActiveExchangeRate
);

export default router;
