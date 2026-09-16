/**
 * Monthly insights derived from the user's own numbers.
 *
 * Every sentence here is produced from figures the database already holds, and
 * each insight carries those figures in `facts`. Nothing is estimated and
 * nothing is rounded before the comparison is made — if a narration layer is
 * added later, these facts are the only thing it is allowed to talk about.
 */

import { formatAOA } from './money.js';
import type { GoalStatus } from './goals.js';

export type InsightSeverity = 'risk' | 'warn' | 'info' | 'good';

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  facts: Record<string, string | number>;
};

export type InsightInput = {
  yearMonth: string;
  income: { currentCents: number; previousCents: number };
  expense: { currentCents: number; previousCents: number };
  categories: Array<{ name: string; currentCents: number; previousCents: number }>;
  budgets: Array<{ categoryName: string; limitCents: number; spentCents: number }>;
  /** Recurring expenses that have not been charged yet this month. */
  commitments: Array<{ name: string; amountCents: number; dueOn: string }>;
  goals: Array<{ name: string; status: GoalStatus; requiredMonthlyCents: number | null }>;
};

export type InsightMetrics = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  /** Share of income left over, as a percentage. Null when there is no income. */
  saving_rate: number | null;
  previous_expense_cents: number;
  expense_change_percent: number | null;
  commitments_due_cents: number;
  available_after_commitments_cents: number;
  top_category: { name: string; amount_cents: number; share_percent: number } | null;
};

/** A category has to move by at least this much before it is worth a sentence. */
const MIN_JUMP_CENTS = 1_000_000; // 10.000,00 Kz
const JUMP_RATIO = 1.4;
const BUDGET_NEAR_LIMIT = 0.8;
const CONCENTRATION_SHARE = 40;
const MAX_INSIGHTS = 6;

const SEVERITY_ORDER: Record<InsightSeverity, number> = { risk: 0, warn: 1, info: 2, good: 3 };

function percent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Percentages are written the pt way: 88,6% and not 88.6%. */
function pct(value: number): string {
  return `${String(value).replace('.', ',')}%`;
}

export function computeMetrics(input: InsightInput): InsightMetrics {
  const incomeCents = input.income.currentCents;
  const expenseCents = input.expense.currentCents;
  const netCents = incomeCents - expenseCents;
  const commitmentsDueCents = input.commitments.reduce((sum, c) => sum + c.amountCents, 0);

  const sorted = [...input.categories].sort((a, b) => b.currentCents - a.currentCents);
  const top = sorted[0];

  return {
    income_cents: incomeCents,
    expense_cents: expenseCents,
    net_cents: netCents,
    saving_rate: incomeCents > 0 ? percent(netCents, incomeCents) : null,
    previous_expense_cents: input.expense.previousCents,
    expense_change_percent:
      input.expense.previousCents > 0
        ? percent(expenseCents - input.expense.previousCents, input.expense.previousCents)
        : null,
    commitments_due_cents: commitmentsDueCents,
    available_after_commitments_cents: netCents - commitmentsDueCents,
    top_category:
      top && top.currentCents > 0
        ? {
            name: top.name,
            amount_cents: top.currentCents,
            share_percent: percent(top.currentCents, expenseCents),
          }
        : null,
  };
}

export function buildInsights(input: InsightInput): Insight[] {
  const metrics = computeMetrics(input);
  const insights: Insight[] = [];

  // 1. Is the month closing in the black? A month with no movements at all
  // says nothing here, but may still have bills coming (rule 5).
  if (metrics.income_cents === 0 && metrics.expense_cents === 0) {
    // Nothing to weigh yet.
  } else if (metrics.income_cents === 0) {
    insights.push({
      id: 'no-income',
      severity: 'warn',
      title: 'Gastos sem receitas registadas',
      detail: `Gastaste ${formatAOA(metrics.expense_cents)} e ainda não lançaste nenhuma entrada este mês.`,
      facts: { expense_cents: metrics.expense_cents },
    });
  } else if (metrics.net_cents < 0) {
    insights.push({
      id: 'negative-month',
      severity: 'risk',
      title: 'Gastaste mais do que recebeste',
      detail: `As despesas passaram as receitas em ${formatAOA(Math.abs(metrics.net_cents))}.`,
      facts: {
        income_cents: metrics.income_cents,
        expense_cents: metrics.expense_cents,
        net_cents: metrics.net_cents,
      },
    });
  } else {
    const rate = metrics.saving_rate ?? 0;
    insights.push({
      id: 'saving-rate',
      severity: rate >= 20 ? 'good' : 'info',
      title: `Guardaste ${pct(rate)} do que recebeste`,
      detail: `Sobraram ${formatAOA(metrics.net_cents)} de ${formatAOA(metrics.income_cents)} que entraram.`,
      facts: {
        saving_rate: rate,
        net_cents: metrics.net_cents,
        income_cents: metrics.income_cents,
      },
    });
  }

  // 2. Budgets already broken, worst first.
  const overruns = input.budgets
    .filter((b) => b.limitCents > 0 && b.spentCents > b.limitCents)
    .sort((a, b) => b.spentCents - b.limitCents - (a.spentCents - a.limitCents));
  for (const budget of overruns.slice(0, 2)) {
    const overCents = budget.spentCents - budget.limitCents;
    insights.push({
      id: `budget-over-${budget.categoryName}`,
      severity: 'risk',
      title: `${budget.categoryName} passou o orçamento`,
      detail: `Gastaste ${formatAOA(budget.spentCents)} de um limite de ${formatAOA(budget.limitCents)} — ${formatAOA(overCents)} acima.`,
      facts: {
        category: budget.categoryName,
        spent_cents: budget.spentCents,
        limit_cents: budget.limitCents,
        over_cents: overCents,
      },
    });
  }

  // 3. Budgets about to break.
  const nearLimit = input.budgets
    .filter(
      (b) =>
        b.limitCents > 0 &&
        b.spentCents <= b.limitCents &&
        b.spentCents >= b.limitCents * BUDGET_NEAR_LIMIT
    )
    .sort((a, b) => b.spentCents / b.limitCents - a.spentCents / a.limitCents);
  for (const budget of nearLimit.slice(0, 2)) {
    insights.push({
      id: `budget-near-${budget.categoryName}`,
      severity: 'warn',
      title: `${budget.categoryName} está quase no limite`,
      detail: `Já usaste ${pct(percent(budget.spentCents, budget.limitCents))} do orçamento. Restam ${formatAOA(budget.limitCents - budget.spentCents)}.`,
      facts: {
        category: budget.categoryName,
        spent_cents: budget.spentCents,
        limit_cents: budget.limitCents,
        remaining_cents: budget.limitCents - budget.spentCents,
      },
    });
  }

  // 4. Categories that jumped against the previous month.
  const jumps = input.categories
    .filter(
      (c) =>
        c.previousCents > 0 &&
        c.currentCents >= c.previousCents * JUMP_RATIO &&
        c.currentCents - c.previousCents >= MIN_JUMP_CENTS
    )
    .sort((a, b) => b.currentCents - b.previousCents - (a.currentCents - a.previousCents));
  for (const category of jumps.slice(0, 2)) {
    const deltaCents = category.currentCents - category.previousCents;
    insights.push({
      id: `jump-${category.name}`,
      severity: 'warn',
      title: `${category.name} subiu ${pct(percent(deltaCents, category.previousCents))}`,
      detail: `Passou de ${formatAOA(category.previousCents)} no mês passado para ${formatAOA(category.currentCents)}.`,
      facts: {
        category: category.name,
        current_cents: category.currentCents,
        previous_cents: category.previousCents,
        delta_cents: deltaCents,
      },
    });
  }

  // 5. Fixed bills still to be charged this month.
  if (metrics.commitments_due_cents > 0) {
    const short = metrics.available_after_commitments_cents < 0;
    insights.push({
      id: 'commitments',
      severity: short ? 'risk' : 'info',
      title: short
        ? 'As contas fixas que faltam não cabem no que sobra'
        : 'Ainda faltam pagar contas fixas',
      detail: short
        ? `Faltam ${formatAOA(metrics.commitments_due_cents)} em contas fixas e só sobram ${formatAOA(metrics.net_cents)} do mês.`
        : `Faltam ${formatAOA(metrics.commitments_due_cents)} em ${input.commitments.length} conta(s) fixa(s) até ao fim do mês.`,
      facts: {
        commitments_due_cents: metrics.commitments_due_cents,
        count: input.commitments.length,
        net_cents: metrics.net_cents,
        next: input.commitments[0]?.name ?? '',
      },
    });
  }

  // 6. Goals that will not be met at the current pace.
  const atRisk = input.goals.filter((g) => g.status === 'em_risco');
  for (const goal of atRisk.slice(0, 1)) {
    insights.push({
      id: `goal-${goal.name}`,
      severity: 'warn',
      title: `${goal.name} está atrasado`,
      detail: goal.requiredMonthlyCents
        ? `Para chegares ao prazo precisas de pôr de lado ${formatAOA(goal.requiredMonthlyCents)} por mês.`
        : 'Ao ritmo actual não chegas ao prazo definido.',
      facts: {
        goal: goal.name,
        required_monthly_cents: goal.requiredMonthlyCents ?? 0,
      },
    });
  }

  // 7. Where the money is concentrated.
  const top = metrics.top_category;
  if (top && top.share_percent >= CONCENTRATION_SHARE) {
    insights.push({
      id: 'concentration',
      severity: 'info',
      title: `${top.name} levou ${pct(top.share_percent)} das despesas`,
      detail: `São ${formatAOA(top.amount_cents)} de ${formatAOA(metrics.expense_cents)} gastos no mês.`,
      facts: {
        category: top.name,
        amount_cents: top.amount_cents,
        share_percent: top.share_percent,
      },
    });
  }

  if (!insights.length) {
    return [
      {
        id: 'no-data',
        severity: 'info',
        title: 'Ainda não há movimentos neste mês',
        detail: 'Lança o salário e as despesas do mês para veres o resto.',
        facts: { year_month: input.yearMonth },
      },
    ];
  }

  return insights
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_INSIGHTS);
}
