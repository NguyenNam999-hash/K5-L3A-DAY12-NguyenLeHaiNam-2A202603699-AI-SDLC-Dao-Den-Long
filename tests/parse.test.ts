import { describe, expect, it } from 'vitest';
import { parseInputs, parseScenario } from '../src/core/parse';
import { FormatError } from '../src/core/scenario';

describe('parseScenario v1.1', () => {
  it('reads the new player timers', () => {
    const s = parseScenario({
      player: { invuln_ticks: 12, dash_cd_ticks: 34, pulse_cd_ticks: 56, charm_ticks: 78 },
    });
    expect(s.player).toMatchObject({
      invuln_ticks: 12,
      dash_cd_ticks: 34,
      pulse_cd_ticks: 56,
      charm_ticks: 78,
    });
  });

  it('reads shade state and remaining ticks', () => {
    const s = parseScenario({ shades: [{ pos: [1, 0, 2], state: 'stunned', state_ticks_left: 40 }] });
    expect(s.shades![0]).toEqual({ pos: [1, 0, 2], state: 'stunned', state_ticks_left: 40 });
  });

  it('rejects an unknown shade state', () => {
    expect(() => parseScenario({ shades: [{ pos: [0, 0, 0], state: 'sleeping' }] })).toThrow(FormatError);
  });

  it('reads drifters and charms, replacing the defaults', () => {
    const s = parseScenario({
      drifters: [{ id: 'D9', pos: [1, 2, 3], state: 'flee', stolen: 2 }],
      charms: [{ id: 'C9', pos: [4, 5, 6], available: false }],
      random_drifters: false,
      wind_enabled: true,
    });
    expect(s.drifters![0]).toMatchObject({ id: 'D9', state: 'flee', stolen: 2 });
    expect(s.charms![0]).toMatchObject({ id: 'C9', available: false });
    expect(s.random_drifters).toBe(false);
    expect(s.wind_enabled).toBe(true);
  });

  it('keeps accepting v1.0 bare mote positions', () => {
    expect(parseScenario({ motes: [[1, 0, 2]] }).motes).toEqual([{ pos: [1, 0, 2] }]);
    expect(parseScenario({ motes: [{ pos: [1, 0, 2], kind: 'dropped', ttl_ticks: 480 }] }).motes![0]).toEqual({
      pos: [1, 0, 2],
      kind: 'dropped',
      ttl_ticks: 480,
    });
  });
});

describe('parseInputs v1.1', () => {
  it('reads dash and pause edges', () => {
    const inputs = parseInputs({ frames: [{ tick: 0, dash: true, pause: true }] });
    expect(inputs.frames[0]).toMatchObject({ dash: true, pause: true });
  });

  it('rejects a non-boolean pause', () => {
    expect(() => parseInputs({ frames: [{ tick: 0, pause: 1 }] })).toThrow(FormatError);
  });
});

describe('parseScenario v1.2', () => {
  it('reads lantern fuel, ever_lit and player successful_lights', () => {
    const s = parseScenario({
      player: { successful_lights: 3 },
      lanterns: [{ id: 'L1', lit: true, fuel: 42.5, ever_lit: true, deposited: 2 }],
      shades: [{ pos: [0, 0, 0], state: 'drain', target_lantern_id: 'L1' }],
    });
    expect(s.player).toMatchObject({ successful_lights: 3 });
    expect(s.lanterns![0]).toMatchObject({ id: 'L1', lit: true, fuel: 42.5, ever_lit: true, deposited: 2 });
    expect(s.shades![0]).toMatchObject({ state: 'drain', target_lantern_id: 'L1' });
  });

  it('rejects negative fuel and unknown target types', () => {
    expect(() => parseScenario({ lanterns: [{ id: 'L1', fuel: -1 }] })).toThrow(FormatError);
    expect(() => parseScenario({ lanterns: [{ id: 'L1', fuel: 'full' }] })).toThrow(FormatError);
    expect(() => parseScenario({ shades: [{ pos: [0, 0, 0], target_lantern_id: 3 }] })).toThrow(FormatError);
  });
});
