import { Router } from 'express';
import { resetDevelopmentData } from '../controllers/development.controller';
import { resetDevelopmentDataSchema } from '../dtos/development.dto';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));
router.post('/reset-data', validateRequest(resetDevelopmentDataSchema), resetDevelopmentData);

export default router;
