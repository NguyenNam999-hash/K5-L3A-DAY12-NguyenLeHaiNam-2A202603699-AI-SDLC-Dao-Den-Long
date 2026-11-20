/** Single source of truth for gameplay numbers.
 * `game.contract.json` must stay identical to this object (enforced by tests/contract.test.ts).
 */
export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 2,
  pulse_radius: 8,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 1,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 4,
  shade_speed: 3.2,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 5,
    per_flame_left: 50,
  },
};

export type Tuning = typeof TUNING;

/** Island is a disc. `fall_enabled` is false, so this is a soft railing, not a cliff. */
export const ISLAND_RADIUS = 34;

/** Lantern ring of Night 1 (metres, ground plane XZ). */
export const NIGHT1_LANTERNS: ReadonlyArray<{ id: string; x: number; z: number }> = [
  { id: 'L1', x: 0, z: 15 },
  { id: 'L2', x: 14.266, z: 4.635 },
  { id: 'L3', x: 8.817, z: -12.135 },
  { id: 'L4', x: -8.817, z: -12.135 },
  { id: 'L5', x: -14.266, z: 4.635 },
];

export const MOTE_TARGET = 16;
export const SHADE_CAP = 4;
export const MOTE_SPAWN_INTERVAL_S = 3;
export const SHADE_SPAWN_INTERVAL_S = 12;
export const DT = 1 / 60;
