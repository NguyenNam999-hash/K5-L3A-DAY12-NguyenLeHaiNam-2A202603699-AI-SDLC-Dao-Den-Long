import type { AudioFx } from './audio';
import { ACTIONS, ACTION_LABELS, formatCode, Keybinds, RESERVED_LABELS, type Action } from './keybinds';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultySpec {
  label: string;
  /** Multiplier on shade chase speed. */
  speed: number;
  /** Multiplier on the spawn cap. */
  count: number;
  blurb: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: {
    label: 'Dễ',
    speed: 1,
    count: 1,
    blurb: 'Đúng contract v1.1: Bóng Mực 4.0 m/s, trần theo từng Đêm.',
  },
  medium: {
    label: 'Vừa',
    speed: 1.35,
    count: 1,
    blurb: 'Bóng Mực nhanh hơn 35%.',
  },
  hard: {
    label: 'Khó',
    speed: 1.5,
    count: 2,
    blurb: 'Bóng Mực nhanh gấp 1.5 và trần gấp đôi.',
  },
};

export interface PersistedSettings {
  volume: number;
  sensitivity: number;
  difficulty: Difficulty;
  sound: boolean;
  /** High-contrast palette that never relies on red/violet alone. */
  colorblind: boolean;
  /** Stops camera shake and damage flashes. */
  reduceMotion: boolean;
  /** UI text scale ×1.25. */
  largeText: boolean;
}

const STORAGE_KEY = 'dao-den-long.settings.v4';
const LEGACY_STORAGE_KEY = 'dao-den-long.settings.v3';

function defaults(): PersistedSettings {
  return {
    volume: 0.8,
    sensitivity: 0.16,
    difficulty: 'easy',
    sound: true,
    colorblind: false,
    reduceMotion: false,
    largeText: false,
  };
}

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
}

/** Settings shared by the main menu and the pause menu, persisted in localStorage. */
export class Settings {
  values: PersistedSettings;
  readonly keybinds = new Keybinds();
  private readonly root = el<HTMLDivElement>('#settings');
  private readonly volume = el<HTMLInputElement>('#volume-slider');
  private readonly volumeVal = el<HTMLSpanElement>('#volume-val');
  private readonly sensitivity = el<HTMLInputElement>('#sensitivity-slider');
  private readonly sensitivityVal = el<HTMLSpanElement>('#sensitivity-val');
  private readonly soundBtn = el<HTMLButtonElement>('#sound-btn');
  private readonly colorblindBtn = el<HTMLButtonElement>('#colorblind-btn');
  private readonly motionBtn = el<HTMLButtonElement>('#motion-btn');
  private readonly largeTextBtn = el<HTMLButtonElement>('#large-text-btn');
  private readonly difficultyDesc = el<HTMLSpanElement>('#difficulty-desc');
  private readonly difficultyButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#difficulty-group .seg-btn'),
  );
  private readonly backBtn = el<HTMLButtonElement>('#settings-back');
  private readonly keybindList = el<HTMLDivElement>('#keybind-list');
  private readonly keybindError = el<HTMLParagraphElement>('#keybind-error');
  private readonly keybindReset = el<HTMLButtonElement>('#keybinds-reset');
  private readonly keyButtons = new Map<Action, HTMLButtonElement>();
  private captureHandler: ((event: KeyboardEvent) => void) | null = null;
  private capturing: Action | null = null;

  constructor(private readonly audio: AudioFx) {
    this.values = this.load();
    this.volume.value = String(Math.round(this.values.volume * 100));
    this.sensitivity.value = String(Math.round(this.values.sensitivity * 1000));
    this.sync();
    this.volume.addEventListener('input', () => {
      this.values.volume = Number(this.volume.value) / 100;
      this.sync();
    });
    this.sensitivity.addEventListener('input', () => {
      this.values.sensitivity = Number(this.sensitivity.value) / 1000;
      this.sync();
    });
    this.soundBtn.addEventListener('click', () => {
      this.values.sound = !this.values.sound;
      this.sync();
    });
    this.colorblindBtn.addEventListener('click', () => {
      this.values.colorblind = !this.values.colorblind;
      this.sync();
      this.onColorblindChange(this.values.colorblind);
    });
    this.motionBtn.addEventListener('click', () => {
      this.values.reduceMotion = !this.values.reduceMotion;
      this.sync();
    });
    this.largeTextBtn.addEventListener('click', () => {
      this.values.largeText = !this.values.largeText;
      this.sync();
    });
    for (const button of this.difficultyButtons) {
      button.addEventListener('click', () => {
        const value = button.dataset.difficulty as Difficulty | undefined;
        if (value) {
          this.values.difficulty = value;
          this.sync();
        }
      });
    }
    this.backBtn.addEventListener('click', () => this.hide());
    this.buildKeybinds();
    this.keybindReset.addEventListener('click', () => {
      this.keybinds.reset();
      this.endCapture();
      this.showKeyError('');
      this.onKeybindsChange();
    });
  }

  onClose: () => void = () => {};
  onColorblindChange: (on: boolean) => void = () => {};
  onKeybindsChange: () => void = () => {};
  onReduceMotionChange: (on: boolean) => void = () => {};

  keyLabel(action: Action): string {
    return this.keybinds.label(action);
  }

  private buildKeybinds(): void {
    for (const action of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      const label = document.createElement('span');
      label.className = 'keybind-name';
      label.textContent = ACTION_LABELS[action];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn ghost keybind-btn';
      button.textContent = this.keybinds.label(action);
      button.setAttribute('aria-label', `Đổi phím ${ACTION_LABELS[action]}`);
      button.addEventListener('click', () => this.capture(action));
      row.append(label, button);
      this.keybindList.append(row);
      this.keyButtons.set(action, button);
    }
  }

  private capture(action: Action): void {
    this.endCapture();
    this.capturing = action;
    const button = this.keyButtons.get(action);
    button?.classList.add('capturing');
    if (button) button.textContent = 'Nhấn phím…';
    this.captureHandler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        this.endCapture();
        return;
      }
      const result = this.keybinds.set(action, event.code);
      if (!result.ok) {
        if ('reserved' in result) {
          this.showKeyError(`Phím ${formatCode(result.reserved)} được dành cho ${RESERVED_LABELS[result.reserved] ?? 'hệ thống'}`);
        } else {
          this.showKeyError(`Phím ${formatCode(event.code)} đang dùng cho ${ACTION_LABELS[result.conflict]}`);
        }
      } else {
        this.showKeyError('');
        this.onKeybindsChange();
      }
      this.endCapture();
    };
    document.addEventListener('keydown', this.captureHandler, true);
  }

  private endCapture(): void {
    if (this.captureHandler) document.removeEventListener('keydown', this.captureHandler, true);
    this.captureHandler = null;
    this.capturing = null;
    for (const [action, button] of this.keyButtons) {
      button.classList.remove('capturing');
      button.textContent = this.keybinds.label(action);
    }
  }

  private showKeyError(text: string): void {
    this.keybindError.textContent = text;
    this.keybindError.hidden = text.length === 0;
  }

  get difficulty(): Difficulty {
    return this.values.difficulty;
  }

  get colorblind(): boolean {
    return this.values.colorblind;
  }

  toggleSound(): boolean {
    this.values.sound = !this.values.sound;
    this.sync();
    return this.values.sound;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.onClose();
  }

  private load(): PersistedSettings {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      const base = defaults();
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : base.volume,
        sensitivity:
          typeof parsed.sensitivity === 'number' && parsed.sensitivity > 0.01 && parsed.sensitivity < 1
            ? parsed.sensitivity
            : base.sensitivity,
        difficulty:
          parsed.difficulty === 'medium' || parsed.difficulty === 'hard' || parsed.difficulty === 'easy'
            ? parsed.difficulty
            : base.difficulty,
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : base.sound,
        colorblind: typeof parsed.colorblind === 'boolean' ? parsed.colorblind : base.colorblind,
        reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : base.reduceMotion,
        largeText: typeof parsed.largeText === 'boolean' ? parsed.largeText : base.largeText,
      };
    } catch {
      return defaults();
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* private mode */
    }
  }

  private sync(): void {
    this.volumeVal.textContent = `${Math.round(this.values.volume * 100)}%`;
    this.sensitivityVal.textContent = `${this.values.sensitivity.toFixed(2)}×`;
    this.soundBtn.textContent = this.values.sound ? 'Bật' : 'Tắt';
    this.soundBtn.setAttribute('aria-pressed', String(this.values.sound));
    this.soundBtn.classList.toggle('off', !this.values.sound);
    this.colorblindBtn.textContent = this.values.colorblind ? 'Bật' : 'Tắt';
    this.colorblindBtn.setAttribute('aria-pressed', String(this.values.colorblind));
    this.colorblindBtn.classList.toggle('off', !this.values.colorblind);
    this.motionBtn.textContent = this.values.reduceMotion ? 'Bật' : 'Tắt';
    this.motionBtn.setAttribute('aria-pressed', String(this.values.reduceMotion));
    this.motionBtn.classList.toggle('off', !this.values.reduceMotion);
    this.largeTextBtn.textContent = this.values.largeText ? 'Bật' : 'Tắt';
    this.largeTextBtn.setAttribute('aria-pressed', String(this.values.largeText));
    this.largeTextBtn.classList.toggle('off', !this.values.largeText);
    document.body.classList.toggle('colorblind', this.values.colorblind);
    document.body.classList.toggle('reduce-motion', this.values.reduceMotion);
    document.body.classList.toggle('large-text', this.values.largeText);
    this.onReduceMotionChange(this.values.reduceMotion);
    this.audio.setEnabled(this.values.sound);
    this.audio.setVolume(this.values.volume);
    const spec = DIFFICULTIES[this.values.difficulty];
    this.difficultyDesc.textContent = spec.blurb;
    for (const button of this.difficultyButtons) {
      const active = button.dataset.difficulty === this.values.difficulty;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    this.save();
  }
}
