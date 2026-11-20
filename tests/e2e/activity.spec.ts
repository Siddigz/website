import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// The browser tests run against a test build (SITE_FIXTURES=1), which reads
// this saved answer instead of asking GitHub.
const saved = JSON.parse(readFileSync('tests/fixtures/github-activity.json', 'utf8')).data;
const calendar = saved.user.contributionsCollection.contributionCalendar;
const countLine = `${calendar.totalContributions.toLocaleString('en-US')} contributions in the last year`;
const dayCount = calendar.weeks.reduce((sum: number, week: any) => sum + week.contributionDays.length, 0);

test('the activity section sits between the projects and About', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids.indexOf('activity')).toBeGreaterThan(ids.indexOf('more-projects'));
  expect(ids.indexOf('activity')).toBeLessThan(ids.indexOf('about'));
  await expect(page.locator('#activity').getByRole('heading', { level: 2 })).toHaveText('GitHub activity');
});

test('the year is one picture, named by its count, with a square per day', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#activity');
  await expect(section.getByText(countLine)).toBeVisible();
  const picture = section.getByRole('img', { name: countLine });
  await expect(picture).toBeVisible();
  await expect(picture.locator('[data-level]')).toHaveCount(dayCount);
  await expect(picture.locator('.week')).toHaveCount(calendar.weeks.length);
  // More contributions, a different colour: all five steps are distinct.
  const colours = await page.evaluate(() =>
    [0, 1, 2, 3, 4].map(
      (level) => getComputedStyle(document.querySelector(`#activity [data-days] [data-level="${level}"]`)!).backgroundColor,
    ),
  );
  expect(new Set(colours).size).toBe(5);
});

test('squares are square, and the whole year fits the width', async ({ page }) => {
  await page.goto('/');
  const boxes = await page
    .locator('#activity [data-days] [data-level]')
    .evaluateAll((squares) => squares.map((square) => square.getBoundingClientRect()).map((box) => [box.width, box.height]));
  for (const [width, height] of boxes) {
    expect(width).toBeGreaterThan(2);
    expect(Math.abs(width! - height!)).toBeLessThan(0.75);
  }
  const overflow = await page.evaluate(() => {
    const panel = document.querySelector('#activity .panel')!;
    return panel.scrollWidth - panel.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test('recent commits link to the commit, in the repositories the site shows', async ({ page }) => {
  await page.goto('/');
  const commits = page.locator('#activity .commits li');
  await expect(commits).toHaveCount(3);
  await expect(commits.first()).toContainText('Add the project filter');
  await expect(commits.first()).toContainText('website · Nov 19');
  for (const link of await commits.getByRole('link').all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\/github\.com\/Siddigz\/(website|brightspace-deadlines|cuRiding-pi)\/commit\/[0-9a-f]+$/);
  }
  await expect(page.locator('#activity')).not.toContainText('never appear');
  await expect(page.locator('#activity')).not.toContainText('helper account');
});

test('the activity section does not scroll the page sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.locator('#activity').scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the activity section has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const { violations } = await new AxeBuilder({ page })
      .include('#activity')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
  });
}
