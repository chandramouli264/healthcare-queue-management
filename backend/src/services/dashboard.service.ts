import { prisma } from '../config/database';
import { AuthUser } from '../types';
import { appointmentInclude } from '../repositories/selects';
import { clinicDateTime, dateOnly, todayInClinic } from '../utils/time';

function todayRange() {
  const today = todayInClinic();
  const start = clinicDateTime(today, '00:00');
  return { gte: start.toJSDate(), lt: start.plus({ days: 1 }).toJSDate() };
}

export const dashboardService = {
  async stats(actor: AuthUser) {
    const today = todayRange();
    const now = new Date();

    if (actor.role === 'PATIENT') {
      const patientId = actor.patientId!;
      const [upcoming, completed, cancelled, prescriptions, nextAppointments] = await Promise.all([
        prisma.appointment.count({ where: { patientId, status: 'CONFIRMED', startTime: { gte: now } } }),
        prisma.appointment.count({ where: { patientId, status: 'COMPLETED' } }),
        prisma.appointment.count({ where: { patientId, status: 'CANCELLED' } }),
        prisma.prescription.count({ where: { patientId } }),
        prisma.appointment.findMany({
          where: { patientId, status: 'CONFIRMED', startTime: { gte: today.gte } },
          include: appointmentInclude,
          orderBy: { startTime: 'asc' },
          take: 5,
        }),
      ]);
      return { role: actor.role, cards: { upcoming, completed, cancelled, prescriptions }, nextAppointments };
    }

    if (actor.role === 'DOCTOR') {
      const doctorId = actor.doctorId!;
      const [todayTotal, todayCompleted, waiting, totalPatients, prescriptions, todayAppointments] = await Promise.all([
        prisma.appointment.count({ where: { doctorId, startTime: today, status: { not: 'CANCELLED' } } }),
        prisma.appointment.count({ where: { doctorId, startTime: today, status: 'COMPLETED' } }),
        prisma.queueEntry.count({ where: { status: 'WAITING', queue: { doctorId, queueDate: dateOnly(todayInClinic()) } } }),
        prisma.patient.count({ where: { appointments: { some: { doctorId } } } }),
        prisma.prescription.count({ where: { doctorId } }),
        prisma.appointment.findMany({
          where: { doctorId, startTime: today, status: { not: 'CANCELLED' } },
          include: appointmentInclude,
          orderBy: { startTime: 'asc' },
        }),
      ]);
      return { role: actor.role, cards: { todayTotal, todayCompleted, waiting, totalPatients, prescriptions }, todayAppointments };
    }

    const [doctors, patients, todayTotal, todayCancelled, waiting, upcoming, recentAppointments] = await Promise.all([
      prisma.doctor.count({ where: { user: { isActive: true } } }),
      prisma.patient.count(),
      prisma.appointment.count({ where: { startTime: today, status: { not: 'CANCELLED' } } }),
      prisma.appointment.count({ where: { startTime: today, status: 'CANCELLED' } }),
      prisma.queueEntry.count({ where: { status: 'WAITING', queue: { queueDate: dateOnly(todayInClinic()) } } }),
      prisma.appointment.count({ where: { status: 'CONFIRMED', startTime: { gte: now } } }),
      prisma.appointment.findMany({ include: appointmentInclude, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    return { role: actor.role, cards: { doctors, patients, todayTotal, todayCancelled, waiting, upcoming }, recentAppointments };
  },
};
