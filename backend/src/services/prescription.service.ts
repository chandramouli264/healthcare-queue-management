import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types';
import { prescriptionInclude } from '../repositories/selects';
import { nextReference } from '../utils/dbLocks';
import { buildMeta } from '../utils/pagination';
import { patientRepository } from '../repositories/patient.repository';
import { emitToUser } from '../sockets';

interface ItemInput {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

/** Prescriptions are sensitive: receptionists have no access. */
async function assertCanViewPrescriptionsOf(actor: AuthUser, patientId: string, authorDoctorId?: string) {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'PATIENT' && actor.patientId === patientId) return;
  if (actor.role === 'DOCTOR' && actor.doctorId) {
    if (authorDoctorId === actor.doctorId) return;
    if (await patientRepository.hasAppointmentWithDoctor(patientId, actor.doctorId)) return;
  }
  throw AppError.forbidden('You are not allowed to view these prescriptions');
}

export const prescriptionService = {
  async create(actor: AuthUser, input: { appointmentId: string; diagnosis: string; notes?: string; items: ItemInput[] }) {
    if (actor.role !== 'DOCTOR' || !actor.doctorId) throw AppError.forbidden('Only doctors can create prescriptions');
    const appt = await prisma.appointment.findUnique({ where: { id: input.appointmentId }, include: { patient: { select: { userId: true } } } });
    if (!appt) throw AppError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
    if (appt.doctorId !== actor.doctorId) {
      throw AppError.forbidden('You can only write prescriptions for your own appointments', 'NOT_YOUR_PATIENT');
    }
    if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') {
      throw AppError.badRequest('Cannot prescribe for a cancelled or missed appointment', 'INVALID_APPOINTMENT_STATUS');
    }
    const created = await prisma.$transaction(async (tx) =>
      tx.prescription.create({
        data: {
          reference: await nextReference(tx, 'prescription'),
          appointmentId: appt.id,
          doctorId: appt.doctorId,
          patientId: appt.patientId,
          diagnosis: input.diagnosis,
          notes: input.notes,
          items: { create: input.items },
        },
        include: prescriptionInclude,
      }),
    );
    emitToUser(appt.patient.userId, 'prescription:created', { prescriptionId: created.id });
    return created;
  },

  async getById(actor: AuthUser, id: string) {
    const p = await prisma.prescription.findUnique({ where: { id }, include: prescriptionInclude });
    if (!p) throw AppError.notFound('Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    await assertCanViewPrescriptionsOf(actor, p.patientId, p.doctorId);
    return p;
  },

  async list(actor: AuthUser, q: { patientId?: string; doctorId?: string; page: number; limit: number; skip: number }) {
    const where: Prisma.PrescriptionWhereInput = {};
    if (actor.role === 'ADMIN') {
      if (q.patientId) where.patientId = q.patientId;
      if (q.doctorId) where.doctorId = q.doctorId;
    } else if (actor.role === 'DOCTOR') {
      where.doctorId = actor.doctorId!;
      if (q.patientId) where.patientId = q.patientId;
    } else if (actor.role === 'PATIENT') {
      where.patientId = actor.patientId!;
    } else {
      throw AppError.forbidden('You are not allowed to view prescriptions');
    }
    const [items, total] = await prisma.$transaction([
      prisma.prescription.findMany({ where, include: prescriptionInclude, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.limit }),
      prisma.prescription.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  async listForPatient(actor: AuthUser, patientId: string, q: { page: number; limit: number; skip: number }) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw AppError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
    await assertCanViewPrescriptionsOf(actor, patientId);
    const where = { patientId };
    const [items, total] = await prisma.$transaction([
      prisma.prescription.findMany({ where, include: prescriptionInclude, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.limit }),
      prisma.prescription.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  async update(actor: AuthUser, id: string, input: { diagnosis?: string; notes?: string | null; items?: ItemInput[] }) {
    const p = await prisma.prescription.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    if (actor.role !== 'DOCTOR' || actor.doctorId !== p.doctorId) {
      throw AppError.forbidden('Only the prescribing doctor can modify this prescription');
    }
    return prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
        await tx.prescriptionItem.createMany({ data: input.items.map((i) => ({ ...i, prescriptionId: id })) });
      }
      return tx.prescription.update({
        where: { id },
        data: { diagnosis: input.diagnosis, notes: input.notes },
        include: prescriptionInclude,
      });
    });
  },

  async remove(actor: AuthUser, id: string) {
    const p = await prisma.prescription.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    if (!(actor.role === 'ADMIN' || (actor.role === 'DOCTOR' && actor.doctorId === p.doctorId))) {
      throw AppError.forbidden('Only the prescribing doctor can delete this prescription');
    }
    await prisma.prescription.delete({ where: { id } });
  },
};
