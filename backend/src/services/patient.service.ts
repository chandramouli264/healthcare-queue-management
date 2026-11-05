import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types';
import { patientRepository } from '../repositories/patient.repository';
import { buildMeta } from '../utils/pagination';
import { dateOnly } from '../utils/time';
import { isStaff } from './access';

export async function assertCanViewPatient(actor: AuthUser, patientId: string) {
  if (isStaff(actor)) return;
  if (actor.role === 'PATIENT' && actor.patientId === patientId) return;
  if (actor.role === 'DOCTOR' && actor.doctorId && (await patientRepository.hasAppointmentWithDoctor(patientId, actor.doctorId))) return;
  throw AppError.forbidden('You do not have access to this patient');
}

export const patientService = {
  async list(actor: AuthUser, q: { search?: string; page: number; limit: number; skip: number }) {
    const { items, total } = await patientRepository.list({
      search: q.search,
      doctorId: actor.role === 'DOCTOR' ? actor.doctorId! : undefined,
      skip: q.skip,
      take: q.limit,
    });
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  async getById(actor: AuthUser, id: string) {
    const patient = await patientRepository.findById(id);
    if (!patient) throw AppError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
    await assertCanViewPatient(actor, id);
    return patient;
  },

  async update(
    actor: AuthUser,
    id: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      dateOfBirth?: string | null;
      gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
      bloodGroup?: string | null;
      address?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      allergies?: string | null;
    },
  ) {
    if (!(isStaff(actor) || actor.patientId === id)) throw AppError.forbidden('You can only update your own profile');
    const patient = await patientRepository.findById(id);
    if (!patient) throw AppError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
    const { firstName, lastName, phone, dateOfBirth, ...rest } = input;
    await prisma.patient.update({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? dateOnly(dateOfBirth) : null } : {}),
        user: { update: { firstName, lastName, phone } },
      },
    });
    return patientRepository.findById(id);
  },
};
