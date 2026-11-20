/**
 * Scripted playthrough bot for Contract v1.1. Proves Night 1 is winnable through
 * the real gameplay core and writes an inputs file replayable with the headless CLI.
 *
 * Usage: npm run bot
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Game } from '../src/core/game';
import type { InputFrameSpec } from '../src/core/scenario';
import { TUNING } from '../src/core/tuning';
import { IDLE_INPUT, type InputFrame } from '../src/core/types';

const SEED = 7;
const MAX_TICKS = 17900;
const OUT_INPUTS = join('evidence', 'phase-2', 'headless', 'bot-inputs.json');

const game = new Game({ seed: SEED, night: 1 });
const frames: InputFrameSpec[] = [];
let last: InputFrame = { ...IDLE_INPUT };

function nearestMote(): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number; d: number } | null = null;
  for (const mote of game.motes) {
    const d = Math.hypot(mote.x - game.px, mote.z - game.pz);
    const guarded = game.shades.some(
      (shade) => shade.state !== 'stunned' && Math.hypot(shade.x - mote.x, shade.z - mote.z) < 7,
    );
    if (guarded) continue;
    if (!best || d < best.d) best = { x: mote.x, y: mote.y, z: mote.z, d };
  }
  if (best) return best;
  for (const mote of game.motes) {
    const d = Math.hypot(mote.x - game.px, mote.z - game.pz);
    if (!best || d < best.d) best = { x: mote.x, y: mote.y, z: mote.z, d };
  }
  return best;
}

function nearestUnlitLantern(): { x: number; y: number; z: number; need: number; d: number } | null {
  let best: { x: number; y: number; z: number; need: number; d: number } | null = null;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const d = Math.hypot(lantern.x - game.px, lantern.z - game.pz);
    if (!best || d < best.d) {
      best = { x: lantern.x, y: lantern.y, z: lantern.z, need: Math.max(0, TUNING.lantern_cost - lantern.deposited), d };
    }
  }
  return best;
}

function nearestThreat(): { x: number; z: number; d: number } | null {
  let best: { x: number; z: number; d: number } | null = null;
  for (const shade of game.shades) {
    if (shade.state === 'stunned' || shade.safeTicks > 0) continue;
    const d = Math.hypot(shade.x - game.px, shade.z - game.pz);
    if (!best || d < best.d) best = { x: shade.x, z: shade.z, d };
  }
  return best;
}

function decide(tick: number): { input: InputFrame; spec: InputFrameSpec | null } {
  const lantern = nearestUnlitLantern();
  const threat = nearestThreat();
  // Fetch five motes, deposit them, repeat. Short trips lose less to a hit.
  let target: { x: number; z: number } | null = null;
  if (lantern && game.carried >= 5) target = lantern;
  else target = nearestMote() ?? lantern;

  const input: InputFrame = { ...IDLE_INPUT, camYawDeg: 0 };

  const radius = Math.hypot(game.px, game.pz);
  // Potential field: pull toward the objective, push away from every nearby shade.
  let dx = 0;
  let dz = 0;
  if (target) {
    const d = Math.hypot(target.x - game.px, target.z - game.pz);
    if (d > 0.05) {
      dx = (target.x - game.px) / d;
      dz = (target.z - game.pz) / d;
    }
  }
  for (const shade of game.shades) {
    if (shade.state === 'stunned') continue;
    const d = Math.hypot(shade.x - game.px, shade.z - game.pz);
    if (d < 9 && d > 1e-6) {
      const w = ((9 - d) / 9) ** 1.5 * 2.4;
      dx += ((game.px - shade.x) / d) * w;
      dz += ((game.pz - shade.z) / d) * w;
    }
  }
  if (radius > 35) {
    dx -= (game.px / radius) * 1.1;
    dz -= (game.pz / radius) * 1.1;
  }
  const len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    input.moveX = dx / len;
    input.moveZ = dz / len;
  }
  if (threat && threat.d < 5) {
    let ax = game.px - threat.x;
    let az = game.pz - threat.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al;
    az /= al;
    if (radius > 32) {
      const outward = ax * (game.px / radius) + az * (game.pz / radius);
      if (outward > 0) {
        ax -= (game.px / radius) * outward;
        az -= (game.pz / radius) * outward;
      }
      const l2 = Math.hypot(ax, az) || 1;
      ax /= l2;
      az /= l2;
    }
    input.moveX = ax;
    input.moveZ = az;
  }
  const close = threat && threat.d < 3.8;
  if (close && game.dashCdTicks <= 0 && radius < 33) input.dash = true;

  const nearLantern =
    lantern && lantern.d <= TUNING.interact_radius - 0.25 && Math.abs(lantern.y - game.py) <= 1.5;
  if (nearLantern && game.carried > 0 && lantern.need > 0) input.interact = true;
  if (game.pulseCdTicks <= 0 && game.carried >= TUNING.pulse_cost && threat && threat.d < 4.8) {
    input.pulse = true;
  }

  const spec: InputFrameSpec = { tick };
  let changed = false;
  if (input.moveX !== last.moveX || input.moveZ !== last.moveZ) {
    spec.move = [input.moveX, input.moveZ];
    changed = true;
  }
  for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) {
    if (input[key] !== last[key]) {
      spec[key] = input[key];
      changed = true;
    }
  }
  return { input, spec: changed ? spec : null };
}

for (let tick = 0; tick < MAX_TICKS && game.state === 'playing'; tick += 1) {
  const { input, spec } = decide(tick);
  if (spec) frames.push(spec);
  game.step(input);
  last = input;
}

const summary = {
  seed: SEED,
  night: 1,
  state: game.state,
  ticks: game.tick,
  score: game.score,
  time_left_s: Number(game.timeLeft().toFixed(3)),
  flames: game.flames,
  carried: game.carried,
  stats: game.stats,
  lanterns: game.lanterns.map((l) => ({ id: l.id, lit: l.lit, deposited: l.deposited })),
  inputs_frames: frames.length,
};

mkdirSync(dirname(OUT_INPUTS), { recursive: true });
writeFileSync(OUT_INPUTS, `${JSON.stringify({ frames }, null, 2)}\n`);
writeFileSync(join('evidence', 'phase-2', 'headless', 'bot-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (game.state !== 'won') {
  console.error('BOT FAILED: game did not end in a win');
  process.exit(1);
}
