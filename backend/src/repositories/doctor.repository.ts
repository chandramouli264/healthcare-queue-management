import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { doctorInclude } from './selects';

export const doctorRepository = {
  findById(id: string) {
    return prisma.doctor.findUnique({ where: { id }, include: doctorInclude });
  },

  async list(params: { search?: string; specialization?: string; includeInactive?: boolean; skip: number; take: number }) {
    const where: Prisma.DoctorWhereInput = {
      ...(params.includeInactive ? {} : { user: { isActive: true } }),
      ...(params.specialization ? { specialization: { equals: params.specialization, mode: 'insensitive' } } : {}),
      ...(params.search
        ? {
            OR: [
              { specialization: { contains: params.search, mode: 'insensitive' } },
              { user: { firstName: { contains: params.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.doctor.findMany({
        where,
        include: doctorInclude,
        orderBy: [{ user: { lastName: 'asc' } }],
        skip: params.skip,
        take: params.take,
      }),
      prisma.doctor.count({ where }),
    ]);
    return { items, total };
  },

  async specializations() {
    const rows = await prisma.doctor.findMany({
      where: { user: { isActive: true } },
      distinct: ['specialization'],
      select: { specialization: true },
      orderBy: { specialization: 'asc' },
    });
    return rows.map((r) => r.specialization);
  },
};
