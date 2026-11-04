import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type HelloAckMessage } from '../../protocol/messages';
import { envelope } from '../testing/fixtures';
import { protocolAction } from './remote-session.protocol';
import {
  createInitialRemoteSessionState,
  EConnectionStatus,
  remoteSessionReducer,
  type RemoteSessionState,
} from './remote-session.reducer';

describe('remote session protocol', () => {
  it('connects only after an accepted compatible hello acknowledgement', () => {
    const action = protocolAction(helloAck(PROTOCOL_VERSION));
    expect(action).toEqual({ type: 'connected' });
  });

  it('rejects a protocol version mismatch', () => {
    const action = protocolAction(helloAck(PROTOCOL_VERSION + 1));
    expect(action).toEqual({
      type: 'error',
      message: `Protocol mismatch: bridge=${PROTOCOL_VERSION + 1}, panel=${PROTOCOL_VERSION}.`,
    });
  });
});

describe('remote session reducer', () => {
  it('enters reconnecting state after an unexpected close', () => {
    const state = { ...initialState(), connectionStatus: EConnectionStatus.Connected };
    const next = remoteSessionReducer(state, { type: 'connectionClosed', message: 'closed' });

    expect(next.connectionStatus).toBe(EConnectionStatus.Reconnecting);
    expect(next.lastError).toBe('closed');
  });

  it('applies snapshots and clears trainer data on trainer switch', () => {
    let state = remoteSessionReducer(initialState(), { type: 'trainerValues', payload: { speed: 2 } });
    state = remoteSessionReducer(state, { type: 'valueChanged', target: 'speed', value: 3 });
    expect(state.values.speed).toBe(3);

    state = remoteSessionReducer(state, { type: 'trainerChanged' });
    expect(state.values).toEqual({});
    expect(state.pendingWrites).toEqual({});
  });

  it('keeps a write pending until result and commits a successful result', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'new' });
    expect(state.values.speed).toBe(2);
    expect(state.pendingWrites.speed?.requestId).toBe('new');

    state = remoteSessionReducer(state, { type: 'writeResult', target: 'speed', requestId: 'new', ok: true });
    expect(state.confirmedValues.speed).toBe(2);
    expect(state.pendingWrites.speed).toBeUndefined();
  });

  it('clears a write after a matching value delta', () => {
    let state = withConfirmedValue(false);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: true, requestId: 'new' });
    state = remoteSessionReducer(state, { type: 'valueChanged', target: 'speed', value: true });

    expect(state.pendingWrites.speed).toBeUndefined();
    expect(state.confirmedValues.speed).toBe(true);
  });

  it('rolls back only the current rejected request', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'old' });
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 3, requestId: 'new' });
    state = remoteSessionReducer(state, { type: 'writeResult', target: 'speed', requestId: 'old', ok: false });
    expect(state.values.speed).toBe(3);
    expect(state.pendingWrites.speed?.requestId).toBe('new');

    state = remoteSessionReducer(state, { type: 'writeResult', target: 'speed', requestId: 'new', ok: false });
    expect(state.values.speed).toBe(1);
    expect(state.pendingWrites.speed).toBeUndefined();
  });
});

describe('remote session protocol mapping', () => {
  it('rejects a hello that was not accepted', () => {
    const message = helloAck(PROTOCOL_VERSION);
    message.payload.accepted = false;
    expect(protocolAction(message)).toEqual({ type: 'error', message: 'The desktop bridge rejected the connection.' });
  });

  it('maps write results and ignores successful remote commands', () => {
    expect(protocolAction(envelope('set_value_result', { ok: false, trainerId: 't', target: 'speed', error: { code: 'x', message: 'nope' } }, 'req')))
      .toEqual({ type: 'writeResult', target: 'speed', requestId: 'req', ok: false, message: 'nope' });
    expect(protocolAction(envelope('remote_command_result', { ok: true, action: 'launch' }))).toBeNull();
    expect(protocolAction(envelope('remote_command_result', { ok: false, action: 'stop' })))
      .toEqual({ type: 'error', message: 'The remote game command was rejected.' });
  });
});

describe('remote session reducer transitions', () => {
  it('flags an error only while not connected', () => {
    const idle = remoteSessionReducer(initialState(), { type: 'error', message: 'boom' });
    expect(idle.connectionStatus).toBe(EConnectionStatus.Error);

    const connected = remoteSessionReducer({ ...initialState(), connectionStatus: EConnectionStatus.Connected }, { type: 'error', message: 'boom' });
    expect(connected.connectionStatus).toBe(EConnectionStatus.Connected);
    expect(connected.lastError).toBe('boom');

    expect(remoteSessionReducer(idle, { type: 'error', message: null }).lastError).toBeNull();
  });

  it('distinguishes first connect from reconnect', () => {
    expect(remoteSessionReducer(initialState(), { type: 'connecting' }).connectionStatus).toBe(EConnectionStatus.Connecting);
    expect(remoteSessionReducer(initialState(), { type: 'connecting', reconnecting: true }).connectionStatus)
      .toBe(EConnectionStatus.Reconnecting);
  });

  it('drops pending writes when the socket closes and wipes trainer data on disconnect', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'r' });
    state = remoteSessionReducer(state, { type: 'connectionClosed', message: 'closed' });
    expect(state.pendingWrites).toEqual({});

    state = remoteSessionReducer(state, { type: 'disconnected' });
    expect(state.connectionStatus).toBe(EConnectionStatus.Idle);
    expect(state.values).toEqual({});
    expect(state.wsUrl).toBe('ws://test');
  });

  it('ignores write results with a null or unknown request id', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'r' });
    expect(remoteSessionReducer(state, { type: 'writeResult', target: 'speed', requestId: null, ok: false })).toBe(state);
    expect(remoteSessionReducer(state, { type: 'writeResult', target: 'other', requestId: 'r', ok: false })).toBe(state);
  });

  it('uses a default message when a rejected write has none', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'r' });
    state = remoteSessionReducer(state, { type: 'writeResult', target: 'speed', requestId: 'r', ok: false });
    expect(state.lastError).toBe('The trainer rejected the requested value.');
  });

  it('keeps a pending write when a delta reports a different value', () => {
    let state = withConfirmedValue(1);
    state = remoteSessionReducer(state, { type: 'writeStarted', target: 'speed', value: 2, requestId: 'r' });
    state = remoteSessionReducer(state, { type: 'valueChanged', target: 'speed', value: 5 });
    expect(state.pendingWrites.speed?.requestId).toBe('r');
    expect(state.confirmedValues.speed).toBe(5);
  });
});

function helloAck(protocolVersion: number): HelloAckMessage {
  return {
    type: 'hello_ack',
    version: PROTOCOL_VERSION,
    requestId: 'hello',
    payload: {
      sessionId: 'session',
      accepted: true,
      serverVersion: 'test',
      protocolVersion,
    },
  };
}

function initialState(): RemoteSessionState {
  return { ...createInitialRemoteSessionState(), wsUrl: 'ws://test' };
}

function withConfirmedValue(value: unknown): RemoteSessionState {
  return {
    ...initialState(),
    values: { speed: value },
    confirmedValues: { speed: value },
  };
}
