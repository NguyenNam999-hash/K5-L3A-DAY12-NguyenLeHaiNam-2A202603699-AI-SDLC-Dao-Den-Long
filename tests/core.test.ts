import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { TUNING } from '../src/core/tuning';
import type { Scenario } from '../src/core/scenario';
import { eventNames, near, simulate, still } from './helpers';

describe('setup', () => {
  it('starts Night 1 at the origin with 5 unlit lanterns and 20 motes', () => {
    const game = new Game({ seed: 1, night: 1 });
    const snap = game.snapshot();
    expect(snap.night).toBe(1);
    expect(snap.tick).toBe(0);
    expect(snap.sim_tick).toBe(0);
    expect(snap.state).toBe('playing');
    expect(snap.time_left_s).toBe(300);
    expect(snap.player.pos).toEqual([0, 0, 0]);
    expect(snap.player.flames).toBe(3);
    expect(snap.player.carried).toBe(0);
    expect(snap.player.grounded).toBe(true);
    expect(snap.lanterns).toHaveLength(5);
    expect(snap.motes).toHaveLength(20);
    expect(new Set(snap.motes.map((m) => `${m.pos[0]},${m.pos[2]}`)).size).toBe(20);
    expect(snap.motes.every((m) => m.kind === 'random')).toBe(true);
    expect(snap.shades).toHaveLength(0);
    expect(snap.wind).toEqual({ active: false, dir_deg: 0 });
  });

  it('starts Night 2 and Night 3 with their own durations and lantern counts', () => {
    expect(new Game({ seed: 1, night: 2 }).snapshot()).toMatchObject({
      night: 2,
      time_left_s: 330,
    });
    expect(new Game({ seed: 1, night: 2 }).snapshot().lanterns).toHaveLength(6);
    expect(new Game({ seed: 1, night: 3 }).snapshot().time_left_s).toBe(360);
    expect(new Game({ seed: 1, night: 3 }).snapshot().lanterns).toHaveLength(7);
  });

  it('pre-lit scenario lanterns give no score and no events', () => {
    const { game, events } = simulate({
      ticks: 5,
      scenario: { ...still, lanterns: [{ id: 'L1', lit: true, deposited: 10 }] },
    });
    expect(eventNames(events)).toEqual(['night_start']);
    expect(game.score).toBe(0);
    expect(game.lanterns[0]!.lit).toBe(true);
  });
});

describe('movement', () => {
  it('reaches player_speed within 0.1 s and moves +Z at cam_yaw 0', () => {
    const { game } = simulate({ ticks: 60, scenario: still, frames: [{ tick: 0, move: [0, 1] }] });
    expect(near(game.pz, 5.75, 0.05)).toBe(true);
    expect(near(game.vz, TUNING.player_speed)).toBe(true);
    expect(near(game.px, 0)).toBe(true);
  });

  it('rotates the move vector by cam_yaw_deg', () => {
    const { game } = simulate({
      ticks: 60,
      scenario: still,
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
    });
    expect(near(game.px, 5.75, 0.05)).toBe(true);
    expect(near(game.pz, 0)).toBe(true);
  });

  it('normalises diagonal input', () => {
    const { game } = simulate({ ticks: 60, scenario: still, frames: [{ tick: 0, move: [1, 1] }] });
    expect(near(Math.hypot(game.px, game.pz), 5.75, 0.2)).toBe(true);
  });

  it('stops within 0.1 s after releasing the keys', () => {
    const { game } = simulate({
      ticks: 70,
      scenario: still,
      frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }],
    });
    expect(near(game.vz, 0)).toBe(true);
  });

  it('jumps with vy 7 and lands', () => {
    const { game, snapshots } = simulate({
      ticks: 60,
      scenario: still,
      frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }],
    });
    const peak = Math.max(...snapshots.map((s) => s.player.pos[1]));
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.3);
    expect(game.py).toBe(0);
    expect(game.grounded).toBe(true);
  });

  it('cannot double jump', () => {
    const { snapshots } = simulate({
      ticks: 60,
      scenario: still,
      frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 15, jump: true }],
    });
    expect(Math.max(...snapshots.map((s) => s.player.pos[1]))).toBeLessThan(1.3);
  });

  it('dashes 2.8 m in 12 ticks and respects the 1.5 s cooldown', () => {
    const { events, snapshots } = simulate({
      ticks: 120,
      scenario: still,
      frames: [
        { tick: 0, dash: true },
        { tick: 1, dash: false },
        { tick: 30, dash: true },
        { tick: 31, dash: false },
        { tick: 100, dash: true },
        { tick: 101, dash: false },
      ],
    });
    expect(near(snapshots[12]!.player.pos[2], 2.8, 1e-6)).toBe(true);
    expect(eventNames(events).filter((n) => n === 'dash')).toHaveLength(2);
  });

  it('keeps height during an air dash', () => {
    const { snapshots } = simulate({
      ticks: 40,
      scenario: still,
      frames: [
        { tick: 0, jump: true },
        { tick: 1, jump: false },
        { tick: 10, dash: true },
        { tick: 11, dash: false },
      ],
    });
    const yAtDash = snapshots[11]!.player.pos[1];
    for (let t = 11; t <= 21; t += 1) expect(snapshots[t]!.player.pos[1]).toBeCloseTo(yAtDash, 6);
  });

  it('walks off the Night 1 rim and falls', () => {
    const { game, events, snapshots } = simulate({
      ticks: 200,
      scenario: { ...still, player: { pos: [0, 0, 39] } },
      frames: [{ tick: 0, move: [0, 1] }],
    });
    const hit = events.find((e) => e.name === 'player_hit');
    expect(hit?.data).toMatchObject({ by: 'fall', flames: 2 });
    expect(game.flames).toBe(2);
    expect(snapshots.slice(130).some((s) => s.player.pos[1] === 0 && Math.abs(s.player.pos[2]) < 1.5)).toBe(true);
  });

  it('blocks walking up a tier wall but allows the ramp', () => {
    const blocked = simulate({
      ticks: 60,
      night: 3,
      scenario: { ...still, wind_enabled: false, player: { pos: [0, 0, 26] } },
      frames: [{ tick: 0, move: [0, -1] }],
    });
    expect(blocked.game.pz).toBeGreaterThan(23.9);
    expect(blocked.game.py).toBe(0);

    const a = (30 * Math.PI) / 180;
    const ramp = simulate({
      ticks: 90,
      night: 3,
      scenario: {
        ...still,
        wind_enabled: false,
        player: { pos: [Math.cos(a) * 27.7, 0, Math.sin(a) * 27.7] },
      },
      frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }],
    });
    expect(ramp.game.py).toBe(3);
  });
});

describe('jump pads', () => {
  it('launches across the Night 2 bridge and lands on the other island', () => {
    const { game, snapshots } = simulate({
      ticks: 120,
      night: 2,
      scenario: { ...still, player: { pos: [20, 0, 18] } },
    });
    expect(snapshots[10]!.player.grounded).toBe(false);
    expect(game.grounded).toBe(true);
    expect(game.px).toBeGreaterThan(28);
    expect(game.py).toBe(0);
  });

  it('launches from the Night 3 tier-1 pad onto tier 2', () => {
    const { game } = simulate({
      ticks: 80,
      night: 3,
      scenario: { ...still, wind_enabled: false, player: { pos: [0, 3, 13] } },
    });
    expect(game.grounded).toBe(true);
    expect(game.py).toBe(6);
  });
});

describe('pause', () => {
  it('freezes the simulation but keeps tick and emits paused/resumed', () => {
    const { snapshots, events } = simulate({
      ticks: 50,
      scenario: still,
      frames: [
        { tick: 10, pause: true },
        { tick: 11, pause: false },
        { tick: 30, pause: true },
        { tick: 31, pause: false },
      ],
    });
    expect(eventNames(events)).toEqual(['night_start', 'paused', 'resumed']);
    const paused = snapshots[20]!;
    expect(paused.state).toBe('paused');
    expect(paused.tick).toBe(20);
    expect(paused.sim_tick).toBe(10);
    expect(paused.time_left_s).toBe(snapshots[10]!.time_left_s);
    expect(snapshots[50]!.sim_tick).toBe(30);
    expect(snapshots[50]!.state).toBe('playing');
  });
});

describe('motes and lanterns', () => {
  it('picks up inside 1 m only', () => {
    const inside = simulate({
      ticks: 2,
      scenario: { ...still, motes: [{ pos: [0, 0, 0.9] }] },
    });
    expect(inside.game.carried).toBe(1);
    const outside = simulate({
      ticks: 2,
      scenario: { ...still, motes: [{ pos: [0, 0, 1.1] }] },
    });
    expect(outside.game.carried).toBe(0);
  });

  it('requires the mote to be within 1.5 m of the feet', () => {
    const { game } = simulate({ ticks: 2, scenario: { ...still, motes: [{ pos: [0, 2, 0] }] } });
    expect(game.carried).toBe(0);
  });

  it('respects the 10-mote carry capacity', () => {
    const { game, events } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: 10 }, motes: [{ pos: [0, 0, 0] }] },
    });
    expect(events.filter((e) => e.name === 'mote_picked')).toHaveLength(0);
    expect(game.carried).toBe(10);
  });

  it('scores 10 per deposited mote and 100 for the lantern', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 1.5], carried: 10 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(eventNames(events)).toEqual(['night_start', 'deposit', 'lantern_lit']);
    expect(events[1]!.data).toEqual({ lantern_id: 'L1', amount: 10, deposited: 10 });
    expect(game.carried).toBe(0);
    expect(game.score).toBe(200);
    expect(game.stats.motes).toBe(10);
  });

  it('deposits only what is missing and keeps the rest', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 1], carried: 6 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 7 }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(events[1]!.data).toEqual({ lantern_id: 'L1', amount: 3, deposited: 10 });
    expect(game.carried).toBe(3);
    expect(game.score).toBe(130);
  });

  it('ignores lanterns outside the 3D interact radius', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 6], carried: 10 },
        lanterns: [{ id: 'L1', pos: [0, 6, 6] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(eventNames(events)).toEqual(['night_start']);
    expect(game.carried).toBe(10);
  });

  it('uses the 2.0 m XZ radius on the same tier', () => {
    const inside = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 1.9], carried: 10 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(inside.game.carried).toBe(0);
    const outside = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 2.1], carried: 10 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(outside.game.carried).toBe(10);
  });

  it('picks the nearest unlit lantern, ties by id', () => {
    const { events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 0], carried: 2 },
        lanterns: [
          { id: 'L2', pos: [0, 0, 0] },
          { id: 'L1', pos: [0, 0, 0] },
        ],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(events[1]!.data).toMatchObject({ lantern_id: 'L1' });
  });

  it('spawns a mote every 240 ticks up to the cap', () => {
    const { game } = simulate({ ticks: 240, scenario: { random_shades: false, random_drifters: false } });
    expect(game.motes.length).toBe(21);
  });

  it('expires dropped motes after their TTL', () => {
    const { game, snapshots } = simulate({
      ticks: 12,
      scenario: { ...still, motes: [{ pos: [5, 0, 0], kind: 'dropped', ttl_ticks: 10 }] },
    });
    expect(snapshots[9]!.motes).toHaveLength(1);
    expect(game.motes).toHaveLength(0);
  });
});

describe('pulse', () => {
  it('costs 3, stuns 120 ticks, pushes 4 m and scores 5', () => {
    const { game, events, snapshots } = simulate({
      ticks: 130,
      scenario: { ...still, player: { carried: 3 }, shades: [{ pos: [3, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(eventNames(events)).toContain('pulse');
    expect(events.find((e) => e.name === 'pulse')!.data).toEqual({ stunned_ids: ['S1'] });
    expect(game.carried).toBe(0);
    expect(game.score).toBe(5);
    expect(snapshots[16]!.shades[0]!.pos[0]).toBeCloseTo(7, 1);
    expect(snapshots[119]!.shades[0]!.state).toBe('stunned');
    expect(snapshots[120]!.shades[0]!.state).not.toBe('stunned');
  });

  it('ignores shades outside the 3D radius but still pays', () => {
    const { game, events } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: 3 }, shades: [{ pos: [3.5, 0, 6] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(events.find((e) => e.name === 'pulse')!.data).toEqual({ stunned_ids: [] });
    expect(game.carried).toBe(0);
    expect(game.score).toBe(0);
  });

  it('refuses with less than 3 motes', () => {
    const { events, game } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: 2 }, shades: [{ pos: [3, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(eventNames(events)).toEqual(['night_start']);
    expect(game.shades[0]!.state).toBe('chase');
  });

  it('scores every shade hit even when already stunned', () => {
    const { game } = simulate({
      ticks: 200,
      scenario: {
        ...still,
        player: { carried: 6 },
        shades: [{ pos: [3, 0, 0], state: 'stunned', state_ticks_left: 1000 }],
      },
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 190, pulse: true },
        { tick: 191, pulse: false },
      ],
    });
    expect(game.score).toBe(10);
    expect(game.stats.stuns).toBe(2);
  });
});

describe('shades', () => {
  it('spawns two at tick 300 and one every 8 s afterwards', () => {
    const { snapshots, events } = simulate({ ticks: 300, scenario: { random_motes: false } });
    expect(snapshots[300]!.shades).toHaveLength(2);
    expect(snapshots[300]!.shades.every((s) => s.state === 'spawning')).toBe(true);
    expect(eventNames(events).filter((n) => n === 'shade_spawned')).toHaveLength(2);
    const later = simulate({ ticks: 780, scenario: { random_motes: false } });
    expect(later.game.shades.length).toBe(3);
  });

  it('detects at 12 m and gives up at 18 m', () => {
    const detected = simulate({ ticks: 1, scenario: { ...still, shades: [{ pos: [10, 0, 0], state: 'wander' }] } });
    expect(detected.snapshots[1]!.shades[0]!.state).toBe('chase');
    const lost = simulate({ ticks: 1, scenario: { ...still, shades: [{ pos: [20, 0, 0], state: 'chase' }] } });
    expect(lost.snapshots[1]!.shades[0]!.state).toBe('wander');
  });

  it('hits, drops half the carried light and gives 1.5 s invulnerability', () => {
    const { game, events } = simulate({
      ticks: 30,
      scenario: { ...still, player: { carried: 10 }, shades: [{ pos: [0, 0, 0.5] }] },
    });
    const hit = events.find((e) => e.name === 'player_hit');
    expect(hit!.data).toEqual({ by: 'shade', flames: 2, dropped: 5 });
    expect(game.carried).toBe(5);
    expect(game.invulnTicks).toBe(61);
    expect(game.motes.filter((m) => m.kind === 'dropped')).toHaveLength(5);
  });

  it('loses at most one flame per tick even with several shades', () => {
    const { events } = simulate({
      ticks: 1,
      scenario: {
        ...still,
        player: { carried: 0 },
        shades: [
          { pos: [0.5, 0, 0] },
          { pos: [0, 0, 0.6] },
        ],
      },
    });
    expect(events.filter((e) => e.name === 'player_hit')).toHaveLength(1);
  });

  it('cannot enter a lit lantern safe circle or hit there', () => {
    const { game } = simulate({
      ticks: 300,
      scenario: {
        ...still,
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ pos: [1, 0, 0] }],
      },
    });
    expect(Math.hypot(game.shades[0]!.x, game.shades[0]!.z)).toBeGreaterThanOrEqual(6);
    expect(game.flames).toBe(3);
  });

  it('loses at no_flames', () => {
    const { game, events } = simulate({
      ticks: 120,
      scenario: { ...still, player: { flames: 1 }, shades: [{ pos: [0, 0, 0.5] }] },
    });
    expect(game.state).toBe('lost');
    expect(events.at(-1)!.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('drifters, charms and wind', () => {
  it('spawns a drifter at tick 1200 on Night 2', () => {
    const { snapshots } = simulate({ ticks: 1200, night: 2, scenario: { random_motes: false, random_shades: false } });
    expect(snapshots[1200]!.drifters).toHaveLength(1);
    expect(snapshots[1200]!.drifters[0]!.state).toBe('idle');
  });

  it('chases a carrier, steals 3 and flees', () => {
    const { events, game, snapshots } = simulate({
      ticks: 120,
      night: 2,
      scenario: {
        ...still,
        player: { carried: 5 },
        drifters: [{ id: 'D1', pos: [0, 1.6, -10] }],
      },
    });
    expect(snapshots[1]!.drifters[0]!.state).toBe('chase');
    expect(events.find((e) => e.name === 'drifter_steal')!.data).toEqual({
      drifter_id: 'D1',
      amount: 3,
      carried: 2,
    });
    expect(game.carried).toBe(2);
    expect(game.drifters[0]!.state).toBe('flee');
  });

  it('disappears after 240 flee ticks', () => {
    const { game } = simulate({
      ticks: 400,
      night: 2,
      scenario: {
        ...still,
        player: { carried: 5 },
        drifters: [{ id: 'D1', pos: [0, 1.6, -3] }],
      },
    });
    expect(game.drifters).toHaveLength(0);
  });

  it('pulse makes a chasing drifter flee without stealing', () => {
    const { game, events } = simulate({
      ticks: 2,
      night: 2,
      scenario: {
        ...still,
        player: { carried: 5 },
        drifters: [{ id: 'D1', pos: [3, 1.6, 0], state: 'chase' }],
      },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(events.some((e) => e.name === 'drifter_steal')).toBe(false);
    expect(game.drifters[0]!.state).toBe('flee');
    expect(game.carried).toBe(2);
  });

  it('pulse drops a fleeing drifter stolen motes', () => {
    const { game, events } = simulate({
      ticks: 2,
      night: 2,
      scenario: {
        ...still,
        player: { carried: 3 },
        drifters: [{ id: 'D1', pos: [3, 1.6, 0], state: 'flee', stolen: 3 }],
      },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(events.find((e) => e.name === 'drifter_drop')!.data).toEqual({ drifter_id: 'D1', amount: 3 });
    expect(game.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
    expect(game.drifters[0]!.stolen).toBe(0);
  });

  it('charm pickup grants 10 s, speed 7.2 and no dash cooldown', () => {
    const { game, events, snapshots } = simulate({
      ticks: 40,
      night: 2,
      scenario: { ...still, player: { pos: [35, 0, 0] }, charms: [{ id: 'C1', pos: [35, 0, 0] }] },
      frames: [
        { tick: 0, move: [0, 1] },
        { tick: 20, dash: true },
        { tick: 21, dash: false },
        { tick: 30, move: [0, 0] },
      ],
    });
    expect(events.find((e) => e.name === 'charm_picked')!.data).toEqual({ charm_id: 'C1', charm_ticks: 600 });
    expect(game.charmTicks).toBeGreaterThan(500);
    expect(snapshots[20]!.player.vel[2]).toBeCloseTo(7.2, 6);
    expect(events.some((e) => e.name === 'dash')).toBe(true);
  });

  it('charm respawns after 2700 ticks', () => {
    const { snapshots } = simulate({
      ticks: 2701,
      scenario: { ...still, player: { pos: [0, 0, 0] }, charms: [{ id: 'C1', pos: [35, 0, 0], available: false }] },
    });
    expect(snapshots[2701]!.charms[0]!.available).toBe(true);
  });

  it('wind blows on Night 3 from second 30 to second 35', () => {
    const { snapshots } = simulate({ ticks: 2100, night: 3, scenario: { random_motes: false, random_shades: false, player: { pos: [0, 0, 0] } } });
    expect(snapshots[1799]!.wind.active).toBe(false);
    expect(snapshots[1800]!.wind.active).toBe(true);
    expect(snapshots[2100]!.wind.active).toBe(false);
    expect(snapshots[1800]!.wind.dir_deg).toBeGreaterThanOrEqual(0);
    expect(snapshots[1800]!.wind.dir_deg).toBeLessThan(360);
  });
});

describe('ending and scoring', () => {
  it('loses at dawn and gives no bonus', () => {
    const { game, events } = simulate({ ticks: 60, scenario: { ...still, time_left_s: 0.5 } });
    expect(game.state).toBe('lost');
    expect(game.tick).toBe(30);
    expect(game.score).toBe(0);
    expect(events.at(-1)!.data).toEqual({ result: 'lost', reason: 'dawn' });
  });

  it('wins when the last lantern lights, with floor(time) * 2 + 50 per flame', () => {
    const scenario: Scenario = {
      ...still,
      player: { carried: 1 },
      lanterns: [
        { id: 'L1', pos: [0, 0, 0], deposited: 9 },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
    };
    const { game, events } = simulate({
      ticks: 5,
      scenario,
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(game.state).toBe('won');
    expect(events.at(-1)!.data).toEqual({ result: 'won', reason: 'all_lit' });
    expect(game.score).toBe(10 + 100 + Math.floor(game.timeLeft()) * 2 + 150);
  });

  it('wins at the deadline when every lantern is already lit', () => {
    const scenario: Scenario = {
      ...still,
      time_left_s: 0.5,
      lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })),
    };
    const { game } = simulate({ ticks: 60, scenario });
    expect(game.state).toBe('won');
    expect(game.score).toBe(150);
  });
});

describe('determinism', () => {
  it('is byte-identical for the same seed, night and scenario', () => {
    const a = simulate({ ticks: 1200, seed: 42, night: 2, scenario: { random_motes: true, random_shades: true } });
    const b = simulate({ ticks: 1200, seed: 42, night: 2, scenario: { random_motes: true, random_shades: true } });
    expect(JSON.stringify(a.game.snapshot())).toBe(JSON.stringify(b.game.snapshot()));
    expect(a.events).toEqual(b.events);
  });
});
