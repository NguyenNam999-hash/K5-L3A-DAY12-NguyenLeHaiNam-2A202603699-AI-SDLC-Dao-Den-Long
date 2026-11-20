/** Tiny procedural sound kit built on Web Audio. Silent until the first user gesture. */
export class AudioFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicNight = 0;
  enabled = true;
  volume = 0.8;

  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.applyVolume();
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.applyVolume();
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.06,
    slideTo?: number,
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  pickup(): void {
    this.tone(880, 0.16, 'sine', 0.05, 1320);
  }

  deposit(): void {
    this.tone(392, 0.18, 'triangle', 0.05, 523);
  }

  light(): void {
    [523, 659, 784, 1046].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.5, 'sine', 0.045), i * 70);
    });
  }

  pulse(): void {
    this.tone(320, 0.35, 'sawtooth', 0.05, 90);
    this.tone(140, 0.5, 'sine', 0.045, 60);
  }

  hit(): void {
    this.tone(140, 0.3, 'square', 0.05, 60);
  }

  jump(): void {
    this.tone(420, 0.12, 'triangle', 0.035, 620);
  }

  dash(): void {
    this.tone(260, 0.18, 'sawtooth', 0.04, 760);
  }

  charm(): void {
    [784, 988, 1175].forEach((freq, i) => window.setTimeout(() => this.tone(freq, 0.35, 'sine', 0.04), i * 80));
  }

  steal(): void {
    this.tone(520, 0.22, 'triangle', 0.045, 220);
  }

  shadeSpawn(): void {
    this.tone(90, 0.5, 'sine', 0.035, 60);
  }

  countdown(): void {
    this.tone(660, 0.12, 'square', 0.03);
  }

  wind(): void {
    this.tone(220, 1.2, 'sine', 0.025, 160);
  }

  result(won: boolean): void {
    const notes = won ? [523, 659, 784, 1046, 1318] : [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.7, 'sine', 0.05), i * 130);
    });
  }

  /** Slow pentatonic night loop; changes key per island. */
  startMusic(night: number): void {
    if (!this.ctx || !this.master) return;
    if (this.musicNight === night && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicNight = night;
    const ctx = this.ctx;
    const base = night === 1 ? 110 : night === 2 ? 123.47 : 98;
    for (const [freq, gain] of [
      [base, 0.012],
      [base * 1.5, 0.008],
    ] as const) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      amp.gain.value = gain;
      osc.connect(amp).connect(this.master);
      osc.start();
      this.musicNodes.push(osc);
    }
    const scale = [0, 3, 5, 7, 10, 12];
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.enabled) return;
      const semitone = scale[step % scale.length]!;
      const octave = Math.floor(step / scale.length) % 2;
      const freq = base * 2 * Math.pow(2, (semitone + octave * 12) / 12);
      this.tone(freq, 1.4, 'sine', 0.012);
      step += 1;
    }, 1450);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const node of this.musicNodes) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
    this.musicNight = 0;
  }
}
