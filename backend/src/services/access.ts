import { AuthUser } from '../types';
import { AppError } from '../utils/AppError';

export const isStaff = (u: AuthUser) => u.role === 'ADMIN' || u.role === 'RECEPTIONIST';

/** ADMIN, or the doctor themself. */
export function assertCanManageDoctor(actor: AuthUser, doctorId: string) {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'DOCTOR' && actor.doctorId === doctorId) return;
  throw AppError.forbidden('You can only manage your own schedule');
}

/** Doctors / staff that may operate a doctor's queue. */
export function assertCanOperateQueue(actor: AuthUser, doctorId: string) {
  if (isStaff(actor)) return;
  if (actor.role === 'DOCTOR' && actor.doctorId === doctorId) return;
  throw AppError.forbidden('You are not allowed to operate this queue');
}
