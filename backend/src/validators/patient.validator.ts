import { z } from 'zod';
import { isoDate, paginationQuery, phone } from './common';

export const updatePatientSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: phone.nullable().optional(),
  dateOfBirth: isoDate.nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  emergencyContactName: z.string().trim().max(100).nullable().optional(),
  emergencyContactPhone: phone.nullable().optional(),
  allergies: z.string().trim().max(1000).nullable().optional(),
});

export const listPatientsQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
});
