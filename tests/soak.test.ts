import { describe, expect, it } from 'vitest';
import { parseSoakArgs, runSoakSimulation } from '../src/headless/soak';

describe('soak runner', () => {
  it('plays the requested number of nights with no crash', () => {
    const report = runSoakSimulation(7, 2);
    expect(report.nights).toBe(2);
    expect(report.results.length).toBe(2);
    expect(report.crashes).toBe(0);
    expect(report.mem_start_mb).toBeGreaterThan(0);
    expect(report.mem_end_mb).toBeLessThanOrEqual(report.mem_start_mb * 1.2);
    expect(report.duration_s).toBeGreaterThanOrEqual(0);
  });

  it('rejects bad arguments with a usage error', () => {
    expect(() => parseSoakArgs(['--seed', '7', '--out', 'x.json'])).toThrow();
    expect(() => parseSoakArgs(['--seed', '7', '--nights', '0', '--out', 'x.json'])).toThrow();
    expect(() => parseSoakArgs(['--seed', '7', '--nights', '2'])).toThrow();
  });

  it('accepts the documented command line', () => {
    expect(parseSoakArgs(['--seed', '7', '--nights', '10', '--out', 'soak.json'])).toEqual({
      seed: 7,
      nights: 10,
      out: 'soak.json',
    });
  });
});
