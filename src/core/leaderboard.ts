/** Local leaderboard rules (Contract v1.3). Pure: no clock, no storage. */

export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export const LEADERBOARD_SIZE = 10;

const NAME_PATTERN = /^[A-Za-z0-9_]{3,12}$/;
const TZ_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

/** Returns the name unchanged when valid, `null` otherwise. */
export function validateName(raw: string): string | null {
  return NAME_PATTERN.test(raw) ? raw : null;
}

/** Returns a clean entry, or `null` when any field breaks the contract. */
export function normalizeEntry(raw: unknown): LeaderboardEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.name !== 'string' || validateName(value.name) === null) return null;
  if (typeof value.score !== 'number' || !Number.isInteger(value.score) || value.score < 0) return null;
  if (typeof value.nights_won !== 'number' || !Number.isInteger(value.nights_won)) return null;
  if (value.nights_won < 0 || value.nights_won > 3) return null;
  if (typeof value.achieved_at !== 'string' || !TZ_PATTERN.test(value.achieved_at)) return null;
  if (!Number.isFinite(Date.parse(value.achieved_at))) return null;
  if (typeof value.seed !== 'number' || !Number.isInteger(value.seed)) return null;
  return {
    name: value.name,
    score: value.score,
    nights_won: value.nights_won,
    achieved_at: value.achieved_at,
    seed: value.seed,
  };
}

/** Score descending; equal scores keep their order (stable sort). */
export function sortEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...list].sort((a, b) => b.score - a.score);
}

/** Adds one entry, keeps the top 10 and never mutates the input. */
export function insertEntry(list: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return sortEntries([...list, entry]).slice(0, LEADERBOARD_SIZE);
}
