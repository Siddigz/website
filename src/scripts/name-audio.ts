/*
 * The two words of the name play a recording when pressed.
 *
 * Nothing is downloaded until the first press. While a word plays its button
 * carries `data-playing`. When motion is allowed, the word is split into
 * letters for the length of one wave and then put back as plain text.
 */
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-name-part][data-audio]')];
const motionAllowed = matchMedia('(prefers-reduced-motion: no-preference)');
// Where the browser cannot count siblings in CSS, the letters are numbered here.
const countsSiblings = CSS.supports('animation-delay: calc(sibling-index() * 0.1s)');

const players = new Map<HTMLButtonElement, HTMLAudioElement>();
const words = new Map<HTMLButtonElement, string>();
/** How long a recording is taken to last when its length is not known, and the wait after its end. */
const FALLBACK_SECONDS = 3;
const GRACE_MS = 1000;
// Each press gets a number, so a late answer from an earlier press is ignored.
let press = 0;

function letters(word: string): string[] {
  // Whole characters where the browser can find them (so an accented letter stays one piece); code points otherwise.
  if (typeof Intl.Segmenter !== 'function') return [...word];
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map((part) => part.segment);
}

/** Puts the word back as plain text. Safe to call when it was never split. */
function settle(button: HTMLButtonElement): void {
  const word = words.get(button);
  const text = button.querySelector('[data-name-text]');
  if (word === undefined || !text) return;
  words.delete(button);
  text.textContent = word;
  button.removeAttribute('aria-label');
  button.style.removeProperty('inline-size');
}

function ripple(button: HTMLButtonElement): void {
  const text = button.querySelector('[data-name-text]');
  if (!text || words.has(button)) return;
  const word = text.textContent ?? '';
  words.set(button, word);
  // Separate letters lose their kerning, so the width is held and the name is kept for screen readers.
  button.style.inlineSize = `${button.getBoundingClientRect().width}px`;
  button.setAttribute('aria-label', word);
  text.replaceChildren(
    ...letters(word).map((letter, index) => {
      const span = document.createElement('span');
      span.dataset.letter = '';
      span.textContent = letter;
      if (!countsSiblings) span.style.setProperty('--sibling-index', String(index + 1));
      return span;
    }),
  );
  // Done when every letter has finished, or at once if nothing is animating.
  const done = () => settle(button);
  Promise.all(text.getAnimations({ subtree: true }).map((animation) => animation.finished)).then(done, done);
}

/** Ends a word's turn. `cut` also silences it and drops the wave, for when the other word takes over. */
function stop(button: HTMLButtonElement, cut = false): void {
  button.removeAttribute('data-playing');
  if (!cut) return;
  players.get(button)?.pause();
  settle(button);
}

function play(button: HTMLButtonElement): void {
  const mine = (press += 1);
  for (const other of buttons) if (other !== button) stop(other, true);

  let audio = players.get(button);
  if (audio) {
    audio.currentTime = 0;
  } else {
    audio = new Audio(button.dataset.audio);
    players.set(button, audio);
    audio.addEventListener('ended', () => stop(button));
    // A recording that failed to load is dropped, so the next press tries again.
    audio.addEventListener('error', () => {
      players.delete(button);
      stop(button, true);
    });
  }

  button.setAttribute('data-playing', '');
  audio.play().then(
    () => {
      if (mine !== press) return;
      if (motionAllowed.matches) ripple(button);
      // A browser that stalls may never say the recording ended. The mark is
      // lifted a moment after it should be over, unless a later press took its place.
      const seconds = Number.isFinite(audio.duration) ? audio.duration : FALLBACK_SECONDS;
      window.setTimeout(() => {
        if (mine === press) stop(button);
      }, seconds * 1000 + GRACE_MS);
    },
    // Refused or failed: the word simply goes back to rest.
    () => {
      if (mine === press) stop(button, true);
    },
  );
}

for (const button of buttons) button.addEventListener('click', () => play(button));
