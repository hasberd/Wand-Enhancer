import { beforeEach, describe, expect, it } from 'vitest';

import { applySavedAccentColor, DEFAULT_ACCENT_COLOR, loadAccentColor, setAccentColor } from './appearance-storage';

const KEY = 'wand-remote.accent-color.v1';

describe('accent color storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--deck-accent');
  });

  it('normalizes, applies and persists a custom color', () => {
    expect(setAccentColor('  #AABBCC ')).toBe('#aabbcc');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('#aabbcc'));
    expect(document.documentElement.style.getPropertyValue('--deck-accent')).toBe('#aabbcc');
    expect(loadAccentColor()).toBe('#aabbcc');
  });

  it('falls back to the default for invalid input and does not persist the default', () => {
    expect(setAccentColor('red')).toBe(DEFAULT_ACCENT_COLOR);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores a corrupt stored color', () => {
    localStorage.setItem(KEY, JSON.stringify('#12'));
    expect(applySavedAccentColor()).toBe(DEFAULT_ACCENT_COLOR);
  });
});
