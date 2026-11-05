import { DateTime } from 'luxon';
import { api, auth, createDoctor, createPatient, createUser, prisma, resetDb } from './helpers';
import { queueService } from '../src/services/queue.service';
import { lockDoctor } from '../src/utils/dbLocks';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/** Inserts today's appointments directly (booking API rejects past times). */
async function seedTodayQueue(doctorId: string, count: number) {
  const patients = await Promise.all(Array.from({ length: count }, (_, i) => createPatient(`Q${i}`)));
  const base = DateTime.utc().startOf('day').plus({ hours: 9 });
  // Insert in reverse time order to prove calling follows appointment time.
  for (let i = count - 1; i >= 0; i--) {
    await prisma.$transaction(async (tx) => {
      await lockDoctor(tx, doctorId);
      const appt = await tx.appointment.create({
        data: {
          reference: `Q-${i}-${doctorId.slice(0, 4)}`,
          doctorId,
          patientId: patients[i].patientId,
          startTime: base.plus({ minutes: 30 * i }).toJSDate(),
          endTime: base.plus({ minutes: 30 * (i + 1) }).toJSDate(),
        },
      });
      await queueService.addEntry(tx, appt);
    });
  }
  const queue = await prisma.queue.findFirstOrThrow({ where: { doctorId } });
  return { patients, queueId: queue.id };
}

describe('Queue management', () => {
  it('generates sequential tokens and orders the queue by appointment time', async () => {
    const { doctorId, token } = await createDoctor();
    const { queueId } = await seedTodayQueue(doctorId, 3);
    const res = await api().get(`/api/queue/${queueId}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.lastToken).toBe(3);
    // Earliest appointment was inserted last -> token 3 but position 1.
    expect(res.body.data.entries.map((e: { tokenNumber: number }) => e.tokenNumber)).toEqual([3, 2, 1]);
    expect(res.body.data.entries.map((e: { position: number }) => e.position)).toEqual([1, 2, 3]);
    expect(res.body.data.stats).toMatchObject({ total: 3, waiting: 3 });
  });

  it('calls the next patient, prevents duplicate calls and completes the consultation', async () => {
    const { doctorId, token } = await createDoctor();
    const { queueId, patients } = await seedTodayQueue(doctorId, 2);

    const call = await api().post(`/api/queue/${queueId}/call`).set(auth(token));
    expect(call.status).toBe(200);
    expect(call.body.data.called.patient.id).toBe(patients[0].patientId);
    expect(call.body.data.called.status).toBe('CALLED');

    const dup = await api().post(`/api/queue/${queueId}/call`).set(auth(token));
    expect(dup.status).toBe(409);
    expect(dup.body.errorCode).toBe('PATIENT_ALREADY_CALLED');

    const start = await api().post(`/api/queue/${queueId}/start`).set(auth(token));
    expect(start.body.data.current.status).toBe('IN_CONSULTATION');

    const done = await api().post(`/api/queue/${queueId}/complete`).set(auth(token));
    expect(done.status).toBe(200);
    expect(done.body.data.stats).toMatchObject({ completed: 1, waiting: 1 });
    const appt = await prisma.appointment.findFirst({ where: { patientId: patients[0].patientId } });
    expect(appt!.status).toBe('COMPLETED');

    const next = await api().post(`/api/queue/${queueId}/call`).set(auth(token));
    expect(next.body.data.called.patient.id).toBe(patients[1].patientId);
  });

  it('only one of several simultaneous "call next" requests succeeds', async () => {
    const { doctorId, token } = await createDoctor();
    const reception = await createUser('RECEPTIONIST');
    const { queueId } = await seedTodayQueue(doctorId, 3);
    const results = await Promise.all([
      api().post(`/api/queue/${queueId}/call`).set(auth(token)),
      api().post(`/api/queue/${queueId}/call`).set(auth(reception.token)),
      api().post(`/api/queue/${queueId}/call`).set(auth(token)),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await prisma.queueEntry.count({ where: { queueId, status: 'CALLED' } })).toBe(1);
  });

  it('handles an empty queue', async () => {
    const { doctorId, token } = await createDoctor();
    const q = await api().get(`/api/queue/doctor/${doctorId}`).set(auth(token));
    expect(q.status).toBe(200);
    const res = await api().post(`/api/queue/${q.body.data.id}/call`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.called).toBeNull();
    expect(res.body.message).toBe('No patients waiting in the queue');
    expect((await api().post(`/api/queue/${q.body.data.id}/complete`).set(auth(token))).status).toBe(409);
  });

  it('skips a no-show patient', async () => {
    const { doctorId, token } = await createDoctor();
    const { queueId, patients } = await seedTodayQueue(doctorId, 2);
    await api().post(`/api/queue/${queueId}/call`).set(auth(token));
    const res = await api().post(`/api/queue/${queueId}/skip`).set(auth(token));
    expect(res.body.data.stats).toMatchObject({ skipped: 1, waiting: 1 });
    const appt = await prisma.appointment.findFirst({ where: { patientId: patients[0].patientId } });
    expect(appt!.status).toBe('NO_SHOW');
  });

  it('restricts queue operations and hides other patients\' identities', async () => {
    const { doctorId } = await createDoctor();
    const otherDoctor = await createDoctor();
    const { queueId, patients } = await seedTodayQueue(doctorId, 2);

    expect((await api().post(`/api/queue/${queueId}/call`).set(auth(otherDoctor.token))).status).toBe(403);
    expect((await api().post(`/api/queue/${queueId}/call`).set(auth(patients[0].token))).status).toBe(403);

    const view = await api().get(`/api/queue/${queueId}`).set(auth(patients[1].token));
    expect(view.status).toBe(200);
    const [first, second] = view.body.data.entries;
    expect(first.patient).toBeUndefined();
    expect(second.isMine).toBe(true);
    expect(second.patient.id).toBe(patients[1].patientId);
    expect(view.body.data.myEntry).toMatchObject({ position: 2, peopleAhead: 1 });

    const mine = await api().get('/api/queue/mine').set(auth(patients[1].token));
    expect(mine.body.data).toHaveLength(1);
  });
});
