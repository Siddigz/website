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

/** Waits until nothing in the widget, or the row it sits in, is still moving. */
const settled = (page: Page, where: '#top' | '#contact') =>
  expect
    .poll(() =>
      widget(page, where).evaluate((element) => element.getAnimations({ subtree: true }).length + (element.closest('ul')?.getAnimations().length ?? 0)),
    )
    .toBe(0);

test('at the top, the Email button becomes one button in two parts: the address, then a small part that copies it', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const neighbour = page.locator('#top .links').getByRole('link', { name: 'LinkedIn' });
  const shape = (element: Element) => {
    const style = getComputedStyle(element);
    return { radius: style.borderTopLeftRadius, border: style.borderTopWidth, shadow: style.boxShadow, weight: style.fontWeight, height: Math.round(element.getBoundingClientRect().height) };
  };
  const expected = await neighbour.evaluate(shape);
  await reveal(page, '#top').click();
  const link = widget(page, '#top').getByRole('link', { name: ADDRESS });
  const copy = widget(page, '#top').getByRole('button', { name: words.copy });
  await expect(link).toBeVisible();
  // The pointer is still over it from the press: move it away, so the button is measured at rest, not lifted.
  await page.mouse.move(0, 0);
  await settled(page, '#top');
  await expect.poll(() => widget(page, '#top').locator('[data-email-result]').evaluate((element) => getComputedStyle(element).boxShadow)).toBe(expected.shadow);
  // The same shape as the buttons beside it: corners, edge, depth, weight and height.
  expect(await widget(page, '#top').locator('[data-email-result]').evaluate(shape)).toEqual(expected);
  const whole = (await widget(page, '#top').locator('[data-email-result]').boundingBox())!;
  const address = (await link.boundingBox())!;
  const part = (await copy.boundingBox())!;
  // Side by side inside the one button, the copy part last, with nothing between them.
  expect(part.x).toBeGreaterThanOrEqual(address.x + address.width - 1);
  expect(part.x - (address.x + address.width)).toBeLessThanOrEqual(2);
  expect(address.x).toBeGreaterThanOrEqual(whole.x);
  expect(part.x + part.width).toBeLessThanOrEqual(whole.x + whole.width + 1);
  expect(Math.abs(part.height - address.height)).toBeLessThanOrEqual(2);
  // The copy part is a picture with a name, big enough to press.
  await expect(copy.locator('svg:visible')).toHaveCount(1);
  expect((await copy.innerText()).trim()).toBe('');
  expect(part.width).toBeGreaterThanOrEqual(24);
  expect(part.height).toBeGreaterThanOrEqual(24);
});

test('in Contact, the address joins the row of links with the copy picture after it', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.goto('/');
  await reveal(page, '#contact').click();
  const link = widget(page, '#contact').getByRole('link', { name: ADDRESS });
  const copy = widget(page, '#contact').getByRole('button', { name: words.copy });
  await expect(link).toBeVisible();
  const address = (await link.boundingBox())!;
  const part = (await copy.boundingBox())!;
  expect(part.x).toBeGreaterThanOrEqual(address.x + address.width - 1);
  expect(Math.abs(part.y + part.height / 2 - (address.y + address.height / 2))).toBeLessThanOrEqual(3);
  expect(part.width).toBeGreaterThanOrEqual(24);
  expect(part.height).toBeGreaterThanOrEqual(24);
});

for (const address of ['/', '/dev/resume-on']) {
  test(`on a laptop, revealing the address moves nothing up or down (${address})`, async ({ page }) => {
    await mockServer(page);
    await recordMail(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(address);
    const places = () =>
      page.evaluate(() => {
        const box = (selector: string) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect ? [Math.round(rect.top + scrollY), Math.round(rect.height)] : null;
        };
        // The page's length, the photo, the row of buttons, the first button in it, and whatever comes after the top section.
        return { page: document.documentElement.scrollHeight, photo: box('[data-photo-slot]'), row: box('#top .links'), first: box('#top .links a'), after: box('#top ~ *'), footer: box('footer') };
      });
    const before = await places();
    const resume = page.locator('#top .links').getByRole('link', { name: site.resumeLabel });
    const resumeBefore = address === '/' ? null : (await resume.boundingBox())!;
    await reveal(page, '#top').click();
    await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
    await settled(page, '#top');
    expect(await places()).toEqual(before);
    // Email is the last button in the row, so the Resume button before it stays exactly where it was.
    if (resumeBefore) expect(await resume.boundingBox()).toEqual(resumeBefore);
  });
}

test('the button widens into the address in no more than 300 ms, and at once when motion is reduced', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  /** The length of every movement running in the widget or the row it sits in. */
  const running = () =>
    widget(page, '#top').evaluate((element) =>
      [...element.getAnimations({ subtree: true }), ...(element.closest('ul')?.getAnimations() ?? [])].map((animation) => Number(animation.effect?.getTiming().duration)),
    );
  const start = (await reveal(page, '#top').boundingBox())!.width;
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  const lengths = await running();
  expect(lengths.length).toBeGreaterThanOrEqual(1);
  // Rule 18: nothing in the interface moves for longer than 300 ms.
  for (const length of lengths) expect(length).toBeLessThanOrEqual(300);
  await settled(page, '#top');
  // When it is over the button is at its own full width: wider than "Email", with the whole address showing.
  const whole = (await widget(page, '#top').locator('[data-email-result]').boundingBox())!;
  expect(whole.width).toBeGreaterThan(start);
  expect(await widget(page, '#top').locator('[data-email-link]').evaluate((link) => link.scrollWidth <= link.clientWidth + 1)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  expect(await running()).toEqual([]);
});

test('on a phone, where the address needs a line of its own, what is below glides down instead of jumping', async ({ page }) => {
  await mockServer(page);
  await recordMail(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const row = page.locator('#top .links');
  const before = (await row.boundingBox())!.height;
  await reveal(page, '#top').click();
  await expect(widget(page, '#top').getByRole('link', { name: ADDRESS })).toBeVisible();
  // The row is on its way from its old height to its new one, in no more than 300 ms.
  const gliding = await row.evaluate((element) => element.getAnimations().map((animation) => Number(animation.effect?.getTiming().duration)));
  expect(gliding.length).toBe(1);
  expect(gliding[0]).toBeLessThanOrEqual(300);
  await settled(page, '#top');
  expect((await row.boundingBox())!.height).toBeGreaterThan(before);
  // The whole button is on screen, and the page does not scroll sideways.
  const whole = (await widget(page, '#top').locator('[data-email-result]').boundingBox())!;
  expect(whole.x).toBeGreaterThanOrEqual(0);
  expect(whole.x + whole.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
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
  // The picture turns into a tick, the button's name says "Copied", and it is read out.
  const copied = widget(page, '#contact').getByRole('button', { name: words.copied });
  await expect(copied).toBeVisible();
  await expect(copied).toHaveAttribute('data-done', '');
  await expect(copied.locator('svg:visible')).toHaveCount(1);
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

test('on a narrow phone a long address breaks after the at sign, not in the middle of a word', async ({ page }) => {
  // Longer than the usual made-up address, and still built from parts.
  const long = ['firstname.lastname', 'example.test'].join('@');
  await page.route('**/api/contact/token', (route) => route.fulfill({ json: { token: 't' } }));
  await page.route('**/api/contact/address', (route) => route.fulfill({ json: { address: long } }));
  await recordMail(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await reveal(page, '#top').click();
  const link = widget(page, '#top').getByRole('link', { name: long });
  await expect(link).toBeVisible();
  await settled(page, '#top');
  // Two lines: everything up to the at sign, then the rest.
  const lines = await link.evaluate((element) => {
    const range = document.createRange();
    const tops = new Map<number, string>();
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      for (let index = 0; index < node.textContent!.length; index += 1) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        tops.set(top, (tops.get(top) ?? '') + node.textContent![index]);
      }
    }
    return [...tops.values()];
  });
  expect(lines).toEqual(long.split(/(?<=@)/));
  // What is copied or read out is still the address in one piece.
  expect(await link.evaluate((element) => element.textContent)).toBe(long);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
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
