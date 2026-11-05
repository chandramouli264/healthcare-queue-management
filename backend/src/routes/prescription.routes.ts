import { Router } from 'express';
import { prescriptionController as c } from '../controllers/prescription.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam } from '../validators/common';
import { createPrescriptionSchema, listPrescriptionsQuery, updatePrescriptionSchema } from '../validators/prescription.validator';

const router = Router();
router.use(authenticate);
router.post('/', authorize('DOCTOR'), validate({ body: createPrescriptionSchema }), h(c.create));
router.get('/', validate({ query: listPrescriptionsQuery }), h(c.list));
router.get('/:id', validate({ params: idParam }), h(c.get));
router.patch('/:id', authorize('DOCTOR'), validate({ params: idParam, body: updatePrescriptionSchema }), h(c.update));
router.delete('/:id', authorize('DOCTOR', 'ADMIN'), validate({ params: idParam }), h(c.remove));
export default router;
