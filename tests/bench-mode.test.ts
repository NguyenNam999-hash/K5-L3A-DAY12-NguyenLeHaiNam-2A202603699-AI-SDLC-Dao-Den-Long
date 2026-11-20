import { describe, expect, it } from 'vitest';
import { createBenchScenario, BENCH } from '../src/core/bench-scenario';
import { Game } from '../src/core/game';
import { IDLE_INPUT } from '../src/core/types';

describe('benchmark mode', () => {
  it('builds the standard scene: 200 wander shades, 100 motes, L1-L3 lit', () => {
    const game = new Game({ seed: 42, night: 1, benchmark: true, scenario: createBenchScenario(42) });
    expect(game.shades.length).toBe(BENCH.shadeCount);
    expect(game.motes.length).toBe(BENCH.moteCount);
    expect(game.lanterns.filter((l) => l.lit).map((l) => l.id)).toEqual(['L1', 'L2', 'L3']);
    for (const lantern of game.lanterns.filter((l) => l.lit)) {
      expect(game.fuelOf(lantern)).toBe(100);
    }
    expect(game.px).toBe(0);
    expect(game.pz).toBe(0);
  });

  it('freezes fuel, motes, damage and end conditions for 600 ticks', () => {
    const game = new Game({ seed: 42, night: 1, benchmark: true, scenario: createBenchScenario(42) });
    for (let i = 0; i < 600; i += 1) game.step(IDLE_INPUT);
    expect(game.state).toBe('playing');
    expect(game.motes.length).toBe(BENCH.moteCount);
    expect(game.flames).toBe(3);
    expect(game.fuelOf(game.lanterns[0]!)).toBe(100);
    expect(game.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(game.score).toBe(0);
  });

  it('keeps shades wandering without draining or chasing the player', () => {
    const game = new Game({ seed: 42, night: 1, benchmark: true, scenario: createBenchScenario(42) });
    const before = game.shades.map((s) => [s.x, s.z]);
    for (let i = 0; i < 300; i += 1) game.step(IDLE_INPUT);
    const moved = game.shades.filter((s, i) => Math.hypot(s.x - before[i]![0]!, s.z - before[i]![1]!) > 0.01);
    expect(moved.length).toBe(BENCH.shadeCount);
    expect(game.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(game.lanterns.slice(0, 3).every((l) => game.fuelOf(l) === 100)).toBe(true);
  });

  it('places the same scene for the same seed', () => {
    const a = createBenchScenario(42);
    const b = createBenchScenario(42);
    expect(a.shades).toEqual(b.shades);
    expect(a.motes).toEqual(b.motes);
  });
});
