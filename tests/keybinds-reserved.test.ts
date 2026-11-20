import { describe, expect, it } from 'vitest';
import { Keybinds, type KeyStorage } from '../src/render/keybinds';

function memoryStorage(): KeyStorage {
  const data: Record<string, string> = {};
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('Keybinds reserved keys', () => {
  it('refuses codes the game keeps for camera, audio and escape', () => {
    const keys = new Keybinds(memoryStorage());
    expect(keys.set('jump', 'KeyQ')).toEqual({ ok: false, reserved: 'KeyQ' });
    expect(keys.set('interact', 'KeyM')).toEqual({ ok: false, reserved: 'KeyM' });
    expect(keys.set('dash', 'Escape')).toEqual({ ok: false, reserved: 'Escape' });
    expect(keys.codeFor('jump')).toBe('Space');
    expect(keys.codeFor('interact')).toBe('KeyE');
  });
});
