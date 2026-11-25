/*
 * What the browser remembers about a visitor, kept only in their own browser:
 * how many times they have come, when they were last here, and which project
 * pages they have opened.
 * Storage can be missing or blocked (private windows), so every function
 * takes it as a value that may be undefined and never throws.
 */
const VISITS = 'visits';
const LAST_SEEN = 'last-seen';
const SEEN = 'seen-projects';
const SEEN_LIMIT = 50;
/** A visit ends once this long has passed with no page opened. */
const VISIT_GAP_MS = 30 * 60_000;

/**
 * Call once per page load. A visit is a run of page loads with no gap of half
 * an hour: reloading, going to a project and back, or opening a second tab all
 * stay the same visit, because every tab shares the browser's lasting storage.
 * `returning` is true for the whole of any visit after the first.
 */
export function startVisit(local: Storage | undefined, now: number): { returning: boolean } {
  try {
    if (!local) return { returning: false };
    const stored = Number(local.getItem(VISITS));
    const visits = Number.isInteger(stored) && stored > 0 ? stored : 0;
    const lastSeen = Number(local.getItem(LAST_SEEN));
    // A clock that has gone backwards is read as "just now", not as a long absence.
    const away = Number.isFinite(lastSeen) && lastSeen > 0 ? now - lastSeen : Infinity;
    const visit = visits === 0 || away > VISIT_GAP_MS ? visits + 1 : visits;
    local.setItem(VISITS, String(visit));
    local.setItem(LAST_SEEN, String(now));
    return { returning: visit > 1 };
  } catch {
    return { returning: false };
  }
}

/** The project pages this browser has opened, oldest first. */
export function seenProjects(local: Storage | undefined): string[] {
  try {
    const stored: unknown = JSON.parse(local?.getItem(SEEN) ?? '[]');
    return Array.isArray(stored) ? stored.filter((slug): slug is string => typeof slug === 'string') : [];
  } catch {
    return [];
  }
}

export function markSeen(local: Storage | undefined, slug: string): void {
  try {
    if (!local) return;
    const seen = seenProjects(local);
    if (seen.includes(slug)) return;
    local.setItem(SEEN, JSON.stringify([...seen, slug].slice(-SEEN_LIMIT)));
  } catch {
    // Blocked storage: nothing is remembered, and nothing breaks.
  }
}
