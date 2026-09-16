import { describe, expect, it } from 'vitest';
import { formatAOA } from './money.js';
import type { Insight, InsightMetrics } from './insights.js';
import {
  allowedFigures,
  buildNarrationRequest,
  checkNarration,
  deterministicSummary,
  monthLabel,
  numbersIn,
} from './narration.js';

const metrics: InsightMetrics = {
  income_cents: 45_000_000,
  expense_cents: 24_500_050,
  net_cents: 20_499_950,
  saving_rate: 45.6,
  previous_expense_cents: 20_000_000,
  expense_change_percent: 22.5,
  commitments_due_cents: 5_000_000,
  available_after_commitments_cents: 15_499_950,
  top_category: { name: 'Habitação', amount_cents: 15_000_000, share_percent: 61.2 },
};

const insights: Insight[] = [
  {
    id: 'budget-over-Alimentação',
    severity: 'risk',
    title: 'Alimentação passou o orçamento',
    detail: 'Gastaste 95 000,50 Kz de um limite de 70 000,00 Kz — 25 000,50 Kz acima.',
    facts: {
      category: 'Alimentação',
      spent_cents: 9_500_050,
      limit_cents: 7_000_000,
      over_cents: 2_500_050,
    },
  },
  {
    id: 'saving-rate',
    severity: 'good',
    title: 'Guardaste 45,6% do que recebeste',
    detail: 'Sobraram 204 999,50 Kz de 450 000,00 Kz que entraram.',
    facts: { saving_rate: 45.6, net_cents: 20_499_950, income_cents: 45_000_000 },
  },
];

describe('numbersIn', () => {
  it('keeps a year whole instead of splitting it', () => {
    expect(numbersIn('setembro de 2026')).toEqual([2026]);
  });

  it('reads Portuguese thousands and decimals', () => {
    expect(numbersIn('204 999,50 Kz e 1.234.567,89 Kz')).toEqual([204999.5, 1234567.89]);
  });

  it('does not merge two numbers across a full stop', () => {
    expect(numbersIn('sobram 25 000,50. 3 contas fixas')).toEqual([25000.5, 3]);
  });

  it('reads the non-breaking space that Intl produces', () => {
    expect(numbersIn(formatAOA(20_499_950))).toEqual([204999.5]);
  });
});

describe('allowedFigures', () => {
  const allowed = allowedFigures('2026-09', metrics, insights);

  it('offers the month figures in kwanzas', () => {
    expect(allowed).toContain(450000);
    expect(allowed).toContain(245000.5);
    expect(allowed).toContain(204999.5);
  });

  it('offers percentages and the date', () => {
    expect(allowed).toContain(45.6);
    expect(allowed).toContain(61.2);
    expect(allowed).toContain(2026);
    expect(allowed).toContain(9);
  });

  it('offers the figures behind each insight', () => {
    expect(allowed).toContain(95000.5);
    expect(allowed).toContain(70000);
    expect(allowed).toContain(25000.5);
  });

  it('never offers a raw centavo value', () => {
    expect(allowed).not.toContain(20_499_950);
    expect(allowed).not.toContain(9_500_050);
  });
});

describe('checkNarration', () => {
  const allowed = allowedFigures('2026-09', metrics, insights);

  it('accepts an answer that only repeats the figures given', () => {
    const text =
      'Em setembro de 2026 sobraram 204 999,50 Kz, ou seja 45,6% do que recebeste. ' +
      'Só a Alimentação passou o orçamento em 25 000,50 Kz.';
    expect(checkNarration(text, allowed)).toEqual({ ok: true });
  });

  it('rejects an invented figure', () => {
    const text = 'Vais poupar 300 000,00 Kz até dezembro.';
    expect(checkNarration(text, allowed)).toEqual({ ok: false, offending: [300000] });
  });

  it('rejects a rounded figure, because it is a different number', () => {
    expect(checkNarration('Sobraram cerca de 205 000,00 Kz.', allowed)).toEqual({
      ok: false,
      offending: [205000],
    });
  });

  it('rejects arithmetic the model did on its own', () => {
    // 450 000 - 245 000,50 is right, but it is not a figure that was handed over.
    expect(checkNarration('Ficaram 204 999,00 Kz de margem.', allowed).ok).toBe(false);
  });

  it('accepts an answer with no figures at all', () => {
    expect(checkNarration('O mês fechou melhor do que o anterior.', allowed)).toEqual({ ok: true });
  });

  it('does not care whether the space is a normal one or not', () => {
    const normal = 'Sobraram 204 999,50 Kz.';
    const nonBreaking = 'Sobraram 204\u00A0999,50 Kz.';
    expect(checkNarration(normal, allowed).ok).toBe(true);
    expect(checkNarration(nonBreaking, allowed).ok).toBe(true);
  });
});

describe('buildNarrationRequest', () => {
  it('hands over the insight sentences and forbids new numbers', () => {
    const req = buildNarrationRequest('2026-09', metrics, insights);
    expect(req.user).toContain('setembro de 2026');
    expect(req.user).toContain('Alimentação passou o orçamento');
    expect(req.system).toMatch(/não inventes/i);
    expect(req.allowed).toContain(204999.5);
  });

  it('carries no note, account name or e-mail into the prompt', () => {
    const req = buildNarrationRequest('2026-09', metrics, insights);
    expect(req.user).not.toMatch(/@/);
    expect(req.user.toLowerCase()).not.toContain('numerário');
  });
});

describe('deterministicSummary', () => {
  it('describes a month that closed in the black and names the worst problem', () => {
    const text = deterministicSummary('2026-09', metrics, insights);
    expect(text).toContain('setembro de 2026');
    expect(text).toContain(formatAOA(20_499_950));
    expect(text).toContain('Alimentação');
  });

  it('says a deficit out loud', () => {
    const deficit: InsightMetrics = {
      ...metrics,
      income_cents: 10_000_000,
      net_cents: -14_500_050,
      saving_rate: -145,
    };
    const text = deterministicSummary('2026-09', deficit, insights);
    expect(text).toContain('défice');
    expect(text).toContain(formatAOA(14_500_050));
  });

  it('invites the first entry when the month is empty', () => {
    const empty: Insight[] = [
      { id: 'no-data', severity: 'info', title: 'Ainda não há movimentos', detail: '', facts: {} },
    ];
    const zero: InsightMetrics = {
      income_cents: 0,
      expense_cents: 0,
      net_cents: 0,
      saving_rate: null,
      previous_expense_cents: 0,
      expense_change_percent: null,
      commitments_due_cents: 0,
      available_after_commitments_cents: 0,
      top_category: null,
    };
    expect(deterministicSummary('2026-09', zero, empty)).toContain('Ainda não há movimentos');
  });

  it('only states figures that the check would accept', () => {
    const text = deterministicSummary('2026-09', metrics, insights);
    expect(checkNarration(text, allowedFigures('2026-09', metrics, insights))).toEqual({ ok: true });
  });
});

describe('monthLabel', () => {
  it('writes the month in Portuguese', () => {
    expect(monthLabel('2026-01')).toBe('janeiro de 2026');
    expect(monthLabel('2026-12')).toBe('dezembro de 2026');
  });
});
