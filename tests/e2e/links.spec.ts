import { test, expect } from '@playwright/test';
import { pagePaths } from '../content/helpers';

test('every internal link resolves', async ({ page, request }) => {
  const seen = new Set<string>();
  const queue = ['/'];
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    if (!(response.headers()['content-type'] ?? '').includes('text/html')) continue;
    await page.goto(path);
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    queue.push(...hrefs);
  }
  // The home page and one page per featured project, and nothing else.
  expect([...seen].sort()).toEqual(pagePaths().sort());
});

test('same-page links point at sections that exist', async ({ page }) => {
  await page.goto('/');
  const targets = await page
    .locator('a[href*="#"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hash).filter(Boolean));
  expect(targets.length).toBeGreaterThan(0);
  for (const hash of new Set(targets)) {
    await expect(page.locator(hash), hash).toHaveCount(1);
  }
});
