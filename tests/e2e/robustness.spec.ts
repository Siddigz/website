import { test, expect } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every section shows its content', async ({ page }) => {
    await page.goto('/');
    for (const id of ['top', 'proof', 'skills', 'experience', 'projects', 'more-projects', 'about', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator('#projects article')).toHaveCount(6);
    await expect(page.locator('h1')).toContainText('Siddig');
    await expect(page.getByRole('list', { name: 'Skills' }).getByRole('listitem').first()).toBeVisible();
  });
});

for (const path of ['/', '/projects/curiding', '/does-not-exist']) {
  test(`no sideways scroll at 320px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
