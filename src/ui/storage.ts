// localStorage wrapped so the game runs without it (private windows, blocked storage, previews).

export function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function loadRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** True if storage can be written and read back. */
export function storageAvailable(): boolean {
  try {
    const k = '__heartward_probe__';
    window.localStorage.setItem(k, '1');
    const ok = window.localStorage.getItem(k) === '1';
    window.localStorage.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}
