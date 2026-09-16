/** Money helpers — amounts stored as integer centavos (1 Kz = 100 centavos). */

export function assertPositiveCents(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('O valor deve ser um inteiro positivo em centavos.');
  }
}

export function formatAOA(amountCents: number): string {
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz`;
  }
}

export function parseAOAToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }
  const cleaned = String(input)
    .replace(/\s/g, '')
    .replace(/Kz|AOA/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new Error('Valor monetário inválido.');
  return Math.round(n * 100);
}

export type TxType = 'income' | 'expense';

export function budgetProgress(limitCents: number, spentCents: number): {
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
} {
  const limit = Math.max(0, limitCents);
  const spent = Math.max(0, spentCents);
  const remaining = Math.max(0, limit - spent);
  const percentUsed = limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 1000) / 10);
  return { limitCents: limit, spentCents: spent, remainingCents: remaining, percentUsed };
}

export function periodTotals(
  rows: Array<{ type: TxType; amount_cents: number }>
): { incomeCents: number; expenseCents: number; netCents: number } {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const r of rows) {
    if (r.type === 'income') incomeCents += r.amount_cents;
    else expenseCents += r.amount_cents;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export function categoryMatchesType(
  categoryKind: 'income' | 'expense' | 'both',
  txType: TxType
): boolean {
  if (categoryKind === 'both') return true;
  return categoryKind === txType;
}
