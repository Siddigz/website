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

test('the top-right links include Explainers, in page order, and it lights up when that section is on screen', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.site-header .links a');
  await expect(links).toHaveText(['Experience', 'Projects', site.explainers.title, 'About']);
  await expect(links.nth(2)).toHaveAttribute('href', '/#explainers');
  await links.nth(2).click();
  await expect(page).toHaveURL(/\/#explainers$/);
  await expect(page.locator('#explainers')).toBeInViewport();
  await page.locator('#explainers').evaluate((section) => section.scrollIntoView({ block: 'center' }));
  await expect(page.locator('.site-header a[aria-current="true"]')).toHaveText(site.explainers.title);
});

for (const width of [320, 375]) {
  test(`the top-right links fit on one row and never push the page sideways (${width} wide)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    const tops = await page.locator('.site-header .links a').evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

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

  test(`${explainer.slug}: the interactive part is as wide as the page's content, so it sits squarely under the title`, async ({ page }) => {
    await page.goto(`/explainers/${explainer.slug}`);
    const edges = await page.evaluate(() => {
      const article = document.querySelector('article.explainer')!;
      const style = getComputedStyle(article);
      const outer = article.getBoundingClientRect();
      // The interactive part is the one block directly inside the article, between the header and the footer.
      const widget = article.querySelector(':scope > div')!.getBoundingClientRect();
      return {
        left: Math.round(widget.left - (outer.left + parseFloat(style.paddingLeft))),
        right: Math.round(outer.right - parseFloat(style.paddingRight) - widget.right),
      };
    });
    expect(Math.abs(edges.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(edges.right)).toBeLessThanOrEqual(1);
  });

  test(`${explainer.slug}: with scripts off a line says why nothing moves; with scripts on it is not shown`, async ({ page, browser }) => {
    await page.goto(`/explainers/${explainer.slug}`);
    await expect(page.getByText(site.explainers.noScript)).toBeHidden();
    const context = await browser.newContext({ javaScriptEnabled: false });
    const plain = await context.newPage();
    await plain.goto(`/explainers/${explainer.slug}`);
    await expect(plain.getByText(site.explainers.noScript)).toBeVisible();
    await context.close();
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

test.describe('NRZ vs PAM4', () => {
  const open = async (page: Page) => {
    await page.goto('/explainers/nrz-vs-pam4');
    return page.locator('[data-signal]');
  };
  const format = (page: Page, name: string) => page.getByRole('group', { name: 'Modulation format' }).getByRole('button', { name });
  const readout = (page: Page, name: string) => page.locator(`[data-signal] [data-readout="${name}"]`);
  const slider = (page: Page) => page.getByRole('slider', { name: 'Noise (σ)' });
  const sigma = (page: Page) => page.locator('[data-signal] [data-sigma]');
  const drawings = ['wave', 'eye', 'histogram'] as const;
  /** A fingerprint of a drawing's pixels: its size, how many are painted, and a running sum of their colours. */
  const pixels = (page: Page, name: string) =>
    page.locator(`[data-signal] canvas[data-drawing="${name}"]`).evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      let sum = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3]! > 0) painted += 1;
        // Each pixel's place counts too, so two labels swapping places changes the result.
        sum = (sum * 31 + data[index]! * 3 + data[index + 1]! * 5 + data[index + 2]! * 7 + data[index + 3]!) % 1_000_000_007;
      }
      return { width: canvas.width, height: canvas.height, painted, sum };
    });

  test('starts on PAM4 with a little noise', async ({ page }) => {
    await open(page);
    await expect(format(page, 'PAM4 (4 levels)')).toHaveAttribute('aria-pressed', 'true');
    await expect(format(page, 'NRZ (2 levels)')).toHaveAttribute('aria-pressed', 'false');
    await expect(sigma(page)).toHaveText('0.050');
    await expect(readout(page, 'gap').locator('.big')).toHaveText('1/3');
    await expect(readout(page, 'bits').locator('.big')).toHaveText('2');
    await expect(readout(page, 'theory').locator('.big')).toHaveText('6.4e-4');
    await expect(page.getByRole('checkbox', { name: 'Gray code labels' })).toBeChecked();
  });

  test('the page as built already holds the starting numbers', async ({ request }) => {
    const html = await (await request.get('/explainers/nrz-vs-pam4')).text();
    expect(html).toContain('6.4e-4');
    expect(html).toContain('= 0.333 of full range');
  });

  test('NRZ has one full-range gap and one bit per symbol', async ({ page }) => {
    await open(page);
    await format(page, 'NRZ (2 levels)').click();
    await expect(format(page, 'NRZ (2 levels)')).toHaveAttribute('aria-pressed', 'true');
    await expect(format(page, 'PAM4 (4 levels)')).toHaveAttribute('aria-pressed', 'false');
    await expect(readout(page, 'gap').locator('.big')).toHaveText('1');
    await expect(readout(page, 'bits').locator('.big')).toHaveText('1');
    await expect(page.locator('[data-signal] [data-caption]')).toContainText('NRZ is the baseline');
    await format(page, 'PAM8 (8 levels)').click();
    await expect(readout(page, 'gap').locator('.big')).toHaveText('1/7');
    await expect(readout(page, 'bits').locator('.big')).toHaveText('3');
  });

  test('with no noise there are no errors, measured or predicted', async ({ page }) => {
    await open(page);
    await slider(page).fill('0');
    await expect(sigma(page)).toHaveText('0.000');
    await expect(readout(page, 'measured').locator('.big')).toHaveText('< 1 in 20,000');
    await expect(readout(page, 'theory').locator('.big')).toHaveText('0');
    await expect(page.locator('[data-signal] [data-wave-note]')).toContainText('0 of 40 symbols');
  });

  test('the arrow keys move the noise slider', async ({ page }) => {
    await open(page);
    await slider(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(sigma(page)).toHaveText('0.055');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(sigma(page)).toHaveText('0.045');
    // More noise, more predicted errors.
    await slider(page).fill('0.2');
    await expect(readout(page, 'theory').locator('.big')).not.toHaveText('6.4e-4');
  });

  test('every drawing is an image with a name, has size and is not blank', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-signal] canvas')).toHaveCount(3);
    for (const name of drawings) {
      const canvas = page.locator(`[data-signal] canvas[data-drawing="${name}"]`);
      await expect(canvas).toHaveAttribute('role', 'img');
      await expect(canvas).toHaveAttribute('aria-label', /\S/);
      const { width, height, painted } = await pixels(page, name);
      expect(width).toBeGreaterThan(200);
      expect(height).toBeGreaterThan(100);
      expect(painted).toBeGreaterThan(500);
    }
  });

  test('the drawings change with the format, the Gray code switch and Resample', async ({ page }) => {
    await open(page);
    const before = await pixels(page, 'wave');
    await page.getByRole('checkbox', { name: 'Gray code labels' }).uncheck();
    const plain = await pixels(page, 'wave');
    expect(plain.sum).not.toBe(before.sum);
    await page.getByRole('button', { name: 'Resample' }).click();
    expect((await pixels(page, 'wave')).sum).not.toBe(plain.sum);
    const pam4 = await pixels(page, 'histogram');
    await format(page, 'NRZ (2 levels)').click();
    expect((await pixels(page, 'histogram')).sum).not.toBe(pam4.sum);
  });

  test('the drawings are redrawn in the new colours when the theme changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    const light = await Promise.all(drawings.map((name) => pixels(page, name)));
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    for (const [index, name] of drawings.entries()) {
      await expect.poll(async () => (await pixels(page, name)).sum).not.toBe(light[index]!.sum);
    }
    // And when the system changes it, with no button pressed.
    await page.reload();
    const again = await pixels(page, 'wave');
    await page.evaluate(() => localStorage.removeItem('color-scheme'));
    await page.reload();
    const followed = await pixels(page, 'wave');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => (await pixels(page, 'wave')).sum).not.toBe(followed.sum);
    expect(again.sum).not.toBe(light[0]!.sum);
  });

  test('the drawings fit a narrow screen, and are redrawn when it changes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    const wide = await pixels(page, 'eye');
    await page.setViewportSize({ width: 320, height: 640 });
    await expect.poll(async () => (await pixels(page, 'eye')).width).toBeLessThan(wide.width);
    const box = (await page.locator('[data-signal] canvas[data-drawing="eye"]').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('the controls work from the keyboard', async ({ page, browserName }) => {
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    await open(page);
    await format(page, 'NRZ (2 levels)').focus();
    await page.keyboard.press('Enter');
    await expect(format(page, 'NRZ (2 levels)')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(tab);
    await page.keyboard.press(tab);
    await page.keyboard.press(tab);
    await expect(page.getByRole('checkbox', { name: 'Gray code labels' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'Gray code labels' })).not.toBeChecked();
  });

  test('with scripts off the numbers still read, and the controls and empty drawings are not shown', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/explainers/nrz-vs-pam4');
    await expect(page.locator('[data-signal] [data-readout="theory"] .big')).toHaveText('6.4e-4');
    await expect(page.locator('[data-signal] .controls')).toBeHidden();
    await expect(page.locator('[data-signal] canvas:visible')).toHaveCount(0);
    await context.close();
  });
});
