/** Frame-time statistics for the Phase 4 benchmark (Contract v1.3). */

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {number[]} dts frame deltas in milliseconds
 * @returns {{frames:number, avg_fps:number, p1_low_fps:number, frame_ms_p95:number}}
 */
export function computeBenchStats(dts) {
  const frames = dts.length;
  if (frames === 0) throw new Error('computeBenchStats: no frames');
  const total = dts.reduce((sum, dt) => sum + dt, 0);
  const sortedAsc = [...dts].sort((a, b) => a - b);
  const sortedDesc = [...sortedAsc].reverse();

  const k = Math.max(1, Math.ceil(0.01 * frames));
  const worst = sortedDesc.slice(0, k);
  const worstAvg = worst.reduce((sum, dt) => sum + dt, 0) / worst.length;

  const p95Index = Math.max(0, Math.ceil(0.95 * frames) - 1);

  return {
    frames,
    avg_fps: round2((1000 * frames) / total),
    p1_low_fps: round2(1000 / worstAvg),
    frame_ms_p95: round2(sortedAsc[p95Index]),
  };
}
