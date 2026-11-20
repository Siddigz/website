/*
 * Stage 2: three looks to choose from, and the preview-only switcher.
 * This file goes when one look is chosen.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEFAULT_LOOK, LOOKS, LOOK_LABELS, type Look } from '../../src/lib/look';
import { featuredSlugs } from '../content/helpers';

const projectPath = `/projects/${featuredSlugs()[0]}`;
const look = (page: Page) => page.evaluate(() => document.documentElement.dataset.look);
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const switcher = (page: Page) => page.getByRole('group', { name: 'Preview look' });
const option = (page: Page, name: Look) => switcher(page).getByRole('button', { name: LOOK_LABELS[name], exact: true });

// A family name as the browser reports it, without quotes or Astro's hash suffix.
const headingFamily = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily.split(',')[0]!.replace(/["']/g, '').replace(/-[0-9a-f]{16}$/, ''));

const HEADING_FONT: Record<Look, string> = {
  crisp: 'Geist',
  warm: 'Bricolage Grotesque',
  editorial: 'Fraunces',
};

test.describe('the switcher', () => {
  test('offers the three looks and starts on the default', async ({ page }) => {
    await page.goto('/');
    await expect(switcher(page).getByRole('button')).toHaveText(LOOKS.map((name) => LOOK_LABELS[name]));
    expect(await look(page)).toBe(DEFAULT_LOOK);
    await expect(option(page, DEFAULT_LOOK)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a click changes the look, and the choice survives a reload and a new page', async ({ page }) => {
    await page.goto('/');
    const before = await background(page);
    await option(page, 'warm').click();
    expect(await look(page)).toBe('warm');
    await expect(option(page, 'warm')).toHaveAttribute('aria-pressed', 'true');
    await expect(option(page, DEFAULT_LOOK)).toHaveAttribute('aria-pressed', 'false');
    expect(await background(page)).not.toBe(before);
    await page.reload();
    expect(await look(page)).toBe('warm');
    await expect(option(page, 'warm')).toHaveAttribute('aria-pressed', 'true');
    await page.goto(projectPath);
    expect(await look(page)).toBe('warm');
  });

  test('works from the keyboard', async ({ page }) => {
    await page.goto('/');
    await option(page, 'editorial').focus();
    await page.keyboard.press('Enter');
    expect(await look(page)).toBe('editorial');
  });

  test('the address can name a look, and that choice carries to the next page', async ({ page }) => {
    await page.goto('/?look=editorial');
    expect(await look(page)).toBe('editorial');
    await expect(option(page, 'editorial')).toHaveAttribute('aria-pressed', 'true');
    await page.goto(projectPath);
    expect(await look(page)).toBe('editorial');
  });

  test('an unknown look in the address or in storage gives the default', async ({ page }) => {
    await page.goto('/?look=nope');
    expect(await look(page)).toBe(DEFAULT_LOOK);
    await page.evaluate(() => localStorage.setItem('look', 'a-look-that-was-deleted'));
    await page.goto('/');
    expect(await look(page)).toBe(DEFAULT_LOOK);
    await expect(option(page, DEFAULT_LOOK)).toHaveAttribute('aria-pressed', 'true');
  });

  test('blocked storage still switches for this visit', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await option(page, 'warm').click();
    expect(await look(page)).toBe('warm');
    expect(errors).toEqual([]);
  });

  test('never covers the end of the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastLink = page.locator('#contact a').last();
    const bar = await switcher(page).boundingBox();
    const link = await lastLink.boundingBox();
    expect(link!.y + link!.height).toBeLessThanOrEqual(bar!.y);
  });

  test('with JavaScript off the default look renders', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/?look=warm');
    await expect(page.locator('html')).toHaveAttribute('data-look', DEFAULT_LOOK);
    await expect(page.locator('h1')).toBeVisible();
    await context.close();
  });
});

test.describe('the nav shows the current section', () => {
  test('no section is current at the top, and Projects is current once scrolled to', async ({ page }) => {
    await page.goto('/');
    const current = page.locator('.site-header a[aria-current="true"]');
    await expect(current).toHaveCount(0);
    await page.locator('#projects').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('#projects')!.scrollIntoView({ block: 'start' }));
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Projects');
  });

  test('project pages mark no section as current', async ({ page }) => {
    await page.goto(projectPath);
    await expect(page.locator('.site-header a[aria-current="true"]')).toHaveCount(0);
  });
});

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const name of LOOKS) {
  test.describe(`look: ${name}`, () => {
    test('uses its own heading font, served by this site', async ({ page }) => {
      const fontRequests: string[] = [];
      page.on('request', (request) => {
        if (request.resourceType() === 'font') fontRequests.push(request.url());
      });
      await page.goto(`/?look=${name}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await headingFamily(page)).toBe(HEADING_FONT[name]);
      const loaded = await page.evaluate(() => {
        const family = getComputedStyle(document.querySelector('h1')!).fontFamily.split(',')[0]!.trim();
        return document.fonts.check(`700 32px ${family}`);
      });
      expect(loaded).toBe(true);
      expect(fontRequests.length).toBeGreaterThan(0);
      for (const url of fontRequests) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    });

    test('differs from the other looks', async ({ page }) => {
      await page.goto(`/?look=${name}`);
      const mine = await background(page);
      for (const other of LOOKS.filter((candidate) => candidate !== name)) {
        await page.goto(`/?look=${other}`);
        expect(await background(page), `${name} vs ${other}`).not.toBe(mine);
      }
    });

    test('nothing overflows sideways', async ({ page }) => {
      for (const path of ['/', projectPath]) {
        await page.goto(`${path}?look=${name}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });

    test('with reduced motion nothing keeps moving', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/?look=${name}`);
      await page.waitForTimeout(300);
      const running = await page.evaluate(() =>
        document.getAnimations().filter((animation) => animation.playState === 'running').length,
      );
      expect(running).toBe(0);
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      for (const path of ['/', projectPath]) {
        test(`${path} has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
          await page.emulateMedia({ colorScheme });
          await page.goto(`${path}?look=${name}`);
          const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
        });
      }
    }

    test('every section title and card title is readable in both themes', async ({ page }) => {
      // Text drawn over a gradient or image is skipped by the automated contrast check, so
      // make sure no look hides a heading by painting it transparent without a clipped background.
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(`/?look=${name}`);
        const invisible = await page.locator('h1, h2.section-title, h3').evaluateAll((els) =>
          els
            .filter((el) => {
              const style = getComputedStyle(el);
              const transparent = style.color === 'rgba(0, 0, 0, 0)' || style.webkitTextFillColor === 'rgba(0, 0, 0, 0)';
              return transparent && !style.backgroundClip.includes('text');
            })
            .map((el) => el.textContent),
        );
        expect(invisible, colorScheme).toEqual([]);
      }
    });
  });
}
