import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';
import { dateOnly } from '../utils/time';
import { userPublicSelect } from '../repositories/selects';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
}

export const authService = {
  /** Public self-registration always creates a PATIENT account. */
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict('An account with this email already exists', 'EMAIL_IN_USE');

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: 'PATIENT',
        patient: {
          create: {
            dateOfBirth: input.dateOfBirth ? dateOnly(input.dateOfBirth) : undefined,
            gender: input.gender,
          },
        },
      },
      select: { ...userPublicSelect, patient: { select: { id: true } } },
    });

    const token = signToken({ sub: user.id, role: user.role });
    const { patient, ...rest } = user;
    return { token, user: { ...rest, patientId: patient?.id ?? null, doctorId: null } };
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmailWithSecret(email);
    // Same error for unknown email and wrong password (no account enumeration).
    const valid = user ? await comparePassword(password, user.passwordHash) : false;
    if (!user || !valid) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    if (!user.isActive) throw AppError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');

    const token = signToken({ sub: user.id, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        doctorId: user.doctor?.id ?? null,
        patientId: user.patient?.id ?? null,
      },
    };
  },

  async me(userId: string) {
    const user = await userRepository.findProfile(userId);
    if (!user) throw AppError.notFound('User not found');
    return { ...user, doctorId: user.doctor?.id ?? null, patientId: user.patient?.id ?? null };
  },

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string | null }) {
    await userRepository.update(userId, data);
    return this.me(userId);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findByIdWithSecret(userId);
    if (!user) throw AppError.notFound('User not found');
    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
    }
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  },
};
