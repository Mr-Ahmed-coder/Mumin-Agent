import { Router } from 'express';
import { getUsers, createUser, updateUser, changeUserPassword } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../constants/roles';
import { validateRequest } from '../middlewares/validateRequest';
import { createUserSchema } from '../dtos/auth.dto';
import { updateUserSchema, changePasswordSchema } from '../dtos/user.dto';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER));

router.get('/', getUsers);
router.post('/', validateRequest(createUserSchema), createUser);
router.patch('/:id', validateRequest(updateUserSchema), updateUser);
router.patch('/:id/change-password', validateRequest(changePasswordSchema), changeUserPassword);

export default router;
