import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma, LOCKING_TX_OPTIONS } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types';
import { appointmentRepository } from '../repositories/appointment.repository';
import { lockDoctor, nextReference } from '../utils/dbLocks';
import { isOverlapViolation } from '../utils/dbErrors';
import { buildMeta } from '../utils/pagination';
import { clinicDateOf, clinicDateTime } from '../utils/time';
import {
  assertNoTimeOff,
  assertWithinWorkingHours,
  loadSchedulableDoctor,
  scheduleForDate,
  slotDurationOf,
} from './slot.service';
import { queueService } from './queue.service';
import { isStaff } from './access';
import { emitAppointmentChanged, emitQueueUpdated } from '../sockets';

const slotTaken = () => AppError.conflict('This appointment slot is already booked', 'SLOT_ALREADY_BOOKED');

type AppointmentWithRelations = NonNullable<Awaited<ReturnType<typeof appointmentRepository.findById>>>;

function assertCanView(actor: AuthUser, appt: { patientId: string; doctorId: string }) {
  if (isStaff(actor)) return;
  if (actor.role === 'DOCTOR' && actor.doctorId === appt.doctorId) return;
  if (actor.role === 'PATIENT' && actor.patientId === appt.patientId) return;
  throw AppError.forbidden('You do not have access to this appointment');
}

function assertCanModify(actor: AuthUser, appt: { patientId: string; doctorId: string }, action: 'cancel' | 'reschedule') {
  if (isStaff(actor)) return;
  if (actor.role === 'PATIENT' && actor.patientId === appt.patientId) return;
  if (action === 'cancel' && actor.role === 'DOCTOR' && actor.doctorId === appt.doctorId) return;
  throw AppError.forbidden(`You are not allowed to ${action} this appointment`);
}

async function computeInterval(doctorId: string, startIso: string) {
  const doctor = await loadSchedulableDoctor(doctorId);
  const start = new Date(startIso);
  if (start.getTime() <= Date.now()) {
    throw AppError.badRequest('Appointments must be booked for a future time', 'APPOINTMENT_IN_PAST');
  }
  const schedule = scheduleForDate(doctor, clinicDateOf(start));
  const end = new Date(start.getTime() + slotDurationOf(doctor, schedule) * 60_000);
  assertWithinWorkingHours(doctor, start, end);
  return { start, end };
}

function notify(appt: AppointmentWithRelations, previousQueueId?: string | null) {
  emitAppointmentChanged(appt.doctorId, appt.patient.userId, { appointmentId: appt.id, status: appt.status });
  if (appt.queueEntry) emitQueueUpdated(appt.queueEntry.queueId, appt.doctorId, 'appointment');
  if (previousQueueId && previousQueueId !== appt.queueEntry?.queueId) {
    emitQueueUpdated(previousQueueId, appt.doctorId, 'appointment');
  }
}

export const appointmentService = {
  /**
   * Books an appointment. Double-booking is prevented by:
   *  1. a per-doctor transaction-scoped advisory lock (serialises bookings),
   *  2. an explicit overlap query inside that transaction, and
   *  3. the `appointments_no_doctor_overlap` exclusion constraint, which makes
   *     overlapping active appointments impossible at the database level.
   */
  async create(actor: AuthUser, input: { doctorId: string; patientId?: string; startTime: string; reason?: string }) {
    let patientId: string;
    if (actor.role === 'PATIENT') {
      if (!actor.patientId) throw AppError.forbidden('Patient profile missing');
      if (input.patientId && input.patientId !== actor.patientId) {
        throw AppError.forbidden('Patients can only book appointments for themselves');
      }
      patientId = actor.patientId;
    } else {
      if (!input.patientId) throw AppError.badRequest('patientId is required', 'VALIDATION_ERROR');
      patientId = input.patientId;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, include: { user: { select: { isActive: true } } } });
    if (!patient || !patient.user.isActive) throw AppError.notFound('Patient not found', 'PATIENT_NOT_FOUND');

    const { start, end } = await computeInterval(input.doctorId, input.startTime);

    let id: string;
    try {
      id = await prisma.$transaction(async (tx) => {
        await lockDoctor(tx, input.doctorId);
        await assertNoTimeOff(tx, input.doctorId, start, end);
        if ((await appointmentRepository.findDoctorOverlaps(tx, input.doctorId, start, end)).length) throw slotTaken();
        if ((await appointmentRepository.findPatientOverlaps(tx, patientId, start, end)).length) {
          throw AppError.conflict('You already have an appointment at this time', 'PATIENT_DOUBLE_BOOKING');
        }
        const appt = await tx.appointment.create({
          data: {
            reference: await nextReference(tx, 'appointment'),
            doctorId: input.doctorId,
            patientId,
            startTime: start,
            endTime: end,
            reason: input.reason,
            status: 'CONFIRMED',
          },
        });
        await queueService.addEntry(tx, appt);
        return appt.id;
      }, LOCKING_TX_OPTIONS);
    } catch (err) {
      if (isOverlapViolation(err)) throw slotTaken();
      throw err;
    }

    const appt = (await appointmentRepository.findById(id))!;
    notify(appt);
    return appt;
  },

  async getById(actor: AuthUser, id: string) {
    const appt = await appointmentRepository.findById(id);
    if (!appt) throw AppError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
    assertCanView(actor, appt);
    return appt;
  },

  async list(
    actor: AuthUser,
    q: { status?: Prisma.AppointmentWhereInput['status']; doctorId?: string; patientId?: string; date?: string; from?: string; to?: string; upcoming?: string; page: number; limit: number; skip: number },
  ) {
    const where: Prisma.AppointmentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.doctorId) where.doctorId = q.doctorId;
    if (q.patientId) where.patientId = q.patientId;

    // Scope non-staff users to their own appointments.
    if (actor.role === 'DOCTOR') where.doctorId = actor.doctorId!;
    if (actor.role === 'PATIENT') where.patientId = actor.patientId!;

    const range: Prisma.DateTimeFilter = {};
    if (q.date) {
      range.gte = clinicDateTime(q.date, '00:00').toJSDate();
      range.lt = clinicDateTime(q.date, '00:00').plus({ days: 1 }).toJSDate();
    }
    if (q.from) range.gte = clinicDateTime(q.from, '00:00').toJSDate();
    if (q.to) range.lt = clinicDateTime(q.to, '00:00').plus({ days: 1 }).toJSDate();
    if (q.upcoming === 'true') range.gte = DateTime.now().toJSDate();
    if (Object.keys(range).length) where.startTime = range;

    const order = q.upcoming === 'true' || q.date ? 'asc' : 'desc';
    const { items, total } = await appointmentRepository.list(where, q.skip, q.limit, order);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  async listForPatient(actor: AuthUser, patientId: string, q: { status?: Prisma.AppointmentWhereInput['status']; upcoming?: string; page: number; limit: number; skip: number }) {
    if (actor.role === 'PATIENT' && actor.patientId !== patientId) throw AppError.forbidden('You can only view your own appointments');
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw AppError.notFound('Patient not found', 'PATIENT_NOT_FOUND');
    return this.list(actor, { ...q, patientId });
  },

  async cancel(actor: AuthUser, id: string, reason?: string) {
    const existing = await this.getById(actor, id);
    assertCanModify(actor, existing, 'cancel');

    const queueId = await prisma.$transaction(async (tx) => {
      await lockDoctor(tx, existing.doctorId);
      const appt = await tx.appointment.findUnique({ where: { id }, include: { queueEntry: true } });
      if (!appt || appt.status !== 'CONFIRMED') {
        throw AppError.badRequest('Only confirmed appointments can be cancelled', 'INVALID_APPOINTMENT_STATUS');
      }
      if (appt.queueEntry && appt.queueEntry.status !== 'WAITING') {
        throw AppError.badRequest('This patient has already been called and cannot be cancelled', 'ALREADY_IN_QUEUE');
      }
      await tx.appointment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      return queueService.removeEntry(tx, id);
    }, LOCKING_TX_OPTIONS);

    const appt = (await appointmentRepository.findById(id))!;
    notify(appt, queueId);
    return appt;
  },

  /** Moves an appointment to a new time atomically (single UPDATE under lock). */
  async reschedule(actor: AuthUser, id: string, startTime: string) {
    const existing = await this.getById(actor, id);
    assertCanModify(actor, existing, 'reschedule');
    if (existing.status !== 'CONFIRMED') {
      throw AppError.badRequest('Only confirmed appointments can be rescheduled', 'INVALID_APPOINTMENT_STATUS');
    }
    const { start, end } = await computeInterval(existing.doctorId, startTime);
    if (start.getTime() === existing.startTime.getTime()) {
      throw AppError.badRequest('The new time is the same as the current time', 'NO_CHANGE');
    }

    let previousQueueId: string | null = null;
    try {
      await prisma.$transaction(async (tx) => {
        await lockDoctor(tx, existing.doctorId);
        const appt = await tx.appointment.findUnique({ where: { id }, include: { queueEntry: true } });
        if (!appt || appt.status !== 'CONFIRMED') {
          throw AppError.badRequest('Only confirmed appointments can be rescheduled', 'INVALID_APPOINTMENT_STATUS');
        }
        if (appt.queueEntry && appt.queueEntry.status !== 'WAITING') {
          throw AppError.badRequest('This patient has already been called', 'ALREADY_IN_QUEUE');
        }
        await assertNoTimeOff(tx, appt.doctorId, start, end);
        if ((await appointmentRepository.findDoctorOverlaps(tx, appt.doctorId, start, end, id)).length) throw slotTaken();
        if ((await appointmentRepository.findPatientOverlaps(tx, appt.patientId, start, end, id)).length) {
          throw AppError.conflict('You already have an appointment at this time', 'PATIENT_DOUBLE_BOOKING');
        }
        const updated = await tx.appointment.update({ where: { id }, data: { startTime: start, endTime: end } });
        if (clinicDateOf(appt.startTime) !== clinicDateOf(start)) {
          previousQueueId = await queueService.removeEntry(tx, id);
          await queueService.addEntry(tx, updated);
        }
      }, LOCKING_TX_OPTIONS);
    } catch (err) {
      if (isOverlapViolation(err)) throw slotTaken();
      throw err;
    }

    const appt = (await appointmentRepository.findById(id))!;
    notify(appt, previousQueueId);
    return appt;
  },
};
