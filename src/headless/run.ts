import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Game } from '../core/game';
import { InputTrack } from '../core/input-track';
import { parseInputs, parseScenario } from '../core/parse';
import { FormatError, type InputsFile, type Scenario } from '../core/scenario';

export class UsageError extends Error {}

interface Args {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  snapshotEvery: number;
  scenarioPath?: string;
  inputsPath?: string;
}

const USAGE = `Usage: node dist-node/headless/main.js --seed <int> --night 1 --ticks <int> --out <file.jsonl>
       [--scenario <file.json>] [--inputs <file.json>] [--snapshot-every <int>]`;

function readInt(argv: string[], i: number, flag: string): number {
  const raw = argv[i];
  if (raw === undefined) throw new UsageError(`${flag}: missing value\n${USAGE}`);
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new UsageError(`${flag}: expected an integer, got "${raw}"\n${USAGE}`);
  return value;
}

export function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { snapshotEvery: 10 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    switch (flag) {
      case '--seed':
        args.seed = readInt(argv, ++i, flag);
        break;
      case '--night':
        args.night = readInt(argv, ++i, flag);
        break;
      case '--ticks':
        args.ticks = readInt(argv, ++i, flag);
        break;
      case '--snapshot-every': {
        const every = readInt(argv, ++i, flag);
        if (every <= 0) throw new UsageError('--snapshot-every: expected a positive integer');
        args.snapshotEvery = every;
        break;
      }
      case '--out':
        args.out = argv[++i];
        break;
      case '--scenario':
        args.scenarioPath = argv[++i];
        break;
      case '--inputs':
        args.inputsPath = argv[++i];
        break;
      case '--help':
      case '-h':
        throw new UsageError(USAGE);
      default:
        throw new UsageError(`unknown argument "${flag}"\n${USAGE}`);
    }
  }

  if (args.seed === undefined) throw new UsageError(`--seed is required\n${USAGE}`);
  if (args.ticks === undefined) throw new UsageError(`--ticks is required\n${USAGE}`);
  if (!args.out) throw new UsageError(`--out is required\n${USAGE}`);
  if (args.ticks < 0) throw new UsageError('--ticks: expected >= 0');
  if (args.night === undefined) args.night = 1;
  if (args.night !== 1) throw new UsageError(`--night: only night 1 exists in Phase 1 (got ${args.night})`);
  return args as Args;
}

function readJson(path: string, label: string): unknown {
  if (!existsSync(path)) throw new FormatError(`${label} file not found: ${path}`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new FormatError(`${label} file cannot be read: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new FormatError(`${label} file is not valid JSON: ${(err as Error).message}`);
  }
}

export function loadScenario(path: string): Scenario {
  return parseScenario(readJson(path, 'scenario'));
}

export function loadInputs(path: string): InputsFile {
  return parseInputs(readJson(path, 'inputs'));
}

/** Runs one headless simulation and writes the JSONL file. Returns the process exit code. */
export function runHeadless(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  let scenario: Scenario | undefined;
  let inputs: InputsFile = { frames: [] };
  try {
    if (args.scenarioPath) scenario = loadScenario(args.scenarioPath);
    if (args.inputsPath) inputs = loadInputs(args.inputsPath);
  } catch (err) {
    const message = err instanceof FormatError ? err.message : `invalid input: ${(err as Error).message}`;
    process.stderr.write(`${message}\n`);
    return 2;
  }

  const lines: string[] = [];
  try {
    const game = new Game({ seed: args.seed, scenario });
    const track = new InputTrack(inputs.frames);

    lines.push(JSON.stringify(game.snapshot()));
    for (let k = 0; k < args.ticks; k += 1) {
      if (game.state !== 'playing') break;
      game.step(track.advanceTo(k));
      for (const event of game.drainEvents()) lines.push(JSON.stringify(event));
      if ((k + 1) % args.snapshotEvery === 0) lines.push(JSON.stringify(game.snapshot()));
    }
    lines.push(JSON.stringify(game.endRecord()));

    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${lines.join('\n')}\n`, 'utf8');
  } catch (err) {
    process.stderr.write(`simulation error: ${(err as Error).message}\n`);
    return 3;
  }
  return 0;
}
