import { useCallback, useEffect, useState } from 'react';

import { loadStringSet, saveStringSet, toggleStringSetEntry } from './storage';

/**
 * A `Record<string, true>` set mirrored to `localStorage` under `storageKey`.
 * Reloads whenever the key changes (e.g. when the active trainer switches).
 */
export function usePersistentStringSet(storageKey: string | null) {
  const [entries, setEntries] = useState<Record<string, true>>(() => loadStringSet(storageKey));

  useEffect(() => {
    setEntries(loadStringSet(storageKey));
  }, [storageKey]);

  const toggle = useCallback(
    (entry: string) => {
      setEntries((current) => {
        const next = toggleStringSetEntry(current, entry);
        saveStringSet(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return { entries, toggle };
}
