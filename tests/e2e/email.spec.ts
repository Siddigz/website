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
  await expect(reveal(page, '#top')).toBeHidden();
  await expect(widget(page, '#top').getByRole('button', { name: words.copy })).toBeVisible();
  // Two calls: a token, then the address in exchange for that token. Both from this site.
  expect(calls.map((call) => call.path)).toEqual(['/api/contact/token', '/api/contact/address']);
  expect(calls[1]!.body).toEqual({ token: 'token-from-the-first-call' });
  for (const call of calls) expect(call.origin).toBe(new URL(page.url()).origin);
  expect(await page.evaluate(() => (window as any).opened)).toEqual([`${MAIL}${ADDRESS}`]);
});

test('one reveal fills the other Email button too, with no further calls', async ({ page }) => {
  const calls = await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#contact').click();
  await expect(widget(page, '#contact').getByRole('link', { name: ADDRESS })).toBeVisible();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  await expect(reveal(page, '#top')).toBeHidden();
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
