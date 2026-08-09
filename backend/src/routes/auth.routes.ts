import { Router } from 'express';
import { loginHandler, refreshHandler, logoutHandler, getMeHandler } from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema } from '../dtos/auth.dto';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/login', validateRequest(loginSchema), loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', authenticate, logoutHandler);
router.get('/me', authenticate, getMeHandler);

export default router;
