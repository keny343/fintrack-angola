/**
 * Narration of the monthly insights.
 *
 * A language model is allowed to choose the words, never the figures. The
 * numbers come from `insights.ts`, which reads them from the database, and this
 * module builds the prompt, lists the figures the model may repeat, and checks
 * the answer against that list. A model that writes a number nobody computed
 * has its answer thrown away in favour of the deterministic summary below, so
 * the feature can only ever fail towards being boring, never towards lying.
 */

import { formatAOA } from './money.js';
import type { Insight, InsightMetrics } from './insights.js';

export type NarrationRequest = {
  system: string;
  user: string;
  /** Every value the answer is allowed to contain, already in kwanzas. */
  allowed: number[];
};

export type NarrationCheck = { ok: true } | { ok: false; offending: number[] };

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const name = MONTHS[month - 1];
  return name ? `${name} de ${year}` : yearMonth;
}

/**
 * Numbers written in Portuguese: thousands split by space, dot or non-breaking
 * space, decimals after a comma. A year like 2026 must stay whole, so the first
 * run of digits is greedy.
 */
const NUMBER_PATTERN = /\d+(?:[\u00A0\u202F .]\d{3})*(?:,\d+)?/g;

/** Turns "204 999,50" into 204999.5 so formatting differences stop mattering. */
function toNumber(token: string): number {
  return Number(token.replace(/[\u00A0\u202F .]/g, '').replace(',', '.'));
}

export function numbersIn(text: string): number[] {
  return (text.match(NUMBER_PATTERN) ?? []).map(toNumber).filter((n) => Number.isFinite(n));
}

/**
 * The figures a narration may repeat: the month's own numbers in kwanzas, the
 * percentages, the counts, and the date itself. Centavos are deliberately left
 * out — nobody should be reading 20499950 out loud.
 */
export function allowedFigures(
  yearMonth: string,
  metrics: InsightMetrics,
  insights: Insight[]
): number[] {
  const values = new Set<number>();
  const [year, month] = yearMonth.split('-').map(Number);
  values.add(year);
  values.add(month);

  const addCents = (cents: number) => {
    values.add(Math.abs(cents) / 100);
  };

  addCents(metrics.income_cents);
  addCents(metrics.expense_cents);
  addCents(metrics.net_cents);
  addCents(metrics.previous_expense_cents);
  addCents(metrics.commitments_due_cents);
  addCents(metrics.available_after_commitments_cents);
  if (metrics.saving_rate !== null) values.add(Math.abs(metrics.saving_rate));
  if (metrics.expense_change_percent !== null) values.add(Math.abs(metrics.expense_change_percent));
  if (metrics.top_category) {
    addCents(metrics.top_category.amount_cents);
    values.add(metrics.top_category.share_percent);
  }

  // Each insight carries the figures behind its own sentence.
  for (const insight of insights) {
    for (const [key, fact] of Object.entries(insight.facts)) {
      if (typeof fact !== 'number') continue;
      if (key.endsWith('_cents')) addCents(fact);
      else values.add(Math.abs(fact));
    }
  }

  return [...values].sort((a, b) => a - b);
}

/** Rejects an answer that contains a figure nobody computed. */
export function checkNarration(text: string, allowed: number[]): NarrationCheck {
  const permitted = new Set(allowed);
  const offending = numbersIn(text).filter((n) => !permitted.has(n));
  return offending.length ? { ok: false, offending } : { ok: true };
}

export function buildNarrationRequest(
  yearMonth: string,
  metrics: InsightMetrics,
  insights: Insight[]
): NarrationRequest {
  const facts = insights.map((i) => `- ${i.title}: ${i.detail}`).join('\n');
  const totals = [
    `Receitas: ${formatAOA(metrics.income_cents)}`,
    `Despesas: ${formatAOA(metrics.expense_cents)}`,
    `Sobra do mês: ${formatAOA(metrics.net_cents)}`,
  ].join('\n');

  return {
    system: [
      'És um assistente financeiro angolano. Escreves em português de Angola,',
      'tratas o leitor por tu e falas de dinheiro em Kwanzas (Kz).',
      'Escreve no máximo três frases curtas, num só parágrafo, sem listas.',
      'Usa apenas os números que te são dados, copiados exactamente como estão:',
      'não somes, não arredondes, não estimes e não inventes nenhum valor novo.',
      'Se faltar informação, escreve menos em vez de preencher com suposições.',
      'Não dês conselhos de investimento nem prometas resultados.',
    ].join(' '),
    user: [
      `Mês: ${monthLabel(yearMonth)}`,
      '',
      totals,
      '',
      'Observações já calculadas:',
      facts,
      '',
      'Resume o mês para o leitor com base apenas nisto.',
    ].join('\n'),
    allowed: allowedFigures(yearMonth, metrics, insights),
  };
}

/**
 * The summary used when there is no model configured, when the call fails, or
 * when the answer did not survive the check. Built from the same sentences the
 * dashboard already shows, so it is always true by construction.
 */
export function deterministicSummary(
  yearMonth: string,
  metrics: InsightMetrics,
  insights: Insight[]
): string {
  const label = monthLabel(yearMonth);
  if (insights.length === 1 && insights[0].id === 'no-data') {
    return `Ainda não há movimentos em ${label}. Lança o salário e as despesas para ver o resumo.`;
  }

  const sentences = [
    metrics.net_cents >= 0
      ? `Em ${label} entraram ${formatAOA(metrics.income_cents)} e saíram ${formatAOA(metrics.expense_cents)}, sobrando ${formatAOA(metrics.net_cents)}.`
      : `Em ${label} saíram ${formatAOA(metrics.expense_cents)} contra ${formatAOA(metrics.income_cents)} de entradas, um défice de ${formatAOA(Math.abs(metrics.net_cents))}.`,
  ];

  // The most serious observation carries the rest of the paragraph. Insights
  // arrive sorted by severity, so the first one is the one worth repeating. The
  // title comes along because it is what names the subject — the detail alone
  // would say a budget was broken without saying which one.
  const worst = insights.find((i) => i.severity === 'risk' || i.severity === 'warn');
  if (worst) sentences.push(worst.detail ? `${worst.title}: ${worst.detail}` : `${worst.title}.`);
  if (metrics.commitments_due_cents > 0 && worst?.id !== 'commitments') {
    sentences.push(`Faltam ainda ${formatAOA(metrics.commitments_due_cents)} em contas fixas.`);
  }

  return sentences.join(' ');
}
