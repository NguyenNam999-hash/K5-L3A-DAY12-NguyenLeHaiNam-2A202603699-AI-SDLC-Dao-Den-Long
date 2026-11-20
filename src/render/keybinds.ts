/** Rebindable keyboard actions, persisted separately from the other settings. */

export type Action =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'dash'
  | 'interact'
  | 'pulse'
  | 'pause';

export interface KeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_BINDINGS: Record<Action, string> = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'KeyP',
};

export const ACTION_LABELS: Record<Action, string> = {
  moveForward: 'Tiến',
  moveBack: 'Lùi',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Thắp đèn / châm dầu',
  pulse: 'Tỏa sáng',
  pause: 'Tạm dừng',
};

export const ACTIONS = Object.keys(DEFAULT_BINDINGS) as Action[];

const STORAGE_KEY = 'dao-den-long.keys.v1';

export type SetResult = { ok: true } | { ok: false; conflict: Action };

export function formatCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'MetaLeft' || code === 'MetaRight') return 'Cmd';
  if (code === 'Escape') return 'Esc';
  const arrows: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };
  return arrows[code] ?? code;
}

function defaultStorage(): KeyStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Mapping of gameplay actions to KeyboardEvent.code values. */
export class Keybinds {
  bindings: Record<Action, string> = { ...DEFAULT_BINDINGS };
  private readonly storage: KeyStorage | null;

  constructor(storage: KeyStorage | null = defaultStorage()) {
    this.storage = storage;
    this.load();
  }

  codeFor(action: Action): string {
    return this.bindings[action];
  }

  set(action: Action, code: string): SetResult {
    const conflict = ACTIONS.find((other) => other !== action && this.bindings[other] === code);
    if (conflict) return { ok: false, conflict };
    this.bindings[action] = code;
    this.save();
    return { ok: true };
  }

  reset(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.save();
  }

  label(action: Action): string {
    return formatCode(this.bindings[action]);
  }

  save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
    } catch {
      /* private mode */
    }
  }

  load(): void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<Action, unknown>>;
      for (const action of ACTIONS) {
        const code = parsed[action];
        if (typeof code === 'string' && code.length > 0) this.bindings[action] = code;
      }
      this.dedupe();
    } catch {
      this.bindings = { ...DEFAULT_BINDINGS };
    }
  }

  /** Hand-edited storage can put the same code on two actions; keep the first. */
  private dedupe(): void {
    const used = new Set<string>();
    for (const action of ACTIONS) {
      const code = this.bindings[action];
      if (used.has(code)) this.bindings[action] = DEFAULT_BINDINGS[action];
      used.add(this.bindings[action]);
    }
  }
}
