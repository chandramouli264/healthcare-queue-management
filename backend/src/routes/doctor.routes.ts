import { Router } from 'express';
import { doctorController as c } from '../controllers/doctor.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam } from '../validators/common';
import {
  availableSlotsQuery,
  createDoctorSchema,
  createTimeOffSchema,
  listDoctorsQuery,
  replaceSchedulesSchema,
  timeOffParams,
  updateDoctorSchema,
} from '../validators/doctor.validator';

const router = Router();

// Public: browsing doctors and availability.
router.get('/', validate({ query: listDoctorsQuery }), h(c.list));
router.get('/specializations', h(c.specializations));
router.get('/:id', validate({ params: idParam }), h(c.get));
router.get('/:id/available-slots', validate({ params: idParam, query: availableSlotsQuery }), h(c.availableSlots));
router.get('/:id/schedules', validate({ params: idParam }), h(c.getSchedules));

// Protected
router.post('/', authenticate, authorize('ADMIN'), validate({ body: createDoctorSchema }), h(c.create));
router.patch('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), validate({ params: idParam, body: updateDoctorSchema }), h(c.update));
router.delete('/:id', authenticate, authorize('ADMIN'), validate({ params: idParam }), h(c.remove));
router.put('/:id/schedules', authenticate, authorize('ADMIN', 'DOCTOR'), validate({ params: idParam, body: replaceSchedulesSchema }), h(c.replaceSchedules));
router.get('/:id/time-off', authenticate, validate({ params: idParam }), h(c.listTimeOff));
router.post('/:id/time-off', authenticate, authorize('ADMIN', 'DOCTOR'), validate({ params: idParam, body: createTimeOffSchema }), h(c.addTimeOff));
router.delete('/:id/time-off/:timeOffId', authenticate, authorize('ADMIN', 'DOCTOR'), validate({ params: timeOffParams }), h(c.removeTimeOff));

export default router;
