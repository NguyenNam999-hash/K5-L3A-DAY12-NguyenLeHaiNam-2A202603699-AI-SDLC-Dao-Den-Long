import {
  FormatError,
  type InputFrameSpec,
  type InputsFile,
  type Scenario,
  type ScenarioMote,
  type ScenarioShade,
} from './scenario';
import type { DrifterState, MoteKind, ShadeState } from './types';
import {
  asArray,
  asBoolean,
  asNonNegativeInt,
  asNumber,
  asObject,
  asString,
  asVec3,
  isObject,
} from './validation';

const SHADE_STATES: ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES: DrifterState[] = ['idle', 'chase', 'flee', 'removed'];
const MOTE_KINDS: MoteKind[] = ['random', 'dropped'];

function asEnum<T extends string>(v: unknown, path: string, allowed: T[]): T {
  const s = asString(v, path);
  if (!(allowed as string[]).includes(s)) {
    throw new FormatError(`${path}: expected one of ${allowed.join(', ')}`);
  }
  return s as T;
}

/** Validates and normalises a scenario object. Throws FormatError on bad shape. */
export function parseScenario(raw: unknown): Scenario {
  const sc = asObject(raw, 'scenario');
  const out: Scenario = {};

  if (sc.night !== undefined) {
    const night = asNonNegativeInt(sc.night, 'scenario.night');
    if (night !== 1 && night !== 2 && night !== 3) throw new FormatError('scenario.night: expected 1, 2 or 3');
    out.night = night;
  }
  if (sc.player !== undefined) {
    const p = asObject(sc.player, 'scenario.player');
    out.player = {};
    if (p.pos !== undefined) out.player.pos = asVec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined) out.player.carried = asNonNegativeInt(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined) out.player.flames = asNonNegativeInt(p.flames, 'scenario.player.flames');
    for (const key of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks'] as const) {
      if (p[key] !== undefined) out.player[key] = asNonNegativeInt(p[key], `scenario.player.${key}`);
    }
  }
  for (const key of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (sc[key] !== undefined) out[key] = asBoolean(sc[key], `scenario.${key}`);
  }
  if (sc.motes !== undefined) {
    out.motes = asArray(sc.motes, 'scenario.motes').map((m, i): ScenarioMote => {
      if (Array.isArray(m)) return { pos: asVec3(m, `scenario.motes[${i}]`) };
      const o = asObject(m, `scenario.motes[${i}]`);
      const mote: ScenarioMote = { pos: asVec3(o.pos, `scenario.motes[${i}].pos`) };
      if (o.kind !== undefined) mote.kind = asEnum(o.kind, `scenario.motes[${i}].kind`, MOTE_KINDS);
      if (o.ttl_ticks !== undefined) {
        mote.ttl_ticks = asNonNegativeInt(o.ttl_ticks, `scenario.motes[${i}].ttl_ticks`);
      }
      return mote;
    });
  }
  if (sc.shades !== undefined) {
    out.shades = asArray(sc.shades, 'scenario.shades').map((s, i) => {
      const o = asObject(s, `scenario.shades[${i}]`);
      const shade: ScenarioShade = {
        pos: asVec3(o.pos, `scenario.shades[${i}].pos`),
      };
      if (o.id !== undefined) shade.id = asString(o.id, `scenario.shades[${i}].id`);
      if (o.state !== undefined) shade.state = asEnum(o.state, `scenario.shades[${i}].state`, SHADE_STATES);
      if (o.state_ticks_left !== undefined) {
        shade.state_ticks_left = asNonNegativeInt(o.state_ticks_left, `scenario.shades[${i}].state_ticks_left`);
      }
      return shade;
    });
  }
  if (sc.lanterns !== undefined) {
    out.lanterns = asArray(sc.lanterns, 'scenario.lanterns').map((l, i) => {
      const o = asObject(l, `scenario.lanterns[${i}]`);
      const lantern: { id: string; pos?: [number, number, number]; deposited?: number; lit?: boolean } = {
        id: asString(o.id, `scenario.lanterns[${i}].id`),
      };
      if (o.pos !== undefined) lantern.pos = asVec3(o.pos, `scenario.lanterns[${i}].pos`);
      if (o.deposited !== undefined) {
        lantern.deposited = asNumber(o.deposited, `scenario.lanterns[${i}].deposited`);
      }
      if (o.lit !== undefined) lantern.lit = asBoolean(o.lit, `scenario.lanterns[${i}].lit`);
      return lantern;
    });
  }
  if (sc.drifters !== undefined) {
    out.drifters = asArray(sc.drifters, 'scenario.drifters').map((d, i) => {
      const o = asObject(d, `scenario.drifters[${i}]`);
      const drifter: { id?: string; pos: [number, number, number]; state?: DrifterState; stolen?: number } = {
        pos: asVec3(o.pos, `scenario.drifters[${i}].pos`),
      };
      if (o.id !== undefined) drifter.id = asString(o.id, `scenario.drifters[${i}].id`);
      if (o.state !== undefined) {
        drifter.state = asEnum(o.state, `scenario.drifters[${i}].state`, DRIFTER_STATES);
      }
      if (o.stolen !== undefined) drifter.stolen = asNonNegativeInt(o.stolen, `scenario.drifters[${i}].stolen`);
      return drifter;
    });
  }
  if (sc.charms !== undefined) {
    out.charms = asArray(sc.charms, 'scenario.charms').map((c, i) => {
      const o = asObject(c, `scenario.charms[${i}]`);
      const charm: { id?: string; pos: [number, number, number]; available?: boolean } = {
        pos: asVec3(o.pos, `scenario.charms[${i}].pos`),
      };
      if (o.id !== undefined) charm.id = asString(o.id, `scenario.charms[${i}].id`);
      if (o.available !== undefined) charm.available = asBoolean(o.available, `scenario.charms[${i}].available`);
      return charm;
    });
  }
  if (sc.time_left_s !== undefined) {
    const t = asNumber(sc.time_left_s, 'scenario.time_left_s');
    if (t < 0) throw new FormatError('scenario.time_left_s: expected >= 0');
    out.time_left_s = t;
  }
  return out;
}

/** Validates `--inputs` JSON. Throws FormatError on bad shape or non-increasing ticks. */
export function parseInputs(raw: unknown): InputsFile {
  const root = asObject(raw, 'inputs');
  const frames = asArray(root.frames, 'inputs.frames');
  let lastTick = -1;
  const out: InputFrameSpec[] = frames.map((f, i) => {
    const o = asObject(f, `inputs.frames[${i}]`);
    const tick = asNonNegativeInt(o.tick, `inputs.frames[${i}].tick`);
    if (tick <= lastTick) {
      throw new FormatError(`inputs.frames[${i}].tick: ticks must increase strictly (${tick} after ${lastTick})`);
    }
    lastTick = tick;
    const frame: InputFrameSpec = { tick };
    if (o.move !== undefined) {
      if (!Array.isArray(o.move) || o.move.length !== 2) {
        throw new FormatError(`inputs.frames[${i}].move: expected [x, z]`);
      }
      const x = asNumber(o.move[0], `inputs.frames[${i}].move[0]`);
      const z = asNumber(o.move[1], `inputs.frames[${i}].move[1]`);
      if (Math.abs(x) > 1 || Math.abs(z) > 1) {
        throw new FormatError(`inputs.frames[${i}].move: components must be within [-1, 1]`);
      }
      frame.move = [x, z];
    }
    if (o.cam_yaw_deg !== undefined) {
      frame.cam_yaw_deg = asNumber(o.cam_yaw_deg, `inputs.frames[${i}].cam_yaw_deg`);
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (o[key] !== undefined) frame[key] = asBoolean(o[key], `inputs.frames[${i}].${key}`);
    }
    return frame;
  });
  return { frames: out };
}

export function isInputsRoot(v: unknown): v is { frames: unknown[] } {
  return isObject(v) && Array.isArray(v.frames);
}
