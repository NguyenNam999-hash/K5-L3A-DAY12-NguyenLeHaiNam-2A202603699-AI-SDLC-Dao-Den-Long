import { describe, expect, it } from 'vitest';
import { NIGHT_CONFIGS } from '../src/core/nights';
import { groundHeight, isSolid, onBridge, onIslandA, onIslandB } from '../src/core/terrain';

describe('night 1 terrain', () => {
  it('is a disc of radius 40 with a void beyond', () => {
    expect(groundHeight(1, 0, 0)).toBe(0);
    expect(groundHeight(1, 39.9, 0)).toBe(0);
    expect(groundHeight(1, 40, 0)).toBe(0);
    expect(groundHeight(1, 40.1, 0)).toBeNull();
    expect(groundHeight(1, 30, 30)).toBeNull();
  });
});

describe('night 2 terrain', () => {
  it('has two islands joined by the bamboo bridge', () => {
    expect(groundHeight(2, 0, 0)).toBe(0);
    expect(groundHeight(2, 27, 0)).toBe(0);
    expect(groundHeight(2, 34, 0)).toBe(0);
    expect(groundHeight(2, 70, 0)).toBe(0);
    expect(onBridge(34, 0)).toBe(true);
    expect(onIslandA(20, 0)).toBe(true);
    expect(onIslandB(50, 0)).toBe(true);
  });

  it('turns everything else into the sea of clouds', () => {
    expect(groundHeight(2, 34, 3)).toBeNull();
    expect(groundHeight(2, 35, 35)).toBeNull();
    expect(groundHeight(2, 40, 20)).toBeNull();
  });

  it('places six lanterns across both islands', () => {
    expect(NIGHT_CONFIGS[2].lanterns.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  });
});

describe('night 3 terrain', () => {
  it('has three tiers', () => {
    expect(groundHeight(3, 0, 0)).toBe(6);
    expect(groundHeight(3, 7, 0)).toBe(6);
    expect(groundHeight(3, 18, 10)).toBe(3);
    expect(groundHeight(3, -18, -10)).toBe(0);
    expect(groundHeight(3, 20, 0)).toBe(0);
    expect(groundHeight(3, 30, -20)).toBe(0);
  });

  it('ramps 0 -> 3 between radius 30 and 24 at 30 and 150 degrees', () => {
    const a = (30 * Math.PI) / 180;
    expect(groundHeight(3, Math.cos(a) * 27, Math.sin(a) * 27)).toBeCloseTo(1.5, 6);
    expect(groundHeight(3, Math.cos(a) * 30, Math.sin(a) * 30)).toBeCloseTo(0, 6);
    expect(groundHeight(3, Math.cos(a) * 24, Math.sin(a) * 24)).toBeCloseTo(3, 6);
    const b = (150 * Math.PI) / 180;
    expect(groundHeight(3, Math.cos(b) * 27, Math.sin(b) * 27)).toBeCloseTo(1.5, 6);
  });

  it('keeps the bell tower solid', () => {
    expect(isSolid(3, 0, 7, 0)).toBe(true);
    expect(isSolid(3, 1.9, 10, 0)).toBe(true);
    expect(isSolid(3, 2.1, 7, 0)).toBe(false);
    expect(isSolid(1, 0, 7, 0)).toBe(false);
  });

  it('has seven lanterns on the correct tiers', () => {
    const lanterns = NIGHT_CONFIGS[3].lanterns;
    expect(lanterns.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
    expect(lanterns[0]!.pos[1]).toBe(6);
    expect(lanterns[1]!.pos[1]).toBe(3);
    expect(lanterns[3]!.pos[1]).toBe(0);
  });
});
