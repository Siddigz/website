/*
 * Switching the theme, for the toggle in the nav and the entry in the command
 * menu. The choice is written to the page's colour-scheme setting, which the
 * styles follow, and remembered for next time where storage allows.
 */
import { STORAGE_KEY, getStorage, isScheme, nextScheme, overrideFor, type Scheme } from '../lib/theme';

const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
const system = window.matchMedia('(prefers-color-scheme: dark)');

const systemScheme = (): Scheme => (system.matches ? 'dark' : 'light');
const renderedScheme = (): Scheme => (isScheme(meta?.content) ? meta.content : systemScheme());

function apply(override: Scheme | null): void {
  if (meta) meta.content = override ?? 'light dark';
  // The browser-bar colour follows a pinned theme, and the system otherwise.
  for (const bar of document.querySelectorAll<HTMLMetaElement>('meta[data-bar]')) {
    const scheme = bar.dataset.bar;
    bar.media = override ? (scheme === override ? 'all' : 'not all') : `(prefers-color-scheme: ${scheme})`;
  }
}

export function toggleTheme(): void {
  const override = overrideFor(nextScheme(renderedScheme()), systemScheme());
  apply(override);
  try {
    const storage = getStorage();
    if (override) storage?.setItem(STORAGE_KEY, override);
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // The theme still applies for this visit; it just is not remembered.
  }
}

// Keep other open tabs in step.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) apply(isScheme(event.newValue) ? event.newValue : null);
});
