import { Router } from 'express';
import {
  getDashboardStats,
  getDashboardCharts,
  getRecentTransactions,
} from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/charts', authorize(UserRole.ADMIN, UserRole.MANAGER), getDashboardCharts);
router.get('/recent', getRecentTransactions);

export default router;
