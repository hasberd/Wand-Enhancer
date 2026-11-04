import { useCallback, useEffect, useState } from 'react';

import type { TrainerMetaPayload } from '../../../protocol/messages';
import { capturePresetValues, createPreset, loadPresets, savePresets, type RemotePreset } from './preset-storage';

type PresetsParams = {
  presetStorageKey: string;
  trainerMeta: TrainerMetaPayload | null;
  values: Record<string, unknown>;
  onError: (message: string) => void;
};

export function usePresets({ presetStorageKey, trainerMeta, values, onError }: PresetsParams) {
  const [presets, setPresets] = useState<RemotePreset[]>(() => loadPresets(presetStorageKey));

  useEffect(() => {
    setPresets(loadPresets(presetStorageKey));
  }, [presetStorageKey]);

  const addPreset = useCallback(
    (name: string): boolean => {
      if (!trainerMeta) {
        onError('No active trainer to save as a preset.');
        return false;
      }

      const captured = capturePresetValues(trainerMeta.schema.cheats, values);
      if (Object.keys(captured).length === 0) {
        onError('There are no mod values to save yet.');
        return false;
      }

      const preset = createPreset(name, captured);
      setPresets((current) => {
        const next = [...current, preset];
        savePresets(presetStorageKey, next);
        return next;
      });
      return true;
    },
    [onError, presetStorageKey, trainerMeta, values],
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      setPresets((current) => {
        const next = current.filter((preset) => preset.id !== presetId);
        savePresets(presetStorageKey, next);
        return next;
      });
    },
    [presetStorageKey],
  );

  return { presets, addPreset, deletePreset };
}
