export type GameStateName = 'playing' | 'won' | 'lost';

export interface Mote {
  id: string;
  x: number;
  z: number;
}

export type ShadeState = 'chase' | 'stunned';

export interface Shade {
  id: string;
  x: number;
  z: number;
  state: ShadeState;
  stunTimer: number;
}

export interface Lantern {
  id: string;
  x: number;
  z: number;
  lit: boolean;
  deposited: number;
}

/** Player command for one tick. `move` is camera-relative, each component in [-1, 1]. */
export interface InputFrame {
  moveX: number;
  moveZ: number;
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

export type GameEventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
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
}

export interface Snapshot {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameStateName;
  time_left_s: number;
  score: number;
  player: { pos: [number, number, number]; flames: number; carried: number };
  lanterns: Array<{ id: string; pos: [number, number, number]; lit: boolean; deposited: number }>;
  shades: Array<{ id: string; pos: [number, number, number]; state: ShadeState }>;
  motes_active: number;
  motes: SnapshotMote[];
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
};
