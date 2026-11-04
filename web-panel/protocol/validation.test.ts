import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from './contract';
import { isIncomingMessage, isOutgoingMessage } from './validation';

describe('web protocol validation', () => {
  it('rejects messages with another envelope version', () => {
    expect(isIncomingMessage({
      type: 'error',
      version: PROTOCOL_VERSION + 1,
      requestId: null,
      payload: { code: 'bad', message: 'bad' },
    })).toBe(false);
  });

  it('rejects incomplete required payloads', () => {
    expect(isIncomingMessage({
      type: 'hello_ack',
      version: PROTOCOL_VERSION,
      requestId: null,
      payload: { accepted: true },
    })).toBe(false);
    expect(isOutgoingMessage({
      type: 'set_value',
      version: PROTOCOL_VERSION,
      requestId: 'set',
      payload: { target: 'speed', value: 1 },
    })).toBe(false);
  });
});

const valid = (type: string, payload: Record<string, unknown>, requestId: string | null = null) => ({
  type,
  version: PROTOCOL_VERSION,
  requestId,
  payload,
});

describe('web protocol validation per message type', () => {
  it.each([
    ['hello_ack', { sessionId: 's', accepted: true, serverVersion: '1', protocolVersion: PROTOCOL_VERSION }],
    ['trainer_meta', { session: { instanceId: 'i' }, trainer: { trainerId: 't' }, schema: { categories: [], cheats: [] } }],
    ['trainer_values', { trainerId: 't', values: {} }],
    ['installed_apps', { instanceId: 'i', updatedAt: 'now', apps: [] }],
    ['game_status', { instanceId: 'i', updatedAt: 'now', session: {}, trainer: {} }],
    ['value_changed', { trainerId: 't', target: 'speed', value: null }],
    ['trainer_changed', { trainerId: 't' }],
    ['set_value_result', { ok: true, trainerId: 't', target: 'speed' }],
    ['remote_command_result', { ok: false, action: 'stop' }],
    ['error', { code: 'x', message: 'y' }],
  ])('accepts a well-formed %s', (type, payload) => {
    expect(isIncomingMessage(valid(type, payload))).toBe(true);
  });

  it.each([
    ['unknown type', valid('hello', { client: 'mobile-web' })],
    ['missing payload', { type: 'error', version: PROTOCOL_VERSION, requestId: null }],
    ['numeric requestId', { ...valid('trainer_changed', { trainerId: 't' }), requestId: 1 }],
    ['value_changed without value', valid('value_changed', { trainerId: 't', target: 'speed' })],
    ['trainer_meta without cheats array', valid('trainer_meta', { session: { instanceId: 'i' }, trainer: { trainerId: 't' }, schema: { categories: [] } })],
    ['remote_command_result with an unknown action', valid('remote_command_result', { ok: true, action: 'restart' })],
    ['null', null],
    ['string', 'hello'],
  ])('rejects %s', (_label, message) => {
    expect(isIncomingMessage(message)).toBe(false);
  });

  it('validates outgoing messages', () => {
    expect(isOutgoingMessage(valid('hello', { client: 'mobile-web', clientVersion: '1', capabilities: {} }, 'h'))).toBe(true);
    expect(isOutgoingMessage(valid('hello', { client: 'desktop', clientVersion: '1', capabilities: {} }, 'h'))).toBe(false);
    expect(isOutgoingMessage(valid('set_value', { trainerId: 't', target: 'speed', value: 1 }, 's'))).toBe(true);
    expect(isOutgoingMessage(valid('remote_command', { action: 'launch' }, 'c'))).toBe(true);
    expect(isOutgoingMessage(valid('remote_command', { action: 'reboot' }, 'c'))).toBe(false);
  });
});
