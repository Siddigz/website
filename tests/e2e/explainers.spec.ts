import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync } from 'node:fs';
import { readMarkdown, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const DIR = 'src/content/explainers';
const explainers = readdirSync(DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ slug: name.replace(/\.md$/, ''), ...readMarkdown(`${DIR}/${name}`).data }))
  .sort((a: any, b: any) => a.order - b.order) as { slug: string; title: string; summary: string; order: number }[];

test('the home page lists every explainer, between the projects and the activity', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((sections) => sections.map((section) => section.id));
  expect(ids.indexOf('explainers')).toBe(ids.indexOf('more-projects') + 1);
  expect(ids.indexOf('explainers')).toBeLessThan(ids.indexOf('about'));
  const section = page.locator('#explainers');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(site.explainers.title);
  const cards = section.locator('article');
  await expect(cards).toHaveCount(explainers.length);
  for (const [index, explainer] of explainers.entries()) {
    await expect(cards.nth(index).getByRole('link', { name: explainer.title })).toHaveAttribute('href', `/explainers/${explainer.slug}`);
    await expect(cards.nth(index)).toContainText(explainer.summary);
  }
});

for (const explainer of explainers) {
  test(`${explainer.slug}: the page has its title, its summary and a way back`, async ({ page }) => {
    const response = await page.goto(`/explainers/${explainer.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(explainer.title);
    await expect(page.locator('main')).toContainText(explainer.summary);
    await expect(page).toHaveTitle(new RegExp(explainer.title.slice(0, 12)));
    const back = page.getByRole('link', { name: site.explainers.back }).first();
    await expect(back).toHaveAttribute('href', '/#explainers');
    await back.click();
    await expect(page).toHaveURL(/\/#explainers$/);
    await expect(page.locator('#explainers')).toBeInViewport();
  });

  test(`${explainer.slug}: the menu lists it`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: site.menu.open }).click();
    const group = page.locator('dialog#command-menu').getByRole('group', { name: site.menu.groups.explainers });
    await expect(group.getByRole('option', { name: explainer.title })).toHaveAttribute('href', `/explainers/${explainer.slug}`);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${explainer.slug}: no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(`/explainers/${explainer.slug}`);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
    });
  }

  test(`${explainer.slug}: the page does not scroll sideways at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/explainers/${explainer.slug}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test.describe('one packet, hop by hop', () => {
  const open = async (page: Page) => {
    await page.goto('/explainers/one-packet-hop-by-hop');
    return page.locator('[data-packet]');
  };
  const previous = (page: Page) => page.getByRole('button', { name: 'Previous' });
  const next = (page: Page) => page.getByRole('button', { name: 'Next hop' });
  const reset = (page: Page) => page.getByRole('button', { name: 'Reset' });
  const caption = (page: Page) => page.locator('[data-packet] [data-caption]');
  const value = (page: Page, field: string) => page.locator(`[data-packet] .cards [data-f="${field}"]`);
  const rows = (page: Page) => page.locator('[data-packet] tbody tr:visible');

  test('starts at the laptop, with nowhere to go back to', async ({ page }) => {
    const widget = await open(page);
    await expect(caption(page)).toContainText('Step 0 of 10 · now at: Laptop');
    await expect(previous(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await expect(value(page, 'ttl')).toHaveText('64');
    await expect(value(page, 'ipDst')).toHaveText('198.51.100.7');
    await expect(rows(page)).toHaveCount(1);
    await expect(widget.getByText('The packet was just created on the laptop.')).toBeVisible();
  });

  test('the home router rewrites the headers and swaps the source address', async ({ page }) => {
    const widget = await open(page);
    await next(page).click();
    await expect(caption(page)).toContainText('Step 1 of 10 · now at: Home router');
    await expect(value(page, 'ttl')).toHaveText('63');
    await expect(value(page, 'eDst')).toHaveText('DD');
    await expect(value(page, 'ipSrc')).toHaveText('203.0.113.5');
    await expect(widget.locator('[data-nat]')).toBeVisible();
    await expect(widget.getByText('Changed at this step: Ethernet dst MAC, Ethernet src MAC, IP src, TTL.')).toBeVisible();
    // The values that changed are marked, and the one that never changes is not.
    await expect(value(page, 'ttl')).toHaveAttribute('data-changed', '');
    await expect(value(page, 'ipDst')).not.toHaveAttribute('data-changed', '');
    await expect(rows(page)).toHaveCount(2);
    await expect(previous(page)).toBeEnabled();

    await next(page).click();
    await expect(caption(page)).toContainText('Step 2 of 10 · now at: ISP router');
    await expect(widget.locator('[data-nat]')).toBeHidden();
    await expect(value(page, 'ipSrc')).not.toHaveAttribute('data-changed', '');
    await expect(rows(page)).toHaveCount(3);
  });

  test('a device that only carries the light changes nothing', async ({ page }) => {
    const widget = await open(page);
    for (let step = 0; step < 4; step += 1) await next(page).click();
    await expect(caption(page)).toContainText('Step 4 of 10 · now at: Amplifier 1');
    await expect(widget.getByText('Nothing in the packet changed at this step.')).toBeVisible();
    await expect(widget.locator('[data-changed]')).toHaveCount(0);
  });

  test('the packet is delivered at step 10, and Reset starts again', async ({ page }) => {
    const widget = await open(page);
    for (let step = 0; step < 10; step += 1) await next(page).click();
    await expect(caption(page)).toContainText('Step 10 of 10 · now at: Web server');
    await expect(next(page)).toBeDisabled();
    await expect(widget.getByText('Packet delivered.')).toBeVisible();
    await expect(widget.locator('[data-verdict]')).toBeVisible();
    await expect(value(page, 'ttl')).toHaveText('60');
    await expect(rows(page)).toHaveCount(11);
    await expect(rows(page).last()).toContainText('Delivered at Web server');
    await reset(page).click();
    await expect(caption(page)).toContainText('Step 0 of 10');
    await expect(rows(page)).toHaveCount(1);
    await expect(widget.locator('[data-verdict]')).toBeHidden();
    await expect(previous(page)).toBeDisabled();
  });

  test('Previous goes back a stop', async ({ page }) => {
    await open(page);
    await next(page).click();
    await next(page).click();
    await previous(page).click();
    await expect(caption(page)).toContainText('Step 1 of 10');
    await expect(value(page, 'ttl')).toHaveText('63');
    await expect(rows(page)).toHaveCount(2);
  });

  test('the packet in the drawing moves to the stop it is at', async ({ page }) => {
    await open(page);
    const x = () => page.locator('[data-packet] [data-token]').evaluate((token) => token.getBoundingClientRect().x);
    const start = await x();
    await next(page).click();
    await expect.poll(x).toBeGreaterThan(start + 5);
  });

  test('all three buttons work from the keyboard', async ({ page }) => {
    await open(page);
    await next(page).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(caption(page)).toContainText('Step 2 of 10');
    await previous(page).focus();
    await page.keyboard.press('Enter');
    await expect(caption(page)).toContainText('Step 1 of 10');
    await reset(page).focus();
    await page.keyboard.press('Enter');
    await expect(caption(page)).toContainText('Step 0 of 10');
  });

  test('the caption is announced to screen readers when it changes', async ({ page }) => {
    await open(page);
    await expect(caption(page)).toHaveAttribute('role', 'status');
  });

  test('with reduced motion the values simply change', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await next(page).click();
    await expect(caption(page)).toContainText('Step 1 of 10');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('on a narrow screen the drawing scrolls inside its own box, which the keyboard can reach', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    const box = page.getByRole('group', { name: 'Network path from a laptop to a web server' });
    await expect(box).toHaveAttribute('tabindex', '0');
    expect(await box.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('with scripts off the whole journey is in the table, and the buttons are not offered', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/explainers/one-packet-hop-by-hop');
    await expect(page.locator('[data-packet] tbody tr:visible')).toHaveCount(11);
    await expect(page.locator('[data-packet] .controls')).toBeHidden();
    await context.close();
  });
});
