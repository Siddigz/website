/*
 * A small in-memory rate limit: at most `limit` calls per `windowMs` for each
 * key. It lives in one running copy of the server function, so it is a first
 * line of defence, not the only one; the host's firewall rule is the other.
 */
const MAX_KEYS = 10_000;

export function createLimiter(limit: number, windowMs: number): (key: string, now: number) => boolean {
  const seen = new Map<string, { start: number; count: number }>();
  return (key, now) => {
    const entry = seen.get(key);
    if (entry && now - entry.start < windowMs) {
      entry.count += 1;
      return entry.count <= limit;
    }
    // A new window. Re-adding moves the key to the end, so the oldest stay first.
    seen.delete(key);
    seen.set(key, { start: now, count: 1 });
    // Memory stays bounded: the oldest keys make room for new ones.
    for (const oldest of seen.keys()) {
      if (seen.size <= MAX_KEYS) break;
      seen.delete(oldest);
    }
    return limit >= 1;
  };
}
