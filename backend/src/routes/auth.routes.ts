import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import { asyncHandler as h } from '../utils/asyncHandler';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.validator';

const router = Router();
router.post('/register', authLimiter, validate({ body: registerSchema }), h(authController.register));
router.post('/login', authLimiter, validate({ body: loginSchema }), h(authController.login));
router.get('/me', authenticate, h(authController.me));
router.patch('/me', authenticate, validate({ body: updateProfileSchema }), h(authController.updateMe));
router.patch('/me/password', authenticate, validate({ body: changePasswordSchema }), h(authController.changePassword));
export default router;
