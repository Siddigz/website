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

describe('startVisit', () => {
  it('counts a first visit once, however often the page loads in that session', () => {
    const local = storage();
    const session = storage();
    expect(startVisit(local, session)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
    expect(startVisit(local, session)).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it('calls a new session after an earlier one a return, for that whole session', () => {
    const local = storage();
    startVisit(local, storage());
    const second = storage();
    expect(startVisit(local, second)).toEqual({ returning: true });
    expect(local.getItem('visits')).toBe('2');
    expect(startVisit(local, second)).toEqual({ returning: true });
    expect(local.getItem('visits')).toBe('2');
  });

  it('treats a count that is not a number as no visits yet', () => {
    const local = storage({ visits: 'many' });
    expect(startVisit(local, storage())).toEqual({ returning: false });
    expect(local.getItem('visits')).toBe('1');
  });

  it.each([
    ['both missing', undefined, undefined],
    ['both throwing', broken, broken],
    ['only the session one throwing', storage({ visits: '3' }), broken],
    ['only the lasting one throwing', broken, storage()],
  ])('is a first visit, without throwing, with storage %s', (_name, local, session) => {
    expect(startVisit(local, session)).toEqual({ returning: false });
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
