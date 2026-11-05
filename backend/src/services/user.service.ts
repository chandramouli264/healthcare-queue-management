import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { hashPassword } from '../utils/password';
import { userRepository } from '../repositories/user.repository';
import { userPublicSelect } from '../repositories/selects';
import { buildMeta } from '../utils/pagination';

export const userService = {
  async list(q: { role?: Role; search?: string; page: number; limit: number; skip: number }) {
    const { items, total } = await userRepository.list({ role: q.role, search: q.search, skip: q.skip, take: q.limit });
    return { items, meta: buildMeta(q.page, q.limit, total) };
  },

  /** Admin creates ADMIN / RECEPTIONIST / PATIENT accounts (doctors via /doctors). */
  async create(input: { email: string; password: string; firstName: string; lastName: string; phone?: string; role: 'ADMIN' | 'RECEPTIONIST' | 'PATIENT' }) {
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
    }
    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role,
        ...(input.role === 'PATIENT' ? { patient: { create: {} } } : {}),
      },
      select: userPublicSelect,
    });
  },

  async update(actorId: string, id: string, data: { firstName?: string; lastName?: string; phone?: string | null; isActive?: boolean }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw AppError.notFound('User not found');
    if (actorId === id && data.isActive === false) {
      throw AppError.badRequest('You cannot deactivate your own account', 'CANNOT_DEACTIVATE_SELF');
    }
    return userRepository.update(id, data);
  },

  /** Soft delete: accounts are deactivated so medical history stays intact. */
  async deactivate(actorId: string, id: string) {
    return this.update(actorId, id, { isActive: false });
  },
};
