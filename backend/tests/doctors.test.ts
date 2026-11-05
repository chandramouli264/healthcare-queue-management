import { api, at, auth, book, createDoctor, createPatient, createUser, futureDate, prisma, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Doctor management & schedules', () => {
  const newDoctor = {
    email: 'house@example.com',
    password: 'Doctor123',
    firstName: 'Gregory',
    lastName: 'House',
    specialization: 'Diagnostics',
    qualifications: 'MD',
    consultationDuration: 20,
  };

  it('admin can create, update and delete a doctor', async () => {
    const { token } = await createUser('ADMIN');
    const created = await api().post('/api/doctors').set(auth(token)).send(newDoctor);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ specialization: 'Diagnostics', consultationDuration: 20 });
    const id = created.body.data.id;

    const updated = await api().patch(`/api/doctors/${id}`).set(auth(token)).send({ roomNumber: '221B' });
    expect(updated.body.data.roomNumber).toBe('221B');

    const list = await api().get('/api/doctors');
    expect(list.body.data).toHaveLength(1);

    const removed = await api().delete(`/api/doctors/${id}`).set(auth(token));
    expect(removed.body.data.deleted).toBe(true);
    expect((await api().get(`/api/doctors/${id}`)).status).toBe(404);
  });

  it('non-admins cannot create doctors', async () => {
    const { token } = await createPatient();
    expect((await api().post('/api/doctors').set(auth(token)).send(newDoctor)).status).toBe(403);
    expect((await api().post('/api/doctors').send(newDoctor)).status).toBe(401);
  });

  it('a doctor can replace their own weekly schedule but not another doctor\'s', async () => {
    const me = await createDoctor();
    const other = await createDoctor();
    const schedules = [{ dayOfWeek: 1, startTime: '10:00', endTime: '14:00', breakStart: '12:00', breakEnd: '12:30', slotDuration: 15 }];

    const res = await api().put(`/api/doctors/${me.doctorId}/schedules`).set(auth(me.token)).send({ schedules });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ dayOfWeek: 1, startTime: '10:00', slotDuration: 15 });

    const forbidden = await api().put(`/api/doctors/${other.doctorId}/schedules`).set(auth(me.token)).send({ schedules });
    expect(forbidden.status).toBe(403);
  });

  it('validates schedules (break inside hours, unique days)', async () => {
    const { doctorId, token } = await createDoctor();
    const outside = await api()
      .put(`/api/doctors/${doctorId}/schedules`)
      .set(auth(token))
      .send({ schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', breakStart: '12:30', breakEnd: '13:00' }] });
    expect(outside.status).toBe(400);

    const dup = await api()
      .put(`/api/doctors/${doctorId}/schedules`)
      .set(auth(token))
      .send({ schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '13:00', endTime: '15:00' }] });
    expect(dup.status).toBe(400);
  });
});

describe('GET /doctors/:id/available-slots', () => {
  it('generates chronological slots excluding the break', async () => {
    const { doctorId } = await createDoctor();
    const date = futureDate();
    const res = await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date });
    expect(res.status).toBe(200);
    const labels = res.body.data.slots.map((s: { label: string }) => s.label);
    // 09:00-13:00 (8 slots) + 14:00-17:00 (6 slots)
    expect(labels).toHaveLength(14);
    expect(labels[0]).toBe('09:00');
    expect(labels).not.toContain('13:00');
    expect(labels).not.toContain('13:30');
    expect(labels[labels.length - 1]).toBe('16:30');
    const starts = res.body.data.slots.map((s: { startTime: string }) => new Date(s.startTime).getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('excludes booked slots and frees them again on cancellation', async () => {
    const { doctorId } = await createDoctor();
    const patient = await createPatient();
    const date = futureDate();
    const booked = await book(patient.token, doctorId, at(date, '10:00'));
    expect(booked.status).toBe(201);

    let res = await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date });
    expect(res.body.data.slots.map((s: { label: string }) => s.label)).not.toContain('10:00');

    await api().patch(`/api/appointments/${booked.body.data.id}/cancel`).set(auth(patient.token)).send({});
    res = await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date });
    expect(res.body.data.slots.map((s: { label: string }) => s.label)).toContain('10:00');
  });

  it('excludes unavailable periods (time off)', async () => {
    const { doctorId, token } = await createDoctor();
    const date = futureDate();
    const off = await api()
      .post(`/api/doctors/${doctorId}/time-off`)
      .set(auth(token))
      .send({ startTime: at(date, '15:00'), endTime: at(date, '17:00'), reason: 'Conference' });
    expect(off.status).toBe(201);
    const res = await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date });
    const labels = res.body.data.slots.map((s: { label: string }) => s.label);
    expect(labels).not.toContain('15:00');
    expect(labels).not.toContain('16:30');
    expect(labels).toContain('14:30');
  });

  it('returns no slots on a non-working day', async () => {
    const { doctorId, token } = await createDoctor();
    await api().put(`/api/doctors/${doctorId}/schedules`).set(auth(token)).send({ schedules: [] });
    const res = await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date: futureDate() });
    expect(res.body.data).toMatchObject({ isWorkingDay: false, slots: [] });
  });

  it('validates the date parameter', async () => {
    const { doctorId } = await createDoctor();
    expect((await api().get(`/api/doctors/${doctorId}/available-slots`)).status).toBe(400);
    expect((await api().get(`/api/doctors/${doctorId}/available-slots`).query({ date: '31-01-2025' })).status).toBe(400);
  });
});
