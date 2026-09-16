import { describe, expect, it } from 'vitest';
import { daysInMonth, dueOccurrences, nextOccurrence, occurrenceInMonth } from './recurring.js';

describe('occurrenceInMonth', () => {
  it('clamps days that do not exist in the month', () => {
    expect(occurrenceInMonth('2026-01', 31)).toBe('2026-01-31');
    expect(occurrenceInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(occurrenceInMonth('2024-02', 30)).toBe('2024-02-29');
    expect(occurrenceInMonth('2026-04', 31)).toBe('2026-04-30');
  });

  it('knows the length of each month', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('dueOccurrences', () => {
  it('returns every month from the start date up to today', () => {
    expect(
      dueOccurrences({ dayOfMonth: 5, startDate: '2026-07-05' }, '2026-09-16')
    ).toEqual(['2026-07-05', '2026-08-05', '2026-09-05']);
  });

  it('skips the current month when the day has not arrived yet', () => {
    expect(
      dueOccurrences({ dayOfMonth: 28, startDate: '2026-08-28' }, '2026-09-16')
    ).toEqual(['2026-08-28']);
  });

  it('ignores occurrences already generated', () => {
    expect(
      dueOccurrences(
        { dayOfMonth: 5, startDate: '2026-07-05', lastRunOn: '2026-08-05' },
        '2026-09-16'
      )
    ).toEqual(['2026-09-05']);
  });

  it('stops at the end date', () => {
    expect(
      dueOccurrences(
        { dayOfMonth: 10, startDate: '2026-06-10', endDate: '2026-07-31' },
        '2026-09-16'
      )
    ).toEqual(['2026-06-10', '2026-07-10']);
  });

  it('returns nothing before the rule starts', () => {
    expect(dueOccurrences({ dayOfMonth: 1, startDate: '2026-11-01' }, '2026-09-16')).toEqual([]);
  });

  it('clamps long months so no month is skipped', () => {
    expect(
      dueOccurrences({ dayOfMonth: 31, startDate: '2026-01-31' }, '2026-03-31')
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('nextOccurrence', () => {
  it('finds the next date after today', () => {
    expect(nextOccurrence({ dayOfMonth: 5, startDate: '2026-01-05' }, '2026-09-16')).toBe(
      '2026-10-05'
    );
    expect(nextOccurrence({ dayOfMonth: 28, startDate: '2026-01-28' }, '2026-09-16')).toBe(
      '2026-09-28'
    );
  });

  it('respects a future start date', () => {
    expect(nextOccurrence({ dayOfMonth: 3, startDate: '2027-02-03' }, '2026-09-16')).toBe(
      '2027-02-03'
    );
  });

  it('is null once the rule has ended', () => {
    expect(
      nextOccurrence({ dayOfMonth: 5, startDate: '2026-01-05', endDate: '2026-08-31' }, '2026-09-16')
    ).toBeNull();
  });
});
