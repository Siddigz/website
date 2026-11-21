/*
 * The greeting at the top of the home page: a word for the visitor's time of
 * day (or a welcome back), then their time next to the owner's. Pure, so it
 * runs the same in the browser and in tests. The phrases come from site.yaml.
 */
export type GreetingWords = {
  /** Shown before the visitor's clock is known, and when it cannot be used. */
  neutral: string;
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
  returning: string;
  /** Holds {yours}, {mine} and {city}. */
  times: string;
  /** Holds {time}. Used when both clocks read the same. */
  sameTime: string;
};

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** `hour` is 0 to 23. */
export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

type GreetingInput = {
  now: Date;
  visitorZone: string;
  home: { city: string; timeZone: string };
  returning: boolean;
  words: GreetingWords;
  /** How times are written. Left out, the visitor's own settings decide. */
  locale?: string;
};

/** One sentence pair, or `null` when either time zone cannot be used. */
export function greeting({ now, visitorZone, home, returning, words, locale }: GreetingInput): string | null {
  try {
    if (!visitorZone || !home.timeZone) return null;
    const clock = (timeZone: string) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(now);
    const yours = clock(visitorZone);
    const mine = clock(home.timeZone);
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: visitorZone }).format(now));
    const opening = returning ? words.returning : words[partOfDay(hour)];
    const times = yours === mine ? fill(words.sameTime, { time: yours }) : fill(words.times, { yours, mine, city: home.city });
    return `${opening} ${times}`;
  } catch {
    // An unknown time zone makes the formatter throw.
    return null;
  }
}

/**
 * The longest greeting anyone can get. The page reserves room for it, so the
 * real one never moves what sits below.
 */
export function longestGreeting(words: GreetingWords, city: string): string {
  const openings = [words.morning, words.afternoon, words.evening, words.night, words.returning];
  const opening = openings.reduce((longest, word) => (word.length > longest.length ? word : longest));
  return `${opening} ${fill(words.times, { yours: '12:44 a.m.', mine: '12:44 p.m.', city })}`;
}
