import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';
import { resetNarrationCache } from '../services/narration.js';
import { formatAOA } from '../domain/money.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

const MONTH = '2026-01';

async function signUp(email: string): Promise<SuperAgentTest> {
  const agent = request.agent(app) as unknown as SuperAgentTest;
  await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'senha1234' })
    .expect(201);
  return agent;
}

async function seedMonth(agent: SuperAgentTest): Promise<void> {
  const accounts = await agent.get('/api/accounts').expect(200);
  const categories = await agent.get('/api/categories').expect(200);
  const account = accounts.body.accounts[0].id as number;
  const category = (name: string) =>
    categories.body.categories.find((c: { name: string }) => c.name === name).id as number;

  await agent
    .post('/api/transactions')
    .send({
      account_id: account,
      category_id: category('Salário'),
      type: 'income',
      amount_cents: 45_000_000,
      occurred_on: `${MONTH}-05`,
    })
    .expect(201);
  await agent
    .post('/api/transactions')
    .send({
      account_id: account,
      category_id: category('Habitação'),
      type: 'expense',
      amount_cents: 15_000_000,
      occurred_on: `${MONTH}-06`,
    })
    .expect(201);
}

/** Stands in for the vendor's HTTP endpoint, in the shape the provider expects. */
function stubProvider(answer: string | Error) {
  return vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

beforeEach(() => {
  resetNarrationCache();
  delete process.env.AI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_API_KEY;
});

describe('GET /api/insights/narration', () => {
  it('describes the month without any model configured', async () => {
    const agent = await signUp('sem-modelo@example.ao');
    await seedMonth(agent);

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('deterministic');
    expect(res.body.provider).toBeNull();
    expect(res.body.text).toContain('janeiro de 2026');
    // Compared through the formatter: Intl separates thousands with a
    // non-breaking space, not the space a keyboard produces.
    expect(res.body.text).toContain(formatAOA(45_000_000));
  });

  it('serves the model answer when it only repeats the figures given', async () => {
    const agent = await signUp('modelo-fiel@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    process.env.AI_MODEL = 'modelo-de-teste';
    const fetchStub = stubProvider(
      'Em janeiro de 2026 entraram 450 000,00 Kz e sobraram 300 000,00 Kz, ' +
        'o que dá 66,7% do que recebeste.'
    );
    vi.stubGlobal('fetch', fetchStub);

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('model');
    expect(res.body.provider).toBe('modelo-de-teste');
    expect(res.body.text).toContain('66,7%');
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it('sends the key as a bearer token and caps the answer length', async () => {
    const agent = await signUp('pedido@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    const fetchStub = stubProvider('O mês fechou com folga.');
    vi.stubGlobal('fetch', fetchStub);

    await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);

    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer chave-de-teste');
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBeLessThanOrEqual(250);
    expect(body.messages[1].content).toContain('janeiro de 2026');
  });

  it('discards an answer that invents a figure', async () => {
    const agent = await signUp('modelo-inventor@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    vi.stubGlobal('fetch', stubProvider('Vais poupar 999 999,00 Kz até junho.'));

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('deterministic');
    expect(res.body.rejected_figures).toEqual([999999]);
    expect(res.body.text).not.toContain('999 999');
  });

  it('falls back when the provider fails', async () => {
    const agent = await signUp('modelo-em-baixo@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    vi.stubGlobal('fetch', stubProvider(new Error('timeout')));

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('deterministic');
    expect(res.body.text).toContain('janeiro de 2026');
  });

  it('falls back when the provider answers with an error status', async () => {
    const agent = await signUp('sem-quota@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"quota"}', { status: 429 }))
    );

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('deterministic');
  });

  it('does not call the model for a month with no movements', async () => {
    const agent = await signUp('mes-vazio@example.ao');
    process.env.AI_API_KEY = 'chave-de-teste';
    const fetchStub = stubProvider('Boas contas: sobraram 0,00 Kz este mês.');
    vi.stubGlobal('fetch', fetchStub);

    const res = await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(res.body.source).toBe('deterministic');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('does not pay for the same month twice', async () => {
    const agent = await signUp('cache@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    const fetchStub = stubProvider('O mês fechou com folga.');
    vi.stubGlobal('fetch', fetchStub);

    await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it('asks again once the numbers change', async () => {
    const agent = await signUp('cache-invalida@example.ao');
    await seedMonth(agent);
    process.env.AI_API_KEY = 'chave-de-teste';
    const fetchStub = stubProvider('O mês fechou com folga.');
    vi.stubGlobal('fetch', fetchStub);

    await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    await seedMonth(agent);
    await agent.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('narrates the month of whoever is asking, and nobody else', async () => {
    const ana = await signUp('ana-narra@example.ao');
    await seedMonth(ana);
    const bruno = await signUp('bruno-narra@example.ao');

    const dela = await ana.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    const dele = await bruno.get(`/api/insights/narration?year_month=${MONTH}`).expect(200);
    expect(dela.body.text).toContain(formatAOA(45_000_000));
    expect(dele.body.text).toContain('Ainda não há movimentos');
  });

  it('requires a session', async () => {
    await request(app).get('/api/insights/narration').expect(401);
  });
});
