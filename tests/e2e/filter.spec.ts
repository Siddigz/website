import { test, expect, type Page } from '@playwright/test';
import { moreSlugs, readProjects, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
// Counted from the content files, so the tests keep working as projects change.
const more = new Set(moreSlugs());
const rows = readProjects().filter((project) => more.has(project.slug));
const total = rows.length;
const count = (category: string) => rows.filter((project) => project.data.category === category).length;
const statusText = (shown: number) => site.filter.status.replace('{n}', String(shown)).replace('{total}', String(total));

const group = (page: Page) => page.getByRole('group', { name: site.filter.label });
const button = (page: Page, name: string) => group(page).getByRole('button', { name, exact: true });
const visibleRows = (page: Page) => page.locator('#more-projects .row:visible');

test('every row shows at first, with "All" pressed', async ({ page }) => {
  await page.goto('/');
  await expect(button(page, site.filter.all)).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Systems')).toHaveAttribute('aria-pressed', 'false');
  await expect(visibleRows(page)).toHaveCount(total);
  // One button per category that has a row, after "All".
  const categories = ['web-apps', 'ai-data', 'systems'].filter((category) => count(category) > 0);
  await expect(group(page).getByRole('button')).toHaveCount(categories.length + 1);
});

test('pressing a category leaves only its rows, updates the address and says how many show', async ({ page }) => {
  await page.goto('/');
  const entries = await page.evaluate(() => history.length);
  await button(page, 'Systems').click();
  await expect(button(page, 'Systems')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, site.filter.all)).toHaveAttribute('aria-pressed', 'false');
  await expect(visibleRows(page)).toHaveCount(count('systems'));
  for (const row of await visibleRows(page).all()) await expect(row).toHaveAttribute('data-category', 'systems');
  expect(page.url()).toMatch(/\?filter=systems$/);
  await expect(page.locator('#more-projects [role="status"]')).toHaveText(statusText(count('systems')));

  await button(page, site.filter.all).click();
  await expect(visibleRows(page)).toHaveCount(total);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('#more-projects [role="status"]')).toHaveText(statusText(total));
  // The address changes in place: Back still leaves the site, not the filter.
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test('an address with a filter arrives filtered, and keeps its place on the page', async ({ page }) => {
  await page.goto('/?filter=ai-data#more-projects');
  await expect(button(page, 'AI & data')).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleRows(page)).toHaveCount(count('ai-data'));
  await button(page, 'Systems').click();
  expect(page.url()).toMatch(/\?filter=systems#more-projects$/);
});

test('a filter that is not a category shows everything', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?filter=nope');
  await expect(button(page, site.filter.all)).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleRows(page)).toHaveCount(total);
  expect(errors).toEqual([]);
});

test('the buttons work from the keyboard', async ({ page, browserName }) => {
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.goto('/');
  await button(page, site.filter.all).focus();
  await page.keyboard.press(tab);
  await expect(button(page, 'Web & apps')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(button(page, 'Web & apps')).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleRows(page)).toHaveCount(count('web-apps'));
});

test('with reduced motion the rows change at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => {
    (window as any).transitions = 0;
    const original = document.startViewTransition?.bind(document);
    if (original) {
      document.startViewTransition = ((update: any) => {
        (window as any).transitions += 1;
        return original(update);
      }) as typeof document.startViewTransition;
    }
  });
  await button(page, 'Systems').click();
  await expect(visibleRows(page)).toHaveCount(count('systems'));
  expect(await page.evaluate(() => (window as any).transitions)).toBe(0);
  // No part of the page is being moved or cross-faded. (A link under the mouse may still change colour.)
  const moving = await page.evaluate(() =>
    document.getAnimations().filter((animation) => (animation.effect as KeyframeEffect).pseudoElement?.startsWith('::view-transition')).length,
  );
  expect(moving).toBe(0);
});

test('where the browser can animate between two states, the rows do', async ({ page }) => {
  await page.goto('/');
  test.skip(!(await page.evaluate(() => 'startViewTransition' in document)), 'this browser has no view transitions');
  await page.evaluate(() => {
    (window as any).transitions = 0;
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: any) => {
      (window as any).transitions += 1;
      return original(update);
    }) as typeof document.startViewTransition;
  });
  await button(page, 'Systems').click();
  await expect(visibleRows(page)).toHaveCount(count('systems'));
  expect(await page.evaluate(() => (window as any).transitions)).toBe(1);
  // Once it is over, no row keeps a transition name, so nothing clashes with later transitions.
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#more-projects .row')].filter((row) => row.style.viewTransitionName).length))
    .toBe(0);
});

test('with scripts off there are no filter buttons and every row shows', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/?filter=systems');
  await expect(page.locator('#more-projects [data-filter]')).toBeHidden();
  await expect(visibleRows(page)).toHaveCount(total);
  await context.close();
});

test('the filter does not scroll the page sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.locator('#more-projects').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
