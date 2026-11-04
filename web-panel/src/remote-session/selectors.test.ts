import { describe, expect, it } from 'vitest';

import { makeGameStatus, makeTrainer } from '../testing/fixtures';
import { createInitialRemoteSessionState, EConnectionStatus } from './remote-session.reducer';
import { selectActiveGameRef, selectIsConnected, selectPendingTargets } from './selectors';

describe('remote session selectors', () => {
  it('derives connection and pending targets', () => {
    const state = {
      ...createInitialRemoteSessionState(),
      connectionStatus: EConnectionStatus.Connected,
      pendingWrites: { speed: { requestId: 'r', value: 1, previousConfirmedValue: 0 } },
    };
    expect(selectIsConnected(state)).toBe(true);
    expect(selectIsConnected({ ...state, connectionStatus: EConnectionStatus.Reconnecting })).toBe(false);
    expect(selectPendingTargets(state)).toEqual({ speed: true });
  });

  it('resolves the active game with session > trainer status > attached trainer precedence', () => {
    const trainer = makeTrainer({ gameId: 'from-trainer', titleId: 'title-trainer' });
    expect(selectActiveGameRef(null, null)).toEqual({ gameId: null, titleId: null });
    expect(selectActiveGameRef(null, trainer)).toEqual({ gameId: 'from-trainer', titleId: 'title-trainer' });
    expect(selectActiveGameRef(makeGameStatus({}, { gameId: 'from-status' }), trainer).gameId).toBe('from-status');
    expect(selectActiveGameRef(makeGameStatus({ gameId: 'from-session', titleId: 't' }, { gameId: 'from-status' }), trainer))
      .toEqual({ gameId: 'from-session', titleId: 't' });
  });
});
