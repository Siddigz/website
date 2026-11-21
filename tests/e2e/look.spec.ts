/*
 * The look chosen in stage 2: warm and playful, with a blue accent. These
 * check the parts of it that behave, not the exact colours.
 */
import { test, expect, type Page } from '@playwright/test';
import { featuredSlugs } from '../content/helpers';

const projectPath = `/projects/${featuredSlugs()[0]}`;

// A family name as the browser reports it, without quotes or Astro's hash suffix.
const family = (page: Page, selector: string) =>
  page.evaluate(
    (target) => getComputedStyle(document.querySelector(target)!).fontFamily.split(',')[0]!.replace(/["']/g, '').replace(/-[0-9a-f]{16}$/, ''),
    selector,
  );

test('headings and text use the two fonts, both served by this site', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(await family(page, 'h1')).toBe('Bricolage Grotesque');
  expect(await family(page, 'body')).toBe('Figtree');
  const loaded = await page.evaluate(() =>
    ['h1', 'body'].map((selector) => {
      const name = getComputedStyle(document.querySelector(selector)!).fontFamily.split(',')[0]!.trim();
      return document.fonts.check(`16px ${name}`);
    }),
  );
  expect(loaded).toEqual([true, true]);
  expect(fontRequests.length).toBe(2);
  for (const url of fontRequests) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
});

test('the name is one colour, the same as the text', async ({ page }) => {
  await page.goto('/');
  const colours = await page.evaluate(() => ({
    body: getComputedStyle(document.body).color,
    parts: [...document.querySelectorAll('h1 [data-name-part]')].map((part) => getComputedStyle(part).color),
  }));
  expect(colours.parts).toEqual([colours.body, colours.body]);
});

test('the preview switcher is gone', async ({ page }) => {
  await page.goto('/?look=teal');
  await expect(page.locator('[data-look-switcher]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-look');
});

test.describe('the nav shows the current section', () => {
  test('no section is current at the top, and Projects is current once scrolled to', async ({ page }) => {
    await page.goto('/');
    const current = page.locator('.site-header a[aria-current="true"]');
    await expect(current).toHaveCount(0);
    await page.evaluate(() => document.querySelector('#projects')!.scrollIntoView({ block: 'start' }));
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Projects');
  });

  test('the second projects list still counts as Projects', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.querySelector('#more-projects')!.scrollIntoView({ block: 'start' }));
    await expect(page.locator('.site-header a[aria-current="true"]')).toHaveText('Projects');
  });

  test('project pages mark no section as current', async ({ page }) => {
    await page.goto(projectPath);
    await expect(page.locator('.site-header a[aria-current="true"]')).toHaveCount(0);
  });
});

test.describe('movement', () => {
  test('a card leans towards the mouse and settles when it leaves', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('phone'), 'a phone has no mouse');
    await page.goto('/');
    const card = page.locator('.card').first();
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    const lean = () => card.evaluate((el: HTMLElement) => [el.style.getPropertyValue('--pointer-dx'), el.style.getPropertyValue('--pointer-dy')].map(Number));
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
    await expect.poll(async () => (await lean())[0]).toBeGreaterThan(0.5);
    expect((await lean())[1]).toBeLessThan(0);
    await page.mouse.move(0, 0);
    await expect.poll(lean).toEqual([0, 0]);
  });

  test('with reduced motion nothing moves, leans or keeps animating', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(300);
    const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length);
    expect(running).toBe(0);
    const card = page.locator('.card').first();
    await card.scrollIntoViewIfNeeded();
    if (!testInfo.project.name.includes('phone')) {
      const box = (await card.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
      await page.waitForTimeout(100);
    }
    expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('the availability light pings a few times and then stops', async ({ page }) => {
    await page.goto('/dev/no-looking-for');
    await page.goto('/');
    const iterations = await page.evaluate(() => {
      const dot = document.querySelector('[data-looking-for]');
      if (!dot) return null;
      return getComputedStyle(dot, '::before').animationIterationCount;
    });
    test.skip(iterations === null, 'the looking-for line is switched off');
    expect(Number(iterations)).toBeGreaterThan(0);
    expect(Number(iterations)).toBeLessThanOrEqual(3);
  });
});

test.describe('the browser bar takes the page colour', () => {
  const bar = (page: Page) =>
    page.evaluate(() => {
      const active = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].filter((meta) => window.matchMedia(meta.media || 'all').matches);
      return active.map((meta) => meta.content);
    });
  // #rrggbb as the browser reports a computed colour.
  const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
  // The page background as red, green and blue. The browser reports it in the
  // form it was written (oklch), so paint it on a canvas and read the pixel.
  const background = (page: Page) =>
    page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.fillStyle = getComputedStyle(document.body).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${red}, ${green}, ${blue})`;
    });
  const close = (first: string, second: string) => {
    const [a, b] = [first, second].map((value) => value.match(/[\d.]+/g)!.map(Number));
    return a!.every((channel, index) => Math.abs(channel - b![index]!) <= 2);
  };

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`follows the system when it is ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      const active = await bar(page);
      expect(active).toHaveLength(1);
      expect(close(rgb(active[0]!), await background(page))).toBe(true);
    });
  }

  test('follows a pinned theme, also after a reload, and the system again once unpinned', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const light = await bar(page);
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    const dark = await bar(page);
    expect(dark).toHaveLength(1);
    expect(dark).not.toEqual(light);
    expect(close(rgb(dark[0]!), await background(page))).toBe(true);
    await page.reload();
    expect(await bar(page)).toEqual(dark);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    expect(await bar(page)).toEqual(light);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`a chart on a project card sits on paper of its own colour, so it fills the card's rounded top (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const charts = page.locator('#projects .cover.contain');
    expect(await charts.count()).toBeGreaterThan(0);
    for (const chart of await charts.all()) {
      // The charts are drawn on white. A frame of any other colour shows the picture as a square patch inside it.
      // Painted onto a one-pixel canvas, so the colour compares the same however the browser writes it.
      const frame = await chart.evaluate((image) => {
        const context = document.createElement('canvas').getContext('2d')!;
        context.fillStyle = getComputedStyle(image).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      });
      expect(frame).toEqual([255, 255, 255, 255]);
    }
  });
}
