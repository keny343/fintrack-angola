import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';
import { runRecurring } from '../services/recurring.js';
import { query } from '../db/pool.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

async function signUp(email: string): Promise<SuperAgentTest> {
  const agent = request.agent(app) as unknown as SuperAgentTest;
  await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'senha1234' })
    .expect(201);
  return agent;
}

async function context(agent: SuperAgentTest, categoryName: string) {
  const accounts = await agent.get('/api/accounts').expect(200);
  const categories = await agent.get('/api/categories').expect(200);
  const category = categories.body.categories.find(
    (c: { name: string }) => c.name === categoryName
  );
  return { accountId: accounts.body.accounts[0].id as number, categoryId: category.id as number };
}

async function userId(email: string): Promise<number> {
  const r = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  return r.rows[0].id;
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('recurring transactions API', () => {
  it('generates one transaction per due month and is idempotent', async () => {
    const email = 'rent@example.ao';
    const agent = await signUp(email);
    const { accountId, categoryId } = await context(agent, 'Habitação');

    await agent
      .post('/api/recurring')
      .send({
        name: 'Renda da casa',
        account_id: accountId,
        category_id: categoryId,
        type: 'expense',
        amount_cents: 150_000_00,
        day_of_month: 5,
        start_date: '2026-07-05',
      })
      .expect(201);

    const id = await userId(email);
    expect(await runRecurring(id, '2026-09-16')).toEqual({ created: 3 });
    // Running again for the same day must not duplicate anything.
    expect(await runRecurring(id, '2026-09-16')).toEqual({ created: 0 });
    expect(await runRecurring(id, '2026-10-05')).toEqual({ created: 1 });

    const tx = await agent.get('/api/transactions?from=2026-07-01&to=2026-10-31').expect(200);
    expect(tx.body.transactions).toHaveLength(4);
    expect(tx.body.transactions.map((t: { occurred_on: string }) => t.occurred_on.slice(0, 10))).toEqual([
      '2026-10-05',
      '2026-09-05',
      '2026-08-05',
      '2026-07-05',
    ]);
    expect(tx.body.transactions[0]).toMatchObject({
      amount_cents: 150_000_00,
      type: 'expense',
      notes: 'Renda da casa',
    });
  });

  it('clamps the day so short months are not skipped', async () => {
    const email = 'salary@example.ao';
    const agent = await signUp(email);
    const { accountId, categoryId } = await context(agent, 'Salário');

    await agent
      .post('/api/recurring')
      .send({
        name: 'Salário',
        account_id: accountId,
        category_id: categoryId,
        type: 'income',
        amount_cents: 450_000_00,
        day_of_month: 31,
        start_date: '2026-01-31',
      })
      .expect(201);

    expect(await runRecurring(await userId(email), '2026-03-31')).toEqual({ created: 3 });
    const tx = await agent.get('/api/transactions').expect(200);
    expect(
      tx.body.transactions.map((t: { occurred_on: string }) => t.occurred_on.slice(0, 10))
    ).toEqual(['2026-03-31', '2026-02-28', '2026-01-31']);
  });

  it('does not generate for paused rules and reports the next occurrence', async () => {
    const email = 'paused@example.ao';
    const agent = await signUp(email);
    const { accountId, categoryId } = await context(agent, 'Energia');

    const created = await agent
      .post('/api/recurring')
      .send({
        name: 'Luz',
        account_id: accountId,
        category_id: categoryId,
        type: 'expense',
        amount_cents: 25_000_00,
        day_of_month: 10,
        start_date: '2026-01-10',
      })
      .expect(201);

    await agent.patch(`/api/recurring/${created.body.rule.id}`).send({ active: false }).expect(200);
    expect(await runRecurring(await userId(email), '2026-09-16')).toEqual({ created: 0 });

    const list = await agent.get('/api/recurring').expect(200);
    expect(list.body.rules[0]).toMatchObject({ active: false, next_occurrence: null });

    await agent.patch(`/api/recurring/${created.body.rule.id}`).send({ active: true }).expect(200);
    const resumed = await agent.get('/api/recurring').expect(200);
    expect(resumed.body.rules[0].next_occurrence).toMatch(/^\d{4}-\d{2}-10$/);
  });

  it('validates the rule against the account, category and dates', async () => {
    const agent = await signUp('invalid-recurring@example.ao');
    const { accountId, categoryId } = await context(agent, 'Salário');
    const base = {
      name: 'Teste',
      account_id: accountId,
      category_id: categoryId,
      amount_cents: 10_000_00,
      day_of_month: 5,
      start_date: '2026-01-05',
    };

    await agent.post('/api/recurring').send({ ...base, type: 'expense' }).expect(400);
    await agent.post('/api/recurring').send({ ...base, type: 'income', day_of_month: 32 }).expect(400);
    await agent
      .post('/api/recurring')
      .send({ ...base, type: 'income', end_date: '2025-12-31' })
      .expect(400);
    await agent
      .post('/api/recurring')
      .send({ ...base, type: 'income', account_id: accountId + 999 })
      .expect(400);
  });

  it('keeps rules private to their owner', async () => {
    const ownerEmail = 'recurring-owner@example.ao';
    const owner = await signUp(ownerEmail);
    const intruder = await signUp('recurring-intruder@example.ao');
    const { accountId, categoryId } = await context(owner, 'Educação / Propinas');

    const created = await owner
      .post('/api/recurring')
      .send({
        name: 'Propinas',
        account_id: accountId,
        category_id: categoryId,
        type: 'expense',
        amount_cents: 80_000_00,
        day_of_month: 15,
        start_date: '2026-09-15',
      })
      .expect(201);

    expect((await intruder.get('/api/recurring')).body.rules).toHaveLength(0);
    await intruder.patch(`/api/recurring/${created.body.rule.id}`).send({ active: false }).expect(404);
    await intruder.delete(`/api/recurring/${created.body.rule.id}`).expect(404);
    expect((await owner.get('/api/recurring')).body.rules[0]).toMatchObject({ active: true });
  });

  it('deletes a rule and keeps the transactions it already generated', async () => {
    const email = 'recurring-delete@example.ao';
    const agent = await signUp(email);
    const { accountId, categoryId } = await context(agent, 'Água');

    const created = await agent
      .post('/api/recurring')
      .send({
        name: 'Água',
        account_id: accountId,
        category_id: categoryId,
        type: 'expense',
        amount_cents: 8_000_00,
        day_of_month: 3,
        start_date: '2026-08-03',
      })
      .expect(201);

    await runRecurring(await userId(email), '2026-09-16');
    await agent.delete(`/api/recurring/${created.body.rule.id}`).expect(200);

    expect((await agent.get('/api/recurring')).body.rules).toHaveLength(0);
    const tx = await agent.get('/api/transactions').expect(200);
    expect(tx.body.transactions).toHaveLength(2);
    expect(tx.body.transactions[0].recurring_id).toBeNull();
  });
});
