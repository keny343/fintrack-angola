import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  formatCentsForCsv,
  normaliseHeader,
  normaliseName,
  parseCsv,
  parseDateInput,
  parseTypeInput,
  toCsv,
} from './csv.js';

describe('detectDelimiter', () => {
  it('prefers the semicolon used by pt spreadsheets', () => {
    expect(detectDelimiter('data;tipo;categoria;valor')).toBe(';');
  });

  it('falls back to the comma for files exported elsewhere', () => {
    expect(detectDelimiter('date,type,category,amount')).toBe(',');
  });

  it('ignores separators inside quoted headers', () => {
    expect(detectDelimiter('"data, dia";tipo;valor')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('normalises the header and keeps original line numbers', () => {
    const parsed = parseCsv('Data;Tipo;Categoria;Valor (Kz)\n05/09/2026;Despesa;Energia;25000,00');
    expect(parsed.header).toEqual(['data', 'tipo', 'categoria', 'valor']);
    expect(parsed.rows).toEqual([
      { line: 2, values: ['05/09/2026', 'Despesa', 'Energia', '25000,00'] },
    ]);
  });

  it('handles a BOM, CRLF endings and blank lines', () => {
    const parsed = parseCsv('\uFEFFdata;valor\r\n05/09/2026;100,00\r\n\r\n06/09/2026;200,00\r\n');
    expect(parsed.header).toEqual(['data', 'valor']);
    expect(parsed.rows.map((r) => r.line)).toEqual([2, 4]);
  });

  it('keeps separators and quotes inside quoted fields', () => {
    const parsed = parseCsv('data;notas\n05/09/2026;"Renda; casa ""nova"""');
    expect(parsed.rows[0].values).toEqual(['05/09/2026', 'Renda; casa "nova"']);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsv('   \n\n')).toThrow(/vazio/i);
  });
});

describe('normalisation', () => {
  it('strips accents and units from header names', () => {
    expect(normaliseHeader('Valor (Kz)')).toBe('valor');
    expect(normaliseHeader(' Categoria ')).toBe('categoria');
    expect(normaliseHeader('Data do movimento')).toBe('data_do_movimento');
  });

  it('compares category names without accents or case', () => {
    expect(normaliseName('  EDUCAÇÃO / Propinas ')).toBe('educacao / propinas');
    expect(normaliseName('Água')).toBe(normaliseName('agua'));
  });
});

describe('parseDateInput', () => {
  it('accepts the Angolan format and the ISO format', () => {
    expect(parseDateInput('05/09/2026')).toBe('2026-09-05');
    expect(parseDateInput('5/9/2026')).toBe('2026-09-05');
    expect(parseDateInput('2026-09-05')).toBe('2026-09-05');
  });

  it('does not silently roll over an impossible date', () => {
    expect(() => parseDateInput('31/02/2026')).toThrow(/calendário/i);
  });

  it('rejects unrecognised text', () => {
    expect(() => parseDateInput('setembro')).toThrow(/dd\/mm\/aaaa/i);
  });
});

describe('parseTypeInput', () => {
  it('accepts Portuguese and English wording', () => {
    expect(parseTypeInput('Receita')).toBe('income');
    expect(parseTypeInput('saída')).toBe('expense');
    expect(parseTypeInput('expense')).toBe('expense');
  });

  it('rejects anything else', () => {
    expect(() => parseTypeInput('transferência')).toThrow(/receita/i);
  });
});

describe('formatCentsForCsv', () => {
  it('writes amounts with a decimal comma and no thousands separator', () => {
    expect(formatCentsForCsv(15_000_050)).toBe('150000,50');
    expect(formatCentsForCsv(5)).toBe('0,05');
    expect(formatCentsForCsv(100)).toBe('1,00');
  });
});

describe('toCsv', () => {
  it('quotes fields containing the delimiter and doubles inner quotes', () => {
    const csv = toCsv(['categoria', 'notas'], [['Energia', 'Renda; casa "nova"']], { bom: false });
    expect(csv).toBe('categoria;notas\r\nEnergia;"Renda; casa ""nova"""\r\n');
  });

  it('prefixes a BOM so Excel renders accents', () => {
    expect(toCsv(['categoria'], [['Habitação']])).toMatch(/^\uFEFF/);
  });
});
