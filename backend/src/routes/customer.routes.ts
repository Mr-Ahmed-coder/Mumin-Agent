import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
} from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { createCustomerSchema, updateCustomerSchema } from '../dtos/customer.dto';

const router = Router();

router.use(authenticate);

router.get('/', getCustomers);
router.get('/phone/:phone', getCustomerByPhone);
router.get('/:id', getCustomerById);
router.post('/', validateRequest(createCustomerSchema), createCustomer);
router.patch('/:id', validateRequest(updateCustomerSchema), updateCustomer);

export default router;
