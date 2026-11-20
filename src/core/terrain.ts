/**
 * Pure map queries for the three nights. No game state, no DOM.
 * `groundHeight` returns the walkable surface under (x, z), or `null` for the sea of clouds.
 */
export type NightId = 1 | 2 | 3;

const N1_RADIUS = 40;
const N2_ISLAND_RADIUS = 28;
const N2_ISLAND_B_X = 70;
const N3_RADIUS = 45;
const N3_TIER1_INNER = 12;
const N3_TIER1_OUTER = 24;
const N3_TIER2_RADIUS = 8;
const N3_TOWER_RADIUS = 2;
const N3_TOWER_HEIGHT = 8;
const RAMP_INNER = 24;
const RAMP_OUTER = 30;
const RAMP_HALF_WIDTH = 1.5;
const RAMP_ANGLES = [(30 * Math.PI) / 180, (150 * Math.PI) / 180];

/** Bridge deck of Night 2. */
export function onBridge(x: number, z: number): boolean {
  return x >= 26 && x <= 44 && z >= -2 && z <= 2;
}

export function onIslandA(x: number, z: number): boolean {
  return Math.hypot(x, z) <= N2_ISLAND_RADIUS;
}

export function onIslandB(x: number, z: number): boolean {
  return Math.hypot(x - N2_ISLAND_B_X, z) <= N2_ISLAND_RADIUS;
}

function rampHeight(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r < RAMP_INNER || r > RAMP_OUTER) return null;
  const angle = Math.atan2(z, x);
  for (const ramp of RAMP_ANGLES) {
    let delta = angle - ramp;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(r * Math.sin(delta)) <= RAMP_HALF_WIDTH) {
      return ((RAMP_OUTER - r) / (RAMP_OUTER - RAMP_INNER)) * 3;
    }
  }
  return null;
}

export function groundHeight(night: NightId, x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (night === 1) return r <= N1_RADIUS ? 0 : null;

  if (night === 2) {
    if (onIslandA(x, z) || onIslandB(x, z) || onBridge(x, z)) return 0;
    return null;
  }

  if (r > N3_RADIUS) return null;
  const ramp = rampHeight(x, z);
  if (ramp !== null) return ramp;
  if (r <= N3_TIER2_RADIUS) return 6;
  if (z > 0 && r >= N3_TIER1_INNER && r <= N3_TIER1_OUTER) return 3;
  return 0;
}

/** The bell tower is a vertical obstacle from the tier-2 floor to its top. */
export function isSolid(night: NightId, x: number, y: number, z: number): boolean {
  if (night !== 3) return false;
  return Math.hypot(x, z) <= N3_TOWER_RADIUS && y < 6 + N3_TOWER_HEIGHT;
}

export const MAP_LIMITS = {
  night1Radius: N1_RADIUS,
  night2IslandRadius: N2_ISLAND_RADIUS,
  night2IslandBCenterX: N2_ISLAND_B_X,
  night3Radius: N3_RADIUS,
} as const;
