import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const ORIGIN = 'https://fintrack-angola.vercel.app';
const original = process.env.FRONTEND_URL;

afterEach(() => {
  process.env.FRONTEND_URL = original;
});

describe('createApp', () => {
  it('serves the health check without a database or an origin', async () => {
    const res = await request(createApp()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('survives a FRONTEND_URL pasted with a trailing newline', async () => {
    // This exact value took the API down on Render: a newline is illegal in a
    // header, so cors() threw on every request, health check included.
    process.env.FRONTEND_URL = `${ORIGIN}\n`;
    const app = createApp();

    await request(app).get('/health').set('Origin', ORIGIN).expect(200);
    const res = await request(app).get('/').set('Origin', ORIGIN).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('allows the frontend origin when the variable has a trailing slash', async () => {
    process.env.FRONTEND_URL = `${ORIGIN}/`;
    const res = await request(createApp()).get('/').set('Origin', ORIGIN).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('never reflects a foreign origin back to the caller', async () => {
    // The allowlist is a single fixed origin, so the header always names the
    // frontend and the browser is the one that refuses the mismatch.
    process.env.FRONTEND_URL = ORIGIN;
    const res = await request(createApp())
      .get('/')
      .set('Origin', 'https://nao-autorizado.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });
});
