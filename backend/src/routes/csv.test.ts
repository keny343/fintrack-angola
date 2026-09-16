import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { startTestDb } from '../testing/testDb.js';

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

const HEADER = 'Data;Tipo;Categoria;Valor (Kz);Notas';

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db.stop();
});

describe('CSV import', () => {
  it('imports a valid file and lands the amounts in centavos', async () => {
    const agent = await signUp('import@example.ao');

    const csv = [
      HEADER,
      '05/09/2026;Despesa;Energia;25.000,50;Luz de Setembro',
      '01/09/2026;Receita;Salário;450000;',
      '2026-09-07;Despesa;Alimentação;85000,00;',
    ].join('\n');

    const res = await agent.post('/api/transactions/import').send({ csv }).expect(201);
    expect(res.body).toMatchObject({ total: 3, valid: 3, imported: 3, issues: [] });

    const list = await agent.get('/api/transactions').expect(200);
    expect(list.body.transactions).toHaveLength(3);

    const energy = list.body.transactions.find(
      (t: { category_name: string }) => t.category_name === 'Energia'
    );
    expect(energy).toMatchObject({
      amount_cents: 2_500_050,
      occurred_on: '2026-09-05',
      type: 'expense',
      notes: 'Luz de Setembro',
    });
  });

  it('matches categories without accents or case and defaults the account', async () => {
    const agent = await signUp('loose@example.ao');

    const csv = [HEADER, '10/09/2026;despesa;AGUA;3000;'].join('\n');
    await agent.post('/api/transactions/import').send({ csv }).expect(201);

    const list = await agent.get('/api/transactions').expect(200);
    expect(list.body.transactions[0]).toMatchObject({
      category_name: 'Água',
      account_name: 'Numerário',
      amount_cents: 300_000,
    });
  });

  it('imports nothing when any line is invalid, and says which', async () => {
    const agent = await signUp('bad@example.ao');

    const csv = [
      HEADER,
      '05/09/2026;Despesa;Energia;25000;',
      '31/02/2026;Despesa;Energia;1000;',
      '06/09/2026;Despesa;Criptomoeda;1000;',
      '07/09/2026;Despesa;Energia;0;',
      '08/09/2026;Despesa;Salário;1000;',
    ].join('\n');

    const res = await agent.post('/api/transactions/import').send({ csv }).expect(422);
    expect(res.body.imported).toBe(0);
    expect(res.body).toMatchObject({ total: 5, valid: 1 });
    expect(res.body.issues).toEqual([
      { line: 3, message: expect.stringMatching(/calendário/i) },
      { line: 4, message: expect.stringMatching(/Criptomoeda/) },
      { line: 5, message: expect.stringMatching(/maior do que zero/i) },
      { line: 6, message: expect.stringMatching(/não aceita este tipo/i) },
    ]);

    const list = await agent.get('/api/transactions').expect(200);
    expect(list.body.transactions).toHaveLength(0);
  });

  it('reports without writing when dry_run is set', async () => {
    const agent = await signUp('dry@example.ao');

    const csv = [HEADER, '05/09/2026;Despesa;Energia;25000;'].join('\n');
    const res = await agent
      .post('/api/transactions/import')
      .send({ csv, dry_run: true })
      .expect(200);
    expect(res.body).toMatchObject({ total: 1, valid: 1, imported: 0, dry_run: true });

    const list = await agent.get('/api/transactions').expect(200);
    expect(list.body.transactions).toHaveLength(0);
  });

  it('rejects a file missing required columns', async () => {
    const agent = await signUp('cols@example.ao');
    const res = await agent
      .post('/api/transactions/import')
      .send({ csv: 'data;valor\n05/09/2026;1000' })
      .expect(400);
    expect(res.body.error).toMatch(/tipo, categoria/);
  });

  it('requires a session', async () => {
    await request(app)
      .post('/api/transactions/import')
      .send({ csv: `${HEADER}\n05/09/2026;Despesa;Energia;1000;` })
      .expect(401);
  });
});

describe('CSV export', () => {
  it('exports the caller rows only, in a spreadsheet-friendly format', async () => {
    const owner = await signUp('export@example.ao');
    const intruder = await signUp('other@example.ao');

    await owner
      .post('/api/transactions/import')
      .send({
        csv: [
          HEADER,
          '05/09/2026;Despesa;Energia;25.000,50;Luz; com ponto e vírgula',
          '01/09/2026;Receita;Salário;450000;',
        ].join('\n'),
      })
      .expect(201);

    await intruder
      .post('/api/transactions/import')
      .send({ csv: [HEADER, '02/09/2026;Despesa;Transporte;7000;'].join('\n') })
      .expect(201);

    const res = await owner.get('/api/transactions/export').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="fintrack-/);

    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Data;Tipo;Categoria;Conta;Valor (Kz);Notas');
    expect(lines[1]).toBe('01/09/2026;Receita;Salário;Numerário;450000,00;');
    expect(lines[2]).toContain('05/09/2026;Despesa;Energia;Numerário;25000,50;');
    expect(res.text).not.toContain('Transporte');
  });

  it('honours the date and type filters', async () => {
    const agent = await signUp('filtered@example.ao');
    await agent
      .post('/api/transactions/import')
      .send({
        csv: [
          HEADER,
          '05/08/2026;Despesa;Energia;1000;',
          '05/09/2026;Despesa;Energia;2000;',
          '06/09/2026;Receita;Salário;3000;',
        ].join('\n'),
      })
      .expect(201);

    const res = await agent
      .get('/api/transactions/export?from=2026-09-01&to=2026-09-30&type=expense')
      .expect(200);

    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('05/09/2026;Despesa;Energia');
  });

  it('produces a file the importer accepts back unchanged', async () => {
    const source = await signUp('roundtrip-a@example.ao');
    const target = await signUp('roundtrip-b@example.ao');

    await source
      .post('/api/transactions/import')
      .send({
        csv: [
          HEADER,
          '05/09/2026;Despesa;Educação / Propinas;150.000,50;Propina; do semestre',
          '01/09/2026;Receita;Salário;450000;',
        ].join('\n'),
      })
      .expect(201);

    const exported = await source.get('/api/transactions/export').expect(200);
    const reimported = await target
      .post('/api/transactions/import')
      .send({ csv: exported.text })
      .expect(201);
    expect(reimported.body).toMatchObject({ total: 2, valid: 2, imported: 2, issues: [] });

    const [a, b] = await Promise.all([
      source.get('/api/transactions').expect(200),
      target.get('/api/transactions').expect(200),
    ]);
    const shape = (list: { body: { transactions: Array<Record<string, unknown>> } }) =>
      list.body.transactions.map((t) => ({
        occurred_on: t.occurred_on,
        type: t.type,
        amount_cents: t.amount_cents,
        category_name: t.category_name,
        notes: t.notes,
      }));
    expect(shape(b)).toEqual(shape(a));
  });

  it('exports a header-only file when there is nothing to export', async () => {
    const agent = await signUp('empty@example.ao');
    const res = await agent.get('/api/transactions/export').expect(200);
    expect(res.text.replace(/^\uFEFF/, '').trim()).toBe(
      'Data;Tipo;Categoria;Conta;Valor (Kz);Notas'
    );
  });
});
