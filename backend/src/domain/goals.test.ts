import { describe, expect, it } from 'vitest';
import { goalProgress, monthlyPaceCents, monthsBetween } from './goals.js';

describe('monthsBetween', () => {
  it('counts whole calendar months', () => {
    expect(monthsBetween('2026-09-16', '2026-12-15')).toBe(3);
    expect(monthsBetween('2026-09-01', '2026-09-30')).toBe(0);
    expect(monthsBetween('2026-09-16', '2026-08-16')).toBe(-1);
  });
});

describe('monthlyPaceCents', () => {
  it('averages contributions over the active months', () => {
    expect(monthlyPaceCents(300_000_00, '2026-07-05', '2026-09-16')).toBe(100_000_00);
  });

  it('is null without savings', () => {
    expect(monthlyPaceCents(0, '2026-07-05', '2026-09-16')).toBeNull();
    expect(monthlyPaceCents(50_000_00, null, '2026-09-16')).toBeNull();
  });
});

describe('goalProgress', () => {
  const base = { targetCents: 600_000_00, today: '2026-09-16' };

  it('reports the required monthly amount until the deadline', () => {
    expect(
      goalProgress({ ...base, savedCents: 250_000_00, deadline: '2026-12-15' })
    ).toMatchObject({
      percent: 41.7,
      remainingCents: 350_000_00,
      monthsRemaining: 3,
      requiredMonthlyCents: 11_666_667,
      status: 'em_dia',
    });
  });

  it('flags risk when the current pace is below what is required', () => {
    const result = goalProgress({
      ...base,
      savedCents: 250_000_00,
      deadline: '2026-12-15',
      paceCents: 50_000_00,
    });
    expect(result.status).toBe('em_risco');
  });

  it('flags risk when the deadline is due or past and money is missing', () => {
    expect(
      goalProgress({ ...base, savedCents: 100_000_00, deadline: '2026-09-30' }).status
    ).toBe('em_risco');
    expect(
      goalProgress({ ...base, savedCents: 100_000_00, deadline: '2026-01-30' }).status
    ).toBe('em_risco');
  });

  it('marks reached goals regardless of deadline', () => {
    expect(
      goalProgress({ ...base, savedCents: 600_000_00, deadline: '2026-01-30' })
    ).toMatchObject({ percent: 100, remainingCents: 0, requiredMonthlyCents: 0, status: 'atingido' });
  });

  it('handles goals without a deadline', () => {
    expect(goalProgress({ ...base, savedCents: 60_000_00, deadline: null })).toMatchObject({
      percent: 10,
      monthsRemaining: null,
      requiredMonthlyCents: null,
      status: 'sem_prazo',
    });
  });
});
