import type { ReactNode } from 'react';
import { render } from '@testing-library/preact';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';

import {
  ECheatType,
  PROTOCOL_VERSION,
  type CheatSchema,
  type GameStatusPayload,
  type IncomingMessage,
  type TrainerMetaPayload,
  type TrainerSummary,
} from '../../protocol/messages';

export function makeCheat(overrides: Partial<CheatSchema> = {}): CheatSchema {
  return {
    uuid: overrides.target ?? 'cheat',
    target: 'cheat',
    type: ECheatType.Toggle,
    name: 'Cheat',
    category: 'player',
    args: {},
    ...overrides,
  };
}

export function makeTrainer(overrides: Partial<TrainerSummary> = {}): TrainerSummary {
  return {
    trainerId: 'trainer',
    gameId: 'game',
    displayName: 'Test Trainer',
    trainerLoading: false,
    gameInstalled: true,
    needsCompatibilityWarning: false,
    isTimeLimitExpired: false,
    ...overrides,
  };
}

export function makeTrainerMeta(cheats: CheatSchema[], trainer: Partial<TrainerSummary> = {}): TrainerMetaPayload {
  return {
    session: { instanceId: 'session' },
    trainer: makeTrainer(trainer),
    schema: {
      categories: Array.from(new Set(cheats.map((cheat) => cheat.category))),
      cheats,
    },
  };
}

export function makeGameStatus(
  session: Partial<GameStatusPayload['session']> = {},
  trainer: Partial<GameStatusPayload['trainer']> = {},
): GameStatusPayload {
  return {
    instanceId: 'status',
    updatedAt: 'now',
    session: { state: 'idle', event: 'snapshot', ...session },
    trainer: { state: 'idle', event: 'snapshot', ...trainer },
  };
}

export function envelope<T extends IncomingMessage['type']>(
  type: T,
  payload: Extract<IncomingMessage, { type: T }>['payload'],
  requestId: string | null = null,
): Extract<IncomingMessage, { type: T }> {
  return { type, version: PROTOCOL_VERSION, requestId, payload } as Extract<IncomingMessage, { type: T }>;
}

i18n.load('en', {});
i18n.activate('en');

export const renderWithI18n = (ui: ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
