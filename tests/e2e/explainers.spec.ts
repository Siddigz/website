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

test('every explainer card carries a small drawing of what it explains', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#explainers article');
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
    page.locator('#explainers article svg').first().evaluate((drawing) => {
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
    const { violations } = await new AxeBuilder({ page }).include('#explainers').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
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

  test('at the server the removed headers are struck through, not faded: their text keeps its full contrast', async ({ page }) => {
    const widget = await open(page);
    for (let step = 0; step < 10; step += 1) await next(page).click();
    for (const name of ['eth', 'ip']) {
      const segment = widget.locator(`[data-seg="${name}"]`);
      await expect(segment).toHaveAttribute('data-gone', '');
      // An automated scan does not see text faded by its container, so it is checked here.
      const style = await segment.evaluate((element) => {
        const computed = getComputedStyle(element);
        return { opacity: computed.opacity, line: computed.textDecorationLine };
      });
      expect(style.opacity).toBe('1');
      expect(style.line).toContain('line-through');
    }
    await reset(page).click();
    await expect(widget.locator('[data-gone]')).toHaveCount(0);
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

  const route = (page: Page) => page.getByRole('list', { name: 'Network path from a laptop to a web server' });
  /** How far the packet's middle is from the middle of a stop's drawing, up and down. */
  const offBy = (page: Page, stop: number) =>
    page.locator('[data-packet]').evaluate((widget, index) => {
      const middle = (element: Element) => {
        const box = element.getBoundingClientRect();
        return box.top + box.height / 2;
      };
      const mark = widget.querySelectorAll('[data-stop]')[index]!.querySelector('.mark')!;
      return Math.abs(middle(widget.querySelector('[data-token] .layers')!) - middle(mark));
    }, stop);

  test('the route is a list of the eleven stops, top to bottom, with real text', async ({ page }) => {
    await open(page);
    const stops = route(page).getByRole('listitem');
    await expect(stops).toHaveCount(11);
    await expect(stops.first()).toContainText('Laptop');
    await expect(stops.nth(3)).toContainText('Optical modem (ISP end)');
    await expect(stops.last()).toContainText('Web server');
    await expect(route(page)).toContainText('~450 km fiber');
    const boxes = await stops.evaluateAll((items) => items.map((item) => item.getBoundingClientRect()).map((box) => ({ top: box.top, left: box.left })));
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]!.top).toBeGreaterThan(boxes[index - 1]!.top);
      expect(boxes[index]!.left).toBe(boxes[0]!.left);
    }
    // The little drawings and the packet are decoration: the words carry everything.
    expect(await route(page).locator('svg:not([aria-hidden="true"])').count()).toBe(0);
    await expect(route(page).locator('[data-token]')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the packet sits beside the stop it is at, and that stop is marked as the current one', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const current = route(page).locator('[aria-current="step"]');
    for (let step = 0; step <= 10; step += 1) {
      await expect(caption(page)).toContainText(`Step ${step} of 10`);
      await expect(current).toHaveCount(1);
      expect(await route(page).getByRole('listitem').evaluateAll((items) => items.findIndex((item) => item.getAttribute('aria-current') === 'step'))).toBe(step);
      expect(await offBy(page, step)).toBeLessThanOrEqual(2);
      if (step < 10) await next(page).click();
    }
    await previous(page).click();
    expect(await offBy(page, 9)).toBeLessThanOrEqual(2);
    await reset(page).click();
    expect(await offBy(page, 0)).toBeLessThanOrEqual(2);
    await expect(current).toContainText('Laptop');
  });

  test('the packet glides down to the next stop, in no more than 300 ms', async ({ page }) => {
    await open(page);
    const token = page.locator('[data-packet] [data-token]');
    const y = () => token.evaluate((element) => element.getBoundingClientRect().y);
    const start = await y();
    await next(page).click();
    await expect.poll(y).toBeGreaterThan(start + 20);
    await expect.poll(() => offBy(page, 1)).toBeLessThanOrEqual(2);
    const duration = await token.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(0.3);
  });

  test('the packet stays with its stop when the screen changes width', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    for (let step = 0; step < 6; step += 1) await next(page).click();
    expect(await offBy(page, 6)).toBeLessThanOrEqual(2);
    await page.setViewportSize({ width: 320, height: 640 });
    await expect.poll(() => offBy(page, 6)).toBeLessThanOrEqual(2);
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`nothing has to be scrolled sideways to follow the packet (${width} wide)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      // Nothing in the explainer is wider than the room it has. On a phone the history table alone may scroll in its own box.
      const wide = await page.locator('[data-packet]').evaluate((widget, phone) => {
        const table = widget.querySelector('.table-scroll')!;
        return [widget, ...widget.querySelectorAll('*')]
          .filter((element) => !(phone && (element === table || table.contains(element))))
          .filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== 'visible')
          .map((element) => element.className);
      }, width < 768);
      expect(wide).toEqual([]);
      const edges = await page.locator('[data-packet]').evaluate((widget) => {
        const outer = widget.getBoundingClientRect();
        return [...widget.querySelectorAll('.route *, .caption *, .bar *, .cards *')].filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.left < outer.left - 1 || box.right > outer.right + 1);
        }).length;
      });
      expect(edges).toBe(0);
      // The route's smallest words are still a readable size.
      const smallest = await route(page).locator('.name, .detail, .stretch').evaluateAll((words) => Math.min(...words.map((word) => parseFloat(getComputedStyle(word).fontSize))));
      expect(smallest).toBeGreaterThanOrEqual(12);
    });
  }

  test('on a wide screen the route stands beside the words; on a phone they are stacked', async ({ page }) => {
    const boxes = async () => ({
      route: (await route(page).boundingBox())!,
      caption: (await caption(page).boundingBox())!,
      next: (await next(page).boundingBox())!,
      bar: (await page.locator('[data-packet] .bar').boundingBox())!,
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    let at = await boxes();
    expect(at.route.x + at.route.width).toBeLessThanOrEqual(at.caption.x);
    expect(Math.abs(at.route.y - at.caption.y)).toBeLessThanOrEqual(2);
    expect(at.bar.x).toBeGreaterThan(at.route.x + at.route.width);
    await page.setViewportSize({ width: 390, height: 800 });
    at = await boxes();
    // In reading order: what is happening, the buttons, the packet's headers, then the route.
    expect(at.caption.y + at.caption.height).toBeLessThanOrEqual(at.next.y);
    expect(at.next.y + at.next.height).toBeLessThanOrEqual(at.bar.y);
    expect(at.bar.y + at.bar.height).toBeLessThanOrEqual(at.route.y);
    expect(Math.abs(at.route.x - at.caption.x)).toBeLessThanOrEqual(2);
  });

  for (const size of [{ width: 1280, height: 680 }, { width: 1440, height: 800 }, { width: 768, height: 1024 }]) {
    test(`on a ${size.width} by ${size.height} screen the caption, the buttons and the headers stay in view all the way down the route`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize(size);
      await open(page);
      const header = (await page.locator('.site-header').boundingBox())!;
      // Past the page's title, to where the explainer itself starts.
      await page.locator('[data-packet]').evaluate((widget) => widget.scrollIntoView({ block: 'start' }));
      for (let step = 0; step <= 10; step += 1) {
        // Follow the packet, as a visitor would: bring the stop it is at into view.
        await route(page).getByRole('listitem').nth(step).evaluate((stop) => stop.scrollIntoView({ block: 'nearest' }));
        await expect(route(page).locator('[data-token] .layers')).toBeInViewport({ ratio: 1 });
        for (const part of [caption(page), next(page), page.locator('[data-packet] .bar')]) {
          await expect(part).toBeInViewport({ ratio: 1 });
          // And not tucked under the header.
          expect((await part.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height);
        }
        if (step < 10) await next(page).click();
      }
    });
  }

  test('on a short, wide screen nothing is pinned, so everything can still be reached', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await open(page);
    expect(await page.locator('[data-packet] .side').evaluate((side) => getComputedStyle(side).position)).not.toBe('sticky');
  });

  for (const width of [320, 1280]) {
    test(`the buttons never move as the caption changes (${width} wide)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      const places = new Set<number>();
      for (let step = 0; step <= 10; step += 1) {
        places.add(Math.round((await next(page).boundingBox())!.y + (await page.evaluate(() => scrollY))));
        if (step < 10) await next(page).click();
      }
      expect([...places]).toHaveLength(1);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const steps of [1, 10]) {
      test(`step ${steps} has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await open(page);
        for (let step = 0; step < steps; step += 1) await next(page).click();
        await expect(caption(page)).toContainText(`Step ${steps} of 10`);
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

  test('with scripts off the whole journey is in the table, and the buttons are not offered', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/explainers/one-packet-hop-by-hop');
    await expect(page.locator('[data-packet] tbody tr:visible')).toHaveCount(11);
    await expect(page.locator('[data-packet] .controls')).toBeHidden();
    // The route still reads, with the packet at the laptop.
    await expect(page.getByRole('list', { name: 'Network path from a laptop to a web server' }).getByRole('listitem')).toHaveCount(11);
    await expect(page.locator('[data-packet] [aria-current="step"]')).toContainText('Laptop');
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
    await page.goto('/explainers/nrz-vs-pam4');
    await expect(page.locator('[data-signal] [data-readout="theory"] .big')).toHaveText('6.4e-4');
    await expect(page.locator('[data-signal] .controls')).toBeHidden();
    await expect(page.locator('[data-signal] canvas:visible')).toHaveCount(0);
    await context.close();
  });
});
