import { TxClient } from '../config/database';

/**
 * Serialises all booking/queue writes for one doctor for the rest of the
 * current transaction (released automatically on COMMIT/ROLLBACK).
 * The exclusion constraint is the final guarantee; the lock gives clean,
 * deterministic 409s and protects queue token generation.
 */
export async function lockDoctor(tx: TxClient, doctorId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'doctor:' + doctorId}))::text AS locked`;
}

export async function nextReference(tx: TxClient, kind: 'appointment' | 'prescription'): Promise<string> {
  const rows =
    kind === 'appointment'
      ? await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('appointment_reference_seq') AS n`
      : await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('prescription_reference_seq') AS n`;
  return `${kind === 'appointment' ? 'APT' : 'RX'}-${rows[0].n.toString()}`;
}
