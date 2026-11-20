import { FormatError, type InputFrameSpec, type InputsFile, type Scenario } from './scenario';
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

/** Validates and normalises a scenario object. Throws FormatError on bad shape. */
export function parseScenario(raw: unknown): Scenario {
  const sc = asObject(raw, 'scenario');
  const out: Scenario = {};

  if (sc.player !== undefined) {
    const p = asObject(sc.player, 'scenario.player');
    out.player = {};
    if (p.pos !== undefined) out.player.pos = asVec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined) out.player.carried = asNonNegativeInt(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined) out.player.flames = asNonNegativeInt(p.flames, 'scenario.player.flames');
  }
  if (sc.random_motes !== undefined) out.random_motes = asBoolean(sc.random_motes, 'scenario.random_motes');
  if (sc.random_shades !== undefined) out.random_shades = asBoolean(sc.random_shades, 'scenario.random_shades');
  if (sc.motes !== undefined) {
    out.motes = asArray(sc.motes, 'scenario.motes').map((m, i) => asVec3(m, `scenario.motes[${i}]`));
  }
  if (sc.shades !== undefined) {
    out.shades = asArray(sc.shades, 'scenario.shades').map((s, i) => {
      const o = asObject(s, `scenario.shades[${i}]`);
      const shade: { id?: string; pos: [number, number, number] } = {
        pos: asVec3(o.pos, `scenario.shades[${i}].pos`),
      };
      if (o.id !== undefined) shade.id = asString(o.id, `scenario.shades[${i}].id`);
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
    for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) {
      if (o[key] !== undefined) frame[key] = asBoolean(o[key], `inputs.frames[${i}].${key}`);
    }
    return frame;
  });
  return { frames: out };
}

export function isInputsRoot(v: unknown): v is { frames: unknown[] } {
  return isObject(v) && Array.isArray(v.frames);
}
