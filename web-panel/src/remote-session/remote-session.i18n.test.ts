import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeCheat, makeTrainerMeta } from '../testing/fixtures';
import { localizeTrainerMeta } from './remote-session.i18n';

function metaWithToken() {
  const meta = makeTrainerMeta(
    [makeCheat({ target: 'health', name: 'cheat.health', description: 'cheat.health.desc', instructions: null })],
    { gameId: 'g1', gameVersion: '1.2', language: 'ru-RU' },
  );
  return { ...meta, session: { ...meta.session, accessToken: 'token' } };
}

describe('localizeTrainerMeta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replaces cheat strings with the trainer i18n dictionary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ i18n: { strings: { 'cheat.health': 'Бессмертие', 'cheat.health.desc': 'Описание' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await localizeTrainerMeta(metaWithToken());
    expect(result.schema.cheats[0]).toMatchObject({ name: 'Бессмертие', description: 'Описание', instructions: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/g1/trainer?');
    expect(url).toContain('gameVersions=1.2');
    expect(url).toContain('locale=ru-RU');
    expect(init.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('returns the original payload without a token, on HTTP errors and on network failures', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const withoutToken = makeTrainerMeta([makeCheat()]);
    expect(await localizeTrainerMeta(withoutToken)).toBe(withoutToken);
    expect(fetchMock).not.toHaveBeenCalled();

    const meta = metaWithToken();
    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await localizeTrainerMeta(meta)).toBe(meta);

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await localizeTrainerMeta(meta)).toBe(meta);
  });
});
