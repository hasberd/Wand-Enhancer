import { describe, expect, it } from 'vitest';

import type { InstalledAppSummary } from '../../../protocol/messages';
import { makeGameStatus, makeTrainer } from '../../testing/fixtures';
import {
  buildLibraryGames,
  filterLibraryGames,
  formatHours,
  getCurrentGame,
  getGameCoverLabel,
  getInstalledAppId,
  getLibrarySections,
  shortPath,
} from './games';

const apps: InstalledAppSummary[] = [
  {
    platform: 'steam',
    sku: 'one',
    correlationId: 'steam:one',
    displayName: 'Alpha Game',
    gameId: 'game-one',
    location: 'C:\\Games\\Alpha',
    alternateLocations: [],
    platformTotalPlaytimeMinutes: 90,
  },
  {
    platform: 'epic_games',
    sku: 'two',
    correlationId: 'epic:two',
    displayName: 'Beta Game',
    gameId: 'game-two',
    location: 'C:\\Games\\Beta',
    alternateLocations: [],
  },
  {
    platform: 'gog',
    sku: 'three',
    correlationId: 'gog:three',
    displayName: 'Charlie: Remastered',
    titleId: 'title-three',
    location: '/mnt/games/charlie',
    alternateLocations: [],
  },
];

describe('library models', () => {
  it('projects running and pinned games and filters them', () => {
    const games = buildLibraryGames(apps, makeGameStatus({ state: 'running', gameId: 'game-two' }), null, { 'game-one': true });

    expect(getCurrentGame(games)?.id).toBe('game-two');
    expect(games.find((game) => game.id === 'game-one')?.pinned).toBe(true);
    expect(filterLibraryGames(games, 'alpha').map((game) => game.id)).toEqual(['game-one']);
  });

  it('sorts running first, then pinned, then alphabetically', () => {
    const games = buildLibraryGames(apps, makeGameStatus({ gameId: 'game-two' }), null, { 'title-three': true });
    expect(games.map((game) => game.id)).toEqual(['game-two', 'title-three', 'game-one']);
  });

  it('matches the running game by titleId and falls back to the attached trainer', () => {
    expect(getCurrentGame(buildLibraryGames(apps, makeGameStatus({ titleId: 'title-three' }), null, {}))?.id).toBe('title-three');
    expect(getCurrentGame(buildLibraryGames(apps, null, makeTrainer({ gameId: 'game-one' }), {}))?.id).toBe('game-one');
    expect(getCurrentGame(buildLibraryGames(apps, null, null, {}))).toBeNull();
  });

  it('derives display fields', () => {
    const [alpha] = buildLibraryGames([apps[0]], null, null, {});
    expect(alpha.hours).toBe(1.5);
    expect(alpha.platform).toBe('Steam');
    expect(buildLibraryGames([apps[1]], null, null, {})[0].platform).toBe('Epic Games');
    expect(buildLibraryGames([apps[1]], null, null, {})[0].hours).toBeNull();
  });

  it('splits sections without duplicating the running game', () => {
    const games = buildLibraryGames(apps, makeGameStatus({ gameId: 'game-one' }), null, { 'game-one': true, 'game-two': true });
    const sections = getLibrarySections(games);
    expect(sections.running?.id).toBe('game-one');
    expect(sections.pinned.map((game) => game.id)).toEqual(['game-two']);
    expect(sections.rest.map((game) => game.id)).toEqual(['title-three']);
  });

  it('filters by platform and path and ignores blank queries', () => {
    const games = buildLibraryGames(apps, null, null, {});
    expect(filterLibraryGames(games, '  ')).toHaveLength(3);
    expect(filterLibraryGames(games, 'GOG').map((game) => game.id)).toEqual(['title-three']);
    expect(filterLibraryGames(games, 'games\\beta').map((game) => game.id)).toEqual(['game-two']);
  });
});

describe('library formatting helpers', () => {
  it('formats hours', () => {
    expect(formatHours(null)).toBeNull();
    expect(formatHours(1.25)).toBe('1.3h');
    expect(formatHours(12.6)).toBe('13h');
  });

  it('shortens paths from either separator style', () => {
    expect(shortPath('')).toBe('');
    expect(shortPath('C:\\Games')).toBe('C:\\Games');
    expect(shortPath('C:\\Games\\Alpha\\bin')).toBe('.../Alpha/bin');
    expect(shortPath('/mnt/games/charlie')).toBe('.../games/charlie');
  });

  it('builds a cover label and stable ids', () => {
    const games = buildLibraryGames(apps, null, null, {});
    expect(getGameCoverLabel(games.find((game) => game.id === 'title-three')!)).toBe('CHARLIE');
    expect(getInstalledAppId({ ...apps[0], gameId: ' ', titleId: null })).toBe('steam:one');
  });
});
