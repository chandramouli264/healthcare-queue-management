import { z } from 'zod';
import { isoDate, isoDateTime, paginationQuery, uuid } from './common';

export const createAppointmentSchema = z.object({
  doctorId: uuid,
  patientId: uuid.optional(),
  startTime: isoDateTime,
  reason: z.string().trim().max(500).optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  startTime: isoDateTime,
});

export const listAppointmentsQuery = paginationQuery.extend({
  status: z.enum(['CONFIRMED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  doctorId: uuid.optional(),
  patientId: uuid.optional(),
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  upcoming: z.enum(['true', 'false']).optional(),
});
