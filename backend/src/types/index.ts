import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  doctorId?: string | null;
  patientId?: string | null;
}

export interface JwtPayload {
  sub: string;
  role: Role;
}

export const ACTIVE_APPOINTMENT_STATUSES = ['CONFIRMED', 'IN_CONSULTATION', 'COMPLETED'] as const;
