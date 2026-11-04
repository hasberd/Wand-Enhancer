import { useCallback } from 'react';

import { usePersistentStringSet } from '../../shared/use-persistent-string-set';
import type { LibraryGame } from '../model/games';
import { PINNED_GAMES_STORAGE_KEY } from './game-pin-storage';

export function useGamePins() {
  const { entries: pinnedGameIds, toggle } = usePersistentStringSet(PINNED_GAMES_STORAGE_KEY);
  const togglePin = useCallback((game: LibraryGame) => toggle(game.id), [toggle]);

  return { pinnedGameIds, togglePin };
}
