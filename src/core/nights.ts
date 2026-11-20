import type { Vec3 } from './validation';
import { PHYSICS, TUNING } from './tuning';

export type NightId = 1 | 2 | 3;

export interface LanternSpec {
  id: string;
  pos: Vec3;
}

export interface JumpPad {
  x: number;
  y: number;
  z: number;
  radius: number;
  vy: number;
  /** Horizontal launch velocity (m/s). */
  hx: number;
  hz: number;
}

export interface CharmSpec {
  id: string;
  pos: Vec3;
}

export interface NightConfig {
  night: 1 | 2 | 3;
  name: string;
  durationS: number;
  start: Vec3;
  facingDeg: number;
  lanterns: LanternSpec[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeSpeed: number;
  shadeCap: number;
  shadeSpawnIntervalS: number;
  driftersEnabled: boolean;
  windEnabled: boolean;
  jumpPads: JumpPad[];
  charms: CharmSpec[];
}

function ring(radius: number, count: number, startDeg: number, stepDeg: number, y = 0): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
    pts.push([Math.cos(a) * radius, y, Math.sin(a) * radius]);
  }
  return pts;
}

const NIGHT1_MOTES: Vec3[] = [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)];
const NIGHT1_SHADES: Vec3[] = ring(37, 12, 15, 30);

const NIGHT2_MOTE_A: Vec3[] = [...ring(10, 4, 0, 90), ...ring(22, 8, 0, 45)];
const NIGHT2_MOTES: Vec3[] = [
  ...NIGHT2_MOTE_A,
  ...NIGHT2_MOTE_A.map(([x, y, z]) => [x + 70, y, z] as Vec3),
];
const NIGHT2_SHADES: Vec3[] = [...ring(26, 8, 22.5, 45), ...ring(26, 8, 22.5, 45).map(([x, y, z]) => [x + 70, y, z] as Vec3)];

const NIGHT3_MOTES: Vec3[] = [
  ...ring(34, 18, 0, 20),
  ...ring(18, 8, 20, 20, 3),
  ...ring(5, 4, 45, 90, 6),
];
const NIGHT3_SHADES: Vec3[] = ring(43, 16, 0, 22.5);

const NIGHT2_PAD_A: JumpPad = {
  x: 20,
  y: 0,
  z: 18,
  radius: 1,
  vy: 14,
  hx: (50 / Math.hypot(50, 18)) * 24,
  hz: (-18 / Math.hypot(50, 18)) * 24,
};
const NIGHT2_PAD_B: JumpPad = {
  x: 50,
  y: 0,
  z: -18,
  radius: 1,
  vy: 14,
  hx: (-50 / Math.hypot(50, 18)) * 24,
  hz: (18 / Math.hypot(50, 18)) * 24,
};

const NIGHT3_PAD: JumpPad = { x: 0, y: 3, z: 13, radius: 1, vy: 12, hx: 0, hz: -8 };

export const NIGHT_CONFIGS: Record<1 | 2 | 3, NightConfig> = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    durationS: TUNING.night1_duration_s,
    start: [0, 0, 0],
    facingDeg: 0,
    lanterns: [
      { id: 'L1', pos: [0, 0, 25] },
      { id: 'L2', pos: [23.8, 0, 7.7] },
      { id: 'L3', pos: [14.7, 0, -20.2] },
      { id: 'L4', pos: [-14.7, 0, -20.2] },
      { id: 'L5', pos: [-23.8, 0, 7.7] },
    ],
    motePoints: NIGHT1_MOTES,
    shadePoints: NIGHT1_SHADES,
    shadeSpeed: TUNING.shade_speed,
    shadeCap: 6,
    shadeSpawnIntervalS: 8,
    driftersEnabled: false,
    windEnabled: false,
    jumpPads: [],
    charms: [],
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    durationS: TUNING.night2_duration_s,
    start: [0, 0, 0],
    facingDeg: 0,
    lanterns: [
      { id: 'L1', pos: [0, 0, 20] },
      { id: 'L2', pos: [17, 0, -10] },
      { id: 'L3', pos: [-17, 0, -10] },
      { id: 'L4', pos: [70, 0, 20] },
      { id: 'L5', pos: [87, 0, -10] },
      { id: 'L6', pos: [53, 0, -10] },
    ],
    motePoints: NIGHT2_MOTES,
    shadePoints: NIGHT2_SHADES,
    shadeSpeed: TUNING.shade_speed,
    shadeCap: 8,
    shadeSpawnIntervalS: 7,
    driftersEnabled: true,
    windEnabled: false,
    jumpPads: [NIGHT2_PAD_A, NIGHT2_PAD_B],
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    durationS: TUNING.night3_duration_s,
    start: [0, 0, 0],
    facingDeg: 0,
    lanterns: [
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ],
    motePoints: NIGHT3_MOTES,
    shadePoints: NIGHT3_SHADES,
    shadeSpeed: 4.5,
    shadeCap: 10,
    shadeSpawnIntervalS: 6,
    driftersEnabled: true,
    windEnabled: true,
    jumpPads: [NIGHT3_PAD],
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
  },
};

export function nightConfig(night: number): NightConfig {
  if (night !== 1 && night !== 2 && night !== 3) throw new Error(`unknown night ${night}`);
  return NIGHT_CONFIGS[night];
}

/** Initial motes are a deterministic random subset of the night's points. */
export function moteCap(night: 1 | 2 | 3): number {
  return night === 3 ? PHYSICS.mote_cap : PHYSICS.mote_cap;
}
