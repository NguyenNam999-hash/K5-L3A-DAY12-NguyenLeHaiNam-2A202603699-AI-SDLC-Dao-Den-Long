/**
 * Scripted playthrough bot. Proves Night 1 is winnable through the real gameplay core.
 * It writes an inputs file that can be replayed with the headless CLI.
 *
 * Usage: npm run bot
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Game } from '../src/core/game';
import type { InputFrameSpec } from '../src/core/scenario';
import { TUNING } from '../src/core/tuning';
import type { InputFrame } from '../src/core/types';

const SEED = 7;
const MAX_TICKS = 18000;
const OUT_INPUTS = join('evidence', 'phase-1', 'headless', 'bot-inputs.json');

const game = new Game({ seed: SEED });
const frames: InputFrameSpec[] = [];
let last: InputFrame = {
  moveX: 0,
  moveZ: 0,
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
};

function nearestMote(): { x: number; z: number } | null {
  let best: { x: number; z: number; d: number } | null = null;
  for (const mote of game.motes) {
    const d = Math.hypot(mote.x - game.px, mote.z - game.pz);
    if (!best || d < best.d) best = { x: mote.x, z: mote.z, d };
  }
  return best;
}

function nearestUnlitLantern(): { x: number; z: number; need: number; d: number } | null {
  let best: { x: number; z: number; need: number; d: number } | null = null;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const d = Math.hypot(lantern.x - game.px, lantern.z - game.pz);
    if (!best || d < best.d) {
      best = { x: lantern.x, z: lantern.z, need: Math.max(0, TUNING.lantern_cost - lantern.deposited), d };
    }
  }
  return best;
}

function nearestShadeDistance(): number {
  let best = Infinity;
  for (const shade of game.shades) {
    best = Math.min(best, Math.hypot(shade.x - game.px, shade.z - game.pz));
  }
  return best;
}

function decide(tick: number): { input: InputFrame; spec: InputFrameSpec | null } {
  const lantern = nearestUnlitLantern();
  const mote = nearestMote();

  let target: { x: number; z: number } | null = null;
  if (lantern && game.carried >= lantern.need) target = lantern;
  else target = mote ?? lantern;

  const input: InputFrame = { moveX: 0, moveZ: 0, camYawDeg: 0, jump: false, interact: false, pulse: false };
  if (target) {
    const dx = target.x - game.px;
    const dz = target.z - game.pz;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      input.moveX = dx / d;
      input.moveZ = dz / d;
    }
  }

  if (lantern && lantern.d <= TUNING.interact_radius - 0.35 && game.carried > 0 && lantern.need > 0) {
    input.interact = true;
  }
  if (game.pulseCd <= 0 && game.carried >= TUNING.pulse_cost && nearestShadeDistance() < 6.5) {
    input.pulse = true;
  }

  const spec: InputFrameSpec = { tick };
  let changed = false;
  if (input.moveX !== last.moveX || input.moveZ !== last.moveZ) {
    spec.move = [input.moveX, input.moveZ];
    changed = true;
  }
  if (input.jump !== last.jump) {
    spec.jump = input.jump;
    changed = true;
  }
  if (input.interact !== last.interact) {
    spec.interact = input.interact;
    changed = true;
  }
  if (input.pulse !== last.pulse) {
    spec.pulse = input.pulse;
    changed = true;
  }
  return { input, spec: changed ? spec : null };
}

let interactedTick = -1;
for (let tick = 0; tick < MAX_TICKS && game.state === 'playing'; tick += 1) {
  const { input, spec } = decide(tick);
  if (spec) frames.push(spec);
  if (input.interact) interactedTick = tick;
  game.step(input);
  last = input;
}

const summary = {
  seed: SEED,
  state: game.state,
  ticks: game.tick,
  score: game.score,
  time_left_s: Number(game.timeLeft().toFixed(3)),
  flames: game.flames,
  carried: game.carried,
  stats: game.stats,
  lanterns: game.lanterns.map((l) => ({ id: l.id, lit: l.lit, deposited: l.deposited })),
  last_interact_tick: interactedTick,
  inputs_frames: frames.length,
};

mkdirSync(dirname(OUT_INPUTS), { recursive: true });
writeFileSync(OUT_INPUTS, `${JSON.stringify({ frames }, null, 2)}\n`);
writeFileSync(join('evidence', 'phase-1', 'headless', 'bot-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (game.state !== 'won') {
  console.error('BOT FAILED: game did not end in a win');
  process.exit(1);
}
