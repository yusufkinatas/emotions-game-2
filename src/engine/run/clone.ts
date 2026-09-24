// Deep copy of plain JSON data (objects, arrays, primitives). Run-phase steps clone the whole state with it.
// Hand-rolled: the engine may not use the platform clone, and JSON round trips are slower.

export function cloneJson<T>(x: T): T {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) {
    const out: unknown[] = new Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = cloneJson(x[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  const src = x as Record<string, unknown>;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v !== undefined) out[k] = cloneJson(v);
  }
  return out as T;
}
