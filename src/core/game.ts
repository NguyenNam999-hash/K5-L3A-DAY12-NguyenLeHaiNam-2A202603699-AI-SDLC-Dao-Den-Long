import { Rng } from './rng';
import { FormatError, type Scenario } from './scenario';
import {
  DT,
  ISLAND_RADIUS,
  MOTE_SPAWN_INTERVAL_S,
  MOTE_TARGET,
  NIGHT1_LANTERNS,
  SHADE_CAP,
  SHADE_SPAWN_INTERVAL_S,
  TUNING,
} from './tuning';
import type {
  EndRecord,
  GameEvent,
  GameEventName,
  GameStateName,
  InputFrame,
  Lantern,
  Mote,
  Shade,
  Snapshot,
} from './types';

export function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface GameOptions {
  seed: number;
  scenario?: Scenario;
  random?: Rng;
}

/**
 * Headless-safe gameplay core. Deterministic: same seed + scenario + inputs => same events.
 * Rendering reads this state; it never writes it.
 */
export class Game {
  readonly tuning = TUNING;

  tick = 0;
  state: GameStateName = 'playing';
  score = 0;

  px = 0;
  py = 0;
  pz = 0;
  vy = 0;
  carried = 0;
  flames = TUNING.flames;
  invuln = 0;
  pulseCd = 0;

  motes: Mote[] = [];
  shades: Shade[] = [];
  lanterns: Lantern[] = [];

  readonly events: GameEvent[] = [];
  readonly stats = { motes: 0, lanterns: 0, stuns: 0, hits: 0 };

  private readonly rng: Rng;
  private randomMotes = true;
  private randomShades = true;
  private moteTimer = 0;
  private shadeTimer = 0;
  private moteSeq = 0;
  private shadeSeq = 0;
  private timeBase = TUNING.night1_duration_s;
  private prev: InputFrame = { moveX: 0, moveZ: 0, camYawDeg: 0, jump: false, interact: false, pulse: false };

  constructor(opts: GameOptions) {
    this.rng = opts.random ?? new Rng(opts.seed);
    this.buildNight1(opts.scenario);
  }

  get steps(): number {
    return this.tick;
  }

  timeLeft(): number {
    return Math.max(0, this.timeBase - this.tick * DT);
  }

  /** One fixed 1/60 s step. Reads the input of tick `k`, produces state `k+1`. */
  step(input: InputFrame): void {
    if (this.state !== 'playing') return;
    this.tick += 1;
    const dt = DT;

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.pulseCd > 0) this.pulseCd = Math.max(0, this.pulseCd - dt);

    this.movePlayer(input, dt);
    this.jumpPlayer(input, dt);
    this.collectMotes();

    if (input.interact && !this.prev.interact) this.tryInteract();
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    if (input.pulse && !this.prev.pulse && this.pulseCd <= 0 && this.carried >= TUNING.pulse_cost) {
      this.pulse();
    }
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    this.updateShades(dt);
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    this.updateSpawns(dt);

    if (this.timeLeft() <= 0) {
      this.finish(this.allLit() ? 'won' : 'lost', this.allLit() ? 'all_lit' : 'dawn');
    }

    this.prev = { ...input };
  }

  snapshot(): Snapshot {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeft()),
      score: this.score,
      player: { pos: [r3(this.px), r3(this.py), r3(this.pz)], flames: this.flames, carried: this.carried },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [r3(l.x), 0, r3(l.z)],
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [r3(s.x), 1, r3(s.z)],
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: [r3(m.x), 0, r3(m.z)] })),
    };
  }

  endRecord(): EndRecord {
    return { type: 'end', ticks: this.tick, state: this.state, score: this.score };
  }

  /** Events emitted since the last drain. */
  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private buildNight1(scenario: Scenario | undefined): void {
    this.lanterns = NIGHT1_LANTERNS.map((l) => ({ id: l.id, x: l.x, z: l.z, lit: false, deposited: 0 }));

    if (scenario) {
      this.randomMotes = scenario.random_motes !== false;
      this.randomShades = scenario.random_shades !== false;
      if (scenario.player) {
        if (scenario.player.pos) {
          this.px = scenario.player.pos[0];
          this.pz = scenario.player.pos[2];
        }
        if (scenario.player.carried !== undefined) this.carried = scenario.player.carried;
        if (scenario.player.flames !== undefined) this.flames = scenario.player.flames;
      }
      if (scenario.motes) {
        this.motes = scenario.motes.map((p) => ({ id: `M${++this.moteSeq}`, x: p[0], z: p[2] }));
      }
      if (scenario.shades) {
        this.shades = scenario.shades.map((s) => ({
          id: s.id ?? `S${++this.shadeSeq}`,
          x: s.pos[0],
          z: s.pos[2],
          state: 'chase',
          stunTimer: 0,
        }));
      }
      if (scenario.lanterns) {
        for (const spec of scenario.lanterns) {
          const lantern = this.lanterns.find((l) => l.id === spec.id);
          if (!lantern) throw new FormatError(`scenario.lanterns: unknown lantern id "${spec.id}"`);
          if (spec.pos) {
            lantern.x = spec.pos[0];
            lantern.z = spec.pos[2];
          }
          if (spec.deposited !== undefined) lantern.deposited = spec.deposited;
          // Pre-lit lanterns give no score and emit no event.
          if (spec.lit !== undefined) lantern.lit = spec.lit;
        }
      }
      if (scenario.time_left_s !== undefined) this.timeBase = scenario.time_left_s;
    }

    // Literal lanterns already lit hold their safe circle from tick 0.
    for (const shade of this.shades) this.keepOutOfLanternLight(shade);

    // Scenario setup never emits events and never scores.
    if (!scenario?.motes && this.randomMotes) {
      for (let i = 0; i < 12; i += 1) this.spawnMote();
    }
    if (!scenario?.shades && this.randomShades) {
      for (let i = 0; i < 2; i += 1) this.spawnShade(false, 24, 32);
    }
  }

  private allLit(): boolean {
    return this.lanterns.every((l) => l.lit);
  }

  private movePlayer(input: InputFrame, dt: number): void {
    let mx = input.moveX;
    let mz = input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const theta = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
    const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
    this.px += wx * TUNING.player_speed * dt;
    this.pz += wz * TUNING.player_speed * dt;

    // fall_enabled = false: a soft railing keeps Mây on the island.
    const r = Math.hypot(this.px, this.pz);
    if (r > ISLAND_RADIUS) {
      this.px = (this.px / r) * ISLAND_RADIUS;
      this.pz = (this.pz / r) * ISLAND_RADIUS;
    }
  }

  private jumpPlayer(input: InputFrame, dt: number): void {
    if (input.jump && !this.prev.jump && this.py <= 0.0001) this.vy = 5.5;
    if (this.py > 0 || this.vy > 0) {
      this.vy -= 16 * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) {
        this.py = 0;
        this.vy = 0;
      }
    }
  }

  private collectMotes(): void {
    if (this.carried >= TUNING.carry_capacity) return;
    const r2 = TUNING.pickup_radius * TUNING.pickup_radius;
    for (let i = this.motes.length - 1; i >= 0; i -= 1) {
      if (this.carried >= TUNING.carry_capacity) break;
      const m = this.motes[i]!;
      const dx = m.x - this.px;
      const dz = m.z - this.pz;
      if (dx * dx + dz * dz <= r2) {
        this.motes.splice(i, 1);
        this.carried += 1;
        this.score += TUNING.score.per_mote;
        this.stats.motes += 1;
        this.emit('mote_picked', { carried: this.carried });
      }
    }
  }

  private tryInteract(): void {
    let best: Lantern | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(l.x - this.px, l.z - this.pz);
      if (d <= TUNING.interact_radius && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (!best) return;

    const need = Math.max(0, TUNING.lantern_cost - best.deposited);
    const amount = Math.min(this.carried, need);
    if (amount <= 0) return;

    this.carried -= amount;
    best.deposited += amount;
    this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });

    if (best.deposited >= TUNING.lantern_cost) {
      best.lit = true;
      this.score += TUNING.score.per_lantern;
      this.stats.lanterns += 1;
      this.emit('lantern_lit', { lantern_id: best.id });
      if (this.allLit()) this.finish('won', 'all_lit');
    }
  }

  private pulse(): void {
    this.carried -= TUNING.pulse_cost;
    this.pulseCd = TUNING.pulse_cooldown_s;
    const stunned: string[] = [];
    for (const s of this.shades) {
      const dx = s.x - this.px;
      const dz = s.z - this.pz;
      const d = Math.hypot(dx, dz);
      if (d > TUNING.pulse_radius) continue;
      s.state = 'stunned';
      s.stunTimer = TUNING.pulse_stun_s;
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      s.x += nx * TUNING.pulse_push_m;
      s.z += nz * TUNING.pulse_push_m;
      this.keepOutOfLanternLight(s);
      stunned.push(s.id);
    }
    this.score += TUNING.score.per_stun * stunned.length;
    this.stats.stuns += stunned.length;
    this.emit('pulse', { stunned_ids: stunned });
  }

  private updateShades(dt: number): void {
    for (const s of this.shades) {
      if (s.state === 'stunned') {
        s.stunTimer -= dt;
        if (s.stunTimer <= 0) {
          s.state = 'chase';
          s.stunTimer = 0;
        }
        continue;
      }
      const dx = this.px - s.x;
      const dz = this.pz - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const move = Math.min(TUNING.shade_speed * dt, d);
        s.x += (dx / d) * move;
        s.z += (dz / d) * move;
      }
      this.keepOutOfLanternLight(s);

      if (this.invuln <= 0) {
        const hd = Math.hypot(s.x - this.px, s.z - this.pz);
        if (hd <= TUNING.shade_hit_radius) {
          this.hitPlayer('shade');
          if (this.state !== 'playing') return;
        }
      }
    }
  }

  /** Lit lanterns hold a safe circle; shades are pushed to its edge. */
  private keepOutOfLanternLight(s: Shade): void {
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const dx = s.x - l.x;
      const dz = s.z - l.z;
      const d = Math.hypot(dx, dz);
      if (d >= TUNING.safe_radius) continue;
      // Sit just outside the circle so "inside safe_radius" is unambiguously false.
      const edge = TUNING.safe_radius + 0.05;
      if (d < 1e-6) {
        s.x = l.x + edge;
        s.z = l.z;
      } else {
        s.x = l.x + (dx / d) * edge;
        s.z = l.z + (dz / d) * edge;
      }
    }
  }

  private hitPlayer(by: 'shade' | 'fall'): void {
    const dropped = Math.min(this.carried, Math.round(this.carried * TUNING.hit_drop_ratio));
    this.carried -= dropped;
    this.flames = Math.max(0, this.flames - 1);
    this.invuln = TUNING.invuln_s;
    this.stats.hits += 1;
    this.emit('player_hit', { by, flames: this.flames, dropped });
    if (this.flames <= 0) this.finish('lost', 'no_flames');
  }

  private updateSpawns(dt: number): void {
    if (this.randomMotes) {
      this.moteTimer += dt;
      if (this.moteTimer >= MOTE_SPAWN_INTERVAL_S) {
        this.moteTimer -= MOTE_SPAWN_INTERVAL_S;
        if (this.motes.length < MOTE_TARGET) this.spawnMote();
      }
    }
    if (this.randomShades) {
      this.shadeTimer += dt;
      if (this.shadeTimer >= SHADE_SPAWN_INTERVAL_S) {
        this.shadeTimer -= SHADE_SPAWN_INTERVAL_S;
        if (this.shades.length < SHADE_CAP) this.spawnShade(true);
      }
    }
  }

  private spawnMote(): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = this.rng.range(4, 28);
    this.motes.push({
      id: `M${++this.moteSeq}`,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    });
  }

  private spawnShade(emitEvent: boolean, minRadius = 18, maxRadius = 26): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = this.rng.range(minRadius, maxRadius);
    let id = `S${++this.shadeSeq}`;
    while (this.shades.some((existing) => existing.id === id)) id = `S${++this.shadeSeq}`;
    const shade: Shade = {
      id,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      state: 'chase',
      stunTimer: 0,
    };
    this.shades.push(shade);
    this.keepOutOfLanternLight(shade);
    if (emitEvent) this.emit('shade_spawned', { id: shade.id });
  }

  private finish(result: 'won' | 'lost', reason: 'all_lit' | 'dawn' | 'no_flames'): void {
    if (this.state !== 'playing') return;
    this.state = result;
    // Time bonus rewards finishing early, so it only pays out on a win.
    if (result === 'won') this.score += Math.round(this.timeLeft() * TUNING.score.per_second_left);
    this.score += this.flames * TUNING.score.per_flame_left;
    this.emit('game_over', { result, reason });
  }

  private emit(name: GameEventName, data: Record<string, unknown>): void {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }
}
