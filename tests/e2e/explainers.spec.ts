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
  expect(ids.indexOf('playground')).toBe(ids.indexOf('more-projects') + 1);
  expect(ids.indexOf('playground')).toBeLessThan(ids.indexOf('about'));
  const section = page.locator('#playground');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(site.explainers.title);
  const cards = section.locator('article');
  await expect(cards).toHaveCount(explainers.length);
  for (const [index, explainer] of explainers.entries()) {
    await expect(cards.nth(index).getByRole('link', { name: explainer.title })).toHaveAttribute('href', `/playground/${explainer.slug}`);
    await expect(cards.nth(index)).toContainText(explainer.summary);
  }
});

test('the top-right links include Explainers, in page order, and it lights up when that section is on screen', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.site-header .links a');
  await expect(links).toHaveText(['Experience', 'Projects', site.explainers.title, 'About']);
  await expect(links.nth(2)).toHaveAttribute('href', '/#playground');
  await links.nth(2).click();
  await expect(page).toHaveURL(/\/#playground$/);
  await expect(page.locator('#playground')).toBeInViewport();
  await page.locator('#playground').evaluate((section) => section.scrollIntoView({ block: 'center' }));
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

test('every explainer card carries a small drawing of what it explains', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#playground article');
  for (const [index, explainer] of explainers.entries()) {
    const drawing = cards.nth(index).locator('svg');
    await expect(drawing).toHaveCount(1);
    await expect(drawing).toBeVisible();
    // Decoration: the card is still named by its title alone.
    await expect(drawing).toHaveAttribute('aria-hidden', 'true');
    await expect(cards.nth(index).getByRole('link')).toHaveAccessibleName(explainer.title);
    const box = (await drawing.boundingBox())!;
    expect(box.width).toBeGreaterThan(150);
    expect(box.height).toBeGreaterThan(80);
    // It really draws something, and sits above the words.
    expect(await drawing.locator('path, rect, circle, line, polyline').count()).toBeGreaterThan(5);
    expect(box.y).toBeLessThan((await cards.nth(index).locator('h3').boundingBox())!.y);
  }
  // The two drawings are different pictures.
  const shapes = await cards.locator('svg').evaluateAll((drawings) => drawings.map((drawing) => drawing.innerHTML));
  expect(new Set(shapes).size).toBe(explainers.length);
});

test('the drawings on the cards follow the theme', async ({ page }) => {
  const ink = () =>
    page.locator('#playground article svg').first().evaluate((drawing) => {
      const shape = drawing.querySelector('[class]')!;
      const style = getComputedStyle(shape);
      return `${style.fill} ${style.stroke}`;
    });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const light = await ink();
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await ink()).not.toBe(light);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the Explainers section has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    const { violations } = await new AxeBuilder({ page }).include('#playground').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
  });
}

for (const explainer of explainers) {
  test(`${explainer.slug}: the page has its title, its summary and a way back`, async ({ page }) => {
    const response = await page.goto(`/playground/${explainer.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(explainer.title);
    await expect(page.locator('main')).toContainText(explainer.summary);
    await expect(page).toHaveTitle(new RegExp(explainer.title.slice(0, 12)));
    const back = page.getByRole('link', { name: site.explainers.back }).first();
    await expect(back).toHaveAttribute('href', '/#playground');
    await back.click();
    await expect(page).toHaveURL(/\/#playground$/);
    await expect(page.locator('#playground')).toBeInViewport();
  });

  test(`${explainer.slug}: the interactive part is as wide as the page's content, so it sits squarely under the title`, async ({ page }) => {
    await page.goto(`/playground/${explainer.slug}`);
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
    await page.goto(`/playground/${explainer.slug}`);
    await expect(page.getByText(site.explainers.noScript)).toBeHidden();
    const context = await browser.newContext({ javaScriptEnabled: false });
    const plain = await context.newPage();
    await plain.goto(`/playground/${explainer.slug}`);
    await expect(plain.getByText(site.explainers.noScript)).toBeVisible();
    await context.close();
  });

  test(`${explainer.slug}: the menu lists it`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: site.menu.open }).click();
    const group = page.locator('dialog#command-menu').getByRole('group', { name: site.menu.groups.explainers });
    await expect(group.getByRole('option', { name: explainer.title })).toHaveAttribute('href', `/playground/${explainer.slug}`);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${explainer.slug}: no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(`/playground/${explainer.slug}`);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
    });
  }

  test(`${explainer.slug}: the page does not scroll sideways at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/playground/${explainer.slug}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test.describe('follow a packet', () => {
  const open = async (page: Page) => {
    await page.goto('/playground/follow-a-packet');
    return page.locator('[data-packet]');
  };
  const previous = (page: Page) => page.getByRole('button', { name: 'Previous' });
  const next = (page: Page) => page.getByRole('button', { name: 'Next hop' });
  const reset = (page: Page) => page.getByRole('button', { name: 'Reset' });
  const caption = (page: Page) => page.locator('[data-packet] [data-caption]');
  const value = (page: Page, field: string) => page.locator(`[data-packet] [data-f="${field}"]`);
  const mark = (page: Page, layer: string) => page.locator(`[data-packet] [data-mark="${layer}"]`);
  const rows = (page: Page) => page.locator('[data-packet] tbody tr:visible');
  const route = (page: Page) => page.getByRole('list', { name: 'The stops from the laptop to the web server' });
  const forward = async (page: Page, times: number) => {
    for (let step = 0; step < times; step += 1) await next(page).click();
  };

  test('starts at the laptop, which writes every layer, with nowhere to go back to', async ({ page }) => {
    const widget = await open(page);
    await expect(caption(page)).toContainText('Stop 1 of 11 · Laptop');
    await expect(previous(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await expect(widget.locator('[data-name]')).toHaveText('Laptop');
    await expect(widget.locator('[data-does]')).toHaveText('Builds the packet');
    await expect(widget.locator('[data-from]')).toHaveText('Start');
    await expect(widget.locator('[data-next-name]')).toHaveText('Home router');
    await expect(value(page, 'ttl')).toHaveText('64');
    await expect(value(page, 'ipDst')).toHaveText('198.51.100.7');
    for (const layer of ['eth', 'ip', 'tcp', 'data']) await expect(mark(page, layer)).toHaveText('written here');
    await expect(rows(page)).toHaveCount(1);
  });

  test('the home router replaces Ethernet, reads IP, and swaps the source address', async ({ page }) => {
    const widget = await open(page);
    await next(page).click();
    await expect(caption(page)).toContainText('Stop 2 of 11 · Home router');
    await expect(widget.locator('[data-does]')).toHaveText('Reads IP, rewrites Ethernet');
    await expect(widget.locator('[data-from]')).toHaveText('Laptop');
    await expect(value(page, 'ttl')).toHaveText('63');
    await expect(value(page, 'eDst')).toHaveText('DD');
    await expect(value(page, 'ipSrc')).toHaveText('203.0.113.5');
    await expect(mark(page, 'eth')).toHaveText('rewritten here');
    await expect(mark(page, 'ip')).toHaveText('read here');
    await expect(mark(page, 'tcp')).toHaveText('');
    await expect(mark(page, 'data')).toHaveText('');
    // The values that changed are marked, and the one that never changes is not.
    for (const field of ['eDst', 'eSrc', 'ipSrc', 'ttl']) await expect(value(page, field)).toHaveAttribute('data-changed', '');
    await expect(value(page, 'ipDst')).not.toHaveAttribute('data-changed', '');
    await expect(rows(page)).toHaveCount(2);
    await expect(previous(page)).toBeEnabled();

    await next(page).click();
    await expect(caption(page)).toContainText('Stop 3 of 11 · ISP router');
    await expect(value(page, 'ipSrc')).not.toHaveAttribute('data-changed', '');
    await expect(rows(page)).toHaveCount(3);
  });

  test('a changed value is marked by more than colour', async ({ page }) => {
    await open(page);
    await next(page).click();
    const ring = (field: string) => value(page, field).evaluate((element) => getComputedStyle(element).outlineColor);
    expect(await ring('ttl')).not.toBe(await ring('ipDst'));
  });

  test('a device that only carries the light opens nothing and changes nothing', async ({ page }) => {
    const widget = await open(page);
    await forward(page, 4);
    await expect(caption(page)).toContainText('Stop 5 of 11 · Amplifier 1');
    await expect(widget.locator('[data-does]')).toHaveText('Boosts the light');
    for (const layer of ['eth', 'ip', 'tcp', 'data']) await expect(mark(page, layer)).toHaveText('');
    await expect(widget.locator('[data-changed]')).toHaveCount(0);
  });

  test('the switch reads Ethernet only; the server reads everything, and Reset starts again', async ({ page }) => {
    const widget = await open(page);
    await forward(page, 9);
    await expect(caption(page)).toContainText('Stop 10 of 11 · Data-centre switch');
    await expect(mark(page, 'eth')).toHaveText('read here');
    await expect(mark(page, 'ip')).toHaveText('');
    await next(page).click();
    await expect(caption(page)).toContainText('Stop 11 of 11 · Web server');
    await expect(next(page)).toBeDisabled();
    await expect(widget.locator('[data-next-name]')).toHaveText('Delivered');
    for (const layer of ['eth', 'ip', 'tcp', 'data']) await expect(mark(page, layer)).toHaveText('read here');
    await expect(value(page, 'ttl')).toHaveText('60');
    await expect(rows(page)).toHaveCount(11);
    await expect(rows(page).last()).toContainText('Web server');
    await reset(page).click();
    await expect(caption(page)).toContainText('Stop 1 of 11');
    await expect(rows(page)).toHaveCount(1);
    await expect(previous(page)).toBeDisabled();
  });

  test('Previous goes back a stop', async ({ page }) => {
    await open(page);
    await forward(page, 2);
    await previous(page).click();
    await expect(caption(page)).toContainText('Stop 2 of 11');
    await expect(value(page, 'ttl')).toHaveText('63');
    await expect(rows(page)).toHaveCount(2);
  });

  test('the row of dots is a list of the eleven stops, on one line, and marks where the packet is', async ({ page }) => {
    await open(page);
    const stops = route(page).getByRole('listitem');
    await expect(stops).toHaveCount(11);
    await expect(stops.first()).toHaveText('Laptop');
    await expect(stops.last()).toHaveText('Web server');
    const dots = await route(page).locator('.dot').evaluateAll((items) => items.map((item) => item.getBoundingClientRect()).map((box) => ({ x: box.x, y: Math.round(box.y + box.height / 2) })));
    for (let index = 1; index < dots.length; index += 1) {
      expect(dots[index]!.x).toBeGreaterThan(dots[index - 1]!.x);
      expect(Math.abs(dots[index]!.y - dots[0]!.y)).toBeLessThanOrEqual(1);
    }
    for (const step of [0, 1, 5, 10]) {
      while ((await route(page).getByRole('listitem').evaluateAll((items) => items.findIndex((item) => item.getAttribute('aria-current') === 'step'))) < step) await next(page).click();
      await expect(route(page).locator('[aria-current="step"]')).toHaveCount(1);
      await expect(route(page).locator('[data-passed]')).toHaveCount(step);
    }
  });

  test('only the drawing of the device the packet is at is shown', async ({ page }) => {
    const widget = await open(page);
    const shown = () => widget.locator('[data-glyph]:visible').evaluateAll((glyphs) => glyphs.map((glyph) => (glyph as HTMLElement).dataset.glyph));
    expect(await shown()).toEqual(['laptop']);
    await next(page).click();
    expect(await shown()).toEqual(['router']);
    await forward(page, 3);
    expect(await shown()).toEqual(['amplifier']);
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`nothing in it has to be scrolled sideways, the table included (${width} wide)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const widget = await open(page);
      await forward(page, 10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const wide = await widget.evaluate((element) =>
        // Only boxes that scroll or clip count here; anything that merely spills out of its box is caught just below.
        [element, ...element.querySelectorAll('*')]
          .filter((each) => !each.closest('.visually-hidden') && getComputedStyle(each).overflowX !== 'visible' && each.scrollWidth > each.clientWidth + 1 && each.clientWidth > 0)
          .map((each) => each.className || each.tagName),
      );
      expect(wide).toEqual([]);
      const outside = await widget.evaluate((element) => {
        const outer = element.getBoundingClientRect();
        return [...element.querySelectorAll('*')].filter((each) => {
          if (each.closest('.visually-hidden')) return false;
          const box = each.getBoundingClientRect();
          return box.width > 0 && (box.left < outer.left - 1 || box.right > outer.right + 1);
        }).length;
      });
      expect(outside).toBe(0);
    });
  }

  for (const size of [{ width: 320, height: 640 }, { width: 1280, height: 800 }]) {
    test(`nothing moves from stop to stop: the buttons and the packet stay where they are (${size.width} wide)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize(size);
      const widget = await open(page);
      const places = new Set<string>();
      for (let step = 0; step <= 10; step += 1) {
        const place = await widget.evaluate((element) => {
          const top = (selector: string) => Math.round(element.querySelector(selector)!.getBoundingClientRect().top + scrollY);
          return [top('[data-layer="eth"]'), top('[data-layer="data"]'), top('.caption-box'), top('[data-next]'), top('.history')].join(',');
        });
        places.add(place);
        if (step < 10) await next(page).click();
      }
      expect([...places]).toHaveLength(1);
    });
  }

  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    test(`from the row of dots to the buttons, it fits one screen (${size.width} by ${size.height})`, async ({ page }) => {
      await page.setViewportSize(size);
      const widget = await open(page);
      const header = (await page.locator('.site-header').boundingBox())!;
      const stage = (await widget.locator('[data-stage]').boundingBox())!;
      expect(stage.height).toBeLessThanOrEqual(size.height - header.height);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const steps of [1, 10]) {
      test(`after ${steps} hop(s) there are no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await open(page);
        await forward(page, steps);
        await expect(caption(page)).toContainText(`Stop ${steps + 1} of 11`);
        const { violations } = await new AxeBuilder({ page })
          .include('[data-packet]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
      });
    }
  }

  test('all three buttons work from the keyboard', async ({ page }) => {
    await open(page);
    await next(page).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(caption(page)).toContainText('Stop 3 of 11');
    await previous(page).focus();
    await page.keyboard.press('Enter');
    await expect(caption(page)).toContainText('Stop 2 of 11');
    await reset(page).focus();
    await page.keyboard.press('Enter');
    await expect(caption(page)).toContainText('Stop 1 of 11');
  });

  test('the caption is announced to screen readers when it changes', async ({ page }) => {
    await open(page);
    await expect(caption(page)).toHaveAttribute('role', 'status');
  });

  test('a router’s new Ethernet layer slides in, in no more than 300 ms; with reduced motion the values simply change', async ({ page }) => {
    await open(page);
    await next(page).click();
    const head = page.locator('[data-packet] [data-head="eth"]');
    await expect(head).toHaveAttribute('data-swap', '');
    expect(await head.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.3);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await next(page).click();
    await expect(caption(page)).toContainText('Stop 2 of 11');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('with scripts off the whole journey is in the table, and the buttons are not offered', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/playground/follow-a-packet');
    await expect(page.locator('[data-packet] tbody tr:visible')).toHaveCount(11);
    await expect(page.locator('[data-packet] .controls')).toBeHidden();
    // The packet still reads, as it leaves the laptop.
    await expect(page.locator('[data-packet] [data-name]')).toHaveText('Laptop');
    await expect(page.locator('[data-packet] [data-route] [aria-current="step"]')).toHaveText('Laptop');
    await context.close();
  });
});

test.describe('NRZ vs PAM4', () => {
  const open = async (page: Page) => {
    await page.goto('/playground/nrz-vs-pam4');
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
    const html = await (await request.get('/playground/nrz-vs-pam4')).text();
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

  test('only the slider’s own value is announced as it moves, not the whole conclusion each step', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-signal] [data-caption]')).not.toHaveAttribute('role', 'status');
    await expect(page.locator('[data-signal] output')).toHaveCount(1);
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

  test('in the histogram the wrong part of a bar is striped, so it is not told apart by colour alone', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    await slider(page).fill('0.2');
    // Row by row: the longest unbroken run of red. (A few rows also carry the red dotted threshold lines, which run on.)
    const red = await page.locator('[data-signal] canvas[data-drawing="histogram"]').evaluate((canvas: HTMLCanvasElement) => {
      const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const longest: number[] = [];
      for (let y = 0; y < height; y += 1) {
        let run = 0;
        let most = 0;
        for (let x = 0; x < width; x += 1) {
          const at = (y * width + x) * 4;
          const isRed = data[at + 3]! > 200 && data[at]! > data[at + 1]! + 60 && data[at]! > data[at + 2]! + 60;
          run = isRed ? run + 1 : 0;
          most = Math.max(most, run);
        }
        if (most > 0) longest.push(most);
      }
      return { longest, scale: canvas.width / canvas.getBoundingClientRect().width };
    });
    expect(red.longest.length).toBeGreaterThan(20);
    // In nearly every row with red in it, no stretch of red is wider than one stripe (plus a pixel of smoothing either side).
    const limit = Math.ceil(3 * red.scale) + 2;
    const striped = red.longest.filter((run) => run <= limit).length;
    expect(striped / red.longest.length).toBeGreaterThan(0.85);
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

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the other formats have no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await open(page);
      for (const name of ['NRZ (2 levels)', 'PAM8 (8 levels)']) {
        await format(page, name).click();
        const { violations } = await new AxeBuilder({ page })
          .include('[data-signal]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`), name).toEqual([]);
      }
    });
  }

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
    await page.goto('/playground/nrz-vs-pam4');
    await expect(page.locator('[data-signal] [data-readout="theory"] .big')).toHaveText('6.4e-4');
    await expect(page.locator('[data-signal] .controls')).toBeHidden();
    await expect(page.locator('[data-signal] canvas:visible')).toHaveCount(0);
    await context.close();
  });
});
