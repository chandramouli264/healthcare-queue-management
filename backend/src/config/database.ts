import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Options for interactive transactions that may wait on a per-doctor lock. */
export const LOCKING_TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;
