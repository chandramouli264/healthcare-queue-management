import { api, at, auth, book, createDoctor, createPatient, createUser, futureDate, prisma, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const items = [{ medicineName: 'Amoxicillin', dosage: '500 mg', frequency: 'Three times a day', duration: '7 days', instructions: 'After meals' }];

async function setup() {
  const doctor = await createDoctor();
  const patient = await createPatient();
  const appt = await book(patient.token, doctor.doctorId, at(futureDate(), '10:00'));
  return { doctor, patient, appointmentId: appt.body.data.id as string };
}

describe('Prescriptions', () => {
  it('the treating doctor can create a prescription', async () => {
    const { doctor, patient, appointmentId } = await setup();
    const res = await api().post('/api/prescriptions').set(auth(doctor.token)).send({ appointmentId, diagnosis: 'Bacterial infection', items });
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^RX-\d+$/);
    expect(res.body.data.patientId).toBe(patient.patientId);
    expect(res.body.data.items[0]).toMatchObject(items[0]);
  });

  it('other doctors, patients and receptionists cannot create prescriptions', async () => {
    const { patient, appointmentId } = await setup();
    const other = await createDoctor();
    const reception = await createUser('RECEPTIONIST');
    const body = { appointmentId, diagnosis: 'x', items };
    const r1 = await api().post('/api/prescriptions').set(auth(other.token)).send(body);
    expect(r1.status).toBe(403);
    expect(r1.body.errorCode).toBe('NOT_YOUR_PATIENT');
    expect((await api().post('/api/prescriptions').set(auth(patient.token)).send(body)).status).toBe(403);
    expect((await api().post('/api/prescriptions').set(auth(reception.token)).send(body)).status).toBe(403);
  });

  it('validates prescription items', async () => {
    const { doctor, appointmentId } = await setup();
    const res = await api().post('/api/prescriptions').set(auth(doctor.token)).send({ appointmentId, diagnosis: 'x', items: [] });
    expect(res.status).toBe(400);
  });

  it('patients see only their own prescriptions; receptionists see none', async () => {
    const { doctor, patient, appointmentId } = await setup();
    const stranger = await createPatient();
    const reception = await createUser('RECEPTIONIST');
    const created = await api().post('/api/prescriptions').set(auth(doctor.token)).send({ appointmentId, diagnosis: 'Flu', items });
    const id = created.body.data.id;

    expect((await api().get(`/api/prescriptions/${id}`).set(auth(patient.token))).status).toBe(200);
    expect((await api().get(`/api/prescriptions/${id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await api().get(`/api/prescriptions/${id}`).set(auth(reception.token))).status).toBe(403);

    const list = await api().get(`/api/patients/${patient.patientId}/prescriptions`).set(auth(patient.token));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect((await api().get(`/api/patients/${patient.patientId}/prescriptions`).set(auth(stranger.token))).status).toBe(403);
  });

  it('only the prescribing doctor can update it', async () => {
    const { doctor, appointmentId } = await setup();
    const other = await createDoctor();
    const created = await api().post('/api/prescriptions').set(auth(doctor.token)).send({ appointmentId, diagnosis: 'Flu', items });
    const id = created.body.data.id;
    expect((await api().patch(`/api/prescriptions/${id}`).set(auth(other.token)).send({ diagnosis: 'Cold' })).status).toBe(403);
    const ok = await api().patch(`/api/prescriptions/${id}`).set(auth(doctor.token)).send({ diagnosis: 'Cold', items: [{ ...items[0], dosage: '250 mg' }] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.diagnosis).toBe('Cold');
    expect(ok.body.data.items).toHaveLength(1);
    expect(ok.body.data.items[0].dosage).toBe('250 mg');
  });

  it('cannot prescribe for cancelled appointments', async () => {
    const { doctor, patient, appointmentId } = await setup();
    await api().patch(`/api/appointments/${appointmentId}/cancel`).set(auth(patient.token)).send({});
    const res = await api().post('/api/prescriptions').set(auth(doctor.token)).send({ appointmentId, diagnosis: 'x', items });
    expect(res.status).toBe(400);
  });
});
