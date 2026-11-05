import { z } from 'zod';
import { paginationQuery } from './common';
import { uuid } from './common';

const item = z.object({
  medicineName: z.string().trim().min(1, 'Medicine name is required').max(200),
  dosage: z.string().trim().min(1, 'Dosage is required').max(100),
  frequency: z.string().trim().min(1, 'Frequency is required').max(100),
  duration: z.string().trim().min(1, 'Duration is required').max(100),
  instructions: z.string().trim().max(500).optional(),
});

export const createPrescriptionSchema = z.object({
  appointmentId: uuid,
  diagnosis: z.string().trim().min(1, 'Diagnosis is required').max(1000),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(item).min(1, 'At least one medicine is required').max(30),
});

export const updatePrescriptionSchema = z.object({
  diagnosis: z.string().trim().min(1).max(1000).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(item).min(1).max(30).optional(),
});

export const listPrescriptionsQuery = paginationQuery.extend({
  patientId: uuid.optional(),
  doctorId: uuid.optional(),
});
