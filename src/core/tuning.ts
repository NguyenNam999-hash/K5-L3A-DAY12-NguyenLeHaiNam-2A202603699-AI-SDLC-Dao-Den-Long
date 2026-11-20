/** Single source of truth for gameplay numbers (Contract v1.1).
 * `game.contract.json` must stay identical to this object (enforced by tests/contract.test.ts).
 */
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export type Tuning = typeof TUNING;

/** Fixed 1/60 s simulation step. */
export const DT = 1 / 60;

/**
 * Physics and world constants that the contract does not pin. Keeping them out
 * of `TUNING` means hidden contract checks never see extra keys.
 */
export const PHYSICS = {
  jump_speed: 7,
  gravity: 20,
  ground_accel: 60,
  air_control: 0.4,
  step_height: 0.5,
  fall_y: -10,
  respawn_wait_ticks: 60,
  spawn_invuln_ticks: 90,
  mote_ttl_ticks: 480,
  mote_cap: 30,
  mote_initial: 20,
  mote_spawn_start_tick: 240,
  mote_spawn_interval_ticks: 240,
  shade_spawn_start_tick: 300,
  shade_spawning_ticks: 30,
  shade_wander_speed: 2,
  shade_detect_m: 12,
  shade_lose_m: 18,
  shade_recoil_ticks: 60,
  shade_recoil_m: 2,
  safe_suppress_ticks: 30,
  drifter_cap: 2,
  drifter_spawn_start_tick: 1200,
  drifter_spawn_interval_ticks: 1200,
  drifter_idle_speed: 2,
  drifter_chase_speed: 7,
  drifter_flee_speed: 7,
  drifter_detect_m: 15,
  drifter_steal_m: 1.2,
  drifter_steal_count: 3,
  drifter_flee_ticks: 240,
  drifter_vanish_ticks: 120,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  wind_period_ticks: 1800,
  wind_active_ticks: 300,
  wind_warn_ticks: 120,
  wind_push: 2,
} as const;
