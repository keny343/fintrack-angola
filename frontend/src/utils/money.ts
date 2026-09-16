export function formatAOA(amountCents: number): string {
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Kz`;
  }
}

/**
 * Percentages the pt way: 18,7% and not 18.7%. Sitting next to amounts that are
 * already written with a comma, a dot reads as a different number entirely.
 */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`;
}

/** Parse user input like "150000" or "1.500,00" to centavos. */
export function parseAOAInput(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/\s/g, '')
    .replace(/Kz|AOA/gi, '');
  if (!cleaned) throw new Error('Valor vazio');
  // If has comma as decimal separator (pt)
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const n = Number(normalized);
  if (Number.isNaN(n) || n <= 0) throw new Error('Valor inválido');
  return Math.round(n * 100);
}

export function formatDateAO(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
