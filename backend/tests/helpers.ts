import request from 'supertest';
import { DateTime } from 'luxon';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { hashPassword } from '../src/utils/password';
import { signToken } from '../src/utils/jwt';

export const app = createApp();
export const api = () => request(app);
export { prisma };

const TABLES = [
  'prescription_items', 'prescriptions', 'queue_entries', 'queues', 'appointments',
  'doctor_time_off', 'doctor_schedules', 'doctors', 'patients', 'users',
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

let counter = 0;
const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}.${++counter}@test.local`;
export const PASSWORD = 'Password123';

export async function createUser(role: 'ADMIN' | 'RECEPTIONIST') {
  const user = await prisma.user.create({
    data: { email: uniqueEmail(role.toLowerCase()), passwordHash: await hashPassword(PASSWORD), firstName: role, lastName: 'User', role },
  });
  return { user, token: signToken({ sub: user.id, role }) };
}

export async function createPatient(firstName = 'Pat') {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail('patient'),
      passwordHash: await hashPassword(PASSWORD),
      firstName,
      lastName: 'Patient',
      role: 'PATIENT',
      patient: { create: {} },
    },
    include: { patient: true },
  });
  return { user, patientId: user.patient!.id, token: signToken({ sub: user.id, role: 'PATIENT' }) };
}

/** Doctor working every day 09:00-17:00 with a 13:00-14:00 break, 30 min slots. */
export async function createDoctor(opts: { slotDuration?: number } = {}) {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail('doctor'),
      passwordHash: await hashPassword(PASSWORD),
      firstName: 'Doc',
      lastName: `Tor${counter}`,
      role: 'DOCTOR',
      doctor: {
        create: {
          specialization: 'Cardiology',
          qualifications: 'MBBS, MD',
          consultationDuration: opts.slotDuration ?? 30,
          schedules: {
            create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
              dayOfWeek: d,
              startTime: '09:00',
              endTime: '17:00',
              breakStart: '13:00',
              breakEnd: '14:00',
              slotDuration: opts.slotDuration ?? 30,
            })),
          },
        },
      },
    },
    include: { doctor: true },
  });
  return { user, doctorId: user.doctor!.id, token: signToken({ sub: user.id, role: 'DOCTOR' }) };
}

/** A clinic date (tests run with CLINIC_TIMEZONE=UTC) N days from today. */
export function futureDate(daysAhead = 7): string {
  return DateTime.utc().plus({ days: daysAhead }).toISODate()!;
}

export function at(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function book(token: string, doctorId: string, startTime: string, extra: Record<string, unknown> = {}) {
  return api().post('/api/appointments').set(auth(token)).send({ doctorId, startTime, ...extra });
}
