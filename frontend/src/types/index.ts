export type Role = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR' | 'PATIENT';
export type AppointmentStatus = 'CONFIRMED' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type QueueEntryStatus = 'WAITING' | 'CALLED' | 'IN_CONSULTATION' | 'COMPLETED' | 'SKIPPED';

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  doctorId: string | null;
  patientId: string | null;
}

export interface BriefUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive?: boolean;
}

export interface Schedule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  slotDuration: number;
  isActive: boolean;
}

export interface Doctor {
  id: string;
  userId: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  consultationDuration: number;
  consultationFee: string;
  contactPhone: string | null;
  contactEmail: string | null;
  roomNumber: string | null;
  bio: string | null;
  user: BriefUser;
  schedules?: Schedule[];
}

export interface Patient {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  bloodGroup: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  allergies: string | null;
  user: BriefUser;
}

export interface TimeOff {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface Slot {
  startTime: string;
  endTime: string;
  label: string;
}

export interface AvailableSlots {
  doctorId: string;
  date: string;
  timezone: string;
  slotDuration: number;
  isWorkingDay: boolean;
  workingHours: { startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null } | null;
  slots: Slot[];
}

export interface Appointment {
  id: string;
  reference: string;
  patientId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  doctor: Doctor;
  patient: Patient;
  queueEntry: { id: string; queueId: string; tokenNumber: number; status: QueueEntryStatus } | null;
}

export interface QueueEntry {
  id: string;
  tokenNumber: number;
  status: QueueEntryStatus;
  position: number | null;
  peopleAhead: number | null;
  estimatedWaitMinutes: number | null;
  scheduledTime: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  isMine: boolean;
  appointmentId?: string;
  appointmentReference?: string;
  reason?: string | null;
  patient?: { id: string; firstName: string; lastName: string; phone?: string | null };
}

export interface QueueSnapshot {
  id: string;
  doctorId: string;
  doctor: { id: string; name: string; specialization: string; roomNumber: string | null };
  queueDate: string;
  lastToken: number;
  current: QueueEntry | null;
  entries: QueueEntry[];
  myEntry: QueueEntry | null;
  stats: { total: number; waiting: number; called: number; inConsultation: number; completed: number; skipped: number };
}

export interface PrescriptionItem {
  id?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
}

export interface Prescription {
  id: string;
  reference: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  diagnosis: string;
  notes: string | null;
  createdAt: string;
  items: PrescriptionItem[];
  doctor: Doctor;
  patient: Patient;
  appointment: { id: string; reference: string; startTime: string; endTime: string; status: AppointmentStatus };
}
