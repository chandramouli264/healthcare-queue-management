import { api, auth, createPatient, PASSWORD, prisma, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Auth', () => {
  const body = { email: 'jane@example.com', password: 'Secret123', firstName: 'Jane', lastName: 'Doe' };

  it('registers a patient, hashes the password and returns a JWT', async () => {
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email: 'jane@example.com', role: 'PATIENT' });
    expect(res.body.data.user.patientId).toEqual(expect.any(String));
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: 'jane@example.com' } });
    expect(stored!.passwordHash).not.toBe('Secret123');
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    await api().post('/api/auth/register').send(body);
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, errorCode: 'EMAIL_IN_USE' });
  });

  it('validates registration input', async () => {
    const res = await api().post('/api/auth/register').send({ ...body, email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('ignores attempts to self-register with an elevated role', async () => {
    const res = await api().post('/api/auth/register').send({ ...body, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('PATIENT');
  });

  it('logs in with valid credentials', async () => {
    const { user } = await createPatient();
    const res = await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('PATIENT');
  });

  it('rejects wrong passwords and unknown emails with the same 401', async () => {
    const { user } = await createPatient();
    const wrong = await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong1234' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.errorCode).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('blocks disabled accounts', async () => {
    const { user, token } = await createPatient();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect((await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(403);
    expect((await api().get('/api/auth/me').set(auth(token))).status).toBe(401);
  });

  it('protects /auth/me', async () => {
    const { token } = await createPatient();
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth('garbage'))).status).toBe(401);
    const res = await api().get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.patientId).toEqual(expect.any(String));
  });

  it('changes password', async () => {
    const { user, token } = await createPatient();
    const bad = await api().patch('/api/auth/me/password').set(auth(token)).send({ currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(bad.status).toBe(400);
    const ok = await api().patch('/api/auth/me/password').set(auth(token)).send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: 'NewPass123' })).status).toBe(200);
  });
});
