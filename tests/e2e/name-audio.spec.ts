import { test, expect, type Page } from '@playwright/test';
import { readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const first = (page: Page) => page.locator('h1 button[data-name-part="first"]');
const last = (page: Page) => page.locator('h1 button[data-name-part="last"]');

/** Every address ending in an audio extension that the page asks for. */
function audioRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (/\.(wav|m4a|mp3)$/.test(new URL(request.url()).pathname)) seen.push(new URL(request.url()).pathname);
  });
  return seen;
}

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // A browser logs a failed media request itself; that is not the page's script failing.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

const headingBox = (page: Page) =>
  page.locator('h1').evaluate((heading) => {
    const { x, y, width, height } = heading.getBoundingClientRect();
    return [x, y, width, height].map((value) => Math.round(value * 10) / 10);
  });

test('the heading still reads as the name, and each word is a described button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${site.name.first} ${site.name.last}`);
  for (const [button, word] of [
    [first(page), site.name.first],
    [last(page), site.name.last],
  ] as const) {
    await expect(button).toHaveText(word);
    await expect(button).toHaveAccessibleName(word);
    await expect(button).toHaveAccessibleDescription(site.name.audio.hint);
    await expect(button).toHaveAttribute('data-audio', /^\/_astro\/.+\.(wav|m4a)$/);
  }
});

test('no recording is fetched until a word is pressed, and then only that word’s', async ({ page }) => {
  const requests = audioRequests(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  const address = await first(page).getAttribute('data-audio');
  await first(page).click();
  await expect(first(page)).not.toHaveAttribute('data-playing', '', { timeout: 5_000 });
  expect(new Set(requests)).toEqual(new Set([address]));
});

test('pressing a word really fetches a recording and plays it through', async ({ page, browserName }) => {
  await page.goto('/');
  // Count the moments the browser reports about the real recording: no stand-ins here.
  await page.evaluate(() => {
    (window as any).heard = { loadeddata: 0, playing: 0, ended: 0, error: 0 };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      for (const name of ['loadeddata', 'playing', 'ended', 'error'] as const) this.addEventListener(name, () => ((window as any).heard[name] += 1));
      return original.call(this);
    };
  });
  const heard = (name: string) => page.evaluate((key) => (window as any).heard[key] as number, name);
  const answer = page.waitForResponse((response) => /\.(wav|m4a)$/.test(new URL(response.url()).pathname));
  await first(page).click();
  // Safari's engine fetches media outside the page's own network stack on some systems, so the
  // answer's details are only checked where the test can see them.
  if (browserName !== 'webkit') {
    const response = await answer;
    expect([200, 206]).toContain(response.status());
    expect(response.headers()['content-type']).toMatch(/^audio\//);
  }
  // In every engine: the file arrived and is one the browser can decode, and nothing reported an error.
  await expect.poll(() => heard('loadeddata'), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await heard('error')).toBe(0);
  // Chromium and Firefox play without a sound card, right to the end in Chromium.
  if (browserName !== 'webkit') await expect.poll(() => heard('playing'), { timeout: 10_000 }).toBeGreaterThan(0);
  if (browserName === 'chromium') await expect.poll(() => heard('ended'), { timeout: 10_000 }).toBe(1);
});

test('a word is marked while it plays and cleared when the recording ends', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    (window as any).marked = [];
    HTMLMediaElement.prototype.play = function () {
      (window as any).marked.push(document.querySelector('h1 [data-playing]')?.getAttribute('data-name-part') ?? null);
      return original.call(this);
    };
  });
  await last(page).click();
  // Already marked at the moment playback is asked for.
  expect(await page.evaluate(() => (window as any).marked)).toEqual(['last']);
  await expect(page.locator('h1 [data-playing]')).toHaveCount(0, { timeout: 5_000 });
});

test('Enter on a focused word plays it, and the focus ring shows', async ({ page, browserName }) => {
  // Safari moves between buttons with Option+Tab unless a system setting is changed.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).played = 0;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      (window as any).played += 1;
      return original.call(this);
    };
  });
  await first(page).focus();
  // Focus from the keyboard, so the ring applies.
  await page.keyboard.press(`Shift+${tab}`);
  await page.keyboard.press(tab);
  await expect(first(page)).toBeFocused();
  const ring = await first(page).evaluate((button) => {
    const style = getComputedStyle(button);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).played)).toBe(1);
});

test('a recording that never reports its end is still unmarked once it should be over', async ({ page }) => {
  await page.goto('/');
  // Playback "starts" but no end is ever announced, as when a browser stalls.
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 0.3 });
  });
  await first(page).click();
  await expect(first(page)).toHaveAttribute('data-playing', '');
  await expect(first(page)).not.toHaveAttribute('data-playing', '', { timeout: 5_000 });
});

test('starting one word stops the other', async ({ page }) => {
  await page.goto('/');
  // Hold every recording open so the first is still playing when the second starts.
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
  });
  await first(page).click();
  await expect(first(page)).toHaveAttribute('data-playing', '');
  await last(page).click();
  await expect(last(page)).toHaveAttribute('data-playing', '');
  await expect(first(page)).not.toHaveAttribute('data-playing', '');
});

test('the letters ripple while the word plays, and the word is whole again after', async ({ page }) => {
  await page.goto('/');
  // Playback starts at once, so the wave's start does not depend on the network.
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
  });
  await first(page).click();
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('h1 [data-letter]')].map((letter) => letter.getAnimations().length),
  );
  expect(moving).toEqual(Array.from(site.name.first, () => 1));
  // Split into letters, the button still gives its word to a screen reader.
  await expect(first(page)).toHaveAccessibleName(site.name.first);
  await expect(first(page).locator('[data-letter]')).toHaveCount(0, { timeout: 5_000 });
  await expect(first(page)).toHaveText(site.name.first);
  await expect(first(page)).not.toHaveAttribute('aria-label');
});

test('with reduced motion a press plays and nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).played = 0;
    HTMLMediaElement.prototype.play = function () {
      (window as any).played += 1;
      return Promise.resolve();
    };
  });
  await first(page).click();
  expect(await page.evaluate(() => (window as any).played)).toBe(1);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(first(page).locator('[data-letter]')).toHaveCount(0);
});

test('refused playback leaves no mark, no error and no movement', async ({ page }) => {
  const errors = pageErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('refused', 'NotAllowedError'));
  });
  await first(page).click();
  await expect(first(page)).not.toHaveAttribute('data-playing', '');
  await expect(first(page).locator('[data-letter]')).toHaveCount(0);
  await expect(first(page)).toHaveText(site.name.first);
  expect(errors).toEqual([]);
});

test('a missing recording leaves no mark and no error, and the word can be pressed again', async ({ page }) => {
  const errors = pageErrors(page);
  await page.route(/\.(wav|m4a)$/, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await last(page).click();
  await expect(last(page)).not.toHaveAttribute('data-playing', '', { timeout: 5_000 });
  await expect(last(page).locator('[data-letter]')).toHaveCount(0, { timeout: 5_000 });
  await last(page).click();
  await expect(last(page)).not.toHaveAttribute('data-playing', '', { timeout: 5_000 });
  await expect(last(page)).toHaveText(site.name.last);
  expect(errors).toEqual([]);
});

test('pressing a word never moves or resizes the heading', async ({ page }) => {
  await page.goto('/');
  const before = await headingBox(page);
  await first(page).hover();
  expect(await headingBox(page)).toEqual(before);
  await first(page).click();
  expect(await headingBox(page)).toEqual(before);
  await expect(page.locator('h1 [data-playing]')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('h1 [data-letter]')).toHaveCount(0, { timeout: 5_000 });
  expect(await headingBox(page)).toEqual(before);
});

test('pointing at a word shows a small speaker, tipped up and to the right', async ({ page }) => {
  await page.goto('/');
  const icon = first(page).locator('svg');
  await expect(icon).toHaveCSS('opacity', '0');
  await first(page).hover();
  await expect(icon).toHaveCSS('opacity', '1');
  // A negative turn is anticlockwise: a speaker that faced right now faces up and to the right.
  const turn = parseFloat(await icon.evaluate((svg) => getComputedStyle(svg).rotate));
  expect(turn).toBeLessThanOrEqual(-20);
  expect(turn).toBeGreaterThanOrEqual(-50);
  // It sits by the word's top right corner, and never pushes the page sideways.
  const word = (await first(page).boundingBox())!;
  const box = (await icon.boundingBox())!;
  expect(box.x + box.width / 2).toBeGreaterThan(word.x + word.width / 2);
  expect(box.y).toBeLessThan(word.y + word.height / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
