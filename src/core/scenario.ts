import type { Vec3 } from './validation';

export class FormatError extends Error {}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
}

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface InputFrameSpec {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export interface InputsFile {
  frames: InputFrameSpec[];
}
