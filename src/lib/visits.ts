/*
 * What the browser remembers about a visitor, kept only in their own browser:
 * how many times they have come, and which project pages they have opened.
 * Storage can be missing or blocked (private windows), so every function
 * takes it as a value that may be undefined and never throws.
 */
const VISITS = 'visits';
const THIS_VISIT = 'visit';
const SEEN = 'seen-projects';
const SEEN_LIMIT = 50;

/**
 * Call once per page load. A visit is one browser session: reloading, or going
 * to a project and back, stays the same visit. `returning` is true for the
 * whole of any session after the first.
 */
export function startVisit(local: Storage | undefined, session: Storage | undefined): { returning: boolean } {
  try {
    if (!local || !session) return { returning: false };
    const known = Number(session.getItem(THIS_VISIT));
    if (known >= 1) return { returning: known > 1 };
    const earlier = Number(local.getItem(VISITS));
    const visit = (Number.isInteger(earlier) && earlier > 0 ? earlier : 0) + 1;
    session.setItem(THIS_VISIT, String(visit));
    local.setItem(VISITS, String(visit));
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
