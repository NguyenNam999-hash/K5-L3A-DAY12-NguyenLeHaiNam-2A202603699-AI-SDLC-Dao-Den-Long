import {
  insertEntry,
  normalizeEntry,
  sortEntries,
  type LeaderboardEntry,
} from '../core/leaderboard';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LeaderboardStoreOptions {
  apiBase?: string;
  storage?: StorageLike | null;
  fetchImpl?: typeof fetch;
}

const STORAGE_KEY = 'dao-den-long.leaderboard.v1';

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Disk API when the Node app is serving, localStorage otherwise. Never throws. */
export class LeaderboardStore {
  private readonly apiBase: string;
  private readonly storage: StorageLike | null;
  private readonly fetchImpl: typeof fetch | undefined;
  private cached: LeaderboardEntry[];

  constructor(options: LeaderboardStoreOptions = {}) {
    this.apiBase = options.apiBase ?? '';
    this.storage = options.storage === undefined ? browserStorage() : options.storage;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
    this.cached = this.readStorage();
  }

  async load(): Promise<LeaderboardEntry[]> {
    const remote = await this.fetchEntries();
    if (remote) this.cached = remote;
    return this.cached;
  }

  async submit(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
    this.cached = insertEntry(this.cached, entry);
    this.writeStorage(this.cached);
    const saved = await this.postEntry(entry);
    if (saved) this.cached = saved;
    return this.cached;
  }

  private readStorage(): LeaderboardEntry[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const entries: LeaderboardEntry[] = [];
      for (const item of parsed) {
        const entry = normalizeEntry(item);
        if (entry) entries.push(entry);
      }
      return sortEntries(entries).slice(0, 10);
    } catch {
      return [];
    }
  }

  private writeStorage(entries: LeaderboardEntry[]): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 10)));
    } catch {
      /* private mode */
    }
  }

  private async fetchEntries(): Promise<LeaderboardEntry[] | null> {
    if (!this.fetchImpl) return null;
    try {
      const response = await this.fetchImpl(`${this.apiBase}/api/leaderboard`);
      if (!response.ok) return null;
      const body = (await response.json()) as { entries?: unknown };
      if (!Array.isArray(body.entries)) return null;
      return this.clean(body.entries);
    } catch {
      return null;
    }
  }

  private async postEntry(entry: LeaderboardEntry): Promise<LeaderboardEntry[] | null> {
    if (!this.fetchImpl) return null;
    try {
      const response = await this.fetchImpl(`${this.apiBase}/api/leaderboard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { entries?: unknown };
      if (!Array.isArray(body.entries)) return null;
      return this.clean(body.entries);
    } catch {
      return null;
    }
  }

  private clean(items: unknown[]): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];
    for (const item of items) {
      const entry = normalizeEntry(item);
      if (entry) entries.push(entry);
    }
    const list = sortEntries(entries).slice(0, 10);
    this.writeStorage(list);
    return list;
  }
}
