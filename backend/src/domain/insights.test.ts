import { describe, expect, it } from 'vitest';
import { buildInsights, computeMetrics, type InsightInput } from './insights.js';
import { formatAOA } from './money.js';

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    yearMonth: '2026-09',
    income: { currentCents: 450_000_00, previousCents: 450_000_00 },
    expense: { currentCents: 300_000_00, previousCents: 280_000_00 },
    categories: [],
    budgets: [],
    commitments: [],
    goals: [],
    ...overrides,
  };
}

function ids(result: ReturnType<typeof buildInsights>): string[] {
  return result.map((i) => i.id);
}

describe('computeMetrics', () => {
  it('derives the saving rate and the change against last month', () => {
    expect(computeMetrics(input())).toMatchObject({
      net_cents: 150_000_00,
      saving_rate: 33.3,
      expense_change_percent: 7.1,
    });
  });

  it('leaves the saving rate empty when nothing came in', () => {
    const metrics = computeMetrics(
      input({ income: { currentCents: 0, previousCents: 0 } })
    );
    expect(metrics.saving_rate).toBeNull();
    expect(metrics.net_cents).toBe(-300_000_00);
  });

  it('measures the top category against the month total', () => {
    const metrics = computeMetrics(
      input({
        expense: { currentCents: 100_000_00, previousCents: 0 },
        categories: [
          { name: 'Alimentação', currentCents: 45_000_00, previousCents: 0 },
          { name: 'Transporte', currentCents: 30_000_00, previousCents: 0 },
        ],
      })
    );
    expect(metrics.top_category).toEqual({
      name: 'Alimentação',
      amount_cents: 45_000_00,
      share_percent: 45,
    });
  });

  it('subtracts the fixed bills still to be charged', () => {
    const metrics = computeMetrics(
      input({
        commitments: [
          { name: 'Renda', amountCents: 120_000_00, dueOn: '2026-09-28' },
          { name: 'Propinas', amountCents: 50_000_00, dueOn: '2026-09-30' },
        ],
      })
    );
    expect(metrics.commitments_due_cents).toBe(170_000_00);
    expect(metrics.available_after_commitments_cents).toBe(-20_000_00);
  });
});

describe('buildInsights', () => {
  it('says only that the month is empty when there is nothing to read', () => {
    const result = buildInsights(
      input({
        income: { currentCents: 0, previousCents: 0 },
        expense: { currentCents: 0, previousCents: 0 },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'no-data', severity: 'info' });
  });

  it('still warns about bills ahead in a month with no movements yet', () => {
    const result = buildInsights(
      input({
        income: { currentCents: 0, previousCents: 0 },
        expense: { currentCents: 0, previousCents: 0 },
        commitments: [{ name: 'Renda', amountCents: 120_000_00, dueOn: '2026-09-28' }],
      })
    );
    expect(ids(result)).toEqual(['commitments']);
  });

  it('celebrates a month that kept a fifth of the income', () => {
    const [first] = buildInsights(input());
    expect(first).toMatchObject({ id: 'saving-rate', severity: 'good' });
    expect(first.title).toBe('Guardaste 33,3% do que recebeste');
    expect(first.facts).toMatchObject({ saving_rate: 33.3, net_cents: 150_000_00 });
  });

  it('flags a month that spent more than it earned', () => {
    const result = buildInsights(
      input({ expense: { currentCents: 500_000_00, previousCents: 280_000_00 } })
    );
    expect(result[0]).toMatchObject({ id: 'negative-month', severity: 'risk' });
    expect(result[0].detail).toContain(formatAOA(50_000_00));
  });

  it('warns when money was spent but nothing came in', () => {
    const result = buildInsights(input({ income: { currentCents: 0, previousCents: 0 } }));
    expect(result[0]).toMatchObject({ id: 'no-income', severity: 'warn' });
  });

  it('reports the worst budget overruns first and keeps the numbers', () => {
    const result = buildInsights(
      input({
        budgets: [
          { categoryName: 'Transporte', limitCents: 40_000_00, spentCents: 45_000_00 },
          { categoryName: 'Alimentação', limitCents: 80_000_00, spentCents: 110_000_00 },
        ],
      })
    );
    const over = result.filter((i) => i.id.startsWith('budget-over-'));
    expect(over.map((i) => i.facts.category)).toEqual(['Alimentação', 'Transporte']);
    expect(over[0].facts).toMatchObject({ over_cents: 30_000_00, spent_cents: 110_000_00 });
  });

  it('writes percentages the pt way, with a comma', () => {
    const result = buildInsights(
      input({
        budgets: [{ categoryName: 'Energia', limitCents: 70_000_00, spentCents: 62_000_00 }],
      })
    );
    const near = result.find((i) => i.id === 'budget-near-Energia');
    expect(near?.detail).toContain('88,6%');
    expect(near?.detail).not.toContain('88.6');
  });

  it('warns about a budget close to the limit but not one still comfortable', () => {
    const result = buildInsights(
      input({
        budgets: [
          { categoryName: 'Energia', limitCents: 50_000_00, spentCents: 42_000_00 },
          { categoryName: 'Saúde', limitCents: 50_000_00, spentCents: 10_000_00 },
        ],
      })
    );
    expect(ids(result)).toContain('budget-near-Energia');
    expect(ids(result)).not.toContain('budget-near-Saúde');
  });

  it('points out a category that jumped against the previous month', () => {
    const result = buildInsights(
      input({
        categories: [{ name: 'Transporte', currentCents: 60_000_00, previousCents: 20_000_00 }],
      })
    );
    const jump = result.find((i) => i.id === 'jump-Transporte');
    expect(jump).toMatchObject({ severity: 'warn' });
    expect(jump?.title).toBe('Transporte subiu 200%');
    expect(jump?.detail).toContain(formatAOA(60_000_00));
    expect(jump?.facts).toMatchObject({ delta_cents: 40_000_00 });
  });

  it('ignores jumps that are large in percentage but small in Kwanzas', () => {
    const result = buildInsights(
      input({
        categories: [{ name: 'Saúde', currentCents: 9_000_00, previousCents: 1_000_00 }],
      })
    );
    expect(ids(result)).not.toContain('jump-Saúde');
  });

  it('escalates the fixed bills when they do not fit in what is left', () => {
    const result = buildInsights(
      input({
        expense: { currentCents: 400_000_00, previousCents: 280_000_00 },
        commitments: [{ name: 'Renda', amountCents: 120_000_00, dueOn: '2026-09-28' }],
      })
    );
    const commitments = result.find((i) => i.id === 'commitments');
    expect(commitments).toMatchObject({ severity: 'risk' });
    expect(commitments?.facts).toMatchObject({ commitments_due_cents: 120_000_00, count: 1 });
  });

  it('mentions the fixed bills calmly when they do fit', () => {
    const result = buildInsights(
      input({ commitments: [{ name: 'Renda', amountCents: 120_000_00, dueOn: '2026-09-28' }] })
    );
    expect(result.find((i) => i.id === 'commitments')).toMatchObject({ severity: 'info' });
  });

  it('surfaces a goal that is behind, with the pace it needs', () => {
    const result = buildInsights(
      input({
        goals: [
          { name: 'Fundo de emergência', status: 'em_risco', requiredMonthlyCents: 75_000_00 },
          { name: 'Carro', status: 'em_dia', requiredMonthlyCents: 30_000_00 },
        ],
      })
    );
    const goal = result.find((i) => i.id.startsWith('goal-'));
    expect(goal?.title).toBe('Fundo de emergência está atrasado');
    expect(goal?.detail).toContain(formatAOA(75_000_00));
    expect(ids(result)).not.toContain('goal-Carro');
  });

  it('notes when one category takes most of the month', () => {
    const result = buildInsights(
      input({
        expense: { currentCents: 100_000_00, previousCents: 100_000_00 },
        categories: [
          { name: 'Habitação', currentCents: 55_000_00, previousCents: 55_000_00 },
          { name: 'Transporte', currentCents: 20_000_00, previousCents: 20_000_00 },
        ],
      })
    );
    expect(result.find((i) => i.id === 'concentration')?.title).toBe(
      'Habitação levou 55% das despesas'
    );
  });

  it('puts the risks first and never floods the dashboard', () => {
    const result = buildInsights(
      input({
        expense: { currentCents: 600_000_00, previousCents: 200_000_00 },
        categories: [
          { name: 'Alimentação', currentCents: 300_000_00, previousCents: 80_000_00 },
          { name: 'Transporte', currentCents: 150_000_00, previousCents: 40_000_00 },
        ],
        budgets: [
          { categoryName: 'Alimentação', limitCents: 100_000_00, spentCents: 300_000_00 },
          { categoryName: 'Transporte', limitCents: 100_000_00, spentCents: 150_000_00 },
          { categoryName: 'Energia', limitCents: 50_000_00, spentCents: 45_000_00 },
        ],
        commitments: [{ name: 'Renda', amountCents: 120_000_00, dueOn: '2026-09-28' }],
        goals: [{ name: 'Carro', status: 'em_risco', requiredMonthlyCents: 50_000_00 }],
      })
    );
    expect(result).toHaveLength(6);
    expect(result[0].severity).toBe('risk');
    const order = result.map((i) => i.severity);
    expect([...order].sort()).toEqual(order.slice().sort());
    expect(order.indexOf('warn')).toBeGreaterThan(order.lastIndexOf('risk'));
  });
});
