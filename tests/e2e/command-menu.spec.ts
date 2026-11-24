import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { featuredSlugs, readProjects, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const menu = (page: Page) => page.locator('dialog#command-menu');
const search = (page: Page) => menu(page).getByRole('combobox');
const options = (page: Page) => menu(page).getByRole('option');
const opener = (page: Page) => page.getByRole('button', { name: site.menu.open });
const activeLabel = async (page: Page) => {
  const id = await search(page).getAttribute('aria-activedescendant');
  return id ? ((await page.locator(`[id="${id}"]`).textContent()) ?? '').trim() : null;
};

test('the nav button opens the menu with the search box focused', async ({ page }) => {
  await page.goto('/');
  await expect(menu(page)).toBeHidden();
  await opener(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveAttribute('placeholder', site.menu.search);
});

for (const keys of ['Control+k', 'Meta+k']) {
  test(`${keys} opens the menu, and again closes it`, async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(keys);
    await expect(menu(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    await page.keyboard.press(keys);
    await expect(menu(page)).toBeHidden();
  });
}

test('the shortcut is the K key itself, whatever letter the keyboard layout puts on it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  // On an Arabic layout the key marked K types the letter noon.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ن', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true })));
  await expect(menu(page)).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ن', code: 'KeyK', metaKey: true, bubbles: true, cancelable: true })));
  await expect(menu(page)).toBeHidden();
  // Some tools send key events with no key at all. They are ignored, not an error.
  await page.evaluate(() => {
    const bare = new KeyboardEvent('keydown', { ctrlKey: true, bubbles: true });
    Object.defineProperty(bare, 'key', { value: undefined });
    document.dispatchEvent(bare);
  });
  await expect(menu(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test('typing narrows the list, and Enter opens the one that is left', async ({ page }) => {
  await page.goto('/');
  await opener(page).click();
  await search(page).fill('eco');
  await expect(options(page)).toHaveCount(1);
  await expect(options(page)).toHaveText('EcoCart');
  expect(await activeLabel(page)).toBe('EcoCart');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projects\/ecocart\/?$/);
});

test('the arrow keys move through the list and wrap at both ends', async ({ page }) => {
  await page.goto('/');
  await opener(page).click();
  const labels = (await options(page).allTextContents()).map((label) => label.trim());
  expect(await activeLabel(page)).toBe(labels[0]);
  await page.keyboard.press('ArrowDown');
  expect(await activeLabel(page)).toBe(labels[1]);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  expect(await activeLabel(page)).toBe(labels.at(-1));
  await page.keyboard.press('ArrowDown');
  expect(await activeLabel(page)).toBe(labels[0]);
  // Exactly one option is marked as the active one.
  await expect(menu(page).locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
  await expect(search(page)).toBeFocused();
});

test('Escape closes the menu and focus goes back to the button that opened it', async ({ page }) => {
  await page.goto('/');
  await opener(page).click();
  await search(page).fill('about');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(opener(page)).toBeFocused();
  // Opened again, it starts fresh.
  await opener(page).click();
  await expect(search(page)).toHaveValue('');
  expect(await options(page).count()).toBeGreaterThan(5);
});

test('the theme entry switches the theme and closes the menu', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const scheme = page.locator('meta[name="color-scheme"]');
  await opener(page).click();
  await search(page).fill('theme');
  await expect(options(page)).toHaveCount(1);
  // Both labels are in the markup; the one that applies is the one shown and read out.
  await expect(options(page)).toHaveAccessibleName('Switch to dark theme');
  await expect(options(page).getByText('Switch to light theme')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(scheme).toHaveAttribute('content', 'dark');
  await expect(menu(page)).toBeHidden();
  // The entry now offers the way back.
  await opener(page).click();
  await search(page).fill('theme');
  await expect(options(page)).toHaveAccessibleName('Switch to light theme');
});

test('a search that matches nothing says so, and Enter does nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const address = page.url();
  await opener(page).click();
  // The status line is on the page before it has anything to say (one that appears already filled may not be read out), and takes no room.
  const line = menu(page).getByRole('status');
  expect(await line.evaluate((element) => getComputedStyle(element).display)).not.toBe('none');
  expect((await line.boundingBox())!.height).toBe(0);
  await search(page).fill('zzzz');
  await expect(options(page)).toHaveCount(0);
  await expect(menu(page).getByText(site.menu.empty)).toBeVisible();
  // It is said aloud too: a status outside the list, not a stray line inside it.
  await expect(menu(page).getByRole('status')).toHaveText(site.menu.empty);
  await expect(menu(page).getByRole('listbox').getByText(site.menu.empty)).toHaveCount(0);
  await expect(search(page)).toHaveAttribute('aria-activedescendant', '');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(menu(page)).toBeVisible();
  expect(page.url()).toBe(address);
  expect(errors).toEqual([]);
  // Clearing the search brings everything back.
  await search(page).fill('');
  await expect(menu(page).getByText(site.menu.empty)).toBeHidden();
  expect(await options(page).count()).toBeGreaterThan(5);
});

test('from a project page, a section entry leads to that section of the home page', async ({ page }) => {
  await page.goto(`/projects/${featuredSlugs()[0]}`);
  await opener(page).click();
  await search(page).fill('experience');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/#experience$/);
  await expect(page.locator('#experience')).toBeInViewport();
});

test('clicking an entry on the home page goes to its section and closes the menu', async ({ page }) => {
  await page.goto('/');
  await opener(page).click();
  await options(page).filter({ hasText: /^\s*Contact\s*$/ }).click();
  await expect(menu(page)).toBeHidden();
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('the list holds every section on the page, every project and both profile links', async ({ page }) => {
  await page.goto('/');
  // Every section that has a heading, in page order.
  const sections = await page
    .locator('main > section[id]')
    .evaluateAll((all) =>
      all.filter((section) => section.querySelector('h2')).map((section) => [section.id, section.querySelector('h2')!.textContent!.trim()]),
    );
  await opener(page).click();
  const group = (name: string) => menu(page).getByRole('group', { name });
  const entries = async (name: string) =>
    group(name)
      .getByRole('option')
      .evaluateAll((all) => all.map((option) => [option.getAttribute('href'), option.textContent!.trim()]));
  expect(await entries(site.menu.groups.sections)).toEqual(sections.map(([id, label]) => [`/#${id}`, label]));

  const projects = readProjects();
  const listed = await entries(site.menu.groups.projects);
  expect(listed.map(([, label]) => label).sort()).toEqual(projects.map((project) => project.data.title).sort());
  for (const slug of featuredSlugs()) expect(listed.map(([href]) => href)).toContain(`/projects/${slug}`);

  expect(await entries(site.menu.groups.links)).toEqual([
    [site.links.github, 'GitHub'],
    [site.links.linkedin, 'LinkedIn'],
  ]);
  await expect(group(site.menu.groups.theme).getByRole('option')).toHaveCount(1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the open menu has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await opener(page).click();
    await expect(search(page)).toBeFocused();
    // The menu fades in. Colours are only final once that is over.
    await menu(page).evaluate((dialog) => Promise.all(dialog.getAnimations().map((animation) => animation.finished)));
    const { violations } = await new AxeBuilder({ page })
      .include('#command-menu')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
  });
}

test('the open menu fits a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await opener(page).click();
  const box = (await menu(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await menu(page).evaluate((dialog) => dialog.scrollWidth - dialog.clientWidth)).toBeLessThanOrEqual(0);
});

test('the nav button never changes the size of the bar when it is filled in', async ({ page }) => {
  await page.goto('/');
  const width = () => opener(page).evaluate((button) => Math.round(button.getBoundingClientRect().width));
  const before = await width();
  // The other platform's key label takes the same room.
  await opener(page).evaluate((button) => {
    const key = button.querySelector('[data-menu-key]')!;
    key.textContent = key.textContent === '⌘K' ? 'Ctrl K' : '⌘K';
  });
  expect(await width()).toBe(before);
});

test('with scripts off the nav button is not shown', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-menu-open]')).toBeHidden();
  await expect(page.locator('dialog#command-menu')).toBeHidden();
  await context.close();
});
