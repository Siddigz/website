import { test, expect, type Page } from '@playwright/test';
import { featuredSlugs, readProjects } from '../content/helpers';

const [first, second] = featuredSlugs() as [string, string];
const title = (slug: string) => readProjects().find((project) => project.slug === slug)!.data.title as string;

type Entry = { event: string; page: string; transition: boolean; names: string[] };

/**
 * Records, on every page of the visit, what each transition event saw: whether
 * the browser was animating between the two pages, and every transition name
 * in the page right after the site's own handler ran.
 */
async function record(page: Page) {
  await page.addInitScript(() => {
    const add = window.addEventListener;
    window.addEventListener = function (this: Window, type: string, listener: any, options?: any) {
      if (type !== 'pagereveal' && type !== 'pageswap') return add.call(this, type, listener, options);
      return add.call(
        this,
        type,
        (event: any) => {
          listener(event);
          const names = [...document.querySelectorAll('*')]
            .map((element) => getComputedStyle(element).viewTransitionName)
            .filter((name) => name && name !== 'none');
          const log = JSON.parse(sessionStorage.getItem('vt-log') ?? '[]');
          log.push({ event: type, page: location.pathname, transition: Boolean(event.viewTransition), names });
          sessionStorage.setItem('vt-log', JSON.stringify(log));
        },
        options,
      );
    } as typeof window.addEventListener;
  });
}

const log = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('vt-log') ?? '[]') as Entry[]);
const animatesBetweenPages = (page: Page) =>
  page.evaluate(() => 'onpagereveal' in window && typeof CSSViewTransitionRule !== 'undefined');

test('a card leads to its page, and the links there lead back and onward', async ({ page }) => {
  await page.goto('/');
  await page.locator(`#projects a[href="/projects/${first}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${first}/?$`));
  await expect(page.locator('h1')).toHaveText(title(first));
  await page.getByRole('link', { name: /^Next: / }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${second}/?$`));
  await expect(page.locator('h1')).toHaveText(title(second));
  await page.getByRole('link', { name: 'Back to projects' }).first().click();
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator('#projects')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(title(second));
});

test('going from a card to its page animates, carrying the title and the picture across', async ({ page }) => {
  await record(page);
  await page.goto('/');
  test.skip(!(await animatesBetweenPages(page)), 'this browser does not animate between pages');
  const link = page.locator(`#projects a[href="/projects/${first}"]`);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page.locator('h1')).toHaveText(title(first));
  const entries = await log(page);
  const leaving = entries.find((entry) => entry.event === 'pageswap' && entry.page === '/')!;
  const arriving = entries.find((entry) => entry.event === 'pagereveal' && entry.page.startsWith('/projects/'))!;
  expect(leaving.transition).toBe(true);
  expect(arriving.transition).toBe(true);
  // The card that was pressed, and only that one, carries the names the project page uses.
  expect(leaving.names).toContain('project-title');
  expect(leaving.names).toContain('project-image');
  expect(arriving.names).toContain('project-title');
  // Afterwards the home page holds no leftover name, so later transitions cannot clash.
  await page.goBack();
  await expect(page.locator('#projects')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#projects *')].filter((element) => element.style.viewTransitionName).length),
    )
    .toBe(0);
});

test('coming back to the list carries the title back to its card', async ({ page }) => {
  await record(page);
  await page.goto(`/projects/${first}`);
  test.skip(!(await animatesBetweenPages(page)), 'this browser does not animate between pages');
  await page.getByRole('link', { name: 'Back to projects' }).first().click();
  await expect(page).toHaveURL(/\/#projects$/);
  const arriving = (await log(page)).find((entry) => entry.event === 'pagereveal' && entry.page === '/')!;
  expect(arriving.transition).toBe(true);
  expect(arriving.names).toContain('project-title');
});

test('no two elements ever share a transition name', async ({ page }) => {
  await record(page);
  await page.goto('/');
  await page.locator(`#projects a[href="/projects/${first}"]`).click();
  await expect(page.locator('h1')).toHaveText(title(first));
  await page.getByRole('link', { name: /^Next: / }).click();
  await expect(page.locator('h1')).toHaveText(title(second));
  await page.getByRole('link', { name: 'Back to projects' }).first().click();
  await expect(page).toHaveURL(/\/#projects$/);
  for (const entry of await log(page)) {
    expect(new Set(entry.names).size, `${entry.event} on ${entry.page}: ${entry.names.join(', ')}`).toBe(entry.names.length);
  }
  // And at rest, on both kinds of page.
  for (const path of ['/', `/projects/${first}`]) {
    await page.goto(path);
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('*')].map((element) => getComputedStyle(element).viewTransitionName).filter((name) => name && name !== 'none'),
    );
    expect(new Set(names).size, `${path}: ${names.join(', ')}`).toBe(names.length);
  }
});

test('with reduced motion a page simply replaces the one before', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record(page);
  await page.goto('/');
  await page.locator(`#projects a[href="/projects/${first}"]`).click();
  await expect(page.locator('h1')).toHaveText(title(first));
  for (const entry of await log(page)) expect(entry.transition, `${entry.event} on ${entry.page}`).toBe(false);
});

test('a picture that is off screen on the new page is left out of the animation', async ({ page }) => {
  await record(page);
  // Short enough that the project page's lead picture starts below the screen.
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/');
  test.skip(!(await animatesBetweenPages(page)), 'this browser does not animate between pages');
  const link = page.locator(`#projects a[href="/projects/${first}"]`);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page.locator('h1')).toHaveText(title(first));
  const lead = await page.locator('main img').first().boundingBox();
  test.skip(lead!.y < 420, 'the lead picture is on screen at this size');
  const arriving = (await log(page)).find((entry) => entry.event === 'pagereveal' && entry.page.startsWith('/projects/'))!;
  expect(arriving.names).toContain('project-title');
  expect(arriving.names).not.toContain('project-image');
});
