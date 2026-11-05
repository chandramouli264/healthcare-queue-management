import { DoctorSchedule } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma, TxClient } from '../config/database';
import { AppError } from '../utils/AppError';
import { ACTIVE_APPOINTMENT_STATUSES } from '../types';
import { clinicDateOf, clinicDateTime, dayOfWeekOf, rangesOverlap, CLINIC_ZONE } from '../utils/time';

export interface Slot {
  startTime: string;
  endTime: string;
  label: string;
}

interface Segment {
  start: DateTime;
  end: DateTime;
}

type DoctorWithSchedules = { id: string; consultationDuration: number; schedules: DoctorSchedule[]; user: { isActive: boolean } };

export async function loadSchedulableDoctor(doctorId: string, client: TxClient = prisma): Promise<DoctorWithSchedules> {
  const doctor = await client.doctor.findUnique({
    where: { id: doctorId },
    include: { schedules: true, user: { select: { isActive: true } } },
  });
  if (!doctor || !doctor.user.isActive) throw AppError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
  return doctor;
}

export function scheduleForDate(doctor: DoctorWithSchedules, date: string): DoctorSchedule | null {
  const dow = dayOfWeekOf(date);
  return doctor.schedules.find((s) => s.dayOfWeek === dow && s.isActive) ?? null;
}

export function slotDurationOf(doctor: DoctorWithSchedules, schedule: DoctorSchedule | null): number {
  return schedule?.slotDuration ?? doctor.consultationDuration;
}

/** Working segments of a day (the break splits the day in two). */
export function workingSegments(schedule: DoctorSchedule, date: string): Segment[] {
  const start = clinicDateTime(date, schedule.startTime);
  const end = clinicDateTime(date, schedule.endTime);
  if (schedule.breakStart && schedule.breakEnd) {
    const bs = clinicDateTime(date, schedule.breakStart);
    const be = clinicDateTime(date, schedule.breakEnd);
    return [
      { start, end: bs },
      { start: be, end },
    ].filter((s) => s.end > s.start);
  }
  return [{ start, end }];
}

/**
 * Throws 400 unless [start, end) lies fully inside a working segment of the
 * doctor's schedule for that clinic day.
 */
export function assertWithinWorkingHours(doctor: DoctorWithSchedules, start: Date, end: Date) {
  const date = clinicDateOf(start);
  const schedule = scheduleForDate(doctor, date);
  if (!schedule) throw AppError.badRequest('The doctor does not work on the selected day', 'OUTSIDE_WORKING_HOURS');
  const segments = workingSegments(schedule, date);
  const fits = segments.some((s) => start >= s.start.toJSDate() && end <= s.end.toJSDate());
  if (fits) return;
  const dayStart = segments[0].start.toJSDate();
  const dayEnd = segments[segments.length - 1].end.toJSDate();
  if (start >= dayStart && end <= dayEnd) {
    throw AppError.badRequest('The selected time falls within the doctor\'s break', 'DURING_BREAK');
  }
  throw AppError.badRequest('The selected time is outside the doctor\'s working hours', 'OUTSIDE_WORKING_HOURS');
}

export async function assertNoTimeOff(client: TxClient, doctorId: string, start: Date, end: Date) {
  const blocking = await client.doctorTimeOff.findFirst({
    where: { doctorId, startTime: { lt: end }, endTime: { gt: start } },
  });
  if (blocking) throw AppError.conflict('The doctor is unavailable at the selected time', 'DOCTOR_UNAVAILABLE');
}

export const slotService = {
  /**
   * Available slots for a doctor on a clinic-local date, in chronological
   * order. Excludes breaks, time off, active appointments and past times.
   */
  async getAvailableSlots(doctorId: string, date: string) {
    const doctor = await loadSchedulableDoctor(doctorId);
    const schedule = scheduleForDate(doctor, date);
    const duration = slotDurationOf(doctor, schedule);
    const base = { doctorId, date, timezone: CLINIC_ZONE(), slotDuration: duration };

    if (!schedule) return { ...base, isWorkingDay: false, workingHours: null, slots: [] as Slot[] };

    const segments = workingSegments(schedule, date);
    const dayStart = segments[0].start.toJSDate();
    const dayEnd = segments[segments.length - 1].end.toJSDate();

    const [appointments, timeOff] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          doctorId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          startTime: { lt: dayEnd },
          endTime: { gt: dayStart },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.doctorTimeOff.findMany({
        where: { doctorId, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
        select: { startTime: true, endTime: true },
      }),
    ]);
    const busy = [...appointments, ...timeOff];
    const now = new Date();

    const slots: Slot[] = [];
    for (const seg of segments) {
      for (let s = seg.start; s.plus({ minutes: duration }) <= seg.end; s = s.plus({ minutes: duration })) {
        const e = s.plus({ minutes: duration });
        const start = s.toJSDate();
        const end = e.toJSDate();
        if (start <= now) continue;
        if (busy.some((b) => rangesOverlap(start, end, b.startTime, b.endTime))) continue;
        slots.push({ startTime: start.toISOString(), endTime: end.toISOString(), label: s.toFormat('HH:mm') });
      }
    }

    return {
      ...base,
      isWorkingDay: true,
      workingHours: {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        breakStart: schedule.breakStart,
        breakEnd: schedule.breakEnd,
      },
      slots,
    };
  },
};
