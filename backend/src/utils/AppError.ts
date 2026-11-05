export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, errorCode = 'VALIDATION_ERROR', details?: unknown) {
    return new AppError(400, message, errorCode, details);
  }
  static unauthorized(message = 'Authentication required', errorCode = 'UNAUTHORIZED') {
    return new AppError(401, message, errorCode);
  }
  static forbidden(message = 'You do not have permission to perform this action', errorCode = 'FORBIDDEN') {
    return new AppError(403, message, errorCode);
  }
  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new AppError(404, message, errorCode);
  }
  static conflict(message: string, errorCode = 'CONFLICT') {
    return new AppError(409, message, errorCode);
  }
}
