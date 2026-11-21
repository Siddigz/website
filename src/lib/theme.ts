export type Scheme = 'light' | 'dark';

/** What the theme switch says, in the nav and in the command menu. The page shows the one that applies. */
export const THEME_LABELS = { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' } as const;

/** Same key the previous site used, so returning visitors keep their choice. */
export const STORAGE_KEY = 'color-scheme';

export function isScheme(value: unknown): value is Scheme {
  return value === 'light' || value === 'dark';
}

/** The stored override, or null when there is none or storage is unusable. */
export function readStoredScheme(storage: Pick<Storage, 'getItem'> | undefined): Scheme | null {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return isScheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function nextScheme(current: Scheme): Scheme {
  return current === 'light' ? 'dark' : 'light';
}

/**
 * What to store when the visitor asks for `target`. Matching the system means
 * they are undoing an override, so nothing is stored and the site follows the
 * system again.
 */
export function overrideFor(target: Scheme, system: Scheme): Scheme | null {
  return target === system ? null : target;
}

/** `localStorage`, or undefined where reading it throws (blocked site data). */
export function getStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
