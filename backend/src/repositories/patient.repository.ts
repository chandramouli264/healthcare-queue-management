import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { patientInclude } from './selects';

export const patientRepository = {
  findById(id: string) {
    return prisma.patient.findUnique({ where: { id }, include: patientInclude });
  },

  async list(params: { search?: string; doctorId?: string; skip: number; take: number }) {
    const where: Prisma.PatientWhereInput = {
      ...(params.doctorId ? { appointments: { some: { doctorId: params.doctorId } } } : {}),
      ...(params.search
        ? {
            OR: [
              { user: { firstName: { contains: params.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: params.search, mode: 'insensitive' } } },
              { user: { email: { contains: params.search, mode: 'insensitive' } } },
              { user: { phone: { contains: params.search } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.patient.findMany({ where, include: patientInclude, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      prisma.patient.count({ where }),
    ]);
    return { items, total };
  },

  hasAppointmentWithDoctor(patientId: string, doctorId: string) {
    return prisma.appointment
      .count({ where: { patientId, doctorId } })
      .then((c) => c > 0);
  },
};
