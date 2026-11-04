import type { GameStatusPayload, TrainerSummary } from '../../protocol/messages';
import { EConnectionStatus, type RemoteSessionState } from './remote-session.reducer';

export type ActiveGameRef = {
  gameId: string | null;
  titleId: string | null;
};

export function selectIsConnected(state: RemoteSessionState): boolean {
  return state.connectionStatus === EConnectionStatus.Connected;
}

export function selectPendingTargets(state: RemoteSessionState): Record<string, boolean> {
  return Object.fromEntries(Object.keys(state.pendingWrites).map((target) => [target, true]));
}

/**
 * Single source of truth for "which game is active": the live game session wins,
 * then the running-trainer status, then the trainer the panel is attached to.
 */
export function selectActiveGameRef(
  status: GameStatusPayload | null,
  trainer: TrainerSummary | null = null,
): ActiveGameRef {
  return {
    gameId: status?.session.gameId ?? status?.trainer.gameId ?? trainer?.gameId ?? null,
    titleId: status?.session.titleId ?? status?.trainer.titleId ?? trainer?.titleId ?? null,
  };
}
