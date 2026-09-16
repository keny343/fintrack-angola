import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

const today = new Date().toISOString().slice(0, 10);
const yearMonth = today.slice(0, 7);

type Ids = { accountId: number; salary: number; food: number; transport: number };

async function signUp(email: string): Promise<{ agent: SuperAgentTest; ids: Ids }> {
  const agent = request.agent(app) as unknown as SuperAgentTest;
  await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'senha1234' })
    .expect(201);

  const accounts = await agent.get('/api/accounts').expect(200);
  const categories = await agent.get('/api/categories').expect(200);
  const byName = (name: string) =>
    categories.body.categories.find((c: { name: string }) => c.name === name).id as number;

  return {
    agent,
    ids: {
      accountId: accounts.body.accounts[0].id as number,
      salary: byName('Salário'),
      food: byName('Alimentação'),
      transport: byName('Transporte'),
    },
  };
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('finance API', () => {
  it('creates transactions and aggregates the dashboard in centavos', async () => {
    const { agent, ids } = await signUp('dash@example.ao');

    await agent
      .post('/api/transactions')
      .send({
        account_id: ids.accountId,
        category_id: ids.salary,
        type: 'income',
        amount_cents: 450_000_00,
        occurred_on: today,
      })
      .expect(201);

    await agent
      .post('/api/transactions')
      .send({
        account_id: ids.accountId,
        category_id: ids.food,
        type: 'expense',
        amount_cents: 120_000_00,
        occurred_on: today,
      })
      .expect(201);

    const dash = await agent.get(`/api/dashboard?year_month=${yearMonth}`).expect(200);
    expect(dash.body).toMatchObject({
      income_cents: 450_000_00,
      expense_cents: 120_000_00,
      net_cents: 330_000_00,
      balance_cents: 330_000_00,
    });
    expect(dash.body.by_category[0]).toMatchObject({
      name: 'Alimentação',
      total_cents: 120_000_00,
    });
    expect(dash.body.recent).toHaveLength(2);
  });

  it('rejects a category that does not match the transaction type', async () => {
    const { agent, ids } = await signUp('kind@example.ao');

    const res = await agent.post('/api/transactions').send({
      account_id: ids.accountId,
      category_id: ids.food,
      type: 'income',
      amount_cents: 10_000_00,
      occurred_on: today,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incompatível/i);
  });

  it('rejects non-positive amounts and malformed dates', async () => {
    const { agent, ids } = await signUp('valid@example.ao');
    const base = { account_id: ids.accountId, category_id: ids.food, type: 'expense' as const };

    await agent
      .post('/api/transactions')
      .send({ ...base, amount_cents: 0, occurred_on: today })
      .expect(400);
    await agent
      .post('/api/transactions')
      .send({ ...base, amount_cents: 1000, occurred_on: '16/09/2026' })
      .expect(400);
  });

  it('tracks budget progress against the month spend', async () => {
    const { agent, ids } = await signUp('budget@example.ao');

    await agent
      .put('/api/budgets')
      .send({ category_id: ids.food, year_month: yearMonth, limit_cents: 100_000_00 })
      .expect(200);

    await agent
      .post('/api/transactions')
      .send({
        account_id: ids.accountId,
        category_id: ids.food,
        type: 'expense',
        amount_cents: 78_500_00,
        occurred_on: today,
      })
      .expect(201);

    const res = await agent.get(`/api/budgets?year_month=${yearMonth}`).expect(200);
    expect(res.body.budgets[0]).toMatchObject({
      category_name: 'Alimentação',
      limit_cents: 100_000_00,
      spent_cents: 78_500_00,
      remaining_cents: 21_500_00,
      percent_used: 78.5,
    });
  });

  it('reports totals by category for a period', async () => {
    const { agent, ids } = await signUp('report@example.ao');

    await agent
      .post('/api/transactions')
      .send({
        account_id: ids.accountId,
        category_id: ids.transport,
        type: 'expense',
        amount_cents: 9_500_00,
        occurred_on: today,
      })
      .expect(201);

    const res = await agent.get(`/api/reports/by-category?from=${today}&to=${today}`).expect(200);
    expect(res.body.rows).toEqual([
      { name: 'Transporte', type: 'expense', total_cents: 9_500_00 },
    ]);

    await agent.get('/api/reports/by-category').expect(400);
  });

  it('isolates data between users', async () => {
    const owner = await signUp('owner@example.ao');
    const intruder = await signUp('intruder@example.ao');

    const created = await owner.agent
      .post('/api/transactions')
      .send({
        account_id: owner.ids.accountId,
        category_id: owner.ids.food,
        type: 'expense',
        amount_cents: 55_000_00,
        occurred_on: today,
      })
      .expect(201);
    const ownerTxId = created.body.transaction.id as number;

    const intruderList = await intruder.agent.get('/api/transactions').expect(200);
    expect(intruderList.body.transactions).toHaveLength(0);

    await intruder.agent.delete(`/api/transactions/${ownerTxId}`).expect(404);

    const intruderDash = await intruder.agent.get(`/api/dashboard?year_month=${yearMonth}`).expect(200);
    expect(intruderDash.body.balance_cents).toBe(0);

    // owner still owns the transaction
    const ownerList = await owner.agent.get('/api/transactions').expect(200);
    expect(ownerList.body.transactions).toHaveLength(1);

    // and cannot spend against another user's account
    const foreignAccount = await intruder.agent
      .post('/api/transactions')
      .send({
        account_id: owner.ids.accountId,
        category_id: intruder.ids.food,
        type: 'expense',
        amount_cents: 1_000_00,
        occurred_on: today,
      });
    expect(foreignAccount.status).toBe(400);
  });

  it('keeps custom categories private to their owner', async () => {
    const a = await signUp('cat-a@example.ao');
    const b = await signUp('cat-b@example.ao');

    await a.agent.post('/api/categories').send({ name: 'Candongueiro', kind: 'expense' }).expect(201);

    const bCategories = await b.agent.get('/api/categories').expect(200);
    const names = bCategories.body.categories.map((c: { name: string }) => c.name);
    expect(names).not.toContain('Candongueiro');
    expect(names).toContain('Alimentação');
  });
});
