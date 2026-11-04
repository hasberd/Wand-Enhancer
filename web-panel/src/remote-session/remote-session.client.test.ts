import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION } from '../../protocol/messages';
import { FakeWebSocket } from '../testing/fake-websocket';
import { envelope } from '../testing/fixtures';
import { RemoteSessionClient } from './remote-session.client';

function createClient() {
  const handlers = {
    onConnecting: vi.fn(),
    onTransportOpen: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  return { client: new RemoteSessionClient('ws://bridge/ws', handlers), handlers };
}

describe('RemoteSessionClient', () => {
  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a versioned hello as soon as the transport opens', () => {
    const { client, handlers } = createClient();
    client.connect('pair-token');
    expect(handlers.onConnecting).toHaveBeenCalledOnce();
    expect(client.isOpen()).toBe(false);

    FakeWebSocket.latest().open();
    expect(client.isOpen()).toBe(true);
    expect(FakeWebSocket.latest().sent).toEqual([
      expect.objectContaining({
        type: 'hello',
        version: PROTOCOL_VERSION,
        payload: expect.objectContaining({ client: 'mobile-web', pairingToken: 'pair-token' }),
      }),
    ]);
  });

  it('refuses to send while the socket is not open', () => {
    const { client } = createClient();
    expect(client.setValue('t', 'speed', 1)).toBeNull();
    client.connect();
    expect(client.launchGame('game')).toBe(false);
    expect(FakeWebSocket.latest().sent).toEqual([]);
  });

  it('returns unique request ids for writes and commands', () => {
    const { client } = createClient();
    client.connect();
    const socket = FakeWebSocket.latest();
    socket.open();

    const first = client.setValue('t', 'speed', 1, 'uuid');
    const second = client.setValue('t', 'speed', 2);
    expect(first).not.toBe(second);
    expect(client.stopPlaying('game', 'title')).toBe(true);
    expect(socket.sent.slice(1)).toEqual([
      expect.objectContaining({ type: 'set_value', requestId: first, payload: { trainerId: 't', target: 'speed', value: 1, cheatId: 'uuid' } }),
      expect.objectContaining({ type: 'set_value', requestId: second }),
      expect.objectContaining({ type: 'remote_command', payload: { action: 'stop', gameId: 'game', titleId: 'title' } }),
    ]);
  });

  it('forwards valid messages and reports invalid or malformed ones', () => {
    const { client, handlers } = createClient();
    client.connect();
    const socket = FakeWebSocket.latest();
    socket.open();

    const message = envelope('trainer_changed', { trainerId: 't' });
    socket.receive(message);
    socket.receive({ type: 'trainer_changed', version: PROTOCOL_VERSION + 1, requestId: null, payload: {} });
    socket.receive('{not json');

    expect(handlers.onMessage).toHaveBeenCalledExactlyOnceWith(message);
    expect(handlers.onError).toHaveBeenNthCalledWith(1, 'Received an invalid protocol message.');
    expect(handlers.onError).toHaveBeenCalledTimes(2);
  });

  it('reports unexpected closes but not intentional disconnects', () => {
    const { client, handlers } = createClient();
    client.connect();
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().dropConnection();
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(client.isOpen()).toBe(false);

    client.connect();
    FakeWebSocket.latest().open();
    client.disconnect();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it('ignores a stale socket closing after reconnect', () => {
    const { client, handlers } = createClient();
    client.connect();
    const stale = FakeWebSocket.latest();
    client.connect();
    const fresh = FakeWebSocket.latest();
    fresh.open();

    stale.dropConnection();
    expect(client.isOpen()).toBe(true);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });
});
