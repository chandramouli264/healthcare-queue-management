import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/database';
import { userPublicSelect } from './selects';

export const userRepository = {
  findAuthUser(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true, doctor: { select: { id: true } }, patient: { select: { id: true } } },
    });
  },

  findByEmailWithSecret(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { doctor: { select: { id: true } }, patient: { select: { id: true } } },
    });
  },

  findByIdWithSecret(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findProfile(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...userPublicSelect, doctor: true, patient: true },
    });
  },

  async list(params: { role?: Role; search?: string; skip: number; take: number }) {
    const where: Prisma.UserWhereInput = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: userPublicSelect, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, select: userPublicSelect });
  },
};
