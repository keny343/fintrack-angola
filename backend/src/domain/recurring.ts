/**
 * Monthly recurring rules (rent, salary, tuition).
 *
 * A rule fires on `dayOfMonth` every month. Days that do not exist in a given
 * month (31 in February) are clamped to the last day of that month, so a rule
 * never silently skips a month.
 */

export type RecurringRule = {
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
  lastRunOn?: string | null;
};

const MAX_MONTHS = 240;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ISO date on which a rule fires inside `yearMonth` (`YYYY-MM`). */
export function occurrenceInMonth(yearMonth: string, dayOfMonth: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(year, month));
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

function addMonths(yearMonth: string, count: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const zeroBased = year * 12 + (month - 1) + count;
  return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, '0')}`;
}

/**
 * Dates a rule should have generated up to and including `todayIso`, skipping
 * anything already generated (`lastRunOn`) or outside the rule's window.
 */
export function dueOccurrences(rule: RecurringRule, todayIso: string): string[] {
  const dates: string[] = [];
  const lastMonth = todayIso.slice(0, 7);
  let month = rule.startDate.slice(0, 7);

  for (let i = 0; i <= MAX_MONTHS && month <= lastMonth; i += 1) {
    const date = occurrenceInMonth(month, rule.dayOfMonth);
    const withinWindow =
      date >= rule.startDate && date <= todayIso && (!rule.endDate || date <= rule.endDate);
    if (withinWindow && (!rule.lastRunOn || date > rule.lastRunOn)) dates.push(date);
    month = addMonths(month, 1);
  }

  return dates;
}

/** Next date the rule will fire strictly after `todayIso`, or null when finished. */
export function nextOccurrence(rule: RecurringRule, todayIso: string): string | null {
  let month = todayIso.slice(0, 7);
  if (rule.startDate > todayIso) month = rule.startDate.slice(0, 7);

  for (let i = 0; i <= MAX_MONTHS; i += 1) {
    const date = occurrenceInMonth(month, rule.dayOfMonth);
    if (rule.endDate && date > rule.endDate) return null;
    if (date > todayIso && date >= rule.startDate) return date;
    month = addMonths(month, 1);
  }

  return null;
}
