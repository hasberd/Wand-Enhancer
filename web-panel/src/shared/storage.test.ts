import { beforeEach, describe, expect, it } from 'vitest';

import { makeTrainer } from '../testing/fixtures';
import { getTrainerStorageId, loadJson, loadStringSet, saveJson, saveStringSet, toggleStringSetEntry } from './storage';

describe('storage revival', () => {
  beforeEach(() => localStorage.clear());

  it('revives only valid string ids', () => {
    localStorage.setItem('pins', JSON.stringify(['one', '', 2, 'two']));
    expect(loadStringSet('pins')).toEqual({ one: true, two: true });
  });

  it('removes empty sets', () => {
    saveStringSet('pins', { one: true });
    expect(localStorage.getItem('pins')).toBe(JSON.stringify(['one']));
    saveStringSet('pins', {});
    expect(localStorage.getItem('pins')).toBeNull();
  });

  it('falls back on corrupt JSON, non-array payloads and a null key', () => {
    localStorage.setItem('broken', '{not json');
    localStorage.setItem('object', JSON.stringify({ one: true }));
    expect(loadStringSet('broken')).toEqual({});
    expect(loadStringSet('object')).toEqual({});
    expect(loadStringSet(null)).toEqual({});
    expect(loadJson('missing', () => 'revived', 'fallback')).toBe('fallback');
  });

  it('uses the fallback when the reviver rejects the payload', () => {
    localStorage.setItem('value', JSON.stringify(42));
    expect(loadJson<string>('value', (raw) => (typeof raw === 'string' ? raw : null), 'fallback')).toBe('fallback');
  });

  it('ignores writes without a key', () => {
    saveJson(null, ['x'], () => false);
    expect(localStorage.length).toBe(0);
  });
});

describe('toggleStringSetEntry', () => {
  it('toggles an entry without mutating the input set', () => {
    const current = {};
    const next = toggleStringSetEntry(current, 'game-one');
    expect(next).toEqual({ 'game-one': true });
    expect(current).toEqual({});
    expect(toggleStringSetEntry(next, 'game-one')).toEqual({});
  });
});

describe('getTrainerStorageId', () => {
  it('prefers gameId, then titleId, then trainerId and trims blanks', () => {
    expect(getTrainerStorageId(makeTrainer({ gameId: ' g ', titleId: 't', trainerId: 'tr' }))).toBe('g');
    expect(getTrainerStorageId(makeTrainer({ gameId: '  ', titleId: 't', trainerId: 'tr' }))).toBe('t');
    expect(getTrainerStorageId(makeTrainer({ gameId: undefined, titleId: undefined, trainerId: 'tr' }))).toBe('tr');
    expect(getTrainerStorageId(null)).toBeNull();
  });
});
