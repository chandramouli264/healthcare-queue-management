import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';

/** Requires a valid Bearer token and attaches the current user to req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();
    const payload = verifyToken(header.slice(7));
    const user = await userRepository.findAuthUser(payload.sub);
    if (!user || !user.isActive) throw AppError.unauthorized('Account not found or disabled');
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      doctorId: user.doctor?.id ?? null,
      patientId: user.patient?.id ?? null,
    };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : AppError.unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
  }
}

/** Restricts a route to the given roles (must run after authenticate). */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
