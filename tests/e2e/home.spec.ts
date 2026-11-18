import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const site = parse(readFileSync('src/content/site.yaml', 'utf8')).main;
const skills: string[] = parse(readFileSync('src/content/skills.yaml', 'utf8')).main.items;

test('top half has its sections in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids.slice(0, 4)).toEqual(['top', 'proof', 'skills', 'experience']);
});

test('hero shows the name, pitch, school facts and links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1 [data-name-part="first"]')).toHaveText('Siddig');
  await expect(page.locator('h1 [data-name-part="last"]')).toHaveText('Ahmed');
  await expect(page.getByText(site.pitch)).toBeVisible();
  await expect(page.locator('#top')).toContainText('3.85/4.00');
  await expect(page.locator('#top')).toContainText('April 2028');
  await expect(page.locator('#top [data-greeting]')).toHaveText('Hello, and welcome.');
  await expect(page.locator('#top').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', site.links.github);
  await expect(page.locator('#top').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', site.links.linkedin);
  await expect(page.locator('#top').getByRole('link', { name: /email/i })).toHaveCount(0);
  await expect(page.locator('#top').getByRole('button', { name: /email/i })).toHaveCount(0);
});

test('looking-for line follows the switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-looking-for]')).toHaveCount(site.lookingFor.enabled ? 1 : 0);
  if (site.lookingFor.enabled) await expect(page.locator('[data-looking-for]')).toHaveText(site.lookingFor.text);
});

test('with the switch off the line is gone and leaves no gap', async ({ page }) => {
  await page.goto('/dev/no-looking-for');
  await expect(page.locator('#top h1')).toBeVisible();
  await expect(page.locator('[data-looking-for]')).toHaveCount(0);
  const empties = await page
    .locator('#top [data-hero-text] > *')
    .evaluateAll((els) => els.filter((e) => !e.textContent?.trim()).length);
  expect(empties).toBe(0);
});

test('the photo slot takes no space while there is no photo', async ({ page }) => {
  await page.goto('/');
  const box = await page.locator('[data-photo-slot]').boundingBox();
  expect(box === null || box.width === 0 || box.height === 0).toBe(true);
});

test('experience lists three roles and no descriptions', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#experience li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Embedded Software Engineering Intern');
  await expect(rows.nth(0)).toContainText('Modem Control Software');
  await expect(rows.nth(0)).toContainText('Sep 2026 – Present');
  await expect(rows.nth(1)).toContainText('Jan 2026 – Aug 2026');
  await expect(page.locator('#experience p')).toHaveCount(0);
});

test('proof strip shows the awards as worded', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#proof li')).toHaveCount(5);
  await expect(page.locator('#proof li').nth(0)).toContainText("People's Choice");
  await expect(page.locator('#proof li').nth(0)).toContainText('cuHacking 7');
  await expect(page.locator('#proof li').nth(1)).toContainText('Best AI for Environmental Impact');
});

test('skills strip lists every skill once for assistive tech', async ({ page }) => {
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Skills' });
  await expect(list.getByRole('listitem')).toHaveText(skills);
  await expect(page.locator('#skills [aria-hidden="true"]')).toHaveCount(1);
});

test('skills strip moves, and the pause control stops it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const track = page.locator('#skills [data-track]');
  expect(await track.evaluate((e) => getComputedStyle(e).animationName)).not.toBe('none');
  expect(await track.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('running');
  await page.getByRole('checkbox', { name: 'Pause the skills strip' }).check();
  expect(await track.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
});

test('skills strip is still under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const running = await page
    .locator('#skills *')
    .evaluateAll((els) => els.some((e) => getComputedStyle(e).animationName !== 'none'));
  expect(running).toBe(false);
  await expect(page.locator('#skills [aria-hidden="true"]')).toBeHidden();
  await expect(page.getByRole('checkbox', { name: 'Pause the skills strip' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Skills' }).getByRole('listitem').last()).toBeVisible();
});
