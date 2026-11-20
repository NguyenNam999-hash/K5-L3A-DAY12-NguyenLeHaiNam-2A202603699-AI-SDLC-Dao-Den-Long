/**
 * Scripted playthrough bot for Contract v1.2. Proves Night 1 is winnable under the
 * "keep the lanterns burning until dawn" rule and writes an inputs file replayable
 * with the headless CLI.
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
const MAX_TICKS = 14_500;
const OUT_DIR = join('evidence', 'phase-3', 'headless');

const game = new Game({ seed: SEED, night: 1 });
const frames: InputFrameSpec[] = [];
let last: InputFrame = { ...IDLE_INPUT };

interface Point {
  x: number;
  y: number;
  z: number;
}

function nearestMote(): Point | null {
  let best: (Point & { d: number }) | null = null;
  for (const mote of game.motes) {
    const d = Math.hypot(mote.x - game.px, mote.z - game.pz);
    const guarded = game.shades.some(
      (shade) => shade.state !== 'stunned' && Math.hypot(shade.x - mote.x, shade.z - mote.z) < 3,
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

function nearestUnlit(): (Point & { id: string; need: number; d: number; score: number }) | null {
  let best: (Point & { id: string; need: number; d: number; score: number }) | null = null;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const required = lantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const d = Math.hypot(lantern.x - game.px, lantern.z - game.pz);
    const guard = Math.min(...game.shades.map((shade) => Math.hypot(shade.x - lantern.x, shade.z - lantern.z)), 20);
    const score = d + Math.max(0, 9 - guard) * 2.5;
    if (!best || score < best.score) {
      best = { id: lantern.id, x: lantern.x, y: lantern.y, z: lantern.z, need: Math.max(0, required - lantern.deposited), d, score };
    }
  }
  return best;
}

function weakestLit(): (Point & { id: string; need: number; fuel: number; d: number }) | null {
  let best: (Point & { id: string; need: number; fuel: number; d: number }) | null = null;
  for (const lantern of game.lanterns) {
    if (!lantern.lit) continue;
    const fuel = game.fuelOf(lantern);
    const need = Math.max(1, Math.ceil((TUNING.fuel_max - fuel) / TUNING.fuel_per_mote));
    if (!best || fuel < best.fuel) {
      best = {
        id: lantern.id,
        x: lantern.x,
        y: lantern.y,
        z: lantern.z,
        need,
        fuel,
        d: Math.hypot(lantern.x - game.px, lantern.z - game.pz),
      };
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
  const threat = nearestThreat();
  const litCount = game.litCount();
  const unlit = nearestUnlit();
  const weak = weakestLit();

  // Contract v1.2 rewards lanterns that are still lit at dawn, so pre-fill three
  // lanterns to 5 motes and only light them in the final 100 seconds.
  type Goal = { kind: 'lantern'; lantern: Point } | { kind: 'mote' } | { kind: 'idle' };
  let goal: Goal = { kind: 'idle' };
  const CHOSEN = ['L1', 'L2', 'L3'];
  const PREFILL = 5;
  const timeLeft = game.timeLeft();
  const lightPhase = timeLeft <= 90;
  const chosen = CHOSEN.map((id) => game.lanterns.find((l) => l.id === id)).filter(
    (l): l is NonNullable<typeof l> => Boolean(l),
  );

  if (litCount >= 3) {
    // Keep the three alive only when their fuel would run out before dawn.
    const dying = game.lanterns
      .filter((l) => l.lit && game.fuelOf(l) < Math.max(6, timeLeft + 3))
      .sort((a, b) => game.fuelOf(a) - game.fuelOf(b))[0];
    goal = dying && game.carried > 0 ? { kind: 'lantern', lantern: dying } : { kind: 'mote' };
  } else if (!lightPhase) {
    // Pre-fill phase: bank 5 motes in each chosen lantern but never light it yet.
    const room = chosen.filter((l) => !l.lit && l.deposited < PREFILL);
    const targetLantern = room[0];
    if (targetLantern) {
      const canDeposit = game.carried > 0 && game.carried < TUNING.lantern_cost - targetLantern.deposited;
      goal = game.carried >= PREFILL && canDeposit ? { kind: 'lantern', lantern: targetLantern } : { kind: 'mote' };
    } else {
      goal = { kind: 'mote' };
    }
  } else {
    // Light phase: finish the three chosen lanterns, nearest first.
    const dark = chosen
      .filter((l) => !l.lit)
      .sort(
        (a, b) =>
          Math.hypot(a.x - game.px, a.z - game.pz) - Math.hypot(b.x - game.px, b.z - game.pz),
      )[0];
    if (dark) {
      const need = Math.max(1, TUNING.lantern_cost - dark.deposited);
      const dist = Math.hypot(dark.x - game.px, dark.z - game.pz);
      goal =
        game.carried > 0 && (game.carried >= need || timeLeft < 45 || dist < 4)
          ? { kind: 'lantern', lantern: dark }
          : { kind: 'mote' };
    } else {
      goal = { kind: 'mote' };
    }
  }

  let target: { x: number; z: number } | null = null;
  if (goal.kind === 'lantern') target = goal.lantern;
  else if (goal.kind === 'mote') target = nearestMote() ?? unlit ?? weak ?? null;

  const input: InputFrame = { ...IDLE_INPUT, camYawDeg: 0 };
  const radius = Math.hypot(game.px, game.pz);

  // Shelter: a healthy lit lantern repels shades, so run for its circle when cornered.
  let shelter: (Point & { fuel: number }) | null = null;
  if (threat && threat.d < 7) {
    let bestD = Infinity;
    for (const lantern of game.lanterns) {
      if (!lantern.lit) continue;
      const fuel = game.fuelOf(lantern);
      if (fuel < 40) continue;
      const d = Math.hypot(lantern.x - game.px, lantern.z - game.pz);
      if (d < bestD) {
        bestD = d;
        shelter = { x: lantern.x, y: lantern.y, z: lantern.z, fuel };
      }
    }
    if (shelter && bestD > 22) shelter = null;
  }

  let dx = 0;
  let dz = 0;
  const targetDist = target ? Math.hypot(target.x - game.px, target.z - game.pz) : Infinity;
  const pressing = goal.kind === 'lantern' && targetDist < 8;
  const aim = shelter ?? target;
  if (aim) {
    const d = Math.hypot(aim.x - game.px, aim.z - game.pz);
    if (d > 0.05) {
      dx = (aim.x - game.px) / d;
      dz = (aim.z - game.pz) / d;
    }
  }
  for (const shade of game.shades) {
    if (shade.state === 'stunned') continue;
    const d = Math.hypot(shade.x - game.px, shade.z - game.pz);
    if (d < 7 && d > 1e-6 && !shelter && !pressing) {
      const w = ((7 - d) / 7) ** 1.4 * 2.6;
      dx += ((game.px - shade.x) / d) * w;
      dz += ((game.pz - shade.z) / d) * w;
    }
  }
  if (radius > 28) {
    dx -= (game.px / radius) * ((radius - 28) / 6);
    dz -= (game.pz / radius) * ((radius - 28) / 6);
  }
  const len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    input.moveX = dx / len;
    input.moveZ = dz / len;
  }
  if (threat && threat.d < 3.4 && (!pressing || threat.d < 2.3)) {
    let ax = game.px - threat.x;
    let az = game.pz - threat.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al;
    az /= al;
    if (radius > 27) {
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
  const close = threat && threat.d < 5;
  if (close && game.dashCdTicks <= 0 && radius < 33) input.dash = true;

  // Interact on a rising edge. Refuel any lit lantern in range, and deposit into
  // the committed target while it is still dark.
  if (game.carried > 0 && !last.interact) {
    const inRange = game.lanterns.filter(
      (l) =>
        Math.hypot(l.x - game.px, l.z - game.pz) <= TUNING.interact_radius - 0.2 && Math.abs(l.y - game.py) <= 1.5,
    );
    const refuel = game.litCount() >= 3 ? inRange.find((l) => l.lit && game.fuelOf(l) < 99) : undefined;
    const goalHere =
      goal.kind === 'lantern' && inRange.some((l) => l.id === goal.lantern.id && (!l.lit || game.fuelOf(l) < 100));
    if (refuel || goalHere) input.interact = true;
  }
  if (game.pulseCdTicks <= 0 && game.carried >= 3 && threat && threat.d < 3) {
    input.pulse = true;
  }

  if (process.env.BOT_DEBUG && tick % 600 === 0) {
    const g = goal.kind === 'lantern' ? `lantern:${game.lanterns.findIndex((l) => l.x === goal.lantern.x)}` : goal.kind;
    console.error(`  goal=${g} targetDist=${targetDist.toFixed(1)} pressing=${String(pressing)}`);
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
  if (process.env.BOT_DEBUG) {
    for (const event of game.drainEvents()) {
      if (event.name === 'lantern_lit' || event.name === 'lantern_out') {
        console.error(`  ${event.name} ${JSON.stringify(event.data)} at t=${event.tick}`);
      }
    }
  }
  if (process.env.BOT_DEBUG && tick % 120 === 0) {
    const near = Math.min(...game.shades.map((s) => Math.hypot(s.x - game.px, s.z - game.pz)), 99);
    console.error(
      `t=${tick} pos=${game.px.toFixed(1)},${game.pz.toFixed(1)} flames=${game.flames} lit=${game.litCount()} carried=${game.carried} shades=${game.shades.length} near=${near.toFixed(1)}`,
    );
  }
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
  capacity: game.capacity,
  lit: game.litCount(),
  win_threshold: game.winThreshold(),
  stats: game.stats,
  lanterns: game.lanterns.map((l) => ({
    id: l.id,
    lit: l.lit,
    fuel: Number(game.fuelOf(l).toFixed(1)),
    ever_lit: l.everLit,
    relit_count: l.relitCount,
  })),
  inputs_frames: frames.length,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'bot-inputs.json'), `${JSON.stringify({ frames }, null, 2)}\n`);
writeFileSync(join(OUT_DIR, 'bot-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (game.state !== 'won') {
  console.error('BOT FAILED: game did not end in a win');
  process.exit(1);
}
