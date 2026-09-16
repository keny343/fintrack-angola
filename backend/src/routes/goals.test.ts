import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';

process.env.JWT_SECRET = 'test-secret-with-enough-length-0123456789';

const app = createApp();
let db: Awaited<ReturnType<typeof startTestDb>>;

const today = new Date().toISOString().slice(0, 10);

function monthsAhead(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function signUp(email: string): Promise<SuperAgentTest> {
  const agent = request.agent(app) as unknown as SuperAgentTest;
  await agent
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password: 'senha1234' })
    .expect(201);
  return agent;
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('goals API', () => {
  it('tracks progress and the required monthly amount', async () => {
    const agent = await signUp('goal@example.ao');

    const created = await agent
      .post('/api/goals')
      .send({ name: 'Comprar computador', target_cents: 600_000_00, deadline: monthsAhead(3) })
      .expect(201);
    const goalId = created.body.goal.id as number;

    await agent
      .post(`/api/goals/${goalId}/contributions`)
      .send({ amount_cents: 250_000_00, occurred_on: today })
      .expect(201);

    const list = await agent.get('/api/goals').expect(200);
    expect(list.body.goals).toHaveLength(1);
    expect(list.body.goals[0]).toMatchObject({
      name: 'Comprar computador',
      target_cents: 600_000_00,
      saved_cents: 250_000_00,
      percent: 41.7,
      remainingCents: 350_000_00,
      monthsRemaining: 3,
      requiredMonthlyCents: 11_666_667,
    });
  });

  it('marks a goal as reached once fully funded', async () => {
    const agent = await signUp('reached@example.ao');
    const created = await agent
      .post('/api/goals')
      .send({ name: 'Fundo de emergência', target_cents: 100_000_00, deadline: monthsAhead(2) })
      .expect(201);

    await agent
      .post(`/api/goals/${created.body.goal.id}/contributions`)
      .send({ amount_cents: 60_000_00, occurred_on: today })
      .expect(201);
    await agent
      .post(`/api/goals/${created.body.goal.id}/contributions`)
      .send({ amount_cents: 40_000_00, occurred_on: today })
      .expect(201);

    const list = await agent.get('/api/goals').expect(200);
    expect(list.body.goals[0]).toMatchObject({
      saved_cents: 100_000_00,
      percent: 100,
      status: 'atingido',
    });
  });

  it('handles goals without a deadline', async () => {
    const agent = await signUp('nodeadline@example.ao');
    await agent
      .post('/api/goals')
      .send({ name: 'Viagem', target_cents: 300_000_00 })
      .expect(201);

    const list = await agent.get('/api/goals').expect(200);
    expect(list.body.goals[0]).toMatchObject({
      deadline: null,
      status: 'sem_prazo',
      requiredMonthlyCents: null,
    });
  });

  it('rejects invalid goals and contributions', async () => {
    const agent = await signUp('invalid-goal@example.ao');

    await agent.post('/api/goals').send({ name: 'X', target_cents: 1000 }).expect(400);
    await agent.post('/api/goals').send({ name: 'Carro', target_cents: 0 }).expect(400);
    await agent
      .post('/api/goals')
      .send({ name: 'Carro', target_cents: 100, deadline: '31/12/2026' })
      .expect(400);

    const created = await agent
      .post('/api/goals')
      .send({ name: 'Carro usado', target_cents: 900_000_00 })
      .expect(201);
    await agent
      .post(`/api/goals/${created.body.goal.id}/contributions`)
      .send({ amount_cents: -100, occurred_on: today })
      .expect(400);
  });

  it('keeps goals private to their owner', async () => {
    const owner = await signUp('goal-owner@example.ao');
    const intruder = await signUp('goal-intruder@example.ao');

    const created = await owner
      .post('/api/goals')
      .send({ name: 'Propinas', target_cents: 200_000_00 })
      .expect(201);
    const goalId = created.body.goal.id as number;

    expect((await intruder.get('/api/goals')).body.goals).toHaveLength(0);

    await intruder
      .post(`/api/goals/${goalId}/contributions`)
      .send({ amount_cents: 10_000_00, occurred_on: today })
      .expect(404);
    await intruder.delete(`/api/goals/${goalId}`).expect(404);

    // untouched for the owner
    const ownerGoals = await owner.get('/api/goals').expect(200);
    expect(ownerGoals.body.goals[0]).toMatchObject({ id: goalId, saved_cents: 0 });
  });

  it('deletes a goal with its contributions', async () => {
    const agent = await signUp('goal-delete@example.ao');
    const created = await agent
      .post('/api/goals')
      .send({ name: 'Telefone', target_cents: 150_000_00 })
      .expect(201);
    await agent
      .post(`/api/goals/${created.body.goal.id}/contributions`)
      .send({ amount_cents: 20_000_00, occurred_on: today })
      .expect(201);

    await agent.delete(`/api/goals/${created.body.goal.id}`).expect(200);
    expect((await agent.get('/api/goals')).body.goals).toHaveLength(0);
  });
});
