import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as v8 from 'node:v8';
import * as vm from 'node:vm';
import { Game } from '../core/game';
import { Rng } from '../core/rng';
import { IDLE_INPUT, type InputFrame, type NightId } from '../core/types';

export interface SoakReport {
  nights: number;
  crashes: number;
  results: ('won' | 'lost')[];
  mem_start_mb: number;
  mem_end_mb: number;
  duration_s: number;
}

export interface SoakArgs {
  seed: number;
  nights: number;
  out: string;
}

export class SoakUsageError extends Error {}

const USAGE = 'Usage: node dist-node/headless/soak.js --seed <int> --nights <int> --out <file.json>';

function readInt(argv: string[], i: number, flag: string): number {
  const raw = argv[i];
  if (raw === undefined) throw new SoakUsageError(`${flag}: missing value\n${USAGE}`);
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new SoakUsageError(`${flag}: expected an integer, got "${raw}"\n${USAGE}`);
  return value;
}

export function parseSoakArgs(argv: string[]): SoakArgs {
  const args: Partial<SoakArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    switch (flag) {
      case '--seed':
        args.seed = readInt(argv, ++i, flag);
        break;
      case '--nights':
        args.nights = readInt(argv, ++i, flag);
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--help':
      case '-h':
        throw new SoakUsageError(USAGE);
      default:
        throw new SoakUsageError(`unknown argument "${flag}"\n${USAGE}`);
    }
  }
  if (args.seed === undefined) throw new SoakUsageError(`--seed is required\n${USAGE}`);
  if (args.nights === undefined) throw new SoakUsageError(`--nights is required\n${USAGE}`);
  if (!args.out) throw new SoakUsageError(`--out is required\n${USAGE}`);
  if (args.nights < 1) throw new SoakUsageError('--nights: expected >= 1');
  return args as SoakArgs;
}

function rssMb(): number {
  return Math.round(process.memoryUsage().rss / 1048576);
}

/** Best-effort collection so RSS sampling is not dominated by pending garbage. */
function forceGc(): void {
  try {
    v8.setFlagsFromString('--expose-gc');
    (vm.runInNewContext('gc') as () => void)();
  } catch {
    /* older Node or hardened runtime: keep the raw RSS sample */
  }
}

/** One discarded night warms V8 code pages, so mem_start measures the game, not the JIT. */
function warmUp(seed: number): void {
  const game = new Game({ seed, night: 1 });
  const maxTicks = Math.round(game.config.durationS * 60);
  for (let tick = 0; tick < maxTicks && game.state === 'playing'; tick += 1) {
    game.step({ ...IDLE_INPUT });
    game.drainEvents();
  }
  forceGc();
}

function nightFor(index: number): NightId {
  return (((index - 1) % 3) + 1) as NightId;
}

/** Seeded random input: new direction every 30 ticks, per-tick action chances. */
function soakInput(rng: Rng, moveX: number, moveZ: number): InputFrame {
  return {
    moveX,
    moveZ,
    camYawDeg: (Math.atan2(moveX, moveZ) * 180) / Math.PI,
    jump: rng.next() < 0.05,
    dash: rng.next() < 0.03,
    pulse: rng.next() < 0.02,
    interact: rng.next() < 0.1,
    pause: false,
  };
}

/** Plays `nights` consecutive nights in one process and reports stability. */
export function runSoakSimulation(baseSeed: number, nights: number): SoakReport {
  const started = process.hrtime.bigint();
  const results: ('won' | 'lost')[] = [];
  let crashes = 0;
  let game: Game | null = null;
  let memStart = 0;

  warmUp(baseSeed);

  for (let index = 1; index <= nights; index += 1) {
    const night = nightFor(index);
    const seed = baseSeed + index;
    try {
      game = new Game({ seed, night });
      if (index === 1) {
        forceGc();
        memStart = rssMb();
      }
      const rng = new Rng(seed);
      let moveX = 0;
      let moveZ = 0;
      const maxTicks = Math.round(game.config.durationS * 60);
      while (game.state === 'playing' && game.simTick < maxTicks) {
        const tick = game.simTick;
        if (tick % 30 === 0) {
          moveX = Math.floor(rng.next() * 3) - 1;
          moveZ = Math.floor(rng.next() * 3) - 1;
        }
        game.step(soakInput(rng, moveX, moveZ));
        game.drainEvents();
      }
      results.push(game.state === 'won' ? 'won' : 'lost');
      game = null;
    } catch {
      crashes += 1;
      results.push('lost');
      game = null;
    }
  }

  forceGc();
  const memEnd = rssMb();
  const durationS = Number(process.hrtime.bigint() - started) / 1e9;
  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStart,
    mem_end_mb: memEnd,
    duration_s: Math.round(durationS * 10) / 10,
  };
}

/** CLI entry. Returns the process exit code. */
export function runSoak(argv: string[]): number {
  let args: SoakArgs;
  try {
    args = parseSoakArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
  try {
    const report = runSoakSimulation(args.seed, args.nights);
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`soak error: ${(err as Error).message}\n`);
    return 1;
  }
  return 0;
}
