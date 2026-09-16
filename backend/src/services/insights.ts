import { query } from '../db/pool.js';
import { goalProgress, monthlyPaceCents } from '../domain/goals.js';
import {
  buildInsights,
  computeMetrics,
  type Insight,
  type InsightInput,
  type InsightMetrics,
} from '../domain/insights.js';
import { occurrenceInMonth } from '../domain/recurring.js';

function isoDate(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function previousMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return date.toISOString().slice(0, 7);
}

/** Collects the month's figures and turns them into insights. */
export async function monthInsights(
  userId: number,
  yearMonth: string,
  todayIso: string = new Date().toISOString().slice(0, 10)
): Promise<{ metrics: InsightMetrics; insights: Insight[] }> {
  const previous = previousMonth(yearMonth);

  const [totals, categories, budgets, rules, goals] = await Promise.all([
    query<{ month: string; type: string; total: string }>(
      `SELECT to_char(occurred_on, 'YYYY-MM') AS month, type,
              COALESCE(SUM(amount_cents), 0)::text AS total
       FROM transactions
       WHERE user_id = $1 AND to_char(occurred_on, 'YYYY-MM') IN ($2, $3)
       GROUP BY month, type`,
      [userId, yearMonth, previous]
    ),
    query<{ name: string; current_cents: number; previous_cents: number }>(
      `SELECT c.name,
              COALESCE(SUM(t.amount_cents) FILTER (WHERE to_char(t.occurred_on, 'YYYY-MM') = $2), 0)::int
                AS current_cents,
              COALESCE(SUM(t.amount_cents) FILTER (WHERE to_char(t.occurred_on, 'YYYY-MM') = $3), 0)::int
                AS previous_cents
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND to_char(t.occurred_on, 'YYYY-MM') IN ($2, $3)
       GROUP BY c.name`,
      [userId, yearMonth, previous]
    ),
    query<{ category_name: string; limit_cents: number; spent_cents: string }>(
      `SELECT c.name AS category_name, b.limit_cents,
              COALESCE(
                (SELECT SUM(t.amount_cents)
                 FROM transactions t
                 WHERE t.user_id = b.user_id AND t.category_id = b.category_id
                   AND t.type = 'expense'
                   AND to_char(t.occurred_on, 'YYYY-MM') = b.year_month),
                0
              )::text AS spent_cents
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1 AND b.year_month = $2`,
      [userId, yearMonth]
    ),
    query<{
      name: string;
      amount_cents: number;
      day_of_month: number;
      start_date: string | Date;
      end_date: string | Date | null;
    }>(
      `SELECT name, amount_cents, day_of_month, start_date, end_date
       FROM recurring_transactions
       WHERE user_id = $1 AND active = TRUE AND type = 'expense'`,
      [userId]
    ),
    query<{
      name: string;
      target_cents: number;
      deadline: string | Date | null;
      saved_cents: number;
      first_contribution_on: string | Date | null;
    }>(
      `SELECT g.name, g.target_cents, g.deadline,
              COALESCE(SUM(gc.amount_cents), 0)::int AS saved_cents,
              MIN(gc.occurred_on) AS first_contribution_on
       FROM goals g
       LEFT JOIN goal_contributions gc ON gc.goal_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id`,
      [userId]
    ),
  ]);

  const total = (month: string, type: string) =>
    Number(totals.rows.find((r) => r.month === month && r.type === type)?.total ?? 0);

  // A fixed bill counts as still due when its day this month has not arrived
  // yet and the rule's own window still covers it.
  const commitments = rules.rows
    .map((rule) => ({
      name: rule.name,
      amountCents: rule.amount_cents,
      dueOn: occurrenceInMonth(yearMonth, rule.day_of_month),
      startDate: isoDate(rule.start_date)!,
      endDate: isoDate(rule.end_date),
    }))
    .filter(
      (c) =>
        c.dueOn > todayIso &&
        c.dueOn >= c.startDate &&
        (c.endDate === null || c.dueOn <= c.endDate)
    )
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map(({ name, amountCents, dueOn }) => ({ name, amountCents, dueOn }));

  const input: InsightInput = {
    yearMonth,
    income: {
      currentCents: total(yearMonth, 'income'),
      previousCents: total(previous, 'income'),
    },
    expense: {
      currentCents: total(yearMonth, 'expense'),
      previousCents: total(previous, 'expense'),
    },
    categories: categories.rows.map((c) => ({
      name: c.name,
      currentCents: c.current_cents,
      previousCents: c.previous_cents,
    })),
    budgets: budgets.rows.map((b) => ({
      categoryName: b.category_name,
      limitCents: b.limit_cents,
      spentCents: Number(b.spent_cents),
    })),
    commitments,
    goals: goals.rows.map((g) => {
      const deadline = isoDate(g.deadline);
      const progress = goalProgress({
        targetCents: g.target_cents,
        savedCents: g.saved_cents,
        deadline,
        today: todayIso,
        paceCents: monthlyPaceCents(
          g.saved_cents,
          isoDate(g.first_contribution_on),
          todayIso
        ),
      });
      return {
        name: g.name,
        status: progress.status,
        requiredMonthlyCents: progress.requiredMonthlyCents,
      };
    }),
  };

  return { metrics: computeMetrics(input), insights: buildInsights(input) };
}
