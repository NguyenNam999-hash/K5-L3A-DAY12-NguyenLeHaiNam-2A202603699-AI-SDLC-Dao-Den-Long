import { describe, expect, it } from 'vitest';
import {
  insertEntry,
  normalizeEntry,
  sortEntries,
  validateName,
  type LeaderboardEntry,
} from '../src/core/leaderboard';

function entry(name: string, score: number, at = '2026-11-20T10:00:00.000Z'): LeaderboardEntry {
  return { name, score, nights_won: 3, achieved_at: at, seed: 7 };
}

describe('validateName', () => {
  it('accepts 3 to 12 letters, digits and underscores', () => {
    expect(validateName('abc')).toBe('abc');
    expect(validateName('May_01')).toBe('May_01');
    expect(validateName('A1_b2C3d4E5f')).toBe('A1_b2C3d4E5f');
  });

  it('rejects wrong lengths, spaces and accented letters', () => {
    expect(validateName('ab')).toBeNull();
    expect(validateName('A1_b2C3d4E5f6g')).toBeNull();
    expect(validateName('Mây_01')).toBeNull();
    expect(validateName('bad-name')).toBeNull();
    expect(validateName(' May_01 ')).toBeNull();
  });
});

describe('normalizeEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(normalizeEntry(entry('May_01', 858))).toEqual(entry('May_01', 858));
  });

  it('rejects invalid nights, scores and timestamps without a timezone', () => {
    expect(normalizeEntry({ ...entry('May_01', 10), nights_won: 4 })).toBeNull();
    expect(normalizeEntry({ ...entry('May_01', 10), score: 1.5 })).toBeNull();
    expect(normalizeEntry({ ...entry('May_01', 10), achieved_at: '2026-11-20T10:00:00' })).toBeNull();
    expect(normalizeEntry({ ...entry('May_01', 10), name: 'x' })).toBeNull();
    expect(normalizeEntry(null)).toBeNull();
  });

  it('accepts an achieved_at with a numeric offset', () => {
    expect(normalizeEntry(entry('May_01', 10, '2026-11-20T17:00:00+07:00'))).not.toBeNull();
  });
});

describe('insertEntry', () => {
  it('sorts by score descending and keeps only the top 10', () => {
    let list: LeaderboardEntry[] = [];
    for (let i = 1; i <= 12; i += 1) list = insertEntry(list, entry(`P${i}`, i * 100));
    expect(list.length).toBe(10);
    expect(list.map((e) => e.score)).toEqual([1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300]);
    expect(list.some((e) => e.name === 'P1')).toBe(false);
  });

  it('keeps the earlier entry above a later tie', () => {
    let list = insertEntry([], entry('First', 500, '2026-11-20T10:00:00.000Z'));
    list = insertEntry(list, entry('Later', 500, '2026-11-20T11:00:00.000Z'));
    expect(list.map((e) => e.name)).toEqual(['First', 'Later']);
  });

  it('does not mutate the input list', () => {
    const original = [entry('One', 10)];
    const next = insertEntry(original, entry('Two', 20));
    expect(original.map((e) => e.name)).toEqual(['One']);
    expect(next.map((e) => e.name)).toEqual(['Two', 'One']);
  });
});

describe('sortEntries', () => {
  it('is stable for equal scores', () => {
    const list = [entry('One', 10), entry('Two', 10), entry('Three', 20)];
    expect(sortEntries(list).map((e) => e.name)).toEqual(['Three', 'One', 'Two']);
  });
});
