import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/core/tuning';

const contract = JSON.parse(readFileSync(join(process.cwd(), 'game.contract.json'), 'utf8')) as {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  bench_cmd: string;
  soak_cmd: string;
  tuning: Record<string, unknown>;
};

describe('game.contract.json', () => {
  it('declares contract version 1.3 and the required commands', () => {
    expect(contract.contract_version).toBe('1.3');
    expect(contract.team.length).toBeGreaterThan(0);
    expect(contract.build_cmd).toContain('npm');
    expect(contract.run_cmd).toContain('app.js');
    expect(contract.headless_cmd).toContain('main.js');
    expect(contract.bench_cmd).toContain('bench');
    expect(contract.soak_cmd).toContain('soak');
  });

  it('matches the tuning used by the game', () => {
    expect(contract.tuning).toEqual(TUNING);
  });

  it('keeps every standardized Phase 2 value', () => {
    expect(contract.tuning).toMatchObject({
      player_speed: 6,
      carry_capacity: 10,
      lantern_cost: 10,
      pickup_radius: 1,
      interact_radius: 2,
      pulse_cost: 3,
      pulse_radius: 5,
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
    });
  });

  it('declares every Phase 3 value', () => {
    expect(contract.tuning).toMatchObject({
      fuel_max: 100,
      fuel_decay_per_s: 1,
      fuel_per_mote: 10,
      relight_cost: 5,
      win_ratio: 0.6,
      drain_per_s: 5,
      low_fuel_threshold: 30,
      capacity_max: 20,
      night1_duration_s: 240,
      night2_duration_s: 270,
      night3_duration_s: 300,
    });
  });
});
