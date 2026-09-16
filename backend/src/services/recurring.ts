import { query } from '../db/pool.js';
import { dueOccurrences } from '../domain/recurring.js';

type RuleRow = {
  id: number;
  account_id: number;
  category_id: number;
  type: 'income' | 'expense';
  amount_cents: number;
  name: string;
  day_of_month: number;
  start_date: string | Date;
  end_date: string | Date | null;
  last_run_on: string | Date | null;
};

function isoDate(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/**
 * Materializes every transaction a user's active rules should already have
 * generated. Safe to call repeatedly: the unique index on
 * `(recurring_id, occurred_on)` makes each occurrence idempotent.
 */
export async function runRecurring(
  userId: number,
  todayIso: string = new Date().toISOString().slice(0, 10)
): Promise<{ created: number }> {
  const rules = await query<RuleRow>(
    `SELECT id, account_id, category_id, type, amount_cents, name,
            day_of_month, start_date, end_date, last_run_on
     FROM recurring_transactions
     WHERE user_id = $1 AND active = TRUE`,
    [userId]
  );

  let created = 0;

  for (const rule of rules.rows) {
    const dates = dueOccurrences(
      {
        dayOfMonth: rule.day_of_month,
        startDate: isoDate(rule.start_date)!,
        endDate: isoDate(rule.end_date),
        lastRunOn: isoDate(rule.last_run_on),
      },
      todayIso
    );
    if (!dates.length) continue;

    for (const date of dates) {
      const inserted = await query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, type, amount_cents, occurred_on, notes, recurring_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          userId,
          rule.account_id,
          rule.category_id,
          rule.type,
          rule.amount_cents,
          date,
          rule.name,
          rule.id,
        ]
      );
      created += inserted.rows.length;
    }

    await query('UPDATE recurring_transactions SET last_run_on = $1 WHERE id = $2', [
      dates[dates.length - 1],
      rule.id,
    ]);
  }

  return { created };
}
