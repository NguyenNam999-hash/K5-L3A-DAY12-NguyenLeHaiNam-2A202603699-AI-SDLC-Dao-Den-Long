import { describe, expect, it } from 'vitest';
import { LeaderboardStore } from '../src/render/leaderboard-store';
import type { LeaderboardEntry } from '../src/core/leaderboard';

const remote: LeaderboardEntry = {
  name: 'Remote',
  score: 900,
  nights_won: 3,
  achieved_at: '2026-11-20T10:00:00.000Z',
  seed: 42,
};
const local: LeaderboardEntry = {
  name: 'Local',
  score: 700,
  nights_won: 1,
  achieved_at: '2026-11-20T09:00:00.000Z',
  seed: 7,
};

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch;
}

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const STORAGE_KEY = 'dao-den-long.leaderboard.v1';

describe('LeaderboardStore', () => {
  it('loads from the API and mirrors to storage', async () => {
    const storage = memoryStorage();
    const store = new LeaderboardStore({
      storage,
      fetchImpl: stubFetch(() => new Response(JSON.stringify({ entries: [remote] }), { status: 200 })),
    });
    expect(await store.load()).toEqual([remote]);
    expect(JSON.parse(storage.data[STORAGE_KEY]!)).toEqual([remote]);
  });

  it('falls back to storage when the API fails or is absent', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify([local]) });
    const failing = new LeaderboardStore({
      storage,
      fetchImpl: stubFetch(() => new Response('boom', { status: 500 })),
    });
    expect(await failing.load()).toEqual([local]);

    const offline = new LeaderboardStore({ storage, fetchImpl: undefined });
    expect(await offline.load()).toEqual([local]);
  });

  it('reads corrupt storage as an empty list', async () => {
    const store = new LeaderboardStore({
      storage: memoryStorage({ [STORAGE_KEY]: '{nope' }),
      fetchImpl: undefined,
    });
    expect(await store.load()).toEqual([]);
  });

  it('saves locally when the API rejects the submission', async () => {
    const storage = memoryStorage();
    const store = new LeaderboardStore({
      storage,
      fetchImpl: stubFetch(() => new Response('bad', { status: 400 })),
    });
    const entries = await store.submit(local);
    expect(entries.map((e) => e.name)).toEqual(['Local']);
    expect(JSON.parse(storage.data[STORAGE_KEY]!)[0].name).toBe('Local');
  });

  it('returns the merged server list after a successful submit', async () => {
    const storage = memoryStorage();
    const store = new LeaderboardStore({
      storage,
      fetchImpl: stubFetch((url, init) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ entries: [remote, local] }), { status: 200 })
          : new Response(JSON.stringify({ entries: [] }), { status: 200 }),
      ),
    });
    const entries = await store.submit({ ...local, score: 950 });
    expect(entries.map((e) => e.name)).toEqual(['Remote', 'Local']);
  });

  it('never rejects on a network error', async () => {
    const store = new LeaderboardStore({
      storage: memoryStorage(),
      fetchImpl: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
    });
    await expect(store.load()).resolves.toEqual([]);
    await expect(store.submit(local)).resolves.toHaveLength(1);
  });
});
