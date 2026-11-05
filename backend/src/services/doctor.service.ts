import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { hashPassword } from '../utils/password';
import { doctorRepository } from '../repositories/doctor.repository';
import { doctorInclude } from '../repositories/selects';
import { buildMeta } from '../utils/pagination';
import { AuthUser } from '../types';
import { assertCanManageDoctor } from './access';

interface DoctorProfileInput {
  specialization?: string;
  qualifications?: string;
  experienceYears?: number;
  consultationDuration?: number;
  consultationFee?: number;
  contactPhone?: string;
  contactEmail?: string;
  roomNumber?: string;
  bio?: string;
}

interface ScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  slotDuration?: number;
  isActive?: boolean;
}

export const doctorService = {
  async list(q: { search?: string; specialization?: string; includeInactive?: string; page: number; limit: number; skip: number }) {
    const { items, total } = await doctorRepository.list({
      search: q.search,
      specialization: q.specialization,
      includeInactive: q.includeInactive === 'true',
      skip: q.skip,
      take: q.limit,
    });
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  specializations: () => doctorRepository.specializations(),

  async getById(id: string) {
    const doctor = await doctorRepository.findById(id);
    if (!doctor) throw AppError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
    return doctor;
  },

  async create(input: DoctorProfileInput & { email: string; password: string; firstName: string; lastName: string; phone?: string; specialization: string; qualifications: string }) {
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
    }
    const { email, password, firstName, lastName, phone, ...profile } = input;
    return prisma.doctor.create({
      data: {
        ...profile,
        user: {
          create: { email, passwordHash: await hashPassword(password), firstName, lastName, phone, role: 'DOCTOR' },
        },
      },
      include: doctorInclude,
    });
  },

  async update(actor: AuthUser, id: string, input: DoctorProfileInput & { firstName?: string; lastName?: string; phone?: string | null; isActive?: boolean }) {
    assertCanManageDoctor(actor, id);
    await this.getById(id);
    const { firstName, lastName, phone, isActive, ...profile } = input;
    if (isActive !== undefined && actor.role !== 'ADMIN') throw AppError.forbidden('Only admins can change doctor status');
    return prisma.doctor.update({
      where: { id },
      data: {
        ...profile,
        user: { update: { firstName, lastName, phone, isActive } },
      },
      include: doctorInclude,
    });
  },

  /** Hard-deletes doctors without history; otherwise deactivates the account. */
  async remove(id: string) {
    const doctor = await this.getById(id);
    const history = await prisma.appointment.count({ where: { doctorId: id } });
    if (history === 0) {
      await prisma.user.delete({ where: { id: doctor.userId } });
      return { deleted: true, deactivated: false };
    }
    await prisma.user.update({ where: { id: doctor.userId }, data: { isActive: false } });
    return { deleted: false, deactivated: true };
  },

  async getSchedules(id: string) {
    await this.getById(id);
    return prisma.doctorSchedule.findMany({ where: { doctorId: id }, orderBy: { dayOfWeek: 'asc' } });
  },

  /** Replaces the full weekly schedule atomically. */
  async replaceSchedules(actor: AuthUser, id: string, schedules: ScheduleInput[]) {
    assertCanManageDoctor(actor, id);
    const doctor = await this.getById(id);
    await prisma.$transaction([
      prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }),
      prisma.doctorSchedule.createMany({
        data: schedules.map((s) => ({
          doctorId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart ?? null,
          breakEnd: s.breakEnd ?? null,
          slotDuration: s.slotDuration ?? doctor.consultationDuration,
          isActive: s.isActive ?? true,
        })),
      }),
    ]);
    return this.getSchedules(id);
  },

  async listTimeOff(id: string) {
    await this.getById(id);
    return prisma.doctorTimeOff.findMany({
      where: { doctorId: id, endTime: { gte: new Date() } },
      orderBy: { startTime: 'asc' },
    });
  },

  async addTimeOff(actor: AuthUser, id: string, input: { startTime: string; endTime: string; reason?: string }) {
    assertCanManageDoctor(actor, id);
    await this.getById(id);
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    const clashes = await prisma.appointment.count({
      where: { doctorId: id, status: 'CONFIRMED', startTime: { lt: end }, endTime: { gt: start } },
    });
    if (clashes > 0) {
      throw AppError.conflict(
        `There are ${clashes} confirmed appointment(s) in this period. Reschedule or cancel them first.`,
        'TIME_OFF_CONFLICTS_WITH_APPOINTMENTS',
      );
    }
    return prisma.doctorTimeOff.create({ data: { doctorId: id, startTime: start, endTime: end, reason: input.reason } });
  },

  async removeTimeOff(actor: AuthUser, id: string, timeOffId: string) {
    assertCanManageDoctor(actor, id);
    const entry = await prisma.doctorTimeOff.findFirst({ where: { id: timeOffId, doctorId: id } });
    if (!entry) throw AppError.notFound('Time-off entry not found');
    await prisma.doctorTimeOff.delete({ where: { id: timeOffId } });
  },
};
