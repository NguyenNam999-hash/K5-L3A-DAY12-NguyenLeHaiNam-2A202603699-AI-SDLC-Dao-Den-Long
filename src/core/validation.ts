export type Vec3 = [number, number, number];

export function fail(path: string, expected: string): never {
  throw new Error(`${path}: ${expected}`);
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function asNumber(v: unknown, path: string): number {
  if (!isFiniteNumber(v)) fail(path, 'expected a finite number');
  return v;
}

export function asBoolean(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'expected true or false');
  return v;
}

export function asString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(path, 'expected a non-empty string');
  return v;
}

export function asObject(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) fail(path, 'expected an object');
  return v;
}

export function asVec3(v: unknown, path: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3) fail(path, 'expected [x, y, z]');
  return [asNumber(v[0], `${path}[0]`), asNumber(v[1], `${path}[1]`), asNumber(v[2], `${path}[2]`)];
}

export function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'expected an array');
  return v;
}

export function asNonNegativeInt(v: unknown, path: string): number {
  const n = asNumber(v, path);
  if (!Number.isInteger(n) || n < 0) fail(path, 'expected a non-negative integer');
  return n;
}
