import { test, expect } from '@playwright/test';
import { pagePaths, textFiles } from '../content/helpers';

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
  // The home page, one page per featured project and one per explainer, and nothing else.
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

test('every outside link is https and goes to a site the content files name', async ({ page }) => {
  // The hosts written in src/content/: nothing can link anywhere else without a content file saying so.
  const named = new Set(
    textFiles('src/content').flatMap(([, text]) => [...text.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1]!.toLowerCase())),
  );
  expect(named.size).toBeGreaterThan(1);
  for (const path of pagePaths()) {
    await page.goto(path);
    const outside = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href).filter((href) => new URL(href).origin !== location.origin));
    for (const href of outside) {
      const url = new URL(href);
      expect(url.protocol, `${path}: ${href}`).toBe('https:');
      expect(named.has(url.host.toLowerCase()), `${path}: ${href}`).toBe(true);
    }
  }
});
