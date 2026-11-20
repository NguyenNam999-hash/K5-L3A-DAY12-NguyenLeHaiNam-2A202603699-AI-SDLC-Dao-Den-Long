import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ISLAND_RADIUS, TUNING } from '../src/core/tuning';
import type { Scenario } from '../src/core/scenario';
import { eventNames, near, simulate } from './helpers';

const still = { random_motes: false, random_shades: false };

describe('setup', () => {
  it('starts at the origin, full flames, empty carry, 5 unlit lanterns', () => {
    const game = new Game({ seed: 1 });
    const snap = game.snapshot();
    expect(snap.tick).toBe(0);
    expect(snap.state).toBe('playing');
    expect(snap.time_left_s).toBe(TUNING.night1_duration_s);
    expect(snap.player.pos).toEqual([0, 0, 0]);
    expect(snap.player.flames).toBe(TUNING.flames);
    expect(snap.player.carried).toBe(0);
    expect(snap.lanterns).toHaveLength(5);
    expect(snap.lanterns.every((l) => !l.lit && l.deposited === 0)).toBe(true);
  });

  it('pre-lit scenario lanterns give no score and no events', () => {
    const { game, events } = simulate({
      ticks: 5,
      scenario: { ...still, lanterns: [{ id: 'L1', lit: true, deposited: 3 }] },
    });
    expect(events).toHaveLength(0);
    expect(game.score).toBe(0);
    expect(game.lanterns[0]!.lit).toBe(true);
  });
});

describe('movement', () => {
  it('moves +Z at player_speed when cam_yaw is 0', () => {
    const { game } = simulate({
      ticks: 60,
      scenario: still,
      frames: [{ tick: 0, move: [0, 1] }],
    });
    expect(near(game.pz, TUNING.player_speed, 1e-3)).toBe(true);
    expect(near(game.px, 0, 1e-9)).toBe(true);
  });

  it('rotates the move vector by cam_yaw_deg', () => {
    const { game } = simulate({
      ticks: 60,
      scenario: still,
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
    });
    expect(near(game.px, TUNING.player_speed, 1e-3)).toBe(true);
    expect(near(game.pz, 0, 1e-3)).toBe(true);
  });

  it('normalises diagonal input to length 1', () => {
    const { game } = simulate({ ticks: 60, scenario: still, frames: [{ tick: 0, move: [1, 1] }] });
    expect(near(Math.hypot(game.px, game.pz), TUNING.player_speed, 2e-3)).toBe(true);
  });

  it('keeps Mây on the island while fall_enabled is false', () => {
    const { game } = simulate({ ticks: 1200, scenario: still, frames: [{ tick: 0, move: [0, 1] }] });
    expect(game.pz).toBeLessThanOrEqual(ISLAND_RADIUS + 1e-6);
    expect(near(game.pz, ISLAND_RADIUS, 1e-6)).toBe(true);
  });

  it('jumps without changing the horizontal position', () => {
    const { game } = simulate({
      ticks: 10,
      scenario: still,
      frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }],
    });
    expect(game.py).toBeGreaterThan(0);
    expect(game.px).toBe(0);
    expect(game.pz).toBe(0);
  });
});

describe('motes', () => {
  it('picks up a mote inside pickup_radius and scores per_mote', () => {
    const { game, events } = simulate({
      ticks: 30,
      scenario: { ...still, motes: [[0, 0, 2]] },
      frames: [{ tick: 0, move: [0, 1] }],
    });
    expect(eventNames(events)).toEqual(['mote_picked']);
    expect(events[0]!.data).toEqual({ carried: 1 });
    expect(game.carried).toBe(1);
    expect(game.score).toBe(TUNING.score.per_mote);
    expect(game.motes).toHaveLength(0);
  });

  it('does not pick up a mote outside pickup_radius', () => {
    const { game } = simulate({ ticks: 30, scenario: { ...still, motes: [[0, 0, 10]] } });
    expect(game.carried).toBe(0);
  });

  it('respects carry_capacity', () => {
    const { game, events } = simulate({
      ticks: 5,
      scenario: { ...still, player: { carried: TUNING.carry_capacity }, motes: [[0, 0, 0]] },
    });
    expect(events).toHaveLength(0);
    expect(game.carried).toBe(TUNING.carry_capacity);
  });
});

describe('lanterns', () => {
  it('deposits within interact_radius and lights at lantern_cost', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 2.5], carried: 3 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(eventNames(events)).toEqual(['deposit', 'lantern_lit']);
    expect(events[0]!.data).toEqual({ lantern_id: 'L1', amount: 3, deposited: 3 });
    expect(events[0]!.tick).toBe(1);
    expect(game.carried).toBe(0);
    expect(game.score).toBe(TUNING.score.per_lantern);
  });

  it('deposits only what is missing and keeps the rest', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: {
        ...still,
        player: { pos: [0, 0, 2], carried: 5 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 1 }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(events[0]!.data).toEqual({ lantern_id: 'L1', amount: 2, deposited: 3 });
    expect(game.carried).toBe(3);
  });

  it('does nothing when interacting out of range', () => {
    const { game, events } = simulate({
      ticks: 3,
      scenario: { ...still, player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 9] }] },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(events).toHaveLength(0);
    expect(game.carried).toBe(3);
  });

  it('interact is edge-triggered only on false -> true', () => {
    const { events } = simulate({
      ticks: 5,
      scenario: {
        ...still,
        player: { pos: [0, 0, 2], carried: 6 },
        lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
      },
      frames: [{ tick: 0, interact: true }, { tick: 3, interact: false }],
    });
    expect(eventNames(events)).toEqual(['deposit', 'lantern_lit']);
  });

  it('wins when the last lantern is lit', () => {
    const scenario: Scenario = {
      ...still,
      player: { pos: [0, 0, 15.5], carried: 3 },
      lanterns: [
        { id: 'L1', pos: [0, 0, 15] },
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
    expect(eventNames(events)).toContain('game_over');
    expect(events.at(-1)!.data).toEqual({ result: 'won', reason: 'all_lit' });
    expect(game.score).toBeGreaterThan(TUNING.score.per_lantern);
  });
});

describe('pulse', () => {
  it('stuns, pushes and scores shades inside pulse_radius', () => {
    const { game, events } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: 4 }, shades: [{ pos: [5, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(eventNames(events)).toEqual(['pulse']);
    expect(events[0]!.data).toEqual({ stunned_ids: ['S1'] });
    expect(game.carried).toBe(4 - TUNING.pulse_cost);
    expect(game.score).toBe(TUNING.score.per_stun);
    expect(game.shades[0]!.state).toBe('stunned');
    expect(near(game.shades[0]!.x, 5 + TUNING.pulse_push_m, 1e-6)).toBe(true);
  });

  it('ignores shades outside pulse_radius but still pays the cost', () => {
    const { game, events } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: 4 }, shades: [{ pos: [12, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(events[0]!.data).toEqual({ stunned_ids: [] });
    expect(game.carried).toBe(2);
    expect(game.score).toBe(0);
  });

  it('rejects a pulse with too little light', () => {
    const { game, events } = simulate({
      ticks: 2,
      scenario: { ...still, player: { carried: TUNING.pulse_cost - 1 }, shades: [{ pos: [3, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(events).toHaveLength(0);
    expect(game.shades[0]!.state).toBe('chase');
  });

  it('respects pulse_cooldown_s', () => {
    const { events } = simulate({
      ticks: 60,
      scenario: { ...still, player: { carried: 5 }, shades: [{ pos: [3, 0, 0] }, { pos: [4, 0, 0] }] },
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 30, pulse: true },
        { tick: 31, pulse: false },
      ],
    });
    expect(eventNames(events).filter((n) => n === 'pulse')).toHaveLength(1);
  });

  it('returns stunned shades to chase after pulse_stun_s', () => {
    const { game } = simulate({
      ticks: 240,
      scenario: { ...still, player: { carried: 4 }, shades: [{ pos: [6, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }],
    });
    expect(game.shades[0]!.state).toBe('chase');
  });
});

describe('shades', () => {
  it('chases the player', () => {
    const { game } = simulate({
      ticks: 30,
      scenario: { ...still, shades: [{ pos: [20, 0, 0] }] },
    });
    expect(game.shades[0]!.x).toBeCloseTo(20 - TUNING.shade_speed * 0.5, 3);
  });

  it('hits on contact, costs a flame and drops carried light', () => {
    const { game, events } = simulate({
      ticks: 30,
      scenario: { ...still, player: { carried: 3 }, shades: [{ pos: [0, 0, 1.2] }] },
    });
    const hit = events.find((e) => e.name === 'player_hit');
    expect(hit).toBeDefined();
    expect(hit!.data).toEqual({ by: 'shade', flames: TUNING.flames - 1, dropped: 3 });
    expect(game.carried).toBe(0);
  });

  it('cannot enter the safe_radius of a lit lantern and cannot hit there', () => {
    const { game } = simulate({
      ticks: 300,
      scenario: {
        ...still,
        player: { pos: [0, 0, 0] },
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ pos: [1, 0, 0] }],
      },
    });
    expect(Math.hypot(game.shades[0]!.x, game.shades[0]!.z)).toBeGreaterThanOrEqual(TUNING.safe_radius - 1e-6);
    expect(game.flames).toBe(TUNING.flames);
  });

  it('gives invulnerability after a hit', () => {
    const { events } = simulate({
      ticks: 120,
      scenario: { ...still, player: { flames: 3 }, shades: [{ pos: [0, 0, 1] }] },
    });
    const hits = events.filter((e) => e.name === 'player_hit');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const gap = (hits[1]?.tick ?? Infinity) - hits[0]!.tick;
    expect(gap).toBeGreaterThanOrEqual(Math.ceil(TUNING.invuln_s * 60) - 1);
  });

  it('loses at no_flames', () => {
    const { game, events } = simulate({
      ticks: 120,
      scenario: { ...still, player: { flames: 1 }, shades: [{ pos: [0, 0, 1] }] },
    });
    expect(game.state).toBe('lost');
    expect(events.at(-1)!.name).toBe('game_over');
    expect(events.at(-1)!.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('time and scoring', () => {
  it('loses at dawn when lanterns are still unlit', () => {
    const { game, events } = simulate({ ticks: 200, scenario: { ...still, time_left_s: 1 } });
    expect(game.state).toBe('lost');
    expect(game.tick).toBe(60);
    expect(events.at(-1)!.data).toEqual({ result: 'lost', reason: 'dawn' });
  });

  it('reports time_left_s as duration minus steps / 60', () => {
    const { snapshots } = simulate({ ticks: 120, scenario: still });
    expect(snapshots[120]!.time_left_s).toBe(298);
    expect(snapshots[120]!.sim_tick).toBe(120);
  });

  it('adds time-left and flame bonuses exactly once at the end', () => {
    const { game } = simulate({
      ticks: 5,
      scenario: {
        ...still,
        player: { pos: [0, 0, 2], carried: 3, flames: 3 },
        time_left_s: 300,
        lanterns: [
          { id: 'L1', pos: [0, 0, 0] },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
      },
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    const timeBonus = Math.round((300 - 1 / 60) * TUNING.score.per_second_left);
    expect(game.state).toBe('won');
    expect(game.score).toBe(
      TUNING.score.per_lantern + timeBonus + TUNING.flames * TUNING.score.per_flame_left,
    );
  });
});

describe('world spawning', () => {
  it('is deterministic for the same seed', () => {
    const a = simulate({ ticks: 900, seed: 42 });
    const b = simulate({ ticks: 900, seed: 42 });
    expect(JSON.stringify(a.game.snapshot())).toBe(JSON.stringify(b.game.snapshot()));
    expect(a.events).toEqual(b.events);
  });

  it('spawns random shades over time up to the cap', () => {
    const { game, events } = simulate({
      ticks: 60 * 60,
      scenario: { player: { flames: 99 } },
    });
    expect(events.some((e) => e.name === 'shade_spawned')).toBe(true);
    expect(game.shades.length).toBeLessThanOrEqual(4);
  });

  it('does not spawn when random flags are false', () => {
    const { events } = simulate({ ticks: 60 * 30, scenario: still });
    expect(events).toHaveLength(0);
  });
});
