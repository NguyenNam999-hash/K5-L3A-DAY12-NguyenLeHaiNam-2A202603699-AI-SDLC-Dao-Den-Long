/** Visual subtitle queue for the HUD. Pure: callers pass the clock. */

export type AlertTone = 'info' | 'warn';

export interface AlertMessage {
  text: string;
  tone: AlertTone;
  at: number;
}

export class Alerts {
  private items: AlertMessage[] = [];

  constructor(
    private readonly max = 3,
    private readonly ttlMs = 4000,
    private readonly repeatMs = 1000,
  ) {}

  /** Returns false when the same text was shown within the repeat window. */
  push(text: string, tone: AlertTone = 'info', now = Date.now()): boolean {
    let last: AlertMessage | undefined;
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      if (this.items[i]!.text === text) {
        last = this.items[i];
        break;
      }
    }
    if (last && now - last.at < this.repeatMs) return false;
    this.items = this.items.filter((item) => now - item.at < this.ttlMs);
    this.items.push({ text, tone, at: now });
    if (this.items.length > this.max) this.items = this.items.slice(-this.max);
    return true;
  }

  active(now = Date.now()): AlertMessage[] {
    return this.items.filter((item) => now - item.at < this.ttlMs);
  }

  clear(): void {
    this.items = [];
  }
}
