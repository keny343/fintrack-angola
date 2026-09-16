import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('auth routes', () => {
  it('registers a user, sets a cookie and creates default accounts', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Adnírcio', email: 'ana@example.ao', password: 'senha1234' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@example.ao' });
    expect(res.body.user.password_hash).toBeUndefined();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/token=/);
    expect(cookies.join(';')).toMatch(/HttpOnly/i);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'ana@example.ao', password: 'senha1234' });
    const accounts = await agent.get('/api/accounts');
    expect(accounts.status).toBe(200);
    expect(accounts.body.accounts.map((a: { name: string }) => a.name)).toEqual([
      'Numerário',
      'Conta bancária',
    ]);
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Outro', email: 'ana@example.ao', password: 'senha1234' });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Curto', email: 'curto@example.ao', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.ao', password: 'errada12345' });
    expect(res.status).toBe(401);
  });

  it('protects /api/auth/me and finance routes without session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/transactions')).status).toBe(401);
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });

  it('returns the session user and clears it on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'ana@example.ao', password: 'senha1234' });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ana@example.ao');

    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('serves health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok' });
  });
});
