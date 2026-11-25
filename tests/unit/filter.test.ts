import { describe, it, expect } from 'vitest';
import { FILTERS, parseFilter, withFilter } from '../../src/lib/filter';
import { CATEGORIES } from '../../src/content/schemas';

describe('FILTERS', () => {
  it('is "all" followed by every category', () => {
    expect(FILTERS).toEqual(['all', ...CATEGORIES]);
  });
});

describe('parseFilter', () => {
  it.each([
    ['', 'all'],
    ['?filter=ai-data', 'ai-data'],
    ['?filter=systems', 'systems'],
    ['?filter=all', 'all'],
    ['?filter=AI-DATA', 'all'],
    ['?filter=nope', 'all'],
    ['?filter=', 'all'],
    ['?filter=systems&filter=web-apps', 'systems'],
    ['?other=1&filter=web-apps', 'web-apps'],
    ['?filter=%3Cscript%3E', 'all'],
    ['?filter=constructor', 'all'],
  ])('%j gives %s', (search, filter) => {
    expect(parseFilter(search)).toBe(filter);
  });
});

describe('withFilter', () => {
  it('sets the value, keeping everything else in the address', () => {
    expect(withFilter(new URL('https://x.test/?a=1#more-projects'), 'systems').href).toBe(
      'https://x.test/?a=1&filter=systems#more-projects',
    );
  });

  it('replaces a value that is already there', () => {
    expect(withFilter(new URL('https://x.test/?filter=nope&filter=x'), 'ai-data').href).toBe('https://x.test/?filter=ai-data');
  });

  it('removes the value for "all"', () => {
    expect(withFilter(new URL('https://x.test/?a=1&filter=systems#more-projects'), 'all').href).toBe(
      'https://x.test/?a=1#more-projects',
    );
    expect(withFilter(new URL('https://x.test/?filter=systems'), 'all').href).toBe('https://x.test/');
  });

  it('leaves the address it was given unchanged', () => {
    const url = new URL('https://x.test/');
    withFilter(url, 'systems');
    expect(url.href).toBe('https://x.test/');
  });
});
