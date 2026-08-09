import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/', getAuditLogs);

export default router;
