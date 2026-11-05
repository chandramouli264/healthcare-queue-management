import { DateTime } from 'luxon';
import { env } from '../config/env';

export const CLINIC_ZONE = () => env.CLINIC_TIMEZONE;

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Combine a clinic-local date (YYYY-MM-DD) and "HH:mm" into a UTC Date. */
export function clinicDateTime(date: string, time: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: CLINIC_ZONE() });
}

/** Clinic-local calendar date (YYYY-MM-DD) of an instant. */
export function clinicDateOf(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: CLINIC_ZONE() }).toISODate()!;
}

/** 0 = Sunday ... 6 = Saturday, for a clinic-local date. */
export function dayOfWeekOf(date: string): number {
  return DateTime.fromISO(date, { zone: CLINIC_ZONE() }).weekday % 7;
}

/** Clinic-local "HH:mm" of an instant. */
export function clinicTimeOf(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: CLINIC_ZONE() }).toFormat('HH:mm');
}

/** A clinic-local date as a JS Date at UTC midnight, for @db.Date columns. */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function todayInClinic(): string {
  return DateTime.now().setZone(CLINIC_ZONE()).toISODate()!;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
