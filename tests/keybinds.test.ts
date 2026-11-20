import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, Keybinds, formatCode, type KeyStorage } from '../src/render/keybinds';

function memoryStorage(seed: Record<string, string> = {}): KeyStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('Keybinds', () => {
  it('starts from the documented defaults', () => {
    const keys = new Keybinds(memoryStorage());
    expect(keys.codeFor('moveForward')).toBe('KeyW');
    expect(keys.codeFor('moveBack')).toBe('KeyS');
    expect(keys.codeFor('moveLeft')).toBe('KeyA');
    expect(keys.codeFor('moveRight')).toBe('KeyD');
    expect(keys.codeFor('jump')).toBe('Space');
    expect(keys.codeFor('dash')).toBe('ShiftLeft');
    expect(keys.codeFor('interact')).toBe('KeyE');
    expect(keys.codeFor('pulse')).toBe('KeyF');
    expect(keys.codeFor('pause')).toBe('KeyP');
    expect(DEFAULT_BINDINGS.jump).toBe('Space');
  });

  it('rejects a code already bound to another action and keeps the old binding', () => {
    const keys = new Keybinds(memoryStorage());
    expect(keys.set('jump', 'KeyW')).toEqual({ ok: false, conflict: 'moveForward' });
    expect(keys.codeFor('jump')).toBe('Space');
    expect(keys.set('pulse', 'KeyW')).toEqual({ ok: false, conflict: 'moveForward' });
  });

  it('accepts the action own code and a free code', () => {
    const keys = new Keybinds(memoryStorage());
    expect(keys.set('jump', 'Space')).toEqual({ ok: true });
    expect(keys.set('jump', 'KeyJ')).toEqual({ ok: true });
    expect(keys.codeFor('jump')).toBe('KeyJ');
  });

  it('restores the defaults', () => {
    const keys = new Keybinds(memoryStorage());
    keys.set('jump', 'KeyJ');
    keys.reset();
    expect(keys.codeFor('jump')).toBe('Space');
  });

  it('persists bindings across instances and ignores malformed storage', () => {
    const storage = memoryStorage();
    const first = new Keybinds(storage);
    first.set('dash', 'KeyX');
    const second = new Keybinds(storage);
    expect(second.codeFor('dash')).toBe('KeyX');

    const broken = new Keybinds(memoryStorage({ 'dao-den-long.keys.v1': '{oops' }));
    expect(broken.codeFor('dash')).toBe('ShiftLeft');
  });

  it('formats codes for the UI', () => {
    expect(formatCode('KeyW')).toBe('W');
    expect(formatCode('Digit1')).toBe('1');
    expect(formatCode('Space')).toBe('Space');
    expect(formatCode('ShiftLeft')).toBe('Shift');
    expect(formatCode('ShiftRight')).toBe('Shift');
    expect(formatCode('ArrowUp')).toBe('↑');
    expect(formatCode('Escape')).toBe('Esc');
  });
});
