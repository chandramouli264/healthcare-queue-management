import { Prisma } from '@prisma/client';

export const OVERLAP_CONSTRAINT = 'appointments_no_doctor_overlap';

/**
 * True when Postgres rejected a write because of the appointment exclusion
 * constraint (SQLSTATE 23P01 exclusion_violation).
 */
export function isOverlapViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; meta?: Record<string, unknown> };
  const text = `${e.message ?? ''} ${JSON.stringify(e.meta ?? {})}`;
  if (text.includes(OVERLAP_CONSTRAINT) || text.includes('23P01')) return true;
  return (
    (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientUnknownRequestError) &&
    /exclusion constraint/i.test(text)
  );
}
