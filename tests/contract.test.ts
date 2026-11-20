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
  tuning: Record<string, unknown>;
};

describe('game.contract.json', () => {
  it('declares contract version 1.0 and the required commands', () => {
    expect(contract.contract_version).toBe('1.0');
    expect(contract.team.length).toBeGreaterThan(0);
    expect(contract.build_cmd).toContain('npm');
    expect(contract.run_cmd).toContain('npm');
    expect(contract.headless_cmd).toContain('main.js');
  });

  it('matches the tuning used by the game', () => {
    expect(contract.tuning).toEqual(TUNING);
  });

  it('keeps the contract-mandated values', () => {
    expect(contract.tuning.lantern_count_night1).toBe(5);
    expect(contract.tuning.fall_enabled).toBe(false);
    expect(contract.tuning.score).toEqual({
      per_mote: 10,
      per_lantern: 100,
      per_stun: 25,
      per_second_left: 5,
      per_flame_left: 50,
    });
  });
});
