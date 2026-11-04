import { useCallback } from 'react';

import type { CheatSchema } from '../../../protocol/messages';
import { usePersistentStringSet } from '../../shared/use-persistent-string-set';

type PinnedTargetsParams = {
  pinnedStorageKey: string | null;
};

export function usePinnedCheats({ pinnedStorageKey }: PinnedTargetsParams) {
  const { entries: pinnedTargets, toggle: toggleTarget } = usePersistentStringSet(pinnedStorageKey);
  const toggle = useCallback((cheat: CheatSchema) => toggleTarget(cheat.target), [toggleTarget]);

  return { pinnedTargets, toggle };
}
