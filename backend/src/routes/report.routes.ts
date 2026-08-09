import { Router } from 'express';
import {
  getComprehensiveReport,
  exportTransactionsExcel,
  exportTransactionsCSV,
} from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER));

router.get('/summary', getComprehensiveReport);
router.get('/export/excel', exportTransactionsExcel);
router.get('/export/csv', exportTransactionsCSV);

export default router;
