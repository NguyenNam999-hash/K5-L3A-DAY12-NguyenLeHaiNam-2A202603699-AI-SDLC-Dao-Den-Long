import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportLeaderboard, readLeaderboardFile, writeLeaderboardFile } from '../src/server/leaderboard-file';
import { startApp } from '../src/server/app';
import type { LeaderboardEntry } from '../src/core/leaderboard';

const entry = (name: string, score: number): LeaderboardEntry => ({
  name,
  score,
  nights_won: 3,
  achieved_at: '2026-11-20T10:00:00.000Z',
  seed: 42,
});

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dao-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Đảo</title>');
  writeFileSync(join(dir, 'app.js'), 'console.log(1)');
  return dir;
}

describe('leaderboard file', () => {
  it('returns an empty list for a corrupt or missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dao-'));
    expect(readLeaderboardFile(join(dir, 'missing.json'))).toEqual([]);
    writeFileSync(join(dir, 'bad.json'), '{ not json');
    expect(readLeaderboardFile(join(dir, 'bad.json'))).toEqual([]);
    writeFileSync(join(dir, 'wrong.json'), '{"entries":[{"name":"x"}]}');
    expect(readLeaderboardFile(join(dir, 'wrong.json'))).toEqual([]);
  });

  it('round-trips entries sorted by score', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dao-'));
    const file = join(dir, 'nested', 'leaderboard.json');
    writeLeaderboardFile(file, [entry('Low', 10), entry('High', 20)]);
    expect(readLeaderboardFile(file).map((e) => e.name)).toEqual(['High', 'Low']);
    expect(JSON.parse(readFileSync(file, 'utf8')).entries.length).toBe(2);
  });

  it('exports {"entries":[...]} in leaderboard order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dao-'));
    const data = join(dir, 'data.json');
    writeLeaderboardFile(data, [entry('Low', 10), entry('High', 20)]);
    const out = join(dir, 'out.json');
    exportLeaderboard(data, out);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual({
      entries: [entry('High', 20), entry('Low', 10)],
    });
  });
});

describe('static app server', () => {
  it('serves the UI and the leaderboard API, and rejects unknown API routes', async () => {
    const root = tempRoot();
    const dataFile = join(root, 'data', 'leaderboard.json');
    const app = await startApp({ port: 0, root, dataFile, open: false });
    closers.push(app.close);

    const home = await fetch(app.url);
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('Đảo');

    const empty = await fetch(`${app.url}/api/leaderboard`);
    expect(await empty.json()).toEqual({ entries: [] });

    const saved = await fetch(`${app.url}/api/leaderboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry('May_01', 858)),
    });
    expect(saved.status).toBe(200);
    expect((await saved.json()).entries[0].name).toBe('May_01');

    const appJs = await fetch(`${app.url}/app.js`);
    expect(appJs.headers.get('content-type')).toContain('javascript');

    const missing = await fetch(`${app.url}/api/nope`);
    expect(missing.status).toBe(404);
  });

  it('rejects an invalid leaderboard entry without writing it', async () => {
    const root = tempRoot();
    const dataFile = join(root, 'data', 'leaderboard.json');
    const app = await startApp({ port: 0, root, dataFile, open: false });
    closers.push(app.close);

    const bad = await fetch(`${app.url}/api/leaderboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', score: 10 }),
    });
    expect(bad.status).toBe(400);
    expect(readLeaderboardFile(dataFile)).toEqual([]);
  });
});
