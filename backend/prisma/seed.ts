/* Sample data for local development. Run with: npm run seed */
import { AppointmentStatus, Doctor, Patient, PrismaClient, QueueEntryStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const prisma = new PrismaClient();
const ZONE = process.env.CLINIC_TIMEZONE || 'UTC';
const PASSWORD = 'Password123';

const doctors = [
  { firstName: 'Ananya', lastName: 'Sharma', email: 'doctor@hqms.test', specialization: 'Cardiology', qualifications: 'MBBS, MD (Cardiology)', experienceYears: 12, fee: 800, room: 'C-101', duration: 30, bio: 'Interventional cardiologist focused on preventive heart care.' },
  { firstName: 'Rahul', lastName: 'Verma', email: 'rahul.verma@hqms.test', specialization: 'Dermatology', qualifications: 'MBBS, DDVL', experienceYears: 8, fee: 600, room: 'D-204', duration: 20, bio: 'Clinical and cosmetic dermatology.' },
  { firstName: 'Meera', lastName: 'Iyer', email: 'meera.iyer@hqms.test', specialization: 'Pediatrics', qualifications: 'MBBS, DCH, MD (Pediatrics)', experienceYears: 15, fee: 700, room: 'P-110', duration: 30, bio: 'Child health, vaccinations and developmental care.' },
  { firstName: 'Arjun', lastName: 'Nair', email: 'arjun.nair@hqms.test', specialization: 'Orthopedics', qualifications: 'MBBS, MS (Ortho)', experienceYears: 10, fee: 900, room: 'O-305', duration: 30, bio: 'Sports injuries and joint replacement.' },
  { firstName: 'Fatima', lastName: 'Khan', email: 'fatima.khan@hqms.test', specialization: 'General Medicine', qualifications: 'MBBS, MD (Internal Medicine)', experienceYears: 6, fee: 500, room: 'G-012', duration: 15, bio: 'Primary care for adults, chronic disease management.' },
];

const patients = [
  { firstName: 'Priya', lastName: 'Patel', email: 'patient@hqms.test', gender: 'FEMALE', dob: '1992-04-12', blood: 'B+' },
  { firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@hqms.test', gender: 'MALE', dob: '1985-09-30', blood: 'O+' },
  { firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@hqms.test', gender: 'FEMALE', dob: '1998-01-22', blood: 'A+' },
  { firstName: 'Karan', lastName: 'Mehta', email: 'karan.mehta@hqms.test', gender: 'MALE', dob: '1979-07-08', blood: 'AB+' },
  { firstName: 'Divya', lastName: 'Joshi', email: 'divya.joshi@hqms.test', gender: 'FEMALE', dob: '2001-11-15', blood: 'O-' },
  { firstName: 'Rohan', lastName: 'Gupta', email: 'rohan.gupta@hqms.test', gender: 'MALE', dob: '1990-03-03', blood: 'B-' },
  { firstName: 'Aisha', lastName: 'Siddiqui', email: 'aisha.siddiqui@hqms.test', gender: 'FEMALE', dob: '1995-06-27', blood: 'A-' },
  { firstName: 'Neil', lastName: 'Fernandes', email: 'neil.fernandes@hqms.test', gender: 'MALE', dob: '1988-12-19', blood: 'O+' },
] as const;

async function main() {
  console.log(`Seeding (clinic time zone: ${ZONE})...`);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "prescription_items","prescriptions","queue_entries","queues","appointments","doctor_time_off","doctor_schedules","doctors","patients","users" RESTART IDENTITY CASCADE',
  );
  await prisma.$executeRawUnsafe('ALTER SEQUENCE appointment_reference_seq RESTART WITH 1001');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE prescription_reference_seq RESTART WITH 1001');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.create({ data: { email: 'admin@hqms.test', passwordHash, firstName: 'System', lastName: 'Admin', role: 'ADMIN', phone: '+91 90000 00001' } });
  await prisma.user.create({ data: { email: 'reception@hqms.test', passwordHash, firstName: 'Rita', lastName: 'Desai', role: 'RECEPTIONIST', phone: '+91 90000 00002' } });

  const doctorRows: Doctor[] = [];
  for (const d of doctors) {
    const row: Doctor = await prisma.doctor.create({
      data: {
        specialization: d.specialization,
        qualifications: d.qualifications,
        experienceYears: d.experienceYears,
        consultationDuration: d.duration,
        consultationFee: d.fee,
        roomNumber: d.room,
        bio: d.bio,
        contactEmail: d.email,
        contactPhone: '+91 98000 1' + String(doctorRows.length).padStart(4, '0'),
        user: { create: { email: d.email, passwordHash, firstName: d.firstName, lastName: d.lastName, role: 'DOCTOR' } },
        // Mon-Sat 09:00-17:00 with lunch 13:00-14:00 (Saturday half day).
        schedules: {
          create: [1, 2, 3, 4, 5, 6].map((day) => ({
            dayOfWeek: day,
            startTime: '09:00',
            endTime: day === 6 ? '13:00' : '17:00',
            breakStart: day === 6 ? null : '13:00',
            breakEnd: day === 6 ? null : '14:00',
            slotDuration: d.duration,
          })),
        },
      },
    });
    doctorRows.push(row);
  }
  // The first doctor also works Sundays so there is always demo data.
  await prisma.doctorSchedule.create({ data: { doctorId: doctorRows[0].id, dayOfWeek: 0, startTime: '10:00', endTime: '14:00', slotDuration: 30 } });

  const patientRows: Patient[] = [];
  for (const [i, p] of patients.entries()) {
    const row = await prisma.patient.create({
      data: {
        gender: p.gender,
        dateOfBirth: new Date(`${p.dob}T00:00:00Z`),
        bloodGroup: p.blood,
        address: `${10 + i} MG Road, Bengaluru`,
        emergencyContactName: 'Family Contact',
        emergencyContactPhone: '+91 97000 0' + String(i).padStart(4, '0'),
        allergies: i === 0 ? 'Penicillin' : null,
        user: { create: { email: p.email, passwordHash, firstName: p.firstName, lastName: p.lastName, phone: '+91 99000 0' + String(i).padStart(4, '0'), role: 'PATIENT' } },
      },
    });
    patientRows.push(row);
  }

  const today = DateTime.now().setZone(ZONE).startOf('day');
  let reference = 1001;
  let rxReference = 1001;

  async function createAppointment(doctorIdx: number, patientIdx: number, day: DateTime, time: string, status: AppointmentStatus, queueStatus: QueueEntryStatus | null, reason: string) {
    const doctor = doctorRows[doctorIdx];
    const [h, m] = time.split(':').map(Number);
    const start = day.set({ hour: h, minute: m });
    const end = start.plus({ minutes: doctor.consultationDuration });
    const appt = await prisma.appointment.create({
      data: {
        reference: `APT-${reference++}`,
        doctorId: doctor.id,
        patientId: patientRows[patientIdx].id,
        startTime: start.toJSDate(),
        endTime: end.toJSDate(),
        status,
        reason,
        ...(status === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: 'Schedule conflict' } : {}),
      },
    });
    if (queueStatus) {
      const queueDate = new Date(`${day.toISODate()}T00:00:00.000Z`);
      const queue = await prisma.queue.upsert({
        where: { doctorId_queueDate: { doctorId: doctor.id, queueDate } },
        create: { doctorId: doctor.id, queueDate, lastToken: 1 },
        update: { lastToken: { increment: 1 } },
      });
      const now = new Date();
      await prisma.queueEntry.create({
        data: {
          queueId: queue.id,
          appointmentId: appt.id,
          patientId: appt.patientId,
          tokenNumber: queue.lastToken,
          status: queueStatus,
          calledAt: ['CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'].includes(queueStatus) ? now : null,
          startedAt: ['IN_CONSULTATION', 'COMPLETED'].includes(queueStatus) ? now : null,
          completedAt: ['COMPLETED', 'SKIPPED'].includes(queueStatus) ? now : null,
        },
      });
    }
    return appt;
  }

  async function prescribe(appt: { id: string; doctorId: string; patientId: string }, diagnosis: string, items: { medicineName: string; dosage: string; frequency: string; duration: string; instructions?: string }[]) {
    await prisma.prescription.create({
      data: { reference: `RX-${rxReference++}`, appointmentId: appt.id, doctorId: appt.doctorId, patientId: appt.patientId, diagnosis, items: { create: items } },
    });
  }

  // --- Past history ---
  const lastWeek = today.minus({ days: 7 });
  const past1 = await createAppointment(0, 0, lastWeek, '10:00', 'COMPLETED', 'COMPLETED', 'Palpitations');
  await prescribe(past1, 'Mild hypertension', [
    { medicineName: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily (morning)', duration: '30 days', instructions: 'Monitor BP weekly' },
    { medicineName: 'Aspirin', dosage: '75 mg', frequency: 'Once daily after dinner', duration: '30 days' },
  ]);
  const past2 = await createAppointment(1, 0, lastWeek.plus({ days: 2 }), '11:00', 'COMPLETED', 'COMPLETED', 'Skin rash');
  await prescribe(past2, 'Contact dermatitis', [
    { medicineName: 'Hydrocortisone cream 1%', dosage: 'Thin layer', frequency: 'Twice daily', duration: '7 days', instructions: 'Apply on affected area only' },
    { medicineName: 'Cetirizine', dosage: '10 mg', frequency: 'Once daily at night', duration: '5 days' },
  ]);
  const past3 = await createAppointment(2, 2, lastWeek.plus({ days: 1 }), '09:30', 'COMPLETED', 'COMPLETED', 'Fever');
  await prescribe(past3, 'Viral fever', [{ medicineName: 'Paracetamol', dosage: '650 mg', frequency: 'Every 6 hours if fever', duration: '3 days', instructions: 'Max 4 doses per day' }]);
  await createAppointment(3, 1, lastWeek, '15:00', 'CANCELLED', null, 'Knee pain');
  await createAppointment(4, 3, lastWeek.plus({ days: 3 }), '10:15', 'NO_SHOW', 'SKIPPED', 'Routine check-up');

  // --- Today's live queue for Dr. Ananya Sharma (doctor@hqms.test) ---
  const todayDoctor = 0;
  const todaySchedule = await prisma.doctorSchedule.findFirst({ where: { doctorId: doctorRows[todayDoctor].id, dayOfWeek: today.weekday % 7 } });
  const startHour = todaySchedule ? Number(todaySchedule.startTime.slice(0, 2)) : 9;
  const t = (offsetMin: number) => {
    const total = startHour * 60 + offsetMin;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  await createAppointment(todayDoctor, 3, today, t(0), 'COMPLETED', 'COMPLETED', 'Follow-up ECG');
  await createAppointment(todayDoctor, 1, today, t(30), 'IN_CONSULTATION', 'IN_CONSULTATION', 'Chest discomfort');
  await createAppointment(todayDoctor, 0, today, t(60), 'CONFIRMED', 'WAITING', 'Blood pressure review');
  await createAppointment(todayDoctor, 4, today, t(90), 'CONFIRMED', 'WAITING', 'Shortness of breath');
  await createAppointment(todayDoctor, 5, today, t(120), 'CONFIRMED', 'WAITING', 'Annual cardiac screening');
  await createAppointment(todayDoctor, 6, today, t(150), 'CONFIRMED', 'WAITING', 'Cholesterol consultation');

  // Today for other doctors (if they work today)
  if (today.weekday !== 7) {
    await createAppointment(4, 7, today, '09:00', 'CONFIRMED', 'WAITING', 'Cough and cold');
    await createAppointment(4, 2, today, '09:15', 'CONFIRMED', 'WAITING', 'Headache');
    await createAppointment(2, 5, today, '10:00', 'CONFIRMED', 'WAITING', 'Child vaccination');
  }

  // --- Upcoming appointments ---
  const nextWorkday = (n: number) => {
    let d = today.plus({ days: n });
    while (d.weekday === 7) d = d.plus({ days: 1 });
    return d;
  };
  await createAppointment(1, 0, nextWorkday(2), '10:00', 'CONFIRMED', 'WAITING', 'Dermatology follow-up');
  await createAppointment(3, 0, nextWorkday(5), '11:30', 'CONFIRMED', 'WAITING', 'Shoulder pain');
  await createAppointment(0, 2, nextWorkday(1), '14:00', 'CONFIRMED', 'WAITING', 'Heart palpitations');
  await createAppointment(2, 4, nextWorkday(3), '09:30', 'CONFIRMED', 'WAITING', 'Growth assessment');
  await createAppointment(3, 7, nextWorkday(4), '15:00', 'CONFIRMED', 'WAITING', 'Back pain');

  // Keep DB sequences ahead of the seeded references.
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE appointment_reference_seq RESTART WITH ${reference}`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE prescription_reference_seq RESTART WITH ${rxReference}`);

  console.log('Seed complete. Demo accounts (password: Password123):');
  console.table([
    { role: 'ADMIN', email: 'admin@hqms.test' },
    { role: 'RECEPTIONIST', email: 'reception@hqms.test' },
    { role: 'DOCTOR', email: 'doctor@hqms.test' },
    { role: 'PATIENT', email: 'patient@hqms.test' },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
