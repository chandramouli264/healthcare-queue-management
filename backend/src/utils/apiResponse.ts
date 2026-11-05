import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta,
) {
  return res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errorCode: string,
  details?: unknown,
) {
  return res
    .status(statusCode)
    .json({ success: false, message, errorCode, ...(details !== undefined ? { details } : {}) });
}
