import { test, expect } from '@playwright/test';

import { featuredSlugs, moreSlugs, readProjects } from '../content/helpers';

// Derived from the content files, so adding a featured project needs no test edit.
const FEATURED = featuredSlugs();
const projects = readProjects();

for (const [i, slug] of FEATURED.entries()) {
  test(`${slug} page`, async ({ page }) => {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status()).toBe(200);
    const { data } = projects.find((project) => project.slug === slug)!;
    await expect(page.locator('h1')).toHaveText(data.title);
    await expect(page.getByRole('list', { name: 'Built with' }).getByRole('listitem')).toHaveText(data.stack);
    await expect(page.locator('main').getByRole('heading', { level: 2 })).toHaveText([
      'Problem',
      'What I built',
      'Result',
    ]);
    await expect(page.getByRole('link', { name: 'Repository' }).first()).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/Siddigz\//,
    );
    await expect(page.getByRole('link', { name: /^Next: / })).toHaveAttribute(
      'href',
      `/projects/${FEATURED[(i + 1) % FEATURED.length]}`,
    );
    // One way back at the top of the page and one at the bottom.
    const back = page.getByRole('link', { name: 'Back to projects' });
    await expect(back).toHaveCount(2);
    for (const link of await back.all()) await expect(link).toHaveAttribute('href', '/#projects');
    expect((await back.first().boundingBox())!.y).toBeLessThan(200);
    await expect(page.locator('main img')).toHaveCount(1 + (data.gallery?.length ?? 0));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://siddigz.com/projects/${slug}`,
    );
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('main img').first()).toBeVisible();
    const unlabelled = await page
      .locator('main img')
      .evaluateAll((imgs) => imgs.filter((img) => !img.getAttribute('alt')?.trim()).length);
    expect(unlabelled).toBe(0);
  });
}

test('each page has its own title and description', async ({ page }) => {
  await page.goto('/projects/ecocart');
  await expect(page).toHaveTitle('EcoCart · Siddig Ahmed');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /EcoScore/);
});

test('cuRiding links both repositories and the demo', async ({ page }) => {
  await page.goto('/projects/curiding');
  await expect(page.locator('main a[href="https://github.com/Siddigz/cuRiding-pi"]')).toHaveCount(1);
  await expect(page.locator('main a[href="https://github.com/Siddigz/cuRiding-Server"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Watch demo' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/shorts/Ubc34F7nnvk',
  );
  await expect(page.getByText("People's Choice · cuHacking 7")).toBeVisible();
});

test('a page shows only the links its project has', async ({ page }) => {
  await page.goto('/projects/visioncompanion');
  await expect(page.getByRole('link', { name: 'Live app' })).toHaveAttribute('href', 'https://visioncompanion.vercel.app');
  await page.goto('/projects/alternative-signals');
  await expect(page.getByRole('link', { name: 'Live app' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Watch demo' })).toHaveCount(0);
  await expect(page.locator('[data-award]')).toHaveCount(0);
});

test('a non-featured project has no page', async ({ page }) => {
  const response = await page.goto(`/projects/${moreSlugs()[0]}`);
  expect(response?.status()).toBe(404);
});
