import { Router } from 'express';
import { queueController as c } from '../controllers/queue.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam } from '../validators/common';
import { doctorQueueParams, queueDateQuery } from '../validators/queue.validator';

const router = Router();
router.use(authenticate);
const operators = authorize('DOCTOR', 'RECEPTIONIST', 'ADMIN');

router.get('/mine', h(c.mine));
router.get('/doctor/:doctorId', validate({ params: doctorQueueParams, query: queueDateQuery }), h(c.forDoctor));
router.get('/:id', validate({ params: idParam }), h(c.get));
router.post('/:id/call', operators, validate({ params: idParam }), h(c.call));
router.post('/:id/start', operators, validate({ params: idParam }), h(c.start));
router.post('/:id/complete', operators, validate({ params: idParam }), h(c.complete));
router.post('/:id/skip', operators, validate({ params: idParam }), h(c.skip));
export default router;
