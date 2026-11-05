import { api, at, auth, book, createDoctor, createPatient, createUser, futureDate, prisma, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Appointment booking', () => {
  it('books an appointment with a unique reference and a queue token', async () => {
    const { doctorId } = await createDoctor();
    const patient = await createPatient();
    const res = await book(patient.token, doctorId, at(futureDate(), '10:00'), { reason: 'Chest pain' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: 'Appointment booked successfully' });
    expect(res.body.data.reference).toMatch(/^APT-\d+$/);
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(new Date(res.body.data.endTime).getTime() - new Date(res.body.data.startTime).getTime()).toBe(30 * 60_000);
    expect(res.body.data.queueEntry).toMatchObject({ tokenNumber: 1, status: 'WAITING' });

    const second = await book((await createPatient()).token, doctorId, at(futureDate(), '11:00'));
    expect(second.body.data.reference).not.toBe(res.body.data.reference);
  });

  it('follows the A / B / C overlap example', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    const a = await book((await createPatient('A')).token, doctorId, at(date, '10:00'));
    const b = await book((await createPatient('B')).token, doctorId, at(date, '10:15'));
    const c = await book((await createPatient('C')).token, doctorId, at(date, '10:30'));
    expect(a.status).toBe(201);
    expect(b.status).toBe(409);
    expect(b.body).toEqual({ success: false, message: 'This appointment slot is already booked', errorCode: 'SLOT_ALREADY_BOOKED' });
    expect(c.status).toBe(201);
  });

  it('allows different doctors at the same time', async () => {
    const d1 = await createDoctor();
    const d2 = await createDoctor();
    const start = at(futureDate(), '10:00');
    expect((await book((await createPatient()).token, d1.doctorId, start)).status).toBe(201);
    expect((await book((await createPatient()).token, d2.doctorId, start)).status).toBe(201);
  });

  it('prevents a patient from double booking themself', async () => {
    const d1 = await createDoctor();
    const d2 = await createDoctor();
    const patient = await createPatient();
    const start = at(futureDate(), '10:00');
    expect((await book(patient.token, d1.doctorId, start)).status).toBe(201);
    const res = await book(patient.token, d2.doctorId, start);
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('PATIENT_DOUBLE_BOOKING');
  });

  it('rejects bookings outside working hours, during breaks and in the past', async () => {
    const { doctorId } = await createDoctor();
    const { token } = await createPatient();
    const date = futureDate();
    const early = await book(token, doctorId, at(date, '08:30'));
    expect(early.status).toBe(400);
    expect(early.body.errorCode).toBe('OUTSIDE_WORKING_HOURS');
    const late = await book(token, doctorId, at(date, '16:45')); // would end 17:15
    expect(late.body.errorCode).toBe('OUTSIDE_WORKING_HOURS');
    const lunch = await book(token, doctorId, at(date, '13:00'));
    expect(lunch.body.errorCode).toBe('DURING_BREAK');
    const past = await book(token, doctorId, at(futureDate(-2), '10:00'));
    expect(past.body.errorCode).toBe('APPOINTMENT_IN_PAST');
  });

  it('validates IDs and payloads', async () => {
    const { token } = await createPatient();
    expect((await book(token, 'not-a-uuid', at(futureDate(), '10:00'))).status).toBe(400);
    expect((await book(token, '00000000-0000-4000-8000-000000000000', at(futureDate(), '10:00'))).status).toBe(404);
    expect((await api().post('/api/appointments').set(auth(token)).send({})).status).toBe(400);
  });

  it('requires patientId for staff and blocks booking for other patients', async () => {
    const { doctorId } = await createDoctor();
    const reception = await createUser('RECEPTIONIST');
    const patient = await createPatient();
    const other = await createPatient();
    const start = at(futureDate(), '10:00');
    expect((await book(reception.token, doctorId, start)).status).toBe(400);
    expect((await book(other.token, doctorId, start, { patientId: patient.patientId })).status).toBe(403);
    const ok = await book(reception.token, doctorId, start, { patientId: patient.patientId });
    expect(ok.status).toBe(201);
    expect(ok.body.data.patientId).toBe(patient.patientId);
  });

  it('enforces access to appointment details and history', async () => {
    const { doctorId, token: doctorToken } = await createDoctor();
    const patient = await createPatient();
    const stranger = await createPatient();
    const booked = await book(patient.token, doctorId, at(futureDate(), '10:00'));
    const id = booked.body.data.id;

    expect((await api().get(`/api/appointments/${id}`).set(auth(patient.token))).status).toBe(200);
    expect((await api().get(`/api/appointments/${id}`).set(auth(doctorToken))).status).toBe(200);
    expect((await api().get(`/api/appointments/${id}`).set(auth(stranger.token))).status).toBe(403);

    const history = await api().get(`/api/patients/${patient.patientId}/appointments`).set(auth(patient.token));
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.meta).toMatchObject({ total: 1 });
    expect((await api().get(`/api/patients/${patient.patientId}/appointments`).set(auth(stranger.token))).status).toBe(403);
  });
});

describe('Cancellation', () => {
  it('cancels, removes the queue token and frees the slot', async () => {
    const { doctorId } = await createDoctor();
    const patient = await createPatient();
    const start = at(futureDate(), '10:00');
    const booked = await book(patient.token, doctorId, start);
    const res = await api().patch(`/api/appointments/${booked.body.data.id}/cancel`).set(auth(patient.token)).send({ reason: 'Feeling better' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Feeling better', queueEntry: null });

    const again = await book((await createPatient()).token, doctorId, start);
    expect(again.status).toBe(201);
  });

  it('cannot cancel twice or cancel someone else\'s appointment', async () => {
    const { doctorId } = await createDoctor();
    const patient = await createPatient();
    const stranger = await createPatient();
    const booked = await book(patient.token, doctorId, at(futureDate(), '10:00'));
    const id = booked.body.data.id;
    expect((await api().patch(`/api/appointments/${id}/cancel`).set(auth(stranger.token)).send({})).status).toBe(403);
    expect((await api().patch(`/api/appointments/${id}/cancel`).set(auth(patient.token)).send({})).status).toBe(200);
    const twice = await api().patch(`/api/appointments/${id}/cancel`).set(auth(patient.token)).send({});
    expect(twice.status).toBe(400);
    expect(twice.body.errorCode).toBe('INVALID_APPOINTMENT_STATUS');
  });
});

describe('Rescheduling', () => {
  it('moves the appointment to a free slot and frees the old one', async () => {
    const { doctorId } = await createDoctor();
    const patient = await createPatient();
    const date = futureDate();
    const booked = await book(patient.token, doctorId, at(date, '10:00'));
    const res = await api()
      .patch(`/api/appointments/${booked.body.data.id}/reschedule`)
      .set(auth(patient.token))
      .send({ startTime: at(date, '15:00') });
    expect(res.status).toBe(200);
    expect(res.body.data.startTime).toBe(at(date, '15:00'));
    expect(res.body.data.reference).toBe(booked.body.data.reference);
    expect((await book((await createPatient()).token, doctorId, at(date, '10:00'))).status).toBe(201);
  });

  it('rejects rescheduling into an occupied slot and leaves the original untouched', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    const p1 = await createPatient();
    const p2 = await createPatient();
    const a1 = await book(p1.token, doctorId, at(date, '10:00'));
    await book(p2.token, doctorId, at(date, '11:00'));
    const res = await api().patch(`/api/appointments/${a1.body.data.id}/reschedule`).set(auth(p1.token)).send({ startTime: at(date, '11:15') });
    expect(res.status).toBe(409);
    const after = await prisma.appointment.findUnique({ where: { id: a1.body.data.id } });
    expect(after!.startTime.toISOString()).toBe(at(date, '10:00'));
    expect(after!.status).toBe('CONFIRMED');
  });

  it('can shift within its own time window (overlapping itself)', async () => {
    const { doctorId } = await createDoctor();
    const p = await createPatient();
    const date = futureDate();
    const a = await book(p.token, doctorId, at(date, '10:00'));
    const res = await api().patch(`/api/appointments/${a.body.data.id}/reschedule`).set(auth(p.token)).send({ startTime: at(date, '10:15') });
    expect(res.status).toBe(200);
  });

  it('moves the queue token to the new day', async () => {
    const { doctorId } = await createDoctor();
    const p = await createPatient();
    const a = await book(p.token, doctorId, at(futureDate(7), '10:00'));
    const res = await api().patch(`/api/appointments/${a.body.data.id}/reschedule`).set(auth(p.token)).send({ startTime: at(futureDate(8), '10:00') });
    expect(res.status).toBe(200);
    expect(res.body.data.queueEntry.queueId).not.toBe(a.body.data.queueEntry.queueId);
  });
});
