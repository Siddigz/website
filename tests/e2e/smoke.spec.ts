import { test, expect } from '@playwright/test';

test('home page is served', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Siddig Ahmed');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
