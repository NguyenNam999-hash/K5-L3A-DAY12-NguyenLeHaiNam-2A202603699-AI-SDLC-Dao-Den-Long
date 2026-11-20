import { Rng } from './rng';
import { FormatError, type Scenario } from './scenario';
import { nightConfig, type NightConfig, type NightId } from './nights';
import { groundHeight, isSolid } from './terrain';
import { DT, PHYSICS, TUNING } from './tuning';
import type {
  Charm,
  Drifter,
  DrifterState,
  EndRecord,
  GameEvent,
  GameEventName,
  GameStateName,
  InputFrame,
  Lantern,
  Mote,
  Shade,
  ShadeState,
  Snapshot,
} from './types';
import { IDLE_INPUT } from './types';

export function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

const TAU = Math.PI * 2;

export interface GameOptions {
  seed: number;
  night?: NightId;
  scenario?: Scenario;
  random?: Rng;
}

interface ShadeSpawn {
  x: number;
  z: number;
}

/**
 * Headless-safe gameplay core (Contract v1.1). Deterministic: same seed + scenario + inputs
 * => same events. Rendering reads this state; it never writes it.
 */
export class Game {
  readonly tuning = TUNING;
  readonly physics = PHYSICS;
  readonly night: NightId;
  readonly config: NightConfig;

  tick = 0;
  simTick = 0;
  state: GameStateName = 'playing';
  paused = false;
  score = 0;

  px = 0;
  py = 0;
  pz = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  grounded = true;
  /** Facing angle in radians, 0 = +Z. */
  facing = 0;
  carried = 0;
  flames = TUNING.flames;
  invulnTicks = 0;
  dashCdTicks = 0;
  pulseCdTicks = 0;
  charmTicks = 0;

  motes: Mote[] = [];
  shades: Shade[] = [];
  lanterns: Lantern[] = [];
  drifters: Drifter[] = [];
  charms: Charm[] = [];

  wind = { active: false, dirDeg: 0 };
  /** True during the 2 s leaf warning before a Night 3 gust (UI only). */
  windWarning = false;

  /** UI-only difficulty knobs. Headless never touches them, so default output is unchanged. */
  shadeSpeedMul = 1;
  shadeCap: number;

  readonly events: GameEvent[] = [];
  readonly stats = { motes: 0, picked: 0, lanterns: 0, stuns: 0, hits: 0, falls: 0, stolen: 0 };

  private readonly rng: Rng;
  private randomMotes = true;
  private randomShades = true;
  private randomDrifters = true;
  private windEnabled = false;
  private moteSeq = 0;
  private shadeSeq = 0;
  private drifterSeq = 0;
  private charmSeq = 0;
  private timeBase: number;
  private prev: InputFrame = { ...IDLE_INPUT };

  private dashTicks = 0;
  private dashDirX = 0;
  private dashDirZ = 1;
  private padLocked = false;
  private padVx = 0;
  private padVz = 0;

  private falling = false;
  private respawnTicks = 0;

  private windDirX = 1;
  private windDirZ = 0;
  private nextGustTick = PHYSICS.wind_period_ticks;
  private windTicksLeft = 0;
  private windWarnTicks = 0;

  constructor(opts: GameOptions) {
    this.rng = opts.random ?? new Rng(opts.seed);
    this.night = (opts.night ?? opts.scenario?.night ?? 1) as NightId;
    this.config = nightConfig(this.night);
    this.timeBase = this.config.durationS;
    this.shadeCap = this.config.shadeCap;
    this.build(opts.scenario);
  }

  get steps(): number {
    return this.tick;
  }

  get invuln(): number {
    return this.invulnTicks * DT;
  }

  timeLeft(): number {
    return Math.max(0, this.timeBase - this.simTick * DT);
  }

  allLit(): boolean {
    return this.lanterns.every((l) => l.lit);
  }

  /** One fixed 1/60 s step. Reads the input of tick `k`, produces state `k+1`. */
  step(input: InputFrame): void {
    if (this.state !== 'playing') return;
    this.tick += 1;

    if (this.tick === 1) this.emit('night_start', { night: this.night });

    if (input.pause && !this.prev.pause) {
      this.paused = !this.paused;
      this.emit(this.paused ? 'paused' : 'resumed', {});
      this.prev = { ...input };
      if (this.paused) return;
    } else if (this.paused) {
      this.prev = { ...input };
      return;
    }

    this.simTick += 1;
    const dt = DT;

    this.tickTimers(dt);
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    this.updateWind(dt);
    this.movePlayer(input, dt);
    this.checkFall();
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    if (!this.falling) {
      this.collectMotes();
      this.collectCharms();
      if (input.interact && !this.prev.interact) this.tryInteract();

      // Step 6: lit lanterns claim their safe circle before Pulse resolves.
      for (const shade of this.shades) this.keepOutOfLanternLight(shade);

      if (input.pulse && !this.prev.pulse && this.pulseCdTicks <= 0 && this.carried >= TUNING.pulse_cost) {
        this.pulse();
      }
    }

    this.updateShades(dt);
    this.updateDrifters(dt);
    this.contact();
    if (this.state !== 'playing') {
      this.prev = { ...input };
      return;
    }

    this.spawnScheduled();

    if (this.state === 'playing') this.checkEnd();
    this.prev = { ...input };
  }

  snapshot(): Snapshot {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.paused ? 'paused' : this.state,
      time_left_s: r3(this.timeLeft()),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: r3(this.wind.dirDeg) },
      player: {
        pos: [r3(this.px), r3(this.py), r3(this.pz)],
        flames: this.flames,
        carried: this.carried,
        vel: [r3(this.vx), r3(this.vy), r3(this.vz)],
        grounded: this.grounded,
        invuln: r3(this.invuln),
        dash_cd_s: r3(this.dashCdTicks * DT),
        pulse_cd_s: r3(this.pulseCdTicks * DT),
        charm_s: r3(this.charmTicks * DT),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [r3(l.x), r3(l.y), r3(l.z)],
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [r3(s.x), r3(s.y), r3(s.z)],
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [r3(m.x), r3(m.y), r3(m.z)],
        kind: m.kind,
        ttl_s: r3((m.ttlTicks ?? 0) * DT),
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: [r3(d.x), r3(d.y), r3(d.z)],
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: r3(c.respawnTicks * DT),
      })),
    };
  }

  endRecord(): EndRecord {
    return { type: 'end', ticks: this.tick, state: this.state, score: this.score };
  }

  /** Events emitted since the last drain. */
  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /**
   * Difficulty is a presentation-layer knob: `speedMul` scales chase speed and
   * `countMul` scales the spawn cap. Defaults (1, 1) reproduce the contract.
   */
  setDifficulty(speedMul: number, countMul: number): void {
    this.shadeSpeedMul = speedMul;
    this.shadeCap = Math.round(this.config.shadeCap * countMul);
    while (this.shades.length > this.shadeCap) {
      let farIndex = 0;
      let farDist = -1;
      this.shades.forEach((s, i) => {
        const d = Math.hypot(s.x - this.px, s.z - this.pz);
        if (d > farDist) {
          farDist = d;
          farIndex = i;
        }
      });
      this.shades.splice(farIndex, 1);
    }
  }

  // ---------------------------------------------------------------- setup

  private build(scenario: Scenario | undefined): void {
    const cfg = this.config;
    this.lanterns = cfg.lanterns.map((l) => ({
      id: l.id,
      x: l.pos[0],
      y: l.pos[1],
      z: l.pos[2],
      lit: false,
      deposited: 0,
    }));
    this.px = cfg.start[0];
    this.py = cfg.start[1];
    this.pz = cfg.start[2];
    this.facing = (cfg.facingDeg * Math.PI) / 180;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    if (scenario) {
      this.randomMotes = scenario.random_motes !== false;
      this.randomShades = scenario.random_shades !== false;
      this.randomDrifters = scenario.random_drifters !== false;
      this.windEnabled = scenario.wind_enabled ?? cfg.windEnabled;

      if (scenario.player) {
        const p = scenario.player;
        if (p.pos) {
          this.px = p.pos[0];
          this.py = p.pos[1];
          this.pz = p.pos[2];
          const g = groundHeight(this.night, this.px, this.pz);
          this.grounded = g !== null && Math.abs(this.py - g) < 0.01;
        }
        if (p.carried !== undefined) this.carried = p.carried;
        if (p.flames !== undefined) this.flames = p.flames;
        if (p.invuln_ticks !== undefined) this.invulnTicks = p.invuln_ticks;
        if (p.dash_cd_ticks !== undefined) this.dashCdTicks = p.dash_cd_ticks;
        if (p.pulse_cd_ticks !== undefined) this.pulseCdTicks = p.pulse_cd_ticks;
        if (p.charm_ticks !== undefined) this.charmTicks = p.charm_ticks;
      }

      if (scenario.motes) {
        for (const m of scenario.motes) {
          this.motes.push({
            id: `M${++this.moteSeq}`,
            x: m.pos[0],
            y: m.pos[1],
            z: m.pos[2],
            kind: m.kind ?? 'random',
            ttlTicks: m.ttl_ticks ?? null,
            pickupDelayTicks: 0,
          });
        }
      }

      if (scenario.shades) {
        for (const spec of scenario.shades) {
          const state = (spec.state ?? 'chase') as ShadeState;
          this.shades.push({
            id: spec.id ?? `S${++this.shadeSeq}`,
            x: spec.pos[0],
            y: this.shadeY(spec.pos[0], spec.pos[2]),
            z: spec.pos[2],
            state,
            stateTicksLeft: spec.state_ticks_left ?? 0,
            safeTicks: 0,
            vx: 0,
            vz: 0,
            pushTicksLeft: 0,
          });
        }
      }

      if (scenario.lanterns) {
        for (const spec of scenario.lanterns) {
          const lantern = this.lanterns.find((l) => l.id === spec.id);
          if (!lantern) throw new FormatError(`scenario.lanterns: unknown lantern id "${spec.id}"`);
          if (spec.pos) {
            lantern.x = spec.pos[0];
            lantern.y = spec.pos[1];
            lantern.z = spec.pos[2];
          }
          if (spec.deposited !== undefined) lantern.deposited = spec.deposited;
          // Pre-lit lanterns give no score and emit no event.
          if (spec.lit !== undefined) lantern.lit = spec.lit;
        }
      }

      if (scenario.drifters) {
        for (const spec of scenario.drifters) {
          const state = (spec.state ?? 'idle') as DrifterState;
          this.drifters.push({
            id: spec.id ?? `D${++this.drifterSeq}`,
            x: spec.pos[0],
            y: spec.pos[1] || this.drifterY(spec.pos[0], spec.pos[2]),
            z: spec.pos[2],
            state,
            stolen: spec.stolen ?? 0,
            stateTicksLeft: 0,
            vx: 0,
            vz: 0,
          });
        }
      }

      if (scenario.charms) {
        for (const spec of scenario.charms) {
          this.charms.push({
            id: spec.id ?? `C${++this.charmSeq}`,
            x: spec.pos[0],
            y: spec.pos[1],
            z: spec.pos[2],
            available: spec.available !== false,
            respawnTicks: spec.available === false ? PHYSICS.charm_respawn_ticks : 0,
          });
        }
      }

      if (scenario.time_left_s !== undefined) this.timeBase = scenario.time_left_s;
    }

    if (!scenario?.charms) {
      this.charms = cfg.charms.map((c) => ({
        id: c.id,
        x: c.pos[0],
        y: c.pos[1],
        z: c.pos[2],
        available: true,
        respawnTicks: 0,
      }));
    }

    // Scenario setup never emits events and never scores.
    if (!scenario?.motes && this.randomMotes) this.initialMotes();
    for (const shade of this.shades) this.keepOutOfLanternLight(shade);
    if (scenario?.wind_enabled === false) this.windEnabled = false;
  }

  private initialMotes(): void {
    const points = this.config.motePoints;
    const n = Math.min(PHYSICS.mote_initial, points.length);
    const indices = points.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    for (let i = 0; i < n; i += 1) {
      const [x, y, z] = points[indices[i]!]!;
      this.motes.push({
        id: `M${++this.moteSeq}`,
        x,
        y,
        z,
        kind: 'random',
        ttlTicks: null,
        pickupDelayTicks: 0,
      });
    }
  }

  // ---------------------------------------------------------------- timers

  private tickTimers(dt: number): void {
    if (this.invulnTicks > 0) this.invulnTicks = Math.max(0, this.invulnTicks - 1);
    if (this.dashCdTicks > 0) this.dashCdTicks = Math.max(0, this.dashCdTicks - 1);
    if (this.pulseCdTicks > 0) this.pulseCdTicks = Math.max(0, this.pulseCdTicks - 1);
    if (this.charmTicks > 0) this.charmTicks = Math.max(0, this.charmTicks - 1);
    if (this.falling) {
      if (this.respawnTicks > 0) this.respawnTicks -= 1;
      if (this.respawnTicks <= 0) this.respawn();
    }

    for (const m of this.motes) {
      if (m.pickupDelayTicks > 0) m.pickupDelayTicks -= 1;
      if (m.ttlTicks !== null) m.ttlTicks -= 1;
    }
    this.motes = this.motes.filter((m) => m.ttlTicks === null || m.ttlTicks > 0);

    for (const c of this.charms) {
      if (c.available) continue;
      if (c.respawnTicks > 0) c.respawnTicks -= 1;
      if (c.respawnTicks <= 0) {
        c.available = true;
        c.respawnTicks = 0;
      }
    }
  }

  private updateWind(dt: number): void {
    if (!this.windEnabled) return;
    const t = this.simTick;
    if (this.windTicksLeft > 0) {
      this.windTicksLeft -= 1;
      this.px += this.windDirX * PHYSICS.wind_push * dt;
      this.pz += this.windDirZ * PHYSICS.wind_push * dt;
      if (this.windTicksLeft === 0) this.wind.active = false;
      return;
    }
    if (t === this.nextGustTick - PHYSICS.wind_warn_ticks) this.windWarnTicks = PHYSICS.wind_warn_ticks;
    if (this.windWarnTicks > 0) this.windWarnTicks -= 1;
    this.windWarning = this.windWarnTicks > 0;
    if (t >= this.nextGustTick) {
      const deg = this.rng.range(0, 360);
      this.wind = { active: true, dirDeg: deg };
      const rad = (deg * Math.PI) / 180;
      this.windDirX = Math.cos(rad);
      this.windDirZ = Math.sin(rad);
      this.windTicksLeft = PHYSICS.wind_active_ticks;
      this.nextGustTick += PHYSICS.wind_period_ticks;
      this.windWarning = false;
    }
  }

  // ---------------------------------------------------------------- player

  private movePlayer(input: InputFrame, dt: number): void {
    if (this.falling) return;

    const oldX = this.px;
    const oldZ = this.pz;
    const wasGrounded = this.grounded;

    // Dash starts before movement so its 12 ticks include this one.
    if (input.dash && !this.prev.dash && this.dashCdTicks <= 0 && this.dashTicks <= 0) {
      const dir = this.inputDirection(input);
      if (dir) {
        this.dashDirX = dir.x;
        this.dashDirZ = dir.z;
        this.facing = Math.atan2(dir.x, dir.z);
      } else {
        this.dashDirX = Math.sin(this.facing);
        this.dashDirZ = Math.cos(this.facing);
      }
      this.dashTicks = 12;
      this.dashCdTicks = this.charmTicks > 0 ? 0 : 90;
      this.vy = 0;
      this.emit('dash', {});
    }

    if (this.dashTicks > 0) {
      const step = TUNING.dash_speed * dt;
      this.px += this.dashDirX * step;
      this.pz += this.dashDirZ * step;
      this.vx = this.dashDirX * TUNING.dash_speed;
      this.vz = this.dashDirZ * TUNING.dash_speed;
      if (this.grounded) this.py = groundHeight(this.night, this.px, this.pz) ?? this.py;
      this.dashTicks -= 1;
      if (this.dashTicks === 0) {
        this.vx = this.padLocked ? this.padVx : this.dashDirX * TUNING.player_speed;
        this.vz = this.padLocked ? this.padVz : this.dashDirZ * TUNING.player_speed;
      }
    } else if (this.padLocked) {
      this.vx = this.padVx;
      this.vz = this.padVz;
      this.px += this.padVx * dt;
      this.pz += this.padVz * dt;
    } else {
      const speed = this.charmTicks > 0 ? PHYSICS.charm_speed : TUNING.player_speed;
      const dir = this.inputDirection(input);
      const desiredX = (dir?.x ?? 0) * speed;
      const desiredZ = (dir?.z ?? 0) * speed;
      const accel = PHYSICS.ground_accel * (this.grounded ? 1 : PHYSICS.air_control) * dt;
      this.vx += Math.max(-accel, Math.min(accel, desiredX - this.vx));
      this.vz += Math.max(-accel, Math.min(accel, desiredZ - this.vz));
      if (Math.abs(this.vx) < 1e-6) this.vx = 0;
      if (Math.abs(this.vz) < 1e-6) this.vz = 0;
      this.px += this.vx * dt;
      this.pz += this.vz * dt;
    }

    if (this.grounded || this.dashTicks > 0) {
      const speed = Math.hypot(this.vx, this.vz);
      if (speed > 0.2) this.facing = Math.atan2(this.vx, this.vz);
    }

    if (!this.resolveHorizontal(oldX, oldZ, wasGrounded)) {
      this.px = oldX;
      this.pz = oldZ;
      this.vx = 0;
      this.vz = 0;
    }

    // Jump pads.
    if (this.grounded && this.dashTicks === 0) {
      for (const pad of this.config.jumpPads) {
        const d = Math.hypot(this.px - pad.x, this.pz - pad.z);
        if (d <= pad.radius && Math.abs(this.py - pad.y) <= 0.6) {
          this.vx = pad.hx;
          this.vz = pad.hz;
          this.padVx = pad.hx;
          this.padVz = pad.hz;
          this.vy = pad.vy;
          this.grounded = false;
          this.padLocked = true;
          break;
        }
      }
    }

    if (input.jump && !this.prev.jump && this.grounded && this.dashTicks === 0) {
      this.vy = PHYSICS.jump_speed;
      this.grounded = false;
    }

    const ground = groundHeight(this.night, this.px, this.pz);

    if (this.dashTicks > 0) {
      // Air dash keeps its height; ground dash follows the floor.
      if (this.grounded) this.py = ground ?? this.py;
      return;
    }

    if (this.grounded) {
      if (ground === null || ground < this.py - 0.001) {
        this.grounded = false;
        this.vy = 0;
      } else {
        this.py = ground;
        this.vy = 0;
        this.padLocked = false;
        return;
      }
    }

    this.vy -= PHYSICS.gravity * dt;
    this.py += this.vy * dt;

    if (ground !== null && this.py <= ground && this.vy <= 0) {
      this.py = ground;
      this.vy = 0;
      this.grounded = true;
      this.padLocked = false;
    }
  }

  /** Axis-separated collision against walls and the bell tower. */
  private resolveHorizontal(oldX: number, oldZ: number, wasGrounded: boolean): boolean {
    const canStand = (x: number, z: number): boolean => {
      if (isSolid(this.night, x, this.py + 0.9, z)) return false;
      const g = groundHeight(this.night, x, z);
      if (g === null) return true; // walking off the edge is allowed
      const rise = g - this.py;
      const limit = wasGrounded ? PHYSICS.step_height : 0.1;
      return rise <= limit;
    };
    if (canStand(this.px, this.pz)) return true;
    if (canStand(this.px, oldZ)) {
      this.pz = oldZ;
      this.vz = 0;
      return true;
    }
    if (canStand(oldX, this.pz)) {
      this.px = oldX;
      this.vx = 0;
      return true;
    }
    return false;
  }

  private inputDirection(input: InputFrame): { x: number; z: number } | null {
    let mx = input.moveX;
    let mz = input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len < 1e-6) return null;
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const theta = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
    const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
    const wl = Math.hypot(wx, wz);
    if (wl < 1e-6) return null;
    return { x: wx / wl, z: wz / wl };
  }

  private checkFall(): void {
    if (this.falling || this.py >= PHYSICS.fall_y) return;
    this.falling = true;
    this.respawnTicks = PHYSICS.respawn_wait_ticks;
    const lost = this.carried;
    this.carried = 0;
    this.flames = Math.max(0, this.flames - 1);
    this.invulnTicks = 0;
    this.stats.hits += 1;
    this.stats.falls += 1;
    this.emit('player_hit', { by: 'fall', flames: this.flames, lost });
    if (this.flames <= 0) {
      this.state = 'lost';
      this.emit('game_over', { result: 'lost', reason: 'no_flames' });
    }
  }

  private respawn(): void {
    this.falling = false;
    this.px = this.config.start[0];
    this.py = this.config.start[1];
    this.pz = this.config.start[2];
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.grounded = true;
    this.padLocked = false;
    this.invulnTicks = PHYSICS.spawn_invuln_ticks;
    this.facing = (this.config.facingDeg * Math.PI) / 180;
  }

  // ---------------------------------------------------------------- pickup

  private collectMotes(): void {
    if (this.carried >= TUNING.carry_capacity) return;
    const r = TUNING.pickup_radius;
    for (let i = this.motes.length - 1; i >= 0; i -= 1) {
      if (this.carried >= TUNING.carry_capacity) break;
      const m = this.motes[i]!;
      if (m.pickupDelayTicks > 0) continue;
      const dx = m.x - this.px;
      const dz = m.z - this.pz;
      if (Math.hypot(dx, dz) > r) continue;
      if (Math.abs(m.y - this.py) > 1.5) continue;
      this.motes.splice(i, 1);
      this.carried += 1;
      this.stats.picked += 1;
      this.emit('mote_picked', { carried: this.carried });
    }
  }

  private collectCharms(): void {
    const r = TUNING.pickup_radius;
    for (const c of this.charms) {
      if (!c.available) continue;
      if (Math.hypot(c.x - this.px, c.z - this.pz) > r) continue;
      if (Math.abs(c.y - this.py) > 1.5) continue;
      c.available = false;
      c.respawnTicks = PHYSICS.charm_respawn_ticks;
      this.charmTicks = PHYSICS.charm_ticks;
      this.dashCdTicks = 0;
      this.emit('charm_picked', { charm_id: c.id, charm_ticks: PHYSICS.charm_ticks });
    }
  }

  private tryInteract(): void {
    let best: Lantern | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      if (Math.abs(l.y - this.py) > 1.5) continue;
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
    this.score += amount * TUNING.score.per_mote;
    this.stats.motes += amount;
    this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });

    if (best.deposited >= TUNING.lantern_cost) {
      best.lit = true;
      this.score += TUNING.score.per_lantern;
      this.stats.lanterns += 1;
      this.emit('lantern_lit', { lantern_id: best.id });
    }
  }

  // ---------------------------------------------------------------- pulse

  private pulse(): void {
    this.carried -= TUNING.pulse_cost;
    this.pulseCdTicks = Math.round(TUNING.pulse_cooldown_s * 60);
    const cx = this.px;
    const cy = this.py + 0.8;
    const cz = this.pz;
    const stunned: string[] = [];

    for (const s of this.shades) {
      if (Math.hypot(s.x - cx, s.y - cy, s.z - cz) > TUNING.pulse_radius) continue;
      const dx = s.x - this.px;
      const dz = s.z - this.pz;
      const d = Math.hypot(dx, dz);
      s.vx = d > 1e-6 ? dx / d : 1;
      s.vz = d > 1e-6 ? dz / d : 0;
      s.state = 'stunned';
      s.stateTicksLeft = Math.round(TUNING.pulse_stun_s * 60);
      s.pushTicksLeft = 15;
      s.safeTicks = 0;
      stunned.push(s.id);
      this.score += TUNING.score.per_stun;
      this.stats.stuns += 1;
    }

    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      if (Math.hypot(d.x - cx, d.y - cy, d.z - cz) > TUNING.pulse_radius) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.stateTicksLeft = PHYSICS.drifter_flee_ticks;
        const dx = d.x - this.px;
        const dz = d.z - this.pz;
        const dist = Math.hypot(dx, dz);
        d.vx = dist > 1e-6 ? dx / dist : 1;
        d.vz = dist > 1e-6 ? dz / dist : 0;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        this.dropMotesAt(d.x, d.z, amount, false);
        d.stolen = 0;
        d.state = 'removed';
        d.stateTicksLeft = PHYSICS.drifter_vanish_ticks;
        this.emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }

    this.emit('pulse', { stunned_ids: stunned });
  }

  // ---------------------------------------------------------------- shades

  private shadeY(x: number, z: number): number {
    return (groundHeight(this.night, x, z) ?? 0) + 1;
  }

  private updateShades(dt: number): void {
    for (const s of this.shades) {
      if (s.safeTicks > 0) s.safeTicks -= 1;

      if (s.state === 'spawning') {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0) {
          s.state = 'wander';
          s.stateTicksLeft = 0;
        }
        continue;
      }

      if (s.state === 'stunned') {
        s.stateTicksLeft -= 1;
        if (s.pushTicksLeft > 0) {
          const step = TUNING.pulse_push_m / 15;
          const tx = s.x + s.vx * step;
          const tz = s.z + s.vz * step;
          if (this.walkableForShade(tx, tz, s.y)) {
            s.x = tx;
            s.z = tz;
          }
          s.pushTicksLeft -= 1;
        }
        if (s.stateTicksLeft <= 0) {
          s.state = 'wander';
          s.stateTicksLeft = 0;
          s.vx = 0;
          s.vz = 0;
        }
        s.y = this.shadeY(s.x, s.z);
        this.keepOutOfLanternLight(s);
        continue;
      }

      if (s.state === 'recoil') {
        const step = (PHYSICS.shade_recoil_m / PHYSICS.shade_recoil_ticks) * 60 * dt;
        const tx = s.x + s.vx * step;
        const tz = s.z + s.vz * step;
        if (this.walkableForShade(tx, tz, s.y)) {
          s.x = tx;
          s.z = tz;
        }
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft <= 0) {
          s.state = 'wander';
          s.stateTicksLeft = 0;
        }
        s.y = this.shadeY(s.x, s.z);
        continue;
      }

      const dx = this.px - s.x;
      const dz = this.pz - s.z;
      const dist = Math.hypot(dx, dz);
      if (s.state === 'wander' && dist <= PHYSICS.shade_detect_m) s.state = 'chase';
      if (s.state === 'chase' && dist > PHYSICS.shade_lose_m) s.state = 'wander';

      if (s.state === 'chase' && dist > 1e-6) {
        const speed = this.config.shadeSpeed * this.shadeSpeedMul;
        const step = Math.min(speed * dt, dist);
        const tx = s.x + (dx / dist) * step;
        const tz = s.z + (dz / dist) * step;
        if (this.walkableForShade(tx, tz, s.y)) {
          s.x = tx;
          s.z = tz;
        } else if (this.walkableForShade(tx, s.z, s.y)) {
          s.x = tx;
        } else if (this.walkableForShade(s.x, tz, s.y)) {
          s.z = tz;
        }
      } else if (s.state === 'wander') {
        const phase = Number(s.id.slice(1)) || 1;
        const angle = phase * 0.7 + this.simTick * 0.01;
        const step = PHYSICS.shade_wander_speed * dt;
        const tx = s.x + Math.cos(angle) * step;
        const tz = s.z + Math.sin(angle) * step;
        if (this.walkableForShade(tx, tz, s.y)) {
          s.x = tx;
          s.z = tz;
        }
      }

      s.y = this.shadeY(s.x, s.z);
      this.keepOutOfLanternLight(s);
    }
  }

  private walkableForShade(x: number, z: number, currentY: number): boolean {
    const g = groundHeight(this.night, x, z);
    if (g === null) return false;
    return Math.abs(g - (currentY - 1)) <= PHYSICS.step_height + 1e-6;
  }

  /** Lit lanterns hold a safe circle (same tier). */
  private keepOutOfLanternLight(s: Shade): void {
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      if (Math.abs((s.y - 1) - l.y) > 2) continue;
      const dx = s.x - l.x;
      const dz = s.z - l.z;
      const d = Math.hypot(dx, dz);
      if (d >= TUNING.safe_radius) continue;
      const edge = TUNING.safe_radius + 0.05;
      if (d < 1e-6) {
        s.x = l.x + edge;
        s.z = l.z;
      } else {
        s.x = l.x + (dx / d) * edge;
        s.z = l.z + (dz / d) * edge;
      }
      s.safeTicks = PHYSICS.safe_suppress_ticks;
    }
  }

  // ---------------------------------------------------------------- drifters

  private drifterY(x: number, z: number): number {
    return (groundHeight(this.night, x, z) ?? 0) + 1.6;
  }

  private updateDrifters(dt: number): void {
    for (let i = this.drifters.length - 1; i >= 0; i -= 1) {
      const d = this.drifters[i]!;
      if (d.state === 'removed') {
        d.stateTicksLeft -= 1;
        if (d.stateTicksLeft <= 0) this.drifters.splice(i, 1);
        continue;
      }

      if (d.state === 'idle') {
        if (this.carried >= 5 && Math.hypot(this.px - d.x, this.pz - d.z) <= PHYSICS.drifter_detect_m) {
          d.state = 'chase';
        } else {
          const phase = Number(d.id.slice(1)) || 1;
          const angle = phase * 1.3 + this.simTick * 0.012;
          d.x += Math.cos(angle) * PHYSICS.drifter_idle_speed * dt;
          d.z += Math.sin(angle) * PHYSICS.drifter_idle_speed * dt;
        }
      } else if (d.state === 'chase') {
        if (this.carried < 5) {
          d.state = 'idle';
        } else {
          const dx = this.px - d.x;
          const dz = this.pz - d.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 1e-6) {
            d.x += (dx / dist) * PHYSICS.drifter_chase_speed * dt;
            d.z += (dz / dist) * PHYSICS.drifter_chase_speed * dt;
          }
        }
      } else if (d.state === 'flee') {
        d.x += (d.vx || 1) * PHYSICS.drifter_flee_speed * dt;
        d.z += (d.vz || 0) * PHYSICS.drifter_flee_speed * dt;
        d.stateTicksLeft -= 1;
        if (d.stateTicksLeft <= 0) {
          this.drifters.splice(i, 1);
          continue;
        }
      }

      d.y = this.drifterY(d.x, d.z);
    }
  }

  // ---------------------------------------------------------------- contact

  private contact(): void {
    if (this.falling) return;

    // Drifters steal first.
    for (const d of this.drifters) {
      if (d.state !== 'chase') continue;
      if (Math.hypot(d.x - this.px, d.z - this.pz) > PHYSICS.drifter_steal_m) continue;
      const amount = Math.min(PHYSICS.drifter_steal_count, this.carried);
      if (amount <= 0) continue;
      this.carried -= amount;
      d.stolen += amount;
      this.stats.stolen += amount;
      d.state = 'flee';
      d.stateTicksLeft = PHYSICS.drifter_flee_ticks;
      const dx = d.x - this.px;
      const dz = d.z - this.pz;
      const dist = Math.hypot(dx, dz);
      d.vx = dist > 1e-6 ? dx / dist : 1;
      d.vz = dist > 1e-6 ? dz / dist : 0;
      this.emit('drifter_steal', { drifter_id: d.id, amount, carried: this.carried });
    }

    if (this.invulnTicks > 0) return;

    for (const s of this.shades) {
      if (s.state === 'spawning') continue;
      if (s.safeTicks > 0) continue;
      if (Math.hypot(s.x - this.px, s.z - this.pz) > TUNING.shade_hit_radius) continue;
      if (Math.abs((s.y - 1) - this.py) > 1.5) continue;
      this.hitPlayer(s);
      if (this.state !== 'playing') return;
      if (this.invulnTicks > 0) return;
    }
  }

  private hitPlayer(shade: Shade): void {
    const dropped = Math.floor(this.carried * TUNING.hit_drop_ratio);
    this.carried -= dropped;
    this.flames = Math.max(0, this.flames - 1);
    this.invulnTicks = Math.round(TUNING.invuln_s * 60);
    this.stats.hits += 1;
    this.emit('player_hit', { by: 'shade', flames: this.flames, dropped });
    if (dropped > 0) this.dropMotesAt(this.px, this.pz, dropped, true);

    const dx = shade.x - this.px;
    const dz = shade.z - this.pz;
    const d = Math.hypot(dx, dz);
    shade.state = 'recoil';
    shade.stateTicksLeft = PHYSICS.shade_recoil_ticks;
    shade.vx = d > 1e-6 ? dx / d : 1;
    shade.vz = d > 1e-6 ? dz / d : 0;
    shade.safeTicks = 0;

    if (this.flames <= 0) {
      this.state = 'lost';
      this.emit('game_over', { result: 'lost', reason: 'no_flames' });
    }
  }

  private dropMotesAt(x: number, z: number, amount: number, ring: boolean): void {
    for (let i = 0; i < amount; i += 1) {
      let mx = x;
      let mz = z;
      if (ring) {
        const angle = this.rng.range(0, TAU);
        const radius = this.rng.range(1.5, 2.5);
        mx = x + Math.cos(angle) * radius;
        mz = z + Math.sin(angle) * radius;
      }
      const g = groundHeight(this.night, mx, mz);
      this.motes.push({
        id: `M${++this.moteSeq}`,
        x: mx,
        y: g ?? this.py,
        z: mz,
        kind: 'dropped',
        ttlTicks: PHYSICS.mote_ttl_ticks,
        pickupDelayTicks: 1,
      });
    }
  }

  // ---------------------------------------------------------------- spawning

  private spawnScheduled(): void {
    if (this.randomMotes && this.simTick >= PHYSICS.mote_spawn_start_tick) {
      const offset = this.simTick - PHYSICS.mote_spawn_start_tick;
      if (offset % PHYSICS.mote_spawn_interval_ticks === 0 && this.motes.length < PHYSICS.mote_cap) {
        this.spawnMoteAtFreePoint();
      }
    }
    if (this.randomShades) {
      const interval = Math.round(this.config.shadeSpawnIntervalS * 60);
      if (this.simTick === PHYSICS.shade_spawn_start_tick) {
        this.spawnShades(2);
      } else if (
        this.simTick > PHYSICS.shade_spawn_start_tick &&
        (this.simTick - PHYSICS.shade_spawn_start_tick) % interval === 0
      ) {
        this.spawnShades(1);
      }
    }
    if (this.randomDrifters && this.config.driftersEnabled) {
      if (
        this.simTick >= PHYSICS.drifter_spawn_start_tick &&
        this.simTick % PHYSICS.drifter_spawn_interval_ticks === 0 &&
        this.drifters.length < PHYSICS.drifter_cap
      ) {
        this.spawnDrifter();
      }
    }
  }

  private spawnMoteAtFreePoint(): void {
    const points = this.config.motePoints;
    const free = points.filter(
      (p) => !this.motes.some((m) => Math.hypot(m.x - p[0], m.z - p[2]) < 1e-3),
    );
    if (free.length === 0) return;
    const p = free[Math.floor(this.rng.next() * free.length)]!;
    this.motes.push({
      id: `M${++this.moteSeq}`,
      x: p[0],
      y: p[1],
      z: p[2],
      kind: 'random',
      ttlTicks: null,
      pickupDelayTicks: 0,
    });
  }

  private spawnShades(count: number): void {
    for (let n = 0; n < count; n += 1) {
      if (this.shades.length >= this.shadeCap) return;
      const candidates = this.config.shadePoints.filter(
        (p) => Math.hypot(p[0] - this.px, p[2] - this.pz) >= 15,
      );
      if (candidates.length === 0) return;
      const p = candidates[Math.floor(this.rng.next() * candidates.length)]!;
      let id = `S${++this.shadeSeq}`;
      while (this.shades.some((s) => s.id === id)) id = `S${++this.shadeSeq}`;
      const shade: Shade = {
        id,
        x: p[0],
        y: this.shadeY(p[0], p[2]),
        z: p[2],
        state: 'spawning',
        stateTicksLeft: PHYSICS.shade_spawning_ticks,
        safeTicks: 0,
        vx: 0,
        vz: 0,
        pushTicksLeft: 0,
      };
      this.shades.push(shade);
      this.keepOutOfLanternLight(shade);
      this.emit('shade_spawned', { id: shade.id });
    }
  }

  private spawnDrifter(): void {
    const points = this.config.shadePoints;
    if (points.length === 0) return;
    const p = points[Math.floor(this.rng.next() * points.length)]!;
    let id = `D${++this.drifterSeq}`;
    while (this.drifters.some((d) => d.id === id)) id = `D${++this.drifterSeq}`;
    this.drifters.push({
      id,
      x: p[0],
      y: this.drifterY(p[0], p[2]),
      z: p[2],
      state: 'idle',
      stolen: 0,
      stateTicksLeft: 0,
      vx: 0,
      vz: 0,
    });
  }

  // ---------------------------------------------------------------- end

  private checkEnd(): void {
    if (this.flames <= 0) {
      this.finish('lost', 'no_flames');
      return;
    }
    if (this.allLit()) {
      this.finish('won', 'all_lit');
      return;
    }
    if (this.timeLeft() <= 0) this.finish('lost', 'dawn');
  }

  private finish(result: 'won' | 'lost', reason: 'all_lit' | 'dawn' | 'no_flames'): void {
    if (this.state !== 'playing') return;
    this.state = result;
    // Time and flame bonuses only reward a won night.
    if (result === 'won') {
      this.score += Math.floor(this.timeLeft()) * TUNING.score.per_second_left;
      this.score += this.flames * TUNING.score.per_flame_left;
    }
    this.emit('game_over', { result, reason });
  }

  private emit(name: GameEventName, data: Record<string, unknown>): void {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }
}
