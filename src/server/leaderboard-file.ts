import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  insertEntry,
  normalizeEntry,
  sortEntries,
  type LeaderboardEntry,
} from '../core/leaderboard';

/** Reads the on-disk leaderboard. Corrupt or missing data reads as an empty list. */
export function readLeaderboardFile(path: string): LeaderboardEntry[] {
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)
        ? (raw as { entries: unknown[] }).entries
        : [];
    const entries: LeaderboardEntry[] = [];
    for (const item of list) {
      const entry = normalizeEntry(item);
      if (entry) entries.push(entry);
    }
    return sortEntries(entries).slice(0, 10);
  } catch {
    return [];
  }
}

/** Writes the leaderboard as `{"entries":[...]}`. Creates parent directories. */
export function writeLeaderboardFile(path: string, entries: LeaderboardEntry[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ entries: sortEntries(entries).slice(0, 10) }, null, 2)}\n`, 'utf8');
}

/** Reads, inserts one entry and writes back. Returns the new list. */
export function addLeaderboardEntry(path: string, entry: LeaderboardEntry): LeaderboardEntry[] {
  const next = insertEntry(readLeaderboardFile(path), entry);
  writeLeaderboardFile(path, next);
  return next;
}

/** Writes the export file required by Contract v1.3. */
export function exportLeaderboard(dataFile: string, outFile: string): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify({ entries: readLeaderboardFile(dataFile) }, null, 2)}\n`, 'utf8');
}
