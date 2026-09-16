import { describe, expect, it } from 'vitest';
import { formatAOA, formatDateAO, formatPercent, parseAOAInput } from './money';

describe('formatAOA', () => {
  it('formats positive amounts', () => {
    const s = formatAOA(25000000);
    expect(s).toMatch(/250/);
  });
});

describe('formatPercent', () => {
  it('writes the decimal with a comma, like the amounts beside it', () => {
    expect(formatPercent(18.7)).toBe('18,7%');
  });

  it('leaves a whole percentage whole', () => {
    expect(formatPercent(90)).toBe('90%');
  });

  it('does not stretch to more than one decimal', () => {
    expect(formatPercent(93.849)).toBe('93,8%');
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
