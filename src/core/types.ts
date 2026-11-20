export type GameStateName = 'playing' | 'won' | 'lost' | 'paused';

export type NightId = 1 | 2 | 3;

export type MoteKind = 'random' | 'dropped';

export interface Mote {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: MoteKind;
  /** Ticks left before a dropped mote fades; `null` for regular motes. */
  ttlTicks: number | null;
  /** 1 on the tick a mote drops, so it cannot be picked in the same tick. */
  pickupDelayTicks: number;
}

export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned';

export interface Shade {
  id: string;
  x: number;
  y: number;
  z: number;
  state: ShadeState;
  /** Ticks left in a timed state (spawning / stunned / recoil). */
  stateTicksLeft: number;
  /** While > 0 the shade cannot damage Mây (safe-zone ejection). */
  safeTicks: number;
  /** Recoil velocity, m/s. */
  vx: number;
  vz: number;
  /** First ticks of a stun carry the 4 m pulse push. */
  pushTicksLeft: number;
}

export interface Lantern {
  id: string;
  x: number;
  y: number;
  z: number;
  lit: boolean;
  deposited: number;
}

export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';

export interface Drifter {
  id: string;
  x: number;
  y: number;
  z: number;
  state: DrifterState;
  stolen: number;
  stateTicksLeft: number;
  vx: number;
  vz: number;
}

export interface Charm {
  id: string;
  x: number;
  y: number;
  z: number;
  available: boolean;
  respawnTicks: number;
}

export interface Wind {
  active: boolean;
  dirDeg: number;
}

export interface SnapshotWind {
  active: boolean;
  dir_deg: number;
}

/** Player command for one tick. `move` is camera-relative, each component in [-1, 1]. */
export interface InputFrame {
  moveX: number;
  moveZ: number;
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export type GameEventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
  | 'dash'
  | 'charm_picked'
  | 'drifter_steal'
  | 'drifter_drop'
  | 'night_start'
  | 'paused'
  | 'resumed'
  | 'game_over';

export interface GameEvent {
  type: 'event';
  tick: number;
  name: GameEventName;
  data: Record<string, unknown>;
}

export interface SnapshotMote {
  id: string;
  pos: [number, number, number];
  kind: MoteKind;
  ttl_s: number;
}

export interface SnapshotDrifter {
  id: string;
  pos: [number, number, number];
  state: DrifterState;
  stolen: number;
}

export interface SnapshotCharm {
  id: string;
  available: boolean;
  respawn_s: number;
}

export interface SnapshotLantern {
  id: string;
  pos: [number, number, number];
  lit: boolean;
  deposited: number;
}

export interface Snapshot {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: NightId;
  state: GameStateName;
  time_left_s: number;
  score: number;
  wind: SnapshotWind;
  player: {
    pos: [number, number, number];
    flames: number;
    carried: number;
    vel: [number, number, number];
    grounded: boolean;
    invuln: number;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: SnapshotLantern[];
  shades: Array<{ id: string; pos: [number, number, number]; state: ShadeState }>;
  motes_active: number;
  motes: SnapshotMote[];
  drifters: SnapshotDrifter[];
  charms: SnapshotCharm[];
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameStateName;
  score: number;
}

export const IDLE_INPUT: InputFrame = {
  moveX: 0,
  moveZ: 0,
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
};
