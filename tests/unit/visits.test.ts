import { describe, it, expect } from 'vitest';
import { markSeen, seenProjects, startVisit } from '../../src/lib/visits';

/** A stand-in for the browser's storage. */
function storage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const broken = new Proxy({} as Storage, {
  get() {
    throw new Error('blocked');
  },
});

const START = Date.UTC(2026, 10, 21, 15, 0, 0);
const MINUTE = 60_000;

describe('startVisit', () => {
  it('counts a first visit once, however often pages load during it', () => {
    const local = storage();
    expect(startVisit(local, START)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
    expect(startVisit(local, START + 5 * MINUTE)).toEqual({ returning: false });
    expect(startVisit(local, START + 20 * MINUTE)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it('is the same visit in a second tab: every tab of a browser shares what it remembers', () => {
    // A second tab has its own session storage but the same lasting storage.
    const local = storage();
    expect(startVisit(local, START)).toEqual({ returning: false });
    expect(startVisit(local, START + MINUTE)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it('calls it a return once half an hour has passed with no page opened, and for the whole of that visit', () => {
    const local = storage();
    startVisit(local, START);
    expect(startVisit(local, START + 29 * MINUTE)).toEqual({ returning: false });
    const later = START + 29 * MINUTE + 31 * MINUTE;
    expect(startVisit(local, later)).toEqual({ returning: true });
    expect(local.getItem('visits')).toBe('2');
    expect(startVisit(local, later + 10 * MINUTE)).toEqual({ returning: true });
    expect(local.getItem('visits')).toBe('2');
  });

  it('treats a count or a time that is not a number as no visits yet', () => {
    const local = storage({ visits: 'many', 'last-seen': 'yesterday' });
    expect(startVisit(local, START)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it('is not fooled by a clock that has gone backwards', () => {
    const local = storage();
    startVisit(local, START);
    expect(startVisit(local, START - 5 * 60 * MINUTE)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it.each([
    ['missing', undefined],
    ['throwing', broken],
  ])('is a first visit, without throwing, with storage %s', (_name, local) => {
    expect(startVisit(local, START)).toEqual({ returning: false });
  });
});

describe('seen projects', () => {
  it('starts empty and remembers each project once', () => {
    const local = storage();
    expect(seenProjects(local)).toEqual([]);
    markSeen(local, 'ecocart');
    markSeen(local, 'curiding');
    markSeen(local, 'ecocart');
    expect(seenProjects(local)).toEqual(['ecocart', 'curiding']);
  });

  it.each(['{oops', '"text"', '{"a":1}', 'null', '[1, null, {}]'])('reads %s as nothing seen', (stored) => {
    expect(seenProjects(storage({ 'seen-projects': stored }))).toEqual([]);
  });

  it('keeps at most the 50 most recent', () => {
    const local = storage();
    for (let index = 0; index < 60; index += 1) markSeen(local, `project-${index}`);
    const seen = seenProjects(local);
    expect(seen.length).toBe(50);
    expect(seen[0]).toBe('project-10');
    expect(seen.at(-1)).toBe('project-59');
  });

  it('does nothing, without throwing, when storage is missing or blocked', () => {
    expect(seenProjects(undefined)).toEqual([]);
    expect(seenProjects(broken)).toEqual([]);
    expect(() => markSeen(undefined, 'ecocart')).not.toThrow();
    expect(() => markSeen(broken, 'ecocart')).not.toThrow();
  });
});
