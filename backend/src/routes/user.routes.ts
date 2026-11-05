import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam } from '../validators/common';
import { createUserSchema, listUsersQuery, updateUserSchema } from '../validators/user.validator';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/', validate({ query: listUsersQuery }), h(userController.list));
router.post('/', validate({ body: createUserSchema }), h(userController.create));
router.patch('/:id', validate({ params: idParam, body: updateUserSchema }), h(userController.update));
router.delete('/:id', validate({ params: idParam }), h(userController.remove));
export default router;
