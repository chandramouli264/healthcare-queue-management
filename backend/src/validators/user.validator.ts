import { z } from 'zod';
import { paginationQuery, password, phone } from './common';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: phone.optional(),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'PATIENT']),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: phone.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listUsersQuery = paginationQuery.extend({
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT']).optional(),
  search: z.string().trim().max(100).optional(),
});
