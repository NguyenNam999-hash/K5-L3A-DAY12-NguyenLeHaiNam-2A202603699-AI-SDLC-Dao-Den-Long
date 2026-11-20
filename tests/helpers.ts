import { Game } from '../src/core/game';
import { InputTrack } from '../src/core/input-track';
import type { InputFrameSpec, Scenario } from '../src/core/scenario';
import type { GameEvent, NightId } from '../src/core/types';

export interface SimOptions {
  ticks: number;
  scenario?: Scenario;
  frames?: InputFrameSpec[];
  seed?: number;
  night?: NightId;
}

export function simulate(opts: SimOptions): {
  game: Game;
  events: GameEvent[];
  snapshots: ReturnType<Game['snapshot']>[];
} {
  const game = new Game({ seed: opts.seed ?? 7, night: opts.night ?? 1, scenario: opts.scenario });
  const track = new InputTrack(opts.frames ?? []);
  const events: GameEvent[] = [];
  const snapshots = [game.snapshot()];
  for (let k = 0; k < opts.ticks; k += 1) {
    if (game.state !== 'playing') break;
    game.step(track.advanceTo(k));
    events.push(...game.drainEvents());
    snapshots.push(game.snapshot());
  }
  return { game, events, snapshots };
}

export function eventNames(events: GameEvent[]): string[] {
  return events.map((e) => e.name);
}

export const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

export const still = { random_motes: false, random_shades: false, random_drifters: false } as const;
