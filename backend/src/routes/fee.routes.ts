import { Router } from 'express';
import {
  getFeeRules,
  createFeeRule,
  updateFeeRule,
  deleteFeeRule,
  calculateFeeHandler,
} from '../controllers/fee.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../constants/roles';
import { validateRequest } from '../middlewares/validateRequest';
import { createFeeRuleSchema, calculateFeeSchema } from '../dtos/fee.dto';

const router = Router();

router.use(authenticate);

router.post('/calculate', validateRequest(calculateFeeSchema), calculateFeeHandler);

router.get('/', getFeeRules);
router.post('/', authorize(UserRole.ADMIN, UserRole.MANAGER), validateRequest(createFeeRuleSchema), createFeeRule);
router.patch('/:id', authorize(UserRole.ADMIN, UserRole.MANAGER), updateFeeRule);
router.delete('/:id', authorize(UserRole.ADMIN), deleteFeeRule);

export default router;
