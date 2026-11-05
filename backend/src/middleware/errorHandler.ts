import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { isOverlapViolation } from '../utils/dbErrors';

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.errorCode, err.details);
  }

  if (isOverlapViolation(err)) {
    return sendError(res, 409, 'This appointment slot is already booked', 'SLOT_ALREADY_BOOKED');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return sendError(res, 409, 'A record with these details already exists', 'DUPLICATE_RECORD');
    if (err.code === 'P2025') return sendError(res, 404, 'Resource not found', 'NOT_FOUND');
    if (err.code === 'P2003') return sendError(res, 400, 'Related record does not exist or is still referenced', 'FOREIGN_KEY_VIOLATION');
  }

  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return sendError(res, 400, 'Malformed JSON body', 'INVALID_JSON');
  }

  logger.error(err);
  return sendError(res, 500, 'An unexpected error occurred', 'INTERNAL_SERVER_ERROR');
}
