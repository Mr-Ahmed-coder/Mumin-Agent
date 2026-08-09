import { Router } from 'express';
import {
  getDashboardStats,
  getDashboardCharts,
  getRecentTransactions,
} from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/charts', getDashboardCharts);
router.get('/recent', getRecentTransactions);

export default router;
