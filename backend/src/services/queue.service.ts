import { Prisma, QueueEntryStatus } from '@prisma/client';
import { prisma, TxClient, LOCKING_TX_OPTIONS } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../types';
import { clinicDateOf, dateOnly, todayInClinic } from '../utils/time';
import { lockDoctor } from '../utils/dbLocks';
import { assertCanOperateQueue, isStaff } from './access';
import { emitQueueUpdated, emitToUser, emitAppointmentChanged } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';
import { userBriefSelect } from '../repositories/selects';

const ACTIVE_ENTRY: QueueEntryStatus[] = ['CALLED', 'IN_CONSULTATION'];

const queueInclude = {
  doctor: { select: { id: true, specialization: true, roomNumber: true, consultationDuration: true, user: { select: { firstName: true, lastName: true } } } },
  entries: {
    include: {
      appointment: { select: { id: true, reference: true, startTime: true, endTime: true, reason: true, status: true } },
      patient: { select: { id: true, user: { select: userBriefSelect } } },
    },
  },
} satisfies Prisma.QueueInclude;

type QueueWithEntries = Prisma.QueueGetPayload<{ include: typeof queueInclude }>;

/** Next waiting entry: earliest appointment first, token as tie-breaker. */
function orderEntries<T extends { tokenNumber: number; appointment: { startTime: Date } }>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => a.appointment.startTime.getTime() - b.appointment.startTime.getTime() || a.tokenNumber - b.tokenNumber,
  );
}

function buildSnapshot(queue: QueueWithEntries, actor: AuthUser) {
  const ordered = orderEntries(queue.entries);
  const waiting = ordered.filter((e) => e.status === 'WAITING');
  const current = ordered.find((e) => ACTIVE_ENTRY.includes(e.status)) ?? null;
  const fullAccess = isStaff(actor) || (actor.role === 'DOCTOR' && actor.doctorId === queue.doctorId);
  const avg = queue.doctor.consultationDuration;

  const entries = ordered.map((e) => {
    const position = e.status === 'WAITING' ? waiting.indexOf(e) + 1 : null;
    const base = {
      id: e.id,
      tokenNumber: e.tokenNumber,
      status: e.status,
      position,
      peopleAhead: position !== null ? position - 1 + (current ? 1 : 0) : null,
      estimatedWaitMinutes: position !== null ? (position - 1 + (current ? 1 : 0)) * avg : null,
      scheduledTime: e.appointment.startTime,
      calledAt: e.calledAt,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      isMine: actor.patientId === e.patientId,
    };
    if (fullAccess || base.isMine) {
      return {
        ...base,
        appointmentId: e.appointment.id,
        appointmentReference: e.appointment.reference,
        reason: fullAccess ? e.appointment.reason : undefined,
        patient: { id: e.patient.id, firstName: e.patient.user.firstName, lastName: e.patient.user.lastName, phone: fullAccess ? e.patient.user.phone : undefined },
      };
    }
    return base;
  });

  const count = (s: QueueEntryStatus) => queue.entries.filter((e) => e.status === s).length;
  return {
    id: queue.id,
    doctorId: queue.doctorId,
    doctor: {
      id: queue.doctor.id,
      name: `Dr. ${queue.doctor.user.firstName} ${queue.doctor.user.lastName}`,
      specialization: queue.doctor.specialization,
      roomNumber: queue.doctor.roomNumber,
    },
    queueDate: queue.queueDate.toISOString().slice(0, 10),
    lastToken: queue.lastToken,
    current: current ? entries.find((e) => e.id === current.id)! : null,
    entries,
    myEntry: entries.find((e) => e.isMine) ?? null,
    stats: {
      total: queue.entries.length,
      waiting: count('WAITING'),
      called: count('CALLED'),
      inConsultation: count('IN_CONSULTATION'),
      completed: count('COMPLETED'),
      skipped: count('SKIPPED'),
    },
  };
}

async function loadQueue(queueId: string, client: TxClient = prisma) {
  const queue = await client.queue.findUnique({ where: { id: queueId }, include: queueInclude });
  if (!queue) throw AppError.notFound('Queue not found', 'QUEUE_NOT_FOUND');
  return queue;
}

export const queueService = {
  /**
   * Issues the next token of the doctor's queue for the appointment's clinic
   * day. Must run inside a transaction holding the doctor's advisory lock.
   */
  async addEntry(tx: TxClient, appt: { id: string; doctorId: string; patientId: string; startTime: Date }) {
    const queueDate = dateOnly(clinicDateOf(appt.startTime));
    const queue = await tx.queue.upsert({
      where: { doctorId_queueDate: { doctorId: appt.doctorId, queueDate } },
      create: { doctorId: appt.doctorId, queueDate, lastToken: 1 },
      update: { lastToken: { increment: 1 } },
    });
    return tx.queueEntry.create({
      data: { queueId: queue.id, appointmentId: appt.id, patientId: appt.patientId, tokenNumber: queue.lastToken },
    });
  },

  async removeEntry(tx: TxClient, appointmentId: string): Promise<string | null> {
    const entry = await tx.queueEntry.findUnique({ where: { appointmentId } });
    if (!entry) return null;
    await tx.queueEntry.delete({ where: { id: entry.id } });
    return entry.queueId;
  },

  async getById(actor: AuthUser, queueId: string) {
    const queue = await loadQueue(queueId);
    if (actor.role === 'DOCTOR' && actor.doctorId !== queue.doctorId) {
      throw AppError.forbidden('You can only view your own queue');
    }
    return buildSnapshot(queue, actor);
  },

  async getForDoctor(actor: AuthUser, doctorId: string, date?: string) {
    if (actor.role === 'DOCTOR' && actor.doctorId !== doctorId) throw AppError.forbidden('You can only view your own queue');
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw AppError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
    const queueDate = dateOnly(date ?? todayInClinic());
    const queue = await prisma.queue.upsert({
      where: { doctorId_queueDate: { doctorId, queueDate } },
      create: { doctorId, queueDate },
      update: {},
      include: queueInclude,
    });
    return buildSnapshot(queue, actor);
  },

  /** Today's queues the patient is in (for live tracking). */
  async getMyQueues(actor: AuthUser) {
    if (!actor.patientId) return [];
    const entries = await prisma.queueEntry.findMany({
      where: { patientId: actor.patientId, queue: { queueDate: dateOnly(todayInClinic()) } },
      select: { queueId: true },
    });
    const ids = [...new Set(entries.map((e) => e.queueId))];
    const queues = await Promise.all(ids.map((id) => loadQueue(id)));
    return queues.map((q) => buildSnapshot(q, actor));
  },

  /** Calls the next waiting patient. Only one patient can be active at a time. */
  async callNext(actor: AuthUser, queueId: string) {
    const { doctorId } = await loadQueue(queueId);
    assertCanOperateQueue(actor, doctorId);

    const called = await prisma.$transaction(async (tx) => {
      await lockDoctor(tx, doctorId);
      const active = await tx.queueEntry.findFirst({ where: { queueId, status: { in: ACTIVE_ENTRY } } });
      if (active) {
        throw AppError.conflict(
          `Token #${active.tokenNumber} is already ${active.status === 'CALLED' ? 'called' : 'in consultation'}. Complete or skip it first.`,
          'PATIENT_ALREADY_CALLED',
        );
      }
      const waiting = await tx.queueEntry.findMany({
        where: { queueId, status: 'WAITING', appointment: { status: 'CONFIRMED' } },
        include: { appointment: { select: { startTime: true } }, patient: { select: { userId: true } } },
      });
      const next = orderEntries(waiting)[0];
      if (!next) return null;
      await tx.queueEntry.update({ where: { id: next.id }, data: { status: 'CALLED', calledAt: new Date() } });
      return next;
    }, LOCKING_TX_OPTIONS);

    const snapshot = buildSnapshot(await loadQueue(queueId), actor);
    if (called) {
      emitQueueUpdated(queueId, doctorId, 'called');
      emitToUser(called.patient.userId, SOCKET_EVENTS.PATIENT_CALLED, {
        queueId,
        tokenNumber: called.tokenNumber,
        doctor: snapshot.doctor,
      });
    }
    return { called: called ? snapshot.entries.find((e) => e.id === called.id)! : null, queue: snapshot };
  },

  /** CALLED -> IN_CONSULTATION. */
  async startConsultation(actor: AuthUser, queueId: string) {
    return this.transition(actor, queueId, ['CALLED'], 'IN_CONSULTATION', 'IN_CONSULTATION', 'NO_PATIENT_CALLED', 'started');
  },

  /** CALLED / IN_CONSULTATION -> COMPLETED. */
  async complete(actor: AuthUser, queueId: string) {
    return this.transition(actor, queueId, ACTIVE_ENTRY, 'COMPLETED', 'COMPLETED', 'NO_ACTIVE_PATIENT', 'completed');
  },

  /** CALLED -> SKIPPED (patient did not show up). */
  async skip(actor: AuthUser, queueId: string) {
    return this.transition(actor, queueId, ['CALLED'], 'SKIPPED', 'NO_SHOW', 'NO_PATIENT_CALLED', 'skipped');
  },

  async transition(
    actor: AuthUser,
    queueId: string,
    from: QueueEntryStatus[],
    to: QueueEntryStatus,
    appointmentStatus: 'IN_CONSULTATION' | 'COMPLETED' | 'NO_SHOW',
    emptyCode: string,
    reason: string,
  ) {
    const { doctorId } = await loadQueue(queueId);
    assertCanOperateQueue(actor, doctorId);
    const now = new Date();

    const entry = await prisma.$transaction(async (tx) => {
      await lockDoctor(tx, doctorId);
      const current = await tx.queueEntry.findFirst({
        where: { queueId, status: { in: from } },
        include: { patient: { select: { userId: true } } },
      });
      if (!current) {
        throw AppError.conflict(
          emptyCode === 'NO_PATIENT_CALLED' ? 'No patient has been called yet' : 'There is no patient in consultation',
          emptyCode,
        );
      }
      await tx.queueEntry.update({
        where: { id: current.id },
        data: {
          status: to,
          ...(to === 'IN_CONSULTATION' ? { startedAt: now } : {}),
          ...(to === 'COMPLETED' || to === 'SKIPPED' ? { completedAt: now } : {}),
        },
      });
      await tx.appointment.update({ where: { id: current.appointmentId }, data: { status: appointmentStatus } });
      return current;
    }, LOCKING_TX_OPTIONS);

    emitQueueUpdated(queueId, doctorId, reason);
    emitAppointmentChanged(doctorId, entry.patient.userId, { appointmentId: entry.appointmentId, status: appointmentStatus });
    return buildSnapshot(await loadQueue(queueId), actor);
  },
};
