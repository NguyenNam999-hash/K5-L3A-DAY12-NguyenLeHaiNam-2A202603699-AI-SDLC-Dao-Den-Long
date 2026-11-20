import { describe, expect, it } from 'vitest';
import { computeBenchStats } from '../scripts/bench-stats.mjs';

describe('computeBenchStats', () => {
  it('computes fps, p1 low and p95 from frame deltas', () => {
    const stats = computeBenchStats([10, 10, 10, 40, 10]);
    expect(stats.frames).toBe(5);
    expect(stats.avg_fps).toBe(62.5);
    expect(stats.p1_low_fps).toBe(25);
    expect(stats.frame_ms_p95).toBe(40);
  });

  it('uses at least one worst frame for p1 on short runs', () => {
    const stats = computeBenchStats([8, 8, 8, 32]);
    expect(stats.p1_low_fps).toBe(1000 / 32);
  });

  it('rejects empty input', () => {
    expect(() => computeBenchStats([])).toThrow();
  });
});
