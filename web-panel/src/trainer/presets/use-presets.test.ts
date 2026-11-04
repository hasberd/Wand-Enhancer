import { act, renderHook } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ECheatType } from '../../../protocol/messages';
import { makeCheat, makeTrainerMeta } from '../../testing/fixtures';
import { loadPresets } from './preset-storage';
import { usePresets } from './use-presets';

const meta = makeTrainerMeta([
  makeCheat({ target: 'god', type: ECheatType.Toggle }),
  makeCheat({ target: 'heal', type: ECheatType.Button }),
]);

describe('usePresets', () => {
  beforeEach(() => localStorage.clear());

  it('adds several presets in one tick without losing any', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => usePresets({ presetStorageKey: 'k', trainerMeta: meta, values: { god: true, heal: 1 }, onError }));

    act(() => {
      result.current.addPreset('One');
      result.current.addPreset('Two');
    });

    expect(result.current.presets.map((preset) => preset.name)).toEqual(['One', 'Two']);
    expect(result.current.presets[0].values).toEqual({ god: true });
    expect(loadPresets('k')).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('deletes presets and clears storage when empty', () => {
    const { result } = renderHook(() => usePresets({ presetStorageKey: 'k', trainerMeta: meta, values: { god: true }, onError: vi.fn() }));
    act(() => {
      result.current.addPreset('One');
    });
    const id = result.current.presets[0].id;
    act(() => result.current.deletePreset(id));
    expect(result.current.presets).toEqual([]);
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('reports why a preset cannot be saved', () => {
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      ({ trainerMeta, values }) => usePresets({ presetStorageKey: 'k', trainerMeta, values, onError }),
      { initialProps: { trainerMeta: null as typeof meta | null, values: {} as Record<string, unknown> } },
    );
    act(() => {
      expect(result.current.addPreset('x')).toBe(false);
    });
    expect(onError).toHaveBeenLastCalledWith('No active trainer to save as a preset.');

    rerender({ trainerMeta: meta, values: { heal: 1 } });
    act(() => {
      expect(result.current.addPreset('x')).toBe(false);
    });
    expect(onError).toHaveBeenLastCalledWith('There are no mod values to save yet.');
  });

  it('loads presets for the current storage key on first render', () => {
    localStorage.setItem('k', JSON.stringify([{ id: 'p', name: 'Saved', values: { god: true }, createdAt: 'x' }]));
    const { result } = renderHook(() => usePresets({ presetStorageKey: 'k', trainerMeta: meta, values: {}, onError: vi.fn() }));
    expect(result.current.presets.map((preset) => preset.name)).toEqual(['Saved']);
  });
});
