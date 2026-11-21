/*
 * The parts of a page that depend on who is looking: the greeting built from
 * the visitor's clock, and a mark on the project cards they have opened.
 * Everything is worked out in the browser from its own clock and storage.
 * Nothing is sent anywhere.
 */
import { greeting, type GreetingWords } from '../lib/greeting';
import { markSeen, seenProjects, startVisit } from '../lib/visits';

/** Reading the storage objects can itself throw when a browser blocks them. */
function storage(name: 'localStorage' | 'sessionStorage'): Storage | undefined {
  try {
    return window[name];
  } catch {
    return undefined;
  }
}

const local = storage('localStorage');
const { returning } = startVisit(local, storage('sessionStorage'));

// The greeting. If anything about the clock is unusable, the neutral line stays.
const line = document.querySelector<HTMLElement>('[data-greeting]');
if (line) {
  try {
    const text = greeting({
      now: new Date(),
      visitorZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      home: { city: line.dataset.city ?? '', timeZone: line.dataset.zone ?? '' },
      returning,
      words: JSON.parse(line.dataset.words ?? '') as GreetingWords,
    });
    if (text) line.textContent = text;
  } catch {
    // Keep the neutral line.
  }
}

// A project page remembers that it was opened.
const opened = document.querySelector<HTMLElement>('[data-project-slug]')?.dataset.projectSlug;
if (opened) markSeen(local, opened);

// The home page shows a mark on each card whose page was opened before.
const seen = seenProjects(local);
for (const card of document.querySelectorAll<HTMLElement>('[data-seen-slug]')) {
  const mark = card.querySelector<HTMLElement>('[data-seen]');
  if (mark && seen.includes(card.dataset.seenSlug ?? '')) mark.hidden = false;
}
