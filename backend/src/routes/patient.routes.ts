import { Router } from 'express';
import { patientController as c } from '../controllers/patient.controller';
import { appointmentController } from '../controllers/appointment.controller';
import { prescriptionController } from '../controllers/prescription.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParam, paginationQuery } from '../validators/common';
import { listPatientsQuery, updatePatientSchema } from '../validators/patient.validator';
import { listAppointmentsQuery } from '../validators/appointment.validator';

const router = Router();
router.use(authenticate);
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), validate({ query: listPatientsQuery }), h(c.list));
router.get('/:id', validate({ params: idParam }), h(c.get));
router.patch('/:id', validate({ params: idParam, body: updatePatientSchema }), h(c.update));
router.get('/:id/appointments', validate({ params: idParam, query: listAppointmentsQuery }), h(appointmentController.listForPatient));
router.get('/:id/prescriptions', validate({ params: idParam, query: paginationQuery }), h(prescriptionController.listForPatient));
export default router;
