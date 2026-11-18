import { test, expect } from '@playwright/test';

const scheme = 'meta[name="color-scheme"]';

// What the visitor actually sees, not only what the page records.
const rendered = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    scheme: getComputedStyle(document.documentElement).colorScheme,
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(document.body).color,
  }));

test('toggle switches the theme and it survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator(scheme)).toHaveAttribute('content', 'light dark');
  const light = await rendered(page);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator(scheme)).toHaveAttribute('content', 'dark');
  const dark = await rendered(page);
  expect(dark.scheme).toBe('dark');
  expect(dark.background).not.toBe(light.background);
  expect(dark.text).not.toBe(light.text);
  await page.reload();
  expect(await rendered(page)).toEqual(dark);
  await expect(page.locator(scheme)).toHaveAttribute('content', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('toggling back to the system scheme clears the stored choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator(scheme)).toHaveAttribute('content', 'light dark');
  expect(await page.evaluate(() => localStorage.getItem('color-scheme'))).toBeNull();
});

test('no stored choice follows the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(dark).not.toBe(light);
});

test('blocked storage does not break the page or the toggle', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const light = await rendered(page);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator(scheme)).toHaveAttribute('content', 'dark');
  expect((await rendered(page)).background).not.toBe(light.background);
  expect(errors).toEqual([]);
});

test('unknown address shows the not-found page', async ({ page }) => {
  const response = await page.goto('/nope');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
});

test('skip link jumps to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.locator('main#main')).toHaveCount(1);
});

test('a pinned light theme stays light when the system is dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const dark = await rendered(page);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator(scheme)).toHaveAttribute('content', 'light');
  const light = await rendered(page);
  expect(light.scheme).toBe('light');
  expect(light.background).not.toBe(dark.background);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});
