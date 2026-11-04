import { describe, expect, it } from 'vitest';

import { formatInputNumber, formatNumber, numericValue } from './format-number';

describe('number formatting', () => {
  it('formats by step precision', () => {
    expect(formatNumber(2.6, 1)).toBe('3');
    expect(formatNumber(2.345, 0.01)).toBe('2.35');
    expect(formatNumber(2, 0.5)).toBe('2.0');
  });

  it('groups input numbers and keeps non-numeric text visible', () => {
    expect(formatInputNumber(1234567.5)).toBe('1,234,567.5');
    expect(formatInputNumber('9999')).toBe('9,999');
    expect(formatInputNumber('')).toBe('');
    expect(formatInputNumber(null)).toBe('');
    expect(formatInputNumber('abc')).toBe('abc');
  });

  it('reads numeric values with a fallback', () => {
    expect(numericValue(5, 0)).toBe(5);
    expect(numericValue('1,000', 0)).toBe(1000);
    expect(numericValue('x', 7)).toBe(7);
    expect(numericValue(Number.NaN, 7)).toBe(7);
    expect(numericValue(true, 7)).toBe(7);
  });
});
