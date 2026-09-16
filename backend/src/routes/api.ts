import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';
import { assertPositiveCents, categoryMatchesType } from '../domain/money.js';
import { goalProgress, monthlyPaceCents } from '../domain/goals.js';
import { nextOccurrence } from '../domain/recurring.js';
import { runRecurring } from '../services/recurring.js';

const router = Router();
router.use(requireAuth);

router.get('/accounts', async (req, res) => {
  const r = await query(
    'SELECT id, name, kind, created_at FROM accounts WHERE user_id = $1 ORDER BY id',
    [req.user!.id]
  );
  res.json({ accounts: r.rows });
});

router.get('/categories', async (req, res) => {
  const r = await query(
    `SELECT id, name, kind, is_system, user_id
     FROM categories
     WHERE user_id IS NULL OR user_id = $1
     ORDER BY is_system DESC, name`,
    [req.user!.id]
  );
  res.json({ categories: r.rows });
});

router.post('/categories', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(80),
    kind: z.enum(['income', 'expense', 'both']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
  try {
    const r = await query(
      `INSERT INTO categories (user_id, name, kind, is_system)
       VALUES ($1, $2, $3, FALSE) RETURNING id, name, kind, is_system`,
      [req.user!.id, parsed.data.name, parsed.data.kind]
    );
    res.status(201).json({ category: r.rows[0] });
  } catch {
    res.status(409).json({ error: 'Categoria já existe.' });
  }
});

const txSchema = z.object({
  account_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount_cents: z.number().int().positive(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional().nullable(),
});

router.get('/transactions', async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;
  const type = typeof req.query.type === 'string' ? req.query.type : null;
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
  const params: unknown[] = [req.user!.id];
  const where = ['t.user_id = $1'];
  if (from) {
    params.push(from);
    where.push(`t.occurred_on >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`t.occurred_on <= $${params.length}`);
  }
  if (type === 'income' || type === 'expense') {
    params.push(type);
    where.push(`t.type = $${params.length}`);
  }
  if (categoryId && Number.isFinite(categoryId)) {
    params.push(categoryId);
    where.push(`t.category_id = $${params.length}`);
  }
  const r = await query(
    `SELECT t.*, c.name AS category_name, a.name AS account_name
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN accounts a ON a.id = t.account_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.occurred_on DESC, t.id DESC
     LIMIT 200`,
    params
  );
  res.json({ transactions: r.rows });
});

router.post('/transactions', async (req, res) => {
  const parsed = txSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados da transação inválidos.' });
  const data = parsed.data;
  try {
    assertPositiveCents(data.amount_cents);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
  const acc = await query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [
    data.account_id,
    req.user!.id,
  ]);
  if (!acc.rows.length) return res.status(400).json({ error: 'Conta inválida.' });
  const cat = await query<{ kind: 'income' | 'expense' | 'both' }>(
    `SELECT kind FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [data.category_id, req.user!.id]
  );
  if (!cat.rows.length) return res.status(400).json({ error: 'Categoria inválida.' });
  if (!categoryMatchesType(cat.rows[0].kind, data.type)) {
    return res.status(400).json({ error: 'Categoria incompatível com o tipo de transação.' });
  }
  const r = await query(
    `INSERT INTO transactions
      (user_id, account_id, category_id, type, amount_cents, occurred_on, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      req.user!.id,
      data.account_id,
      data.category_id,
      data.type,
      data.amount_cents,
      data.occurred_on,
      data.notes ?? null,
    ]
  );
  await audit(req.user!.id, 'TRANSACTION_CREATED', { id: r.rows[0].id });
  res.status(201).json({ transaction: r.rows[0] });
});

router.delete('/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [
    id,
    req.user!.id,
  ]);
  if (!r.rows.length) return res.status(404).json({ error: 'Transação não encontrada.' });
  await audit(req.user!.id, 'TRANSACTION_DELETED', { id });
  res.json({ ok: true });
});

router.get('/budgets', async (req, res) => {
  const yearMonth =
    typeof req.query.year_month === 'string' && /^\d{4}-\d{2}$/.test(req.query.year_month)
      ? req.query.year_month
      : new Date().toISOString().slice(0, 7);
  const budgets = await query(
    `SELECT b.*, c.name AS category_name
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = $1 AND b.year_month = $2
     ORDER BY c.name`,
    [req.user!.id, yearMonth]
  );
  const spent = await query<{ category_id: number; spent_cents: string }>(
    `SELECT category_id, COALESCE(SUM(amount_cents),0)::text AS spent_cents
     FROM transactions
     WHERE user_id = $1 AND type = 'expense'
       AND to_char(occurred_on, 'YYYY-MM') = $2
     GROUP BY category_id`,
    [req.user!.id, yearMonth]
  );
  const spentMap = new Map(spent.rows.map((s) => [s.category_id, Number(s.spent_cents)]));
  res.json({
    year_month: yearMonth,
    budgets: budgets.rows.map((b) => {
      const spentCents = spentMap.get(b.category_id) ?? 0;
      const remainingCents = Math.max(0, b.limit_cents - spentCents);
      const percentUsed =
        b.limit_cents === 0 ? 0 : Math.min(100, Math.round((spentCents / b.limit_cents) * 1000) / 10);
      return { ...b, spent_cents: spentCents, remaining_cents: remainingCents, percent_used: percentUsed };
    }),
  });
});

router.put('/budgets', async (req, res) => {
  const schema = z.object({
    category_id: z.number().int().positive(),
    year_month: z.string().regex(/^\d{4}-\d{2}$/),
    limit_cents: z.number().int().positive(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados de orçamento inválidos.' });
  const cat = await query(
    `SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [parsed.data.category_id, req.user!.id]
  );
  if (!cat.rows.length) return res.status(400).json({ error: 'Categoria inválida.' });
  const r = await query(
    `INSERT INTO budgets (user_id, category_id, year_month, limit_cents)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, category_id, year_month)
     DO UPDATE SET limit_cents = EXCLUDED.limit_cents
     RETURNING *`,
    [req.user!.id, parsed.data.category_id, parsed.data.year_month, parsed.data.limit_cents]
  );
  await audit(req.user!.id, 'BUDGET_UPSERT', { id: r.rows[0].id });
  res.json({ budget: r.rows[0] });
});

router.get('/dashboard', async (req, res) => {
  const yearMonth =
    typeof req.query.year_month === 'string' && /^\d{4}-\d{2}$/.test(req.query.year_month)
      ? req.query.year_month
      : new Date().toISOString().slice(0, 7);

  const totals = await query<{ type: string; total: string }>(
    `SELECT type, COALESCE(SUM(amount_cents),0)::text AS total
     FROM transactions
     WHERE user_id = $1 AND to_char(occurred_on, 'YYYY-MM') = $2
     GROUP BY type`,
    [req.user!.id, yearMonth]
  );
  let incomeCents = 0;
  let expenseCents = 0;
  for (const row of totals.rows) {
    if (row.type === 'income') incomeCents = Number(row.total);
    if (row.type === 'expense') expenseCents = Number(row.total);
  }

  const balance = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE -amount_cents END),0)::text AS balance
     FROM transactions WHERE user_id = $1`,
    [req.user!.id]
  );

  const byCategory = await query(
    `SELECT c.name, COALESCE(SUM(t.amount_cents),0)::int AS total_cents
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense' AND to_char(t.occurred_on, 'YYYY-MM') = $2
     GROUP BY c.name
     ORDER BY total_cents DESC
     LIMIT 8`,
    [req.user!.id, yearMonth]
  );

  const recent = await query(
    `SELECT t.id, t.type, t.amount_cents, t.occurred_on, t.notes, c.name AS category_name
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
     ORDER BY t.occurred_on DESC, t.id DESC
     LIMIT 8`,
    [req.user!.id]
  );

  res.json({
    year_month: yearMonth,
    balance_cents: Number(balance.rows[0]?.balance ?? 0),
    income_cents: incomeCents,
    expense_cents: expenseCents,
    net_cents: incomeCents - expenseCents,
    by_category: byCategory.rows,
    recent: recent.rows,
  });
});

const recurringSchema = z.object({
  name: z.string().min(2).max(120),
  account_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount_cents: z.number().int().positive(),
  day_of_month: z.number().int().min(1).max(31),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

router.get('/recurring', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await query(
    `SELECT r.id, r.name, r.type, r.amount_cents, r.day_of_month, r.start_date, r.end_date,
            r.active, r.last_run_on, c.name AS category_name, a.name AS account_name
     FROM recurring_transactions r
     JOIN categories c ON c.id = r.category_id
     JOIN accounts a ON a.id = r.account_id
     WHERE r.user_id = $1
     ORDER BY r.active DESC, r.day_of_month, r.id`,
    [req.user!.id]
  );

  res.json({
    rules: r.rows.map((rule) => {
      const startDate = isoDate(rule.start_date)!;
      const endDate = isoDate(rule.end_date);
      return {
        ...rule,
        start_date: startDate,
        end_date: endDate,
        last_run_on: isoDate(rule.last_run_on),
        next_occurrence: rule.active
          ? nextOccurrence(
              { dayOfMonth: rule.day_of_month, startDate, endDate },
              today
            )
          : null,
      };
    }),
  });
});

router.post('/recurring', async (req, res) => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados da recorrência inválidos.' });
  const data = parsed.data;
  if (data.end_date && data.end_date < data.start_date) {
    return res.status(400).json({ error: 'A data final não pode ser anterior ao início.' });
  }

  const acc = await query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [
    data.account_id,
    req.user!.id,
  ]);
  if (!acc.rows.length) return res.status(400).json({ error: 'Conta inválida.' });

  const cat = await query<{ kind: 'income' | 'expense' | 'both' }>(
    'SELECT kind FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
    [data.category_id, req.user!.id]
  );
  if (!cat.rows.length) return res.status(400).json({ error: 'Categoria inválida.' });
  if (!categoryMatchesType(cat.rows[0].kind, data.type)) {
    return res.status(400).json({ error: 'Categoria incompatível com o tipo de transação.' });
  }

  const r = await query(
    `INSERT INTO recurring_transactions
       (user_id, account_id, category_id, name, type, amount_cents, day_of_month, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, name, type, amount_cents, day_of_month, start_date, end_date, active`,
    [
      req.user!.id,
      data.account_id,
      data.category_id,
      data.name,
      data.type,
      data.amount_cents,
      data.day_of_month,
      data.start_date,
      data.end_date ?? null,
    ]
  );
  await audit(req.user!.id, 'RECURRING_CREATED', { id: r.rows[0].id });
  res.status(201).json({ rule: r.rows[0] });
});

router.patch('/recurring/:id', async (req, res) => {
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Estado inválido.' });
  const r = await query(
    'UPDATE recurring_transactions SET active = $1 WHERE id = $2 AND user_id = $3 RETURNING id, active',
    [parsed.data.active, Number(req.params.id), req.user!.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Recorrência não encontrada.' });
  await audit(req.user!.id, 'RECURRING_TOGGLED', { id: r.rows[0].id, active: r.rows[0].active });
  res.json({ rule: r.rows[0] });
});

router.delete('/recurring/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await query(
    'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user!.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Recorrência não encontrada.' });
  await audit(req.user!.id, 'RECURRING_DELETED', { id });
  res.json({ ok: true });
});

router.post('/recurring/run', async (req, res) => {
  const result = await runRecurring(req.user!.id);
  res.json(result);
});

const goalSchema = z.object({
  name: z.string().min(2).max(120),
  target_cents: z.number().int().positive(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

function isoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

router.get('/goals', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const goals = await query(
    `SELECT g.id, g.name, g.target_cents, g.deadline,
            COALESCE(SUM(gc.amount_cents), 0)::int AS saved_cents,
            MIN(gc.occurred_on) AS first_contribution_on
     FROM goals g
     LEFT JOIN goal_contributions gc ON gc.goal_id = g.id
     WHERE g.user_id = $1
     GROUP BY g.id
     ORDER BY g.deadline NULLS LAST, g.id`,
    [req.user!.id]
  );

  res.json({
    goals: goals.rows.map((g) => {
      const deadline = isoDate(g.deadline);
      const paceCents = monthlyPaceCents(
        g.saved_cents,
        isoDate(g.first_contribution_on),
        today
      );
      return {
        id: g.id,
        name: g.name,
        target_cents: g.target_cents,
        deadline,
        saved_cents: g.saved_cents,
        pace_cents: paceCents,
        ...goalProgress({
          targetCents: g.target_cents,
          savedCents: g.saved_cents,
          deadline,
          today,
          paceCents,
        }),
      };
    }),
  });
});

router.post('/goals', async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados do objetivo inválidos.' });
  const r = await query(
    `INSERT INTO goals (user_id, name, target_cents, deadline)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, target_cents, deadline`,
    [req.user!.id, parsed.data.name, parsed.data.target_cents, parsed.data.deadline ?? null]
  );
  await audit(req.user!.id, 'GOAL_CREATED', { id: r.rows[0].id });
  res.status(201).json({ goal: r.rows[0] });
});

router.post('/goals/:id/contributions', async (req, res) => {
  const goalId = Number(req.params.id);
  const schema = z.object({
    amount_cents: z.number().int().positive(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(500).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Contribuição inválida.' });

  const goal = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [
    goalId,
    req.user!.id,
  ]);
  if (!goal.rows.length) return res.status(404).json({ error: 'Objetivo não encontrado.' });

  const r = await query(
    `INSERT INTO goal_contributions (goal_id, user_id, amount_cents, occurred_on, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, goal_id, amount_cents, occurred_on, notes`,
    [
      goalId,
      req.user!.id,
      parsed.data.amount_cents,
      parsed.data.occurred_on,
      parsed.data.notes ?? null,
    ]
  );
  await audit(req.user!.id, 'GOAL_CONTRIBUTION_ADDED', { goal_id: goalId });
  res.status(201).json({ contribution: r.rows[0] });
});

router.delete('/goals/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [
    id,
    req.user!.id,
  ]);
  if (!r.rows.length) return res.status(404).json({ error: 'Objetivo não encontrado.' });
  await audit(req.user!.id, 'GOAL_DELETED', { id });
  res.json({ ok: true });
});

router.get('/reports/by-category', async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : null;
  const to = typeof req.query.to === 'string' ? req.query.to : null;
  if (!from || !to) {
    return res.status(400).json({ error: 'Parâmetros from e to (YYYY-MM-DD) são obrigatórios.' });
  }
  const r = await query(
    `SELECT c.name, t.type, COALESCE(SUM(t.amount_cents),0)::int AS total_cents
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.occurred_on BETWEEN $2 AND $3
     GROUP BY c.name, t.type
     ORDER BY t.type, total_cents DESC`,
    [req.user!.id, from, to]
  );
  res.json({ from, to, rows: r.rows });
});

export default router;
