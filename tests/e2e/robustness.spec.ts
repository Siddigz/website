import { test, expect } from '@playwright/test';
import { pagePaths } from '../content/helpers';

// Every page a visitor can reach, plus the not-found page and the test-only page.
const pages = [...pagePaths(), '/does-not-exist', '/dev/no-looking-for'];
const SECTIONS = ['top', 'proof', 'experience', 'skills', 'projects', 'more-projects', 'explainers', 'activity', 'about', 'contact'];

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every section of the home page shows its content', async ({ page }) => {
    await page.goto('/');
    for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator('#projects article').first()).toBeVisible();
    await expect(page.getByRole('list', { name: 'Skills' }).getByRole('listitem').first()).toBeVisible();
  });

  for (const path of pagePaths().filter((path) => path.startsWith('/explainers/'))) {
    test(`${path} shows its title and summary`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main header p')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to explainers' }).first()).toBeVisible();
    });
  }

  for (const path of pagePaths().filter((path) => path.startsWith('/projects/'))) {
    test(`${path} shows its full content`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveText([
        'Problem',
        'What I built',
        'Result',
      ]);
      await expect(page.locator('main img').first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Repository' }).first()).toBeVisible();
    });
  }

  test('the theme follows the system', async ({ page }) => {
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const light = await background();
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await background()).not.toBe(light);
  });
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const path of pages) {
    test(`no sideways scroll at 320px on ${path} (motion: ${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
