import { Router } from 'express';
import { appointmentController as c } from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam } from '../validators/common';
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsQuery,
  rescheduleAppointmentSchema,
} from '../validators/appointment.validator';

const router = Router();
router.use(authenticate);
router.post('/', authorize('PATIENT', 'RECEPTIONIST', 'ADMIN'), validate({ body: createAppointmentSchema }), h(c.create));
router.get('/', validate({ query: listAppointmentsQuery }), h(c.list));
router.get('/:id', validate({ params: idParam }), h(c.get));
router.patch('/:id/cancel', validate({ params: idParam, body: cancelAppointmentSchema }), h(c.cancel));
router.patch('/:id/reschedule', authorize('PATIENT', 'RECEPTIONIST', 'ADMIN'), validate({ params: idParam, body: rescheduleAppointmentSchema }), h(c.reschedule));
export default router;
