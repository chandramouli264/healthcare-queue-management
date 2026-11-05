import { Prisma } from '@prisma/client';
import { api, at, auth, book, createDoctor, createPatient, futureDate, prisma, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function activeOverlapsExist(doctorId: string) {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM appointments a JOIN appointments b
      ON a.doctor_id = b.doctor_id AND a.id < b.id
     AND a.start_time < b.end_time AND a.end_time > b.start_time
    WHERE a.doctor_id = ${doctorId}::uuid
      AND a.status IN ('CONFIRMED','IN_CONSULTATION','COMPLETED')
      AND b.status IN ('CONFIRMED','IN_CONSULTATION','COMPLETED')`;
  return Number(rows[0].n) > 0;
}

describe('Double-booking prevention under concurrency', () => {
  it('only one of 25 simultaneous requests for the same slot succeeds', async () => {
    const { doctorId } = await createDoctor();
    const patients = await Promise.all(Array.from({ length: 25 }, (_, i) => createPatient(`P${i}`)));
    const start = at(futureDate(), '10:00');

    const results = await Promise.all(patients.map((p) => book(p.token, doctorId, start)));
    const statuses = results.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(24);
    results.filter((r) => r.status === 409).forEach((r) => expect(r.body.errorCode).toBe('SLOT_ALREADY_BOOKED'));
    expect(await prisma.appointment.count({ where: { doctorId } })).toBe(1);
  });

  it('never creates overlaps for simultaneous partially-overlapping requests', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    // Starts every 5 minutes between 10:00 and 11:55 -> many partial overlaps.
    const starts = Array.from({ length: 24 }, (_, i) => {
      const m = 600 + i * 5;
      return at(date, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    });
    const patients = await Promise.all(starts.map((_, i) => createPatient(`Q${i}`)));
    const results = await Promise.all(starts.map((s, i) => book(patients[i].token, doctorId, s)));

    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    expect(await activeOverlapsExist(doctorId)).toBe(false);
  });

  it('issues unique sequential queue tokens under concurrency', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
    const patients = await Promise.all(times.map((_, i) => createPatient(`T${i}`)));
    const results = await Promise.all(times.map((t, i) => book(patients[i].token, doctorId, at(date, t))));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const tokens = results.map((r) => r.body.data.queueEntry.tokenNumber).sort((a: number, b: number) => a - b);
    expect(tokens).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('concurrent reschedules into the same slot: exactly one wins', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    const ps = await Promise.all([1, 2, 3, 4, 5].map((i) => createPatient(`R${i}`)));
    const booked = await Promise.all(ps.map((p, i) => book(p.token, doctorId, at(date, `0${9 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`.slice(-5)))));
    expect(booked.every((b) => b.status === 201)).toBe(true);

    const results = await Promise.all(
      booked.map((b, i) =>
        api().patch(`/api/appointments/${b.body.data.id}/reschedule`).set(auth(ps[i].token)).send({ startTime: at(date, '15:00') }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await activeOverlapsExist(doctorId)).toBe(false);
  });

  it('a cancellation racing with a new booking never produces an overlap', async () => {
    const { doctorId } = await createDoctor();
    const start = at(futureDate(), '10:00');
    const first = await createPatient();
    const second = await createPatient();
    const a = await book(first.token, doctorId, start);
    const [cancel, rebook] = await Promise.all([
      api().patch(`/api/appointments/${a.body.data.id}/cancel`).set(auth(first.token)).send({}),
      book(second.token, doctorId, start),
    ]);
    expect(cancel.status).toBe(200);
    expect([201, 409]).toContain(rebook.status);
    expect(await activeOverlapsExist(doctorId)).toBe(false);
  });

  it('the database itself rejects overlapping rows even if application checks are bypassed', async () => {
    const { doctorId } = await createDoctor();
    const p1 = await createPatient();
    const p2 = await createPatient();
    const date = futureDate();
    const base = { doctorId, status: 'CONFIRMED' as const };
    await prisma.appointment.create({
      data: { ...base, reference: 'RAW-1', patientId: p1.patientId, startTime: new Date(at(date, '10:00')), endTime: new Date(at(date, '10:30')) },
    });

    // Concurrent raw inserts that skip the advisory lock entirely.
    const attempts = await Promise.allSettled(
      [2, 3, 4, 5].map((n) =>
        prisma.appointment.create({
          data: { ...base, reference: `RAW-${n}`, patientId: p2.patientId, startTime: new Date(at(date, '10:15')), endTime: new Date(at(date, '10:45')) },
        }),
      ),
    );
    expect(attempts.every((a) => a.status === 'rejected')).toBe(true);
    const reason = (attempts[0] as PromiseRejectedResult).reason as Prisma.PrismaClientKnownRequestError;
    expect(String(reason.message) + JSON.stringify(reason.meta ?? {})).toMatch(/appointments_no_doctor_overlap|23P01|exclusion/i);

    // Adjacent ([) ranges) and cancelled rows are allowed.
    await expect(
      prisma.appointment.create({ data: { ...base, reference: 'RAW-ADJ', patientId: p2.patientId, startTime: new Date(at(date, '10:30')), endTime: new Date(at(date, '11:00')) } }),
    ).resolves.toBeDefined();
    await expect(
      prisma.appointment.create({ data: { doctorId, status: 'CANCELLED', reference: 'RAW-CXL', patientId: p2.patientId, startTime: new Date(at(date, '10:00')), endTime: new Date(at(date, '10:30')) } }),
    ).resolves.toBeDefined();
  });
});
