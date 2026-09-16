import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

/** A month far enough back that "today" is always after it. */
const MONTH = '2026-01';
const PREVIOUS = '2025-12';

async function signUp(email: string): Promise<SuperAgentTest> {
  const agent = request.agent(app) as unknown as SuperAgentTest;
  await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'senha1234' })
    .expect(201);
  return agent;
}

async function categoryId(agent: SuperAgentTest, name: string): Promise<number> {
  const res = await agent.get('/api/categories').expect(200);
  const found = res.body.categories.find((c: { name: string }) => c.name === name);
  if (!found) throw new Error(`categoria ${name} não encontrada`);
  return found.id as number;
}

async function accountId(agent: SuperAgentTest): Promise<number> {
  const res = await agent.get('/api/accounts').expect(200);
  return res.body.accounts[0].id as number;
}

async function addTransaction(
  agent: SuperAgentTest,
  body: { type: 'income' | 'expense'; category: string; amount_cents: number; occurred_on: string }
) {
  await agent
    .post('/api/transactions')
    .send({
      account_id: await accountId(agent),
      category_id: await categoryId(agent, body.category),
      type: body.type,
      amount_cents: body.amount_cents,
      occurred_on: body.occurred_on,
    })
    .expect(201);
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('insights API', () => {
  it('tells an empty month apart from a month with movements', async () => {
    const agent = await signUp('empty-insights@example.ao');
    const res = await agent.get(`/api/insights?year_month=${MONTH}`).expect(200);
    expect(res.body.year_month).toBe(MONTH);
    expect(res.body.metrics).toMatchObject({
      income_cents: 0,
      expense_cents: 0,
      saving_rate: null,
    });
    expect(res.body.insights).toHaveLength(1);
    expect(res.body.insights[0].id).toBe('no-data');
  });

  it('computes the metrics from the user own transactions', async () => {
    const agent = await signUp('metrics@example.ao');
    await addTransaction(agent, {
      type: 'income',
      category: 'Salário',
      amount_cents: 450_000_00,
      occurred_on: `${MONTH}-05`,
    });
    await addTransaction(agent, {
      type: 'expense',
      category: 'Habitação',
      amount_cents: 150_000_00,
      occurred_on: `${MONTH}-06`,
    });
    await addTransaction(agent, {
      type: 'expense',
      category: 'Alimentação',
      amount_cents: 50_000_00,
      occurred_on: `${MONTH}-07`,
    });

    const res = await agent.get(`/api/insights?year_month=${MONTH}`).expect(200);
    expect(res.body.metrics).toMatchObject({
      income_cents: 450_000_00,
      expense_cents: 200_000_00,
      net_cents: 250_000_00,
      saving_rate: 55.6,
      top_category: { name: 'Habitação', amount_cents: 150_000_00, share_percent: 75 },
    });
    const ids = res.body.insights.map((i: { id: string }) => i.id);
    expect(ids).toContain('saving-rate');
    expect(ids).toContain('concentration');
  });

  it('compares the month against the previous one', async () => {
    const agent = await signUp('compare@example.ao');
    await addTransaction(agent, {
      type: 'expense',
      category: 'Transporte',
      amount_cents: 20_000_00,
      occurred_on: `${PREVIOUS}-10`,
    });
    await addTransaction(agent, {
      type: 'expense',
      category: 'Transporte',
      amount_cents: 60_000_00,
      occurred_on: `${MONTH}-10`,
    });

    const res = await agent.get(`/api/insights?year_month=${MONTH}`).expect(200);
    expect(res.body.metrics).toMatchObject({
      previous_expense_cents: 20_000_00,
      expense_change_percent: 200,
    });
    const jump = res.body.insights.find((i: { id: string }) => i.id === 'jump-Transporte');
    expect(jump.facts).toMatchObject({ previous_cents: 20_000_00, current_cents: 60_000_00 });
  });

  it('reads the budgets of the month it was asked about', async () => {
    const agent = await signUp('budget-insights@example.ao');
    await agent
      .put('/api/budgets')
      .send({
        category_id: await categoryId(agent, 'Alimentação'),
        year_month: MONTH,
        limit_cents: 50_000_00,
      })
      .expect(200);
    await addTransaction(agent, {
      type: 'expense',
      category: 'Alimentação',
      amount_cents: 80_000_00,
      occurred_on: `${MONTH}-12`,
    });

    const res = await agent.get(`/api/insights?year_month=${MONTH}`).expect(200);
    const over = res.body.insights.find((i: { id: string }) => i.id === 'budget-over-Alimentação');
    expect(over).toMatchObject({ severity: 'risk' });
    expect(over.facts).toMatchObject({ over_cents: 30_000_00, limit_cents: 50_000_00 });
  });

  it('counts only the fixed bills still ahead in the month', async () => {
    const agent = await signUp('commitments@example.ao');
    const today = new Date();
    const yearMonth = today.toISOString().slice(0, 7);
    const account = await accountId(agent);
    const category = await categoryId(agent, 'Habitação');

    // One rule already past for this month, one still ahead of today.
    await agent
      .post('/api/recurring')
      .send({
        name: 'Renda paga',
        account_id: account,
        category_id: category,
        type: 'expense',
        amount_cents: 100_000_00,
        day_of_month: 1,
        start_date: `${yearMonth}-01`,
      })
      .expect(201);
    await agent
      .post('/api/recurring')
      .send({
        name: 'Renda por pagar',
        account_id: account,
        category_id: category,
        type: 'expense',
        amount_cents: 70_000_00,
        day_of_month: 28,
        start_date: `${yearMonth}-01`,
      })
      .expect(201);

    const res = await agent.get(`/api/insights?year_month=${yearMonth}`).expect(200);
    const dueCents = res.body.metrics.commitments_due_cents as number;
    const dayOfMonth = today.getDate();

    // Day 1 is always behind us; day 28 only counts before the 28th.
    expect(dueCents).toBe(dayOfMonth < 28 ? 70_000_00 : 0);
    if (dayOfMonth < 28) {
      expect(res.body.insights.find((i: { id: string }) => i.id === 'commitments').facts).toMatchObject(
        { count: 1, next: 'Renda por pagar' }
      );
    }
  });

  it('keeps one user numbers out of another user insights', async () => {
    const owner = await signUp('owner-insights@example.ao');
    const intruder = await signUp('intruder-insights@example.ao');

    await addTransaction(owner, {
      type: 'income',
      category: 'Salário',
      amount_cents: 300_000_00,
      occurred_on: `${MONTH}-03`,
    });

    const res = await intruder.get(`/api/insights?year_month=${MONTH}`).expect(200);
    expect(res.body.metrics.income_cents).toBe(0);
    expect(res.body.insights[0].id).toBe('no-data');
  });

  it('requires a session', async () => {
    await request(app).get('/api/insights').expect(401);
  });
});
