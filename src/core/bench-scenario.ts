import { Rng } from './rng';
import type { Scenario } from './scenario';
import { groundHeight } from './terrain';
import type { Vec3 } from './validation';

/** Frozen numbers for the standard Phase 4 benchmark scene. */
export const BENCH = {
  shadeCount: 200,
  moteCount: 100,
  cameraRadius: 30,
  cameraHeight: 15,
  orbitSeconds: 15,
  warmupSeconds: 3,
  shadeRing: [20, 38] as const,
  moteRing: [8, 38] as const,
  litLanterns: ['L1', 'L2', 'L3'] as const,
} as const;

function ringPoint(rng: Rng, inner: number, outer: number): { x: number; z: number } {
  const angle = rng.next() * Math.PI * 2;
  const r = Math.sqrt(inner * inner + rng.next() * (outer * outer - inner * inner));
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

/**
 * Standard benchmark scene: Night 1, 200 shades and 100 motes spread over the
 * island, L1-L3 lit at full fuel, everything else off. Seeded, so runs compare.
 */
export function createBenchScenario(seed: number): Scenario {
  const rng = new Rng(seed);
  const shades: NonNullable<Scenario['shades']> = [];
  const motes: NonNullable<Scenario['motes']> = [];

  for (let i = 0; i < BENCH.shadeCount; i += 1) {
    const { x, z } = ringPoint(rng, BENCH.shadeRing[0], BENCH.shadeRing[1]);
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z] as Vec3, state: 'wander' });
  }
  for (let i = 0; i < BENCH.moteCount; i += 1) {
    const { x, z } = ringPoint(rng, BENCH.moteRing[0], BENCH.moteRing[1]);
    motes.push({ pos: [x, (groundHeight(1, x, z) ?? 0) + 1, z] as Vec3, kind: 'random' });
  }

  return {
    night: 1,
    player: { pos: [0, 0, 0] as Vec3, carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    shades,
    motes,
    lanterns: BENCH.litLanterns.map((id) => ({ id, lit: true, fuel: 100 })),
    drifters: [],
    charms: [],
  };
}
