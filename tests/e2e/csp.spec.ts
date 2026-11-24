import { test, expect, type Page } from '@playwright/test';
import { featuredSlugs, pagePaths } from '../content/helpers';

/**
 * Every time the browser refuses something because of the page's content
 * security policy, it says so. These tests use each feature of the site and
 * expect silence.
 */
async function watch(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    (window as any).refused = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as any).refused.push(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'} (line ${event.lineNumber})`);
    });
  });
  const logged: string[] = [];
  page.on('console', (message) => {
    if (/content security policy|csp/i.test(message.text())) logged.push(message.text());
  });
  return async () => [...(await page.evaluate(() => (window as any).refused as string[])), ...logged];
}

async function mockEmail(page: Page) {
  await page.route('**/api/contact/token', (route) => route.fulfill({ json: { token: 't' } }));
  await page.route('**/api/contact/address', (route) => route.fulfill({ json: { address: ['someone', 'example.test'].join('@') } }));
  await page.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.protocol !== 'mailto:') click.call(this);
    };
  });
}

for (const path of [...pagePaths(), '/does-not-exist']) {
  test(`${path} loads with nothing refused`, async ({ page }) => {
    const refused = await watch(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
    expect(await refused()).toEqual([]);
  });
}

test('the home page’s features all work under the policy', async ({ page }) => {
  const refused = await watch(page);
  await mockEmail(page);
  await page.goto('/');
  // The greeting replaced the neutral line, so the page's scripts ran.
  await expect(page.locator('#top [data-greeting]')).not.toHaveText('Hello, and welcome.');
  // Theme.
  const scheme = page.locator('meta[name="color-scheme"]');
  const before = await scheme.getAttribute('content');
  await page.locator('[data-theme-toggle]').click();
  await expect(scheme).not.toHaveAttribute('content', before!);
  // Menu.
  await page.locator('[data-menu-open]').click();
  await page.locator('dialog#command-menu [role="combobox"]').fill('about');
  await page.keyboard.press('Escape');
  // Filter.
  await page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: 'Systems' }).click();
  await expect(page.locator('#more-projects .row:visible').first()).toHaveAttribute('data-category', 'systems');
  // Email.
  await page.locator('#contact [data-email-reveal]').click();
  await expect(page.locator('#contact [data-email-link]')).toBeVisible();
  expect(await refused()).toEqual([]);
});

test('going between pages works under the policy', async ({ page }) => {
  const refused = await watch(page);
  await page.goto('/');
  await page.locator(`#projects a[href="/projects/${featuredSlugs()[0]}"]`).click();
  await expect(page.locator('h1')).toBeVisible();
  expect(await refused()).toEqual([]);
  await page.getByRole('link', { name: 'Back to projects' }).first().click();
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator(`#projects [data-seen-slug="${featuredSlugs()[0]}"] [data-seen]`)).toBeVisible();
  expect(await refused()).toEqual([]);
});

test('both explainers work under the policy', async ({ page }) => {
  const refused = await watch(page);
  await page.goto('/playground/follow-a-packet');
  await page.getByRole('button', { name: 'Next hop' }).click();
  await expect(page.locator('[data-packet] [data-caption]')).toContainText('Stop 2 of 11');
  expect(await refused()).toEqual([]);
  await page.goto('/playground/nrz-vs-pam4');
  await page.getByRole('slider', { name: 'Noise (σ)' }).fill('0.1');
  await page.getByRole('button', { name: 'NRZ (2 levels)' }).click();
  await expect(page.locator('[data-signal] [data-readout="bits"] .big')).toHaveText('1');
  expect(await refused()).toEqual([]);
});

test('the policy really is enforced: a script typed into the page does not run', async ({ page }) => {
  const refused = await watch(page);
  await page.goto('/');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.injected = true';
    document.body.append(script);
  });
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
  expect((await refused()).join(' ')).toContain('script-src');
});
