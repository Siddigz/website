import { describe, it, expect } from 'vitest';
import { greeting, longestGreeting, partOfDay, type GreetingWords } from '../../src/lib/greeting';
import { readYaml } from '../content/helpers';

const words: GreetingWords = readYaml('src/content/site.yaml').main.greeting;
const home = { city: 'Ottawa', timeZone: 'America/Toronto' };
const now = new Date('2026-11-20T02:14:00Z');
/** Browsers put narrow or non-breaking spaces inside a time. Compare with plain ones. */
const plain = (text: string | null) => (text === null ? null : text.replace(/\s/gu, ' '));
const say = (visitorZone: string, returning = false) =>
  plain(greeting({ now, visitorZone, home, returning, words, locale: 'en-US' }));

describe('partOfDay', () => {
  it.each([
    [4, 'night'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [16, 'afternoon'],
    [17, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [0, 'night'],
  ] as const)('hour %i is %s', (hour, part) => {
    expect(partOfDay(hour)).toBe(part);
  });
});

describe('greeting', () => {
  it('gives both times when the visitor is elsewhere', () => {
    expect(say('Europe/Berlin')).toBe('You’re up late. It’s 3:14 AM for you and 9:14 PM in Ottawa.');
  });

  it('says so when the clocks agree, even in another zone', () => {
    expect(say('America/New_York')).toBe('Good evening. It’s 9:14 PM for both of us.');
    expect(say('America/Toronto')).toBe('Good evening. It’s 9:14 PM for both of us.');
  });

  it('handles a zone half an hour off', () => {
    expect(say('Asia/Kolkata')).toBe('Good morning. It’s 7:44 AM for you and 9:14 PM in Ottawa.');
  });

  it('welcomes a returning visitor instead of naming the time of day', () => {
    expect(say('Europe/Berlin', true)).toBe('Welcome back. It’s 3:14 AM for you and 9:14 PM in Ottawa.');
  });

  it('gives nothing when a time zone cannot be used', () => {
    expect(say('Mars/Olympus')).toBeNull();
    expect(say('')).toBeNull();
    expect(greeting({ now, visitorZone: 'Europe/Berlin', home: { city: 'Ottawa', timeZone: 'Nowhere/Real' }, returning: false, words })).toBeNull();
  });

  it('follows the visitor’s own way of writing a time', () => {
    const german = plain(greeting({ now, visitorZone: 'Europe/Berlin', home, returning: false, words, locale: 'de-DE' }));
    expect(german).toBe('You’re up late. It’s 3:14 for you and 21:14 in Ottawa.');
  });
});

describe('longestGreeting', () => {
  it('is at least as long as any greeting a visitor can get', () => {
    const longest = longestGreeting(words, home.city);
    for (const zone of ['Europe/Berlin', 'Asia/Kolkata', 'Pacific/Auckland', 'America/Toronto']) {
      for (const returning of [true, false]) {
        for (const hour of [0, 6, 10, 13, 18, 23]) {
          const at = new Date(Date.UTC(2026, 10, 20, hour, 44));
          const text = greeting({ now: at, visitorZone: zone, home, returning, words, locale: 'en-CA' })!;
          expect(text.length, text).toBeLessThanOrEqual(longest.length);
        }
      }
    }
  });
});
