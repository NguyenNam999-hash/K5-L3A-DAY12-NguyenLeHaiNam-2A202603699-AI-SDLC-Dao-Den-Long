import { describe, expect, it } from 'vitest';
import { Alerts } from '../src/render/alerts';

describe('Alerts', () => {
  it('keeps a message for four seconds', () => {
    const alerts = new Alerts();
    alerts.push('Bóng Mực xuất hiện', 'warn', 1000);
    expect(alerts.active(1000).map((m) => m.text)).toEqual(['Bóng Mực xuất hiện']);
    expect(alerts.active(4999).length).toBe(1);
    expect(alerts.active(5001)).toEqual([]);
  });

  it('shows at most three messages, dropping the oldest', () => {
    const alerts = new Alerts();
    alerts.push('một', 'info', 0);
    alerts.push('hai', 'info', 10);
    alerts.push('ba', 'info', 20);
    alerts.push('bốn', 'info', 30);
    expect(alerts.active(40).map((m) => m.text)).toEqual(['hai', 'ba', 'bốn']);
  });

  it('does not repeat the same message within one second', () => {
    const alerts = new Alerts();
    expect(alerts.push('Gió sắp thổi', 'warn', 0)).toBe(true);
    expect(alerts.push('Gió sắp thổi', 'warn', 900)).toBe(false);
    expect(alerts.push('Gió sắp thổi', 'warn', 1100)).toBe(true);
    expect(alerts.active(1100).length).toBe(2);
  });

  it('shows the newest message last and clears on demand', () => {
    const alerts = new Alerts();
    alerts.push('a', 'info', 0);
    alerts.push('b', 'warn', 10);
    expect(alerts.active(20).at(-1)?.tone).toBe('warn');
    alerts.clear();
    expect(alerts.active(20)).toEqual([]);
  });
});
