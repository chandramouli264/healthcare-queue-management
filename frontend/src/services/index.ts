import { getData, getPage, send } from './api';
import type {
  Appointment, AvailableSlots, Doctor, Patient, Prescription, PrescriptionItem, QueueSnapshot, QueueEntry, Schedule, TimeOff, User,
} from '../types';

export const authService = {
  login: (email: string, password: string) => send<{ token: string; user: User }>('post', '/auth/login', { email, password }),
  register: (body: object) => send<{ token: string; user: User }>('post', '/auth/register', body),
  me: () => getData<User & { doctor: Doctor | null; patient: Patient | null }>('/auth/me'),
  updateMe: (body: object) => send<User>('patch', '/auth/me', body),
  changePassword: (currentPassword: string, newPassword: string) => send<null>('patch', '/auth/me/password', { currentPassword, newPassword }),
};

export const doctorService = {
  list: (params?: object) => getPage<Doctor>('/doctors', params),
  specializations: () => getData<string[]>('/doctors/specializations'),
  get: (id: string) => getData<Doctor>(`/doctors/${id}`),
  create: (body: object) => send<Doctor>('post', '/doctors', body),
  update: (id: string, body: object) => send<Doctor>('patch', `/doctors/${id}`, body),
  remove: (id: string) => send<{ deleted: boolean; deactivated: boolean }>('delete', `/doctors/${id}`),
  schedules: (id: string) => getData<Schedule[]>(`/doctors/${id}/schedules`),
  saveSchedules: (id: string, schedules: Omit<Schedule, 'id'>[]) => send<Schedule[]>('put', `/doctors/${id}/schedules`, { schedules }),
  timeOff: (id: string) => getData<TimeOff[]>(`/doctors/${id}/time-off`),
  addTimeOff: (id: string, body: object) => send<TimeOff>('post', `/doctors/${id}/time-off`, body),
  removeTimeOff: (id: string, timeOffId: string) => send<null>('delete', `/doctors/${id}/time-off/${timeOffId}`),
  slots: (id: string, date: string) => getData<AvailableSlots>(`/doctors/${id}/available-slots`, { date }),
};

export const appointmentService = {
  list: (params?: object) => getPage<Appointment>('/appointments', params),
  forPatient: (patientId: string, params?: object) => getPage<Appointment>(`/patients/${patientId}/appointments`, params),
  get: (id: string) => getData<Appointment>(`/appointments/${id}`),
  create: (body: { doctorId: string; startTime: string; reason?: string; patientId?: string }) => send<Appointment>('post', '/appointments', body),
  cancel: (id: string, reason?: string) => send<Appointment>('patch', `/appointments/${id}/cancel`, { reason }),
  reschedule: (id: string, startTime: string) => send<Appointment>('patch', `/appointments/${id}/reschedule`, { startTime }),
};

export const queueService = {
  get: (id: string) => getData<QueueSnapshot>(`/queue/${id}`),
  forDoctor: (doctorId: string, date?: string) => getData<QueueSnapshot>(`/queue/doctor/${doctorId}`, date ? { date } : undefined),
  mine: () => getData<QueueSnapshot[]>('/queue/mine'),
  call: (id: string) => send<{ called: QueueEntry | null; queue: QueueSnapshot }>('post', `/queue/${id}/call`),
  start: (id: string) => send<QueueSnapshot>('post', `/queue/${id}/start`),
  complete: (id: string) => send<QueueSnapshot>('post', `/queue/${id}/complete`),
  skip: (id: string) => send<QueueSnapshot>('post', `/queue/${id}/skip`),
};

export const prescriptionService = {
  list: (params?: object) => getPage<Prescription>('/prescriptions', params),
  forPatient: (patientId: string, params?: object) => getPage<Prescription>(`/patients/${patientId}/prescriptions`, params),
  get: (id: string) => getData<Prescription>(`/prescriptions/${id}`),
  create: (body: { appointmentId: string; diagnosis: string; notes?: string; items: PrescriptionItem[] }) => send<Prescription>('post', '/prescriptions', body),
  update: (id: string, body: object) => send<Prescription>('patch', `/prescriptions/${id}`, body),
  remove: (id: string) => send<null>('delete', `/prescriptions/${id}`),
};

export const patientService = {
  list: (params?: object) => getPage<Patient>('/patients', params),
  get: (id: string) => getData<Patient>(`/patients/${id}`),
  update: (id: string, body: object) => send<Patient>('patch', `/patients/${id}`, body),
};

export const userService = {
  list: (params?: object) => getPage<User>('/users', params),
  create: (body: object) => send<User>('post', '/users', body),
  update: (id: string, body: object) => send<User>('patch', `/users/${id}`, body),
};

export interface DashboardStats {
  role: string;
  cards: Record<string, number>;
  nextAppointments?: Appointment[];
  todayAppointments?: Appointment[];
  recentAppointments?: Appointment[];
}
export const dashboardService = { stats: () => getData<DashboardStats>('/dashboard/stats') };
