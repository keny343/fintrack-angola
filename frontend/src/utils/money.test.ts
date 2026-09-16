import { describe, expect, it } from 'vitest';
import { formatAOA, formatDateAO, parseAOAInput } from './money';

describe('formatAOA', () => {
  it('formats positive amounts', () => {
    const s = formatAOA(25000000);
    expect(s).toMatch(/250/);
  });
});

describe('parseAOAInput', () => {
  it('parses plain numbers as Kz', () => {
    expect(parseAOAInput('100')).toBe(10000);
  });
});

describe('formatDateAO', () => {
  it('formats ISO to dd/mm/yyyy', () => {
    expect(formatDateAO('2026-09-16')).toBe('16/09/2026');
  });
});
