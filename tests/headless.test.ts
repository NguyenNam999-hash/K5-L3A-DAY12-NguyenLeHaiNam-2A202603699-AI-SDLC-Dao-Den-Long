import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runHeadless } from '../src/headless/run';

const dir = mkdtempSync(join(tmpdir(), 'dao-den-long-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Rec {
  type: string;
  tick?: number;
  state?: string;
  [key: string]: unknown;
}

function readJsonl(path: string): Rec[] {
  return readFileSync(path, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Rec);
}

function writeJson(name: string, value: unknown): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe('headless CLI', () => {
  it('writes snapshot@0, snapshots every N ticks and a final end record', () => {
    const out = join(dir, 'basic.jsonl');
    expect(runHeadless(['--seed', '1', '--night', '1', '--ticks', '60', '--out', out])).toBe(0);
    const recs = readJsonl(out);
    const snaps = recs.filter((r) => r.type === 'snapshot');
    expect(snaps[0]!.tick).toBe(0);
    expect(snaps.map((s) => s.tick)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    const last = recs.at(-1)!;
    expect(last).toMatchObject({ type: 'end', ticks: 60, state: 'playing' });
  });

  it('honours --snapshot-every', () => {
    const out = join(dir, 'every.jsonl');
    runHeadless(['--seed', '2', '--ticks', '25', '--out', out, '--snapshot-every', '5']);
    const ticks = readJsonl(out)
      .filter((r) => r.type === 'snapshot')
      .map((r) => r.tick);
    expect(ticks).toEqual([0, 5, 10, 15, 20, 25]);
  });

  it('applies inputs and stamps events with tick k+1', () => {
    const scenario = writeJson('deposit.json', {
      player: { pos: [0, 0, 2], carried: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
    });
    const inputs = writeJson('deposit-inputs.json', {
      frames: [{ tick: 5, interact: true }, { tick: 6, interact: false }],
    });
    const out = join(dir, 'deposit.jsonl');
    expect(
      runHeadless(['--seed', '1', '--ticks', '20', '--out', out, '--scenario', scenario, '--inputs', inputs]),
    ).toBe(0);
    const recs = readJsonl(out);
    const deposit = recs.find((r) => r.type === 'event' && (r as { name?: string }).name === 'deposit');
    expect(deposit).toMatchObject({ tick: 6, data: { lantern_id: 'L1', amount: 3, deposited: 3 } });
  });

  it('is deterministic: two runs with the same arguments produce identical bytes', () => {
    const a = join(dir, 'det-a.jsonl');
    const b = join(dir, 'det-b.jsonl');
    const args = ['--seed', '99', '--night', '1', '--ticks', '1800', '--out'];
    expect(runHeadless([...args, a])).toBe(0);
    expect(runHeadless([...args, b])).toBe(0);
    expect(readFileSync(a, 'utf8')).toBe(readFileSync(b, 'utf8'));
  });

  it('stops early and reports the final state when the game ends', () => {
    const scenario = writeJson('lose.json', {
      player: { pos: [0, 0, 0], flames: 1 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 0, 0.5] }],
    });
    const out = join(dir, 'lose.jsonl');
    expect(runHeadless(['--seed', '1', '--ticks', '600', '--out', out, '--scenario', scenario])).toBe(0);
    const recs = readJsonl(out);
    expect(recs.at(-1)).toMatchObject({ type: 'end', state: 'lost' });
    expect(recs.find((r) => r.type === 'event' && (r as { name?: string }).name === 'game_over')).toMatchObject({
      data: { result: 'lost', reason: 'no_flames' },
    });
    expect(recs.at(-1)!.ticks).toBeLessThan(600);
  });

  it('rounds positions to 3 decimals and uses ground-level lantern/mote positions', () => {
    const out = join(dir, 'round.jsonl');
    runHeadless(['--seed', '5', '--ticks', '1', '--out', out, '--snapshot-every', '1']);
    const snap = readJsonl(out)[0] as unknown as {
      player: { pos: number[] };
      lanterns: Array<{ pos: number[] }>;
      motes: Array<{ pos: number[] }>;
    };
    expect(snap.player.pos).toEqual([0, 0, 0]);
    expect(snap.lanterns[0]!.pos[1]).toBe(0);
    expect(snap.motes[0]!.pos[1]).toBe(0);
  });

  it('exits 2 on a malformed scenario', () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{ not json');
    expect(runHeadless(['--seed', '1', '--ticks', '1', '--out', join(dir, 'x.jsonl'), '--scenario', bad])).toBe(2);

    const wrongType = writeJson('wrong-type.json', { player: { pos: 'oops' } });
    expect(runHeadless(['--seed', '1', '--ticks', '1', '--out', join(dir, 'y.jsonl'), '--scenario', wrongType])).toBe(2);

    const unknownLantern = writeJson('unknown-lantern.json', { lanterns: [{ id: 'L99' }] });
    expect(
      runHeadless(['--seed', '1', '--ticks', '1', '--out', join(dir, 'y.jsonl'), '--scenario', unknownLantern]),
    ).toBe(2);
  });

  it('exits 2 on malformed inputs', () => {
    const out = join(dir, 'nope.jsonl');
    const decreasing = writeJson('decreasing.json', { frames: [{ tick: 5 }, { tick: 5 }] });
    expect(runHeadless(['--seed', '1', '--ticks', '1', '--out', out, '--inputs', decreasing])).toBe(2);

    const badMove = writeJson('bad-move.json', { frames: [{ tick: 0, move: [2, 0] }] });
    expect(runHeadless(['--seed', '1', '--ticks', '1', '--out', out, '--inputs', badMove])).toBe(2);

    expect(runHeadless(['--seed', '1', '--ticks', '1', '--out', out, '--inputs', join(dir, 'missing.json')])).toBe(2);
  });

  it('exits 1 on bad CLI usage', () => {
    expect(runHeadless(['--ticks', '10'])).toBe(1);
    expect(runHeadless(['--seed', 'x', '--ticks', '10', '--out', join(dir, 'z.jsonl')])).toBe(1);
    expect(runHeadless(['--seed', '1', '--ticks', '10', '--out', join(dir, 'z.jsonl'), '--night', '2'])).toBe(1);
  });
});
