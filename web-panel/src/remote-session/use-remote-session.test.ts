import { act, renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ECheatType, PROTOCOL_VERSION, type TrainerMetaPayload } from '../../protocol/messages';
import { FakeWebSocket } from '../testing/fake-websocket';
import { envelope, makeCheat, makeTrainerMeta } from '../testing/fixtures';
import { EConnectionStatus } from './remote-session.reducer';
import { useRemoteSession } from './use-remote-session';

const localizeMock = vi.hoisted(() => vi.fn());
vi.mock('./remote-session.i18n', () => ({ localizeTrainerMeta: localizeMock }));

const speed = makeCheat({ target: 'speed', type: ECheatType.Number, args: { min: 0, max: 10 } });
const god = makeCheat({ target: 'god', type: ECheatType.Toggle });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function connectedSession() {
  const hook = renderHook(() => useRemoteSession());
  const socket = FakeWebSocket.latest();
  act(() => {
    socket.open();
    socket.receive(envelope('hello_ack', { sessionId: 's', accepted: true, serverVersion: 'test', protocolVersion: PROTOCOL_VERSION }));
  });
  return { ...hook, socket };
}

async function receiveTrainer(socket: FakeWebSocket, meta: TrainerMetaPayload) {
  act(() => socket.receive(envelope('trainer_meta', meta)));
  await flush();
}

describe('useRemoteSession', () => {
  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    localizeMock.mockReset();
    localizeMock.mockImplementation(async (payload: TrainerMetaPayload) => payload);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('auto-connects on mount and becomes connected after hello_ack', () => {
    const { result } = connectedSession();
    expect(FakeWebSocket.latest().url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\//);
    expect(result.current.state.connectionStatus).toBe(EConnectionStatus.Connected);
    expect(result.current.connected).toBe(true);
  });

  it('sends normalized writes and tracks them as pending', async () => {
    const { result, socket } = connectedSession();
    await receiveTrainer(socket, makeTrainerMeta([speed, god]));

    let accepted = false;
    act(() => {
      accepted = result.current.changeCheat(speed, '25');
    });
    expect(accepted).toBe(true);
    expect(socket.sent.at(-1)).toMatchObject({ type: 'set_value', payload: { target: 'speed', value: 10 } });
    expect(result.current.pendingTargets).toEqual({ speed: true });
  });

  it('does not send partial numeric input while the user is typing', async () => {
    const { result, socket } = connectedSession();
    await receiveTrainer(socket, makeTrainerMeta([speed]));
    const sentBefore = socket.sent.length;

    for (const partial of ['', '-', 'abc']) {
      act(() => {
        expect(result.current.changeCheat(speed, partial)).toBe(false);
      });
    }
    expect(socket.sent).toHaveLength(sentBefore);
    expect(result.current.state.lastError).toBeNull();
  });

  it('rejects writes before a trainer is attached', () => {
    const { result } = connectedSession();
    act(() => {
      expect(result.current.changeCheat(god, true)).toBe(false);
    });
    expect(result.current.state.lastError).toBe('The bridge socket is not connected.');
  });

  it('drops a late localization result after disconnect', async () => {
    const pending = deferred<TrainerMetaPayload>();
    localizeMock.mockReturnValueOnce(pending.promise);
    const { result, socket } = connectedSession();
    const meta = makeTrainerMeta([god]);

    act(() => socket.receive(envelope('trainer_meta', meta)));
    act(() => result.current.disconnect());
    pending.resolve(meta);
    await flush();

    expect(result.current.state.trainerMeta).toBeNull();
    expect(result.current.state.connectionStatus).toBe(EConnectionStatus.Idle);
  });

  it('keeps the newest trainer when localization resolves out of order', async () => {
    const first = deferred<TrainerMetaPayload>();
    const second = deferred<TrainerMetaPayload>();
    localizeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, socket } = connectedSession();
    const oldMeta = makeTrainerMeta([god], { trainerId: 'old' });
    const newMeta = makeTrainerMeta([god], { trainerId: 'new' });

    act(() => {
      socket.receive(envelope('trainer_meta', oldMeta));
      socket.receive(envelope('trainer_meta', newMeta));
    });
    second.resolve(newMeta);
    await flush();
    first.resolve(oldMeta);
    await flush();

    expect(result.current.state.trainerMeta?.trainer.trainerId).toBe('new');
  });

  it('drops a late localization result after a trainer switch', async () => {
    const pending = deferred<TrainerMetaPayload>();
    localizeMock.mockReturnValueOnce(pending.promise);
    const { result, socket } = connectedSession();
    const meta = makeTrainerMeta([god]);

    act(() => {
      socket.receive(envelope('trainer_meta', meta));
      socket.receive(envelope('trainer_changed', { trainerId: 'trainer' }));
    });
    pending.resolve(meta);
    await flush();

    expect(result.current.state.trainerMeta).toBeNull();
  });

  it('reconnects after an unexpected close', () => {
    vi.useFakeTimers();
    const { result, socket } = connectedSession();

    act(() => socket.dropConnection());
    expect(result.current.state.connectionStatus).toBe(EConnectionStatus.Reconnecting);
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(result.current.state.connectionStatus).toBe(EConnectionStatus.Reconnecting);
  });

  it('sends launch/stop commands for the active game', () => {
    const { result, socket } = connectedSession();
    act(() => {
      socket.receive(envelope('game_status', {
        instanceId: 'i',
        updatedAt: 'now',
        session: { state: 'running', event: 'game-launched', gameId: 'g1', titleId: 't1' },
        trainer: { state: 'idle', event: 'snapshot' },
      }));
    });
    act(() => result.current.stopPlaying());
    expect(socket.sent.at(-1)).toMatchObject({ type: 'remote_command', payload: { action: 'stop', gameId: 'g1', titleId: 't1' } });

    act(() => {
      expect(result.current.launchGame({
        platform: 'steam', sku: '1', correlationId: 'steam:1', displayName: 'X', location: '', alternateLocations: [],
      })).toBe(false);
    });
    expect(result.current.state.lastError).toBe('This My Games entry does not expose a Wand game id.');
  });
});
