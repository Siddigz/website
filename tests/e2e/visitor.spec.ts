import { test, expect, type Page } from '@playwright/test';
import { featuredSlugs, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const words = site.greeting;
const AT = new Date('2026-11-20T02:14:00Z');
const line = (page: Page) => page.locator('#top [data-greeting]');
/** Browsers put narrow or non-breaking spaces inside a time. Compare with plain ones. */
const plainText = async (page: Page) => ((await line(page).textContent()) ?? '').replace(/\s/gu, ' ');

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('the page as built holds the neutral line', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain(`>${words.neutral}<`);
});

test.describe('a visitor in Berlin', () => {
  test.use({ timezoneId: 'Europe/Berlin', locale: 'en-US' });

  test('is greeted by their own clock, next to the owner’s', async ({ page }) => {
    await page.clock.setFixedTime(AT);
    await page.goto('/');
    await expect.poll(() => plainText(page)).toBe('You’re up late. It’s 3:14 AM for you and 9:14 PM in Ottawa.');
  });

  test('is welcomed back in a later session, and not by a reload or a trip to a project', async ({ page }) => {
    await page.clock.setFixedTime(AT);
    await page.goto('/');
    await expect.poll(() => plainText(page)).toContain(words.night);
    await page.reload();
    await expect.poll(() => plainText(page)).toContain(words.night);
    await page.goto(`/projects/${featuredSlugs()[0]}`);
    await page.goto('/');
    await expect.poll(() => plainText(page)).toContain(words.night);
    // Closing the browser ends the session. Its storage goes; the lasting storage stays.
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect.poll(() => plainText(page)).toBe('Welcome back. It’s 3:14 AM for you and 9:14 PM in Ottawa.');
    await page.reload();
    await expect.poll(() => plainText(page)).toContain(words.returning);
  });
});

test.describe('a visitor whose clock matches the owner’s', () => {
  test.use({ timezoneId: 'America/New_York', locale: 'en-US' });

  test('gets one time, for both', async ({ page }) => {
    await page.clock.setFixedTime(AT);
    await page.goto('/');
    await expect.poll(() => plainText(page)).toBe('Good evening. It’s 9:14 PM for both of us.');
  });
});

test('a time zone the browser cannot use leaves the neutral line', async ({ page }) => {
  const errors = pageErrors(page);
  await page.addInitScript(() => {
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      return { ...original.call(this), timeZone: 'Mars/Olympus' };
    };
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(line(page)).toHaveText(words.neutral);
  expect(errors).toEqual([]);
});

test('loading the home page makes no background request', async ({ page }) => {
  const background: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) background.push(request.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(background).toEqual([]);
});

for (const width of [320, 375, 768, 1280]) {
  test(`the buttons under the greeting sit at the same height with scripts on and off (${width} wide)`, async ({ browser }) => {
    const top = async (javaScriptEnabled: boolean, returning: boolean) => {
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width, height: 900 },
        // The longest words: a long time on both clocks, far from the owner.
        timezoneId: 'Asia/Kolkata',
        locale: 'en-CA',
      });
      const page = await context.newPage();
      if (returning) await page.addInitScript(() => localStorage.setItem('visits', '4'));
      await page.clock.setFixedTime(new Date('2026-11-20T19:14:00Z'));
      await page.goto('/');
      if (javaScriptEnabled) await expect(line(page)).not.toHaveText(words.neutral);
      else await expect(line(page)).toHaveText(words.neutral);
      const y = await page.locator('#top .links').evaluate((links) => Math.round(links.getBoundingClientRect().top + window.scrollY));
      await context.close();
      return y;
    };
    const off = await top(false, false);
    expect(await top(true, false)).toBe(off);
    expect(await top(true, true)).toBe(off);
  });
}

test('a card is marked once its project page has been opened, and nothing moves', async ({ page }) => {
  const [first, second] = featuredSlugs();
  const card = (slug: string) => page.locator(`#projects [data-seen-slug="${slug}"]`);
  const box = (slug: string) =>
    card(slug).evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return [Math.round(width), Math.round(height)];
    });
  await page.goto('/');
  await expect(page.locator('#projects [data-seen]:visible')).toHaveCount(0);
  const before = await box(second!);
  await page.goto(`/projects/${second}`);
  await page.goto('/');
  await expect(card(second!).locator('[data-seen]')).toBeVisible();
  await expect(card(second!).locator('[data-seen]')).toHaveText(site.seenLabel);
  await expect(card(first!).locator('[data-seen]')).toBeHidden();
  await expect(page.locator('#projects [data-seen]:visible')).toHaveCount(1);
  expect(await box(second!)).toEqual(before);
});

test('with storage blocked the greeting still shows, nothing is marked and nothing breaks', async ({ page }) => {
  const errors = pageErrors(page);
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        get() {
          throw new Error('blocked');
        },
      });
    }
  });
  await page.goto(`/projects/${featuredSlugs()[0]}`);
  await page.goto('/');
  await expect(line(page)).not.toHaveText(words.neutral);
  await expect(line(page)).not.toContainText(words.returning);
  await expect(page.locator('#projects [data-seen]:visible')).toHaveCount(0);
  expect(errors).toEqual([]);
});
