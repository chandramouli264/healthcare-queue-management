import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../config/database';
import { appointmentInclude } from './selects';
import { ACTIVE_APPOINTMENT_STATUSES } from '../types';

export const appointmentRepository = {
  findById(id: string, client: TxClient = prisma) {
    return client.appointment.findUnique({ where: { id }, include: appointmentInclude });
  },

  /** Active appointments of a doctor overlapping [start, end). */
  findDoctorOverlaps(client: TxClient, doctorId: string, start: Date, end: Date, excludeId?: string) {
    return client.appointment.findMany({
      where: {
        doctorId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startTime: { lt: end },
        endTime: { gt: start },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true },
    });
  },

  findPatientOverlaps(client: TxClient, patientId: string, start: Date, end: Date, excludeId?: string) {
    return client.appointment.findMany({
      where: {
        patientId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startTime: { lt: end },
        endTime: { gt: start },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  async list(where: Prisma.AppointmentWhereInput, skip: number, take: number, order: 'asc' | 'desc' = 'desc') {
    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({ where, include: appointmentInclude, orderBy: { startTime: order }, skip, take }),
      prisma.appointment.count({ where }),
    ]);
    return { items, total };
  },

  updateStatus(client: TxClient, id: string, status: AppointmentStatus) {
    return client.appointment.update({ where: { id }, data: { status } });
  },
};
