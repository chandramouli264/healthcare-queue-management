import { Prisma } from '@prisma/client';

export const userPublicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userBriefSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
} satisfies Prisma.UserSelect;

export const doctorInclude = {
  user: { select: { ...userBriefSelect, isActive: true } },
  schedules: { orderBy: { dayOfWeek: 'asc' } },
} satisfies Prisma.DoctorInclude;

export const doctorBriefInclude = {
  user: { select: userBriefSelect },
} satisfies Prisma.DoctorInclude;

export const patientInclude = {
  user: { select: { ...userBriefSelect, isActive: true } },
} satisfies Prisma.PatientInclude;

export const appointmentInclude = {
  doctor: { include: doctorBriefInclude },
  patient: { include: { user: { select: userBriefSelect } } },
  queueEntry: { select: { id: true, queueId: true, tokenNumber: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export const prescriptionInclude = {
  items: true,
  doctor: { include: doctorBriefInclude },
  patient: { include: { user: { select: userBriefSelect } } },
  appointment: { select: { id: true, reference: true, startTime: true, endTime: true, status: true } },
} satisfies Prisma.PrescriptionInclude;
