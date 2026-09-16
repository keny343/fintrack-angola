import { describe, expect, it } from 'vitest';
import {
  assertPositiveCents,
  budgetProgress,
  categoryMatchesType,
  formatAOA,
  periodTotals,
} from './money.js';

describe('money domain', () => {
  it('rejects non-positive cents', () => {
    expect(() => assertPositiveCents(0)).toThrow();
    expect(() => assertPositiveCents(-1)).toThrow();
    expect(() => assertPositiveCents(1.5)).toThrow();
  });

  it('formats AOA', () => {
    const s = formatAOA(1005000);
    expect(s).toMatch(/10/);
    expect(s.toLowerCase()).toMatch(/aoa|kz|kz/);
  });

  it('computes budget progress', () => {
    expect(budgetProgress(100_000_00, 78_500_00)).toMatchObject({
      remainingCents: 21_500_00,
      percentUsed: 78.5,
    });
  });

  it('sums period totals', () => {
    expect(
      periodTotals([
        { type: 'income', amount_cents: 450_000_00 },
        { type: 'expense', amount_cents: 120_000_00 },
        { type: 'expense', amount_cents: 80_000_00 },
      ])
    ).toEqual({ incomeCents: 450_000_00, expenseCents: 200_000_00, netCents: 250_000_00 });
  });

  it('checks category vs transaction type', () => {
    expect(categoryMatchesType('income', 'income')).toBe(true);
    expect(categoryMatchesType('expense', 'income')).toBe(false);
    expect(categoryMatchesType('both', 'expense')).toBe(true);
  });
});
