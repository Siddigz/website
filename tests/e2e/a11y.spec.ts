import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pagePaths } from '../content/helpers';

// Automated WCAG 2.2 AA checks. These catch a share of accessibility
// problems (contrast, names, roles, landmarks), not all of them.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const pages = [...pagePaths().slice(0, 2), '/does-not-exist'];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const path of pages) {
    test(`${path} has no detectable accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`)).toEqual([]);
    });
  }
}
