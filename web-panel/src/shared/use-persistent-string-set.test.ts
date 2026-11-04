import { act, renderHook } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePersistentStringSet } from './use-persistent-string-set';

describe('usePersistentStringSet', () => {
  beforeEach(() => localStorage.clear());

  it('loads synchronously on first render and persists toggles', () => {
    localStorage.setItem('pins', JSON.stringify(['a']));
    const { result } = renderHook(() => usePersistentStringSet('pins'));
    expect(result.current.entries).toEqual({ a: true });

    act(() => result.current.toggle('b'));
    expect(result.current.entries).toEqual({ a: true, b: true });
    expect(JSON.parse(localStorage.getItem('pins') ?? '[]')).toEqual(['a', 'b']);

    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.entries).toEqual({});
    expect(localStorage.getItem('pins')).toBeNull();
  });

  it('applies rapid consecutive toggles against the latest state', () => {
    const { result } = renderHook(() => usePersistentStringSet('pins'));
    act(() => {
      result.current.toggle('a');
      result.current.toggle('b');
    });
    expect(result.current.entries).toEqual({ a: true, b: true });
  });

  it('reloads when the storage key changes', () => {
    localStorage.setItem('one', JSON.stringify(['x']));
    localStorage.setItem('two', JSON.stringify(['y']));
    const { result, rerender } = renderHook(({ key }) => usePersistentStringSet(key), { initialProps: { key: 'one' } });
    expect(result.current.entries).toEqual({ x: true });

    rerender({ key: 'two' });
    expect(result.current.entries).toEqual({ y: true });
  });
});
