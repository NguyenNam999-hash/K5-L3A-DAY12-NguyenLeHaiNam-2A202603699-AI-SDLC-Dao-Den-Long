import type { AudioFx } from './audio';

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
}

const STORAGE_KEY = 'dao-den-long.settings.v3';

function defaults(): PersistedSettings {
  return { volume: 0.8, sensitivity: 0.16, difficulty: 'easy', sound: true, colorblind: false };
}

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
}

/** Settings shared by the main menu and the pause menu, persisted in localStorage. */
export class Settings {
  values: PersistedSettings;
  private readonly root = el<HTMLDivElement>('#settings');
  private readonly volume = el<HTMLInputElement>('#volume-slider');
  private readonly volumeVal = el<HTMLSpanElement>('#volume-val');
  private readonly sensitivity = el<HTMLInputElement>('#sensitivity-slider');
  private readonly sensitivityVal = el<HTMLSpanElement>('#sensitivity-val');
  private readonly soundBtn = el<HTMLButtonElement>('#sound-btn');
  private readonly colorblindBtn = el<HTMLButtonElement>('#colorblind-btn');
  private readonly difficultyDesc = el<HTMLSpanElement>('#difficulty-desc');
  private readonly difficultyButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#difficulty-group .seg-btn'),
  );
  private readonly backBtn = el<HTMLButtonElement>('#settings-back');

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
  }

  onClose: () => void = () => {};
  onColorblindChange: (on: boolean) => void = () => {};

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
      const raw = window.localStorage.getItem(STORAGE_KEY);
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
    document.body.classList.toggle('colorblind', this.values.colorblind);
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
