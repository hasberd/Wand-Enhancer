import { describe, expect, it } from 'vitest';

import { ECheatType } from '../../../protocol/messages';
import { makeCheat } from '../../testing/fixtures';
import { INVALID_CHEAT_VALUE, normalizeCheatValue, resolveOption, stripNumberGrouping } from './values';

describe('normalizeCheatValue', () => {
  const number = makeCheat({ type: ECheatType.Number, args: { min: -10, max: 1000 } });
  const slider = makeCheat({ type: ECheatType.Slider, args: { min: 0, max: 5 } });

  it('coerces toggles to booleans', () => {
    const toggle = makeCheat({ type: ECheatType.Toggle });
    expect(normalizeCheatValue(toggle, 1)).toBe(true);
    expect(normalizeCheatValue(toggle, '')).toBe(false);
  });

  it('parses grouped numeric strings', () => {
    expect(normalizeCheatValue(number, '1,000')).toBe(1000);
    expect(normalizeCheatValue(number, ' 12 ')).toBe(12);
    expect(normalizeCheatValue(number, '-3.5')).toBe(-3.5);
  });

  it('rejects partial or non-numeric input instead of sending NaN', () => {
    for (const input of ['', ' ', '-', 'abc', '1e', Number.NaN, Number.POSITIVE_INFINITY, null, undefined, {}]) {
      expect(normalizeCheatValue(number, input)).toBe(INVALID_CHEAT_VALUE);
    }
  });

  it('clamps numeric values to the cheat range', () => {
    expect(normalizeCheatValue(number, '5000')).toBe(1000);
    expect(normalizeCheatValue(number, -50)).toBe(-10);
    expect(normalizeCheatValue(slider, 7)).toBe(5);
    expect(normalizeCheatValue(makeCheat({ type: ECheatType.Number }), 1e9)).toBe(1e9);
  });

  it('passes other cheat types through untouched', () => {
    const selection = makeCheat({ type: ECheatType.Selection });
    expect(normalizeCheatValue(selection, 'hard')).toBe('hard');
    expect(normalizeCheatValue(makeCheat({ type: ECheatType.Button }), undefined)).toBeUndefined();
  });
});

describe('resolveOption', () => {
  it('normalizes primitive and object options', () => {
    expect(resolveOption('easy')).toEqual({ label: 'easy', value: 'easy' });
    expect(resolveOption(3)).toEqual({ label: '3', value: 3 });
    expect(resolveOption({ value: 4 })).toEqual({ label: '4', value: 4 });
    expect(resolveOption({ label: 'Hard', value: 'h' })).toEqual({ label: 'Hard', value: 'h' });
  });
});

describe('stripNumberGrouping', () => {
  it('removes commas and whitespace', () => {
    expect(stripNumberGrouping('1, 234 567')).toBe('1234567');
  });
});
