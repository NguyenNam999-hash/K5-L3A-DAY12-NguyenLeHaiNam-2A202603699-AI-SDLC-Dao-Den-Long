/** Tiny procedural sound kit built on Web Audio. Silent until the first user gesture. */
export class AudioFx {
  private ctx: AudioContext | null = null;
  enabled = true;

  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.06,
    slideTo?: number,
  ): void {
    if (!this.enabled || !this.ctx) return;
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
    osc.connect(amp).connect(ctx.destination);
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

  result(won: boolean): void {
    const notes = won ? [523, 659, 784, 1046, 1318] : [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.7, 'sine', 0.05), i * 130);
    });
  }
}
