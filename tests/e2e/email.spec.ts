import { test, expect, type Page } from '@playwright/test';
import { EMAIL_PATTERN, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const words = site.email;
// A made-up address, built from parts so no file in the repo holds one.
const ADDRESS = ['someone', 'example.test'].join('@');
const MAIL = ['mail', 'to:'].join('');

type Calls = { path: string; body: any; origin: string | null }[];

/** Stands in for the two server addresses. `fail` makes one of them answer with an error. */
async function mockServer(page: Page, fail?: 'token' | 'address'): Promise<Calls> {
  const calls: Calls = [];
  await page.route('**/api/contact/*', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ path, body: request.postDataJSON(), origin: await request.headerValue('origin') });
    if (request.method() !== 'POST') return route.fulfill({ status: 405, json: { error: 'method' } });
    if (path.endsWith('/token')) {
      return fail === 'token' ? route.abort() : route.fulfill({ json: { token: 'token-from-the-first-call' } });
    }
    return fail === 'address' ? route.fulfill({ status: 403, json: { error: 'forbidden' } }) : route.fulfill({ json: { address: ADDRESS } });
  });
  return calls;
}

/** Records every mail link the page opens, without opening a mail app. */
async function recordMail(page: Page) {
  await page.addInitScript(() => {
    (window as any).opened = [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.protocol === 'mailto:') (window as any).opened.push(this.href);
      else click.call(this);
    };
  });
}

const widget = (page: Page, where: '#top' | '#contact') => page.locator(`${where} [data-email]`);
const reveal = (page: Page, where: '#top' | '#contact') => widget(page, where).getByRole('button', { name: words.button, exact: true });

test('there is an Email button after the profile links at the top, and one in Contact', async ({ page }) => {
  await page.goto('/');
  await expect(reveal(page, '#top')).toBeVisible();
  await expect(reveal(page, '#contact')).toBeVisible();
  const order = await page.locator('#top .links > li').evaluateAll((items) => items.map((item) => (item as HTMLElement).innerText.trim()));
  expect(order).toEqual(['GitHub', 'LinkedIn', words.button]);
  // The address is nowhere in the page until it is asked for.
  expect((await page.content()).match(EMAIL_PATTERN)).toBeNull();
});

test('pressing Email shows the address as a link with a Copy button, and opens the mail app once', async ({ page }) => {
  const calls = await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#top').click();
  const link = widget(page, '#top').getByRole('link', { name: ADDRESS });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `${MAIL}${ADDRESS}`);
  await expect(link).toBeFocused();
  // The Email button stays where it is: the address opens in a small box under it.
  await expect(reveal(page, '#top')).toBeVisible();
  await expect(widget(page, '#top').getByRole('button', { name: words.copy })).toBeVisible();
  // Two calls: a token, then the address in exchange for that token. Both from this site.
  expect(calls.map((call) => call.path)).toEqual(['/api/contact/token', '/api/contact/address']);
  expect(calls[1]!.body).toEqual({ token: 'token-from-the-first-call' });
  for (const call of calls) expect(call.origin).toBe(new URL(page.url()).origin);
  expect(await page.evaluate(() => (window as any).opened)).toEqual([`${MAIL}${ADDRESS}`]);
});

for (const where of ['#top', '#contact'] as const) {
  test(`the revealed address sits on top with Copy below it, exactly as wide (${where})`, async ({ page }) => {
    await mockServer(page);
    await recordMail(page);
    await page.goto('/');
    await reveal(page, where).click();
    const link = widget(page, where).getByRole('link', { name: ADDRESS });
    const copy = widget(page, where).getByRole('button', { name: words.copy });
    await expect(link).toBeVisible();
    // Measured once the opening animation has finished.
    await expect.poll(() => widget(page, where).locator('[data-email-result]').evaluate((box) => box.getAnimations({ subtree: true }).length)).toBe(0);
    const address = (await link.boundingBox())!;
    const button = (await copy.boundingBox())!;
    // Stacked, not side by side: Copy starts where the address ends, and the two share their left and right edges.
    expect(button.y).toBeGreaterThanOrEqual(address.y + address.height - 1);
    expect(Math.abs(button.x - address.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.width - address.width)).toBeLessThanOrEqual(1);
    // They read as one piece: nothing but a hairline between them.
    expect(button.y - (address.y + address.height)).toBeLessThanOrEqual(2);
    // Both are comfortable to press.
    expect(button.height).toBeGreaterThanOrEqual(24);
    expect(address.height).toBeGreaterThanOrEqual(24);
  });
}

test('the address and Copy open with a short animation, and without one when motion is reduced', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  // Each animation that starts inside the widget is noted as it begins: its name and how long it runs.
  const watch = () =>
    page.evaluate(() => {
      (window as any).started = [];
      document.querySelector('#top [data-email]')!.addEventListener('animationstart', (event) => {
        const { animationName, target } = event as AnimationEvent;
        (window as any).started.push([animationName, parseFloat(getComputedStyle(target as Element).animationDuration)]);
      });
    });
  await watch();
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).started.length)).toBeGreaterThanOrEqual(2);
  const started: [string, number][] = await page.evaluate(() => (window as any).started);
  // Rule 18: nothing in the interface moves for longer than 300 ms.
  for (const [name, seconds] of started) expect(seconds, name).toBeLessThanOrEqual(0.3);
  // When it is over the box is fully there, at its own size.
  await expect.poll(() => widget(page, '#top').locator('[data-email-result]').evaluate((box) => box.getAnimations({ subtree: true }).length)).toBe(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await watch();
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  expect(await page.evaluate(() => (window as any).started)).toEqual([]);
});

test('once revealed, the other Email button shows the address at once, with no further calls', async ({ page }) => {
  const calls = await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#contact').click();
  await expect(widget(page, '#contact').getByRole('link', { name: ADDRESS })).toBeVisible();
  expect(calls.length).toBe(2);
  // Only one box is open at a time, so opening the other closes this one.
  await page.locator('#top').scrollIntoViewIfNeeded();
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  await expect(widget(page, '#contact').getByRole('link', { name: ADDRESS })).toBeHidden();
  expect(calls.length).toBe(2);
  // The mail app was opened by the first press only.
  expect(await page.evaluate(() => (window as any).opened.length)).toBe(1);
});

for (const width of [320, 390, 1280]) {
  test(`revealing the address moves nothing on the page (${width} wide)`, async ({ page }) => {
    await mockServer(page);
    await recordMail(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/dev/resume-on');
    // Where everything around the button sits: the buttons beside it, the photo, and the page's whole height.
    const layout = () =>
      page.evaluate(() => {
        const box = (selector: string) => {
          const { x, y, width: w, height: h } = document.querySelector(selector)!.getBoundingClientRect();
          return [x, y + scrollY, w, h].map((value) => Math.round(value));
        };
        return {
          links: [...document.querySelectorAll('#top .links > li')].map((item) => {
            const { x, y, width: w, height: h } = item.getBoundingClientRect();
            return [x, y + scrollY, w, h].map((value) => Math.round(value));
          }),
          photo: box('#top [data-photo-slot]'),
          top: box('#top'),
          page: document.documentElement.scrollHeight,
        };
      });
    const before = await layout();
    await reveal(page, '#top').click();
    const link = widget(page, '#top').getByRole('link', { name: ADDRESS });
    await expect(link).toBeVisible();
    await expect.poll(() => widget(page, '#top').locator('[data-email-result]').evaluate((box) => box.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await layout()).toEqual(before);
    // The box hangs by the button, and stays inside the screen.
    const button = (await reveal(page, '#top').boundingBox())!;
    const box = (await widget(page, '#top').locator('[data-email-result]').boundingBox())!;
    // Just under the button, or just over it where under would run past the end of the page.
    const under = box.y - (button.y + button.height);
    const over = button.y - (box.y + box.height);
    expect(Math.max(under, over)).toBeGreaterThanOrEqual(0);
    expect(Math.max(under, over)).toBeLessThanOrEqual(16);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('the box closes with Escape or a press elsewhere, and the Email button opens it again without asking the server', async ({ page }) => {
  const calls = await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#top').click();
  const link = widget(page, '#top').getByRole('link', { name: ADDRESS });
  await expect(link).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(link).toBeHidden();
  await reveal(page, '#top').click();
  await expect(link).toBeVisible();
  await page.locator('#top .pitch').click();
  await expect(link).toBeHidden();
  // Pressing the button while the box is open closes it, like any toggle.
  await reveal(page, '#top').click();
  await expect(link).toBeVisible();
  await reveal(page, '#top').click();
  await expect(link).toBeHidden();
  expect(calls.length).toBe(2);
  expect(await page.evaluate(() => (window as any).opened.length)).toBe(1);
});

test('Copy puts the address on the clipboard and says so', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#contact').click();
  const copy = widget(page, '#contact').getByRole('button', { name: words.copy });
  await copy.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ADDRESS);
  await expect(widget(page, '#contact').getByRole('button', { name: words.copied })).toBeVisible();
  await expect(widget(page, '#contact').getByRole('status')).toHaveText(words.copied);
  // It goes back to "Copy", ready to be used again.
  await expect(widget(page, '#contact').getByRole('button', { name: words.copy, exact: true })).toBeVisible({ timeout: 5_000 });
});

test('a refused clipboard leaves the address selected, so it can still be copied by hand', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('refused')) }, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#contact').click();
  await widget(page, '#contact').getByRole('button', { name: words.copy }).click();
  await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe(ADDRESS);
  expect(errors).toEqual([]);
});

for (const fail of ['token', 'address'] as const) {
  test(`when the ${fail} call fails, the failure line shows and the button still works`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const calls = await mockServer(page, fail);
    await recordMail(page);
    await page.goto('/');
    await reveal(page, '#contact').click();
    await expect(widget(page, '#contact').getByRole('status')).toHaveText(words.failed);
    // Shown in the small box under the button, and read out.
    await expect(widget(page, '#contact').locator('[data-email-problem]')).toBeVisible();
    await expect(widget(page, '#contact').locator('[data-email-problem]')).toHaveText(words.failed);
    await expect(reveal(page, '#contact')).toBeVisible();
    await expect(reveal(page, '#contact')).toBeEnabled();
    await expect(page.locator('#contact')).not.toContainText('@');
    expect(await page.evaluate(() => (window as any).opened)).toEqual([]);
    // Pressing again tries again.
    const before = calls.length;
    await reveal(page, '#contact').click();
    await expect.poll(() => calls.length).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });
}

test('the widget works from the keyboard', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#top').focus();
  await page.keyboard.press('Enter');
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeFocused();
});

test('revealing the address does not push the page sideways at 320px', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('with scripts off there is no Email button, and Contact points to LinkedIn', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-email] button:visible')).toHaveCount(0);
  await expect(page.locator('#contact').getByText(words.noScript)).toBeVisible();
  await expect(page.locator('#contact').getByRole('link', { name: 'LinkedIn' })).toBeVisible();
  await context.close();
});

test('with scripts on, the no-scripts line is not shown', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#contact').getByText(words.noScript)).toBeHidden();
});
