import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { featuredSlugs, moreSlugs, readMarkdown, readProjects } from '../content/helpers';

const site = parse(readFileSync('src/content/site.yaml', 'utf8')).main;
const skills: string[] = parse(readFileSync('src/content/skills.yaml', 'utf8')).main.items;
const projects = readProjects();
const project = (slug: string) => projects.find((p) => p.slug === slug)!;
const featured = featuredSlugs();
const more = moreSlugs();

test('top half has its sections in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids.slice(0, 4)).toEqual(['top', 'proof', 'experience', 'skills']);
});

test('hero shows the name, pitch, school facts and links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Siddig Ahmed');
  await expect(page.locator('h1 [data-name-part="first"]')).toHaveText('Siddig');
  await expect(page.locator('h1 [data-name-part="last"]')).toHaveText('Ahmed');
  await expect(page.getByText(site.pitch)).toBeVisible();
  await expect(page.locator('#top')).toContainText(`GPA ${site.gpa}`);
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
  // Nothing shifts: the space between every pair of neighbours is the same.
  const gaps = await page.locator('#top [data-hero-text] > *').evaluateAll((els) =>
    els.slice(1).map((el, i) => Math.round(el.getBoundingClientRect().top - els[i]!.getBoundingClientRect().bottom)),
  );
  expect(gaps.length).toBeGreaterThan(2);
  expect(new Set(gaps).size).toBe(1);
});

test('the photo slot shows the photo from site.yaml, or a generic placeholder without one', async ({ page }) => {
  await page.goto('/');
  const photo = page.locator('[data-photo-slot] img');
  const placeholder = page.locator('[data-photo-slot] svg');
  const shown = site.photo ? photo : placeholder;
  await expect(shown).toBeVisible();
  await expect(site.photo ? placeholder : photo).toHaveCount(0);
  if (site.photo) {
    await expect(photo).toHaveAttribute('alt', site.photo.alt);
    // It is at the top of the page, so it must not wait to load.
    await expect(photo).toHaveAttribute('fetchpriority', 'high');
    await expect(photo).not.toHaveAttribute('loading', 'lazy');
    expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  } else {
    await expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  }
  const box = await shown.boundingBox();
  expect(box!.width).toBeGreaterThan(80);
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
});

test('with no photo the slot falls back to the placeholder', async ({ page }) => {
  await page.goto('/dev/no-looking-for');
  const placeholder = page.locator('[data-photo-slot] svg');
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-photo-slot] img')).toHaveCount(0);
});

test('the school name stays on one line', async ({ page }) => {
  await page.goto('/');
  const school = page.locator('#top [data-school]');
  await expect(school).toHaveText(site.school);
  expect(await school.evaluate((el) => el.getClientRects().length)).toBe(1);
  await expect(page.locator('#top [data-program]')).toHaveText(site.program);
  // The facts read as separate items, with a space on both sides of each dot.
  await expect(page.locator('#top .facts')).toContainText(`${site.school} · GPA ${site.gpa} · Expected ${site.expectedGraduation}`);
});

test('on a wide screen the photo sits to the right of the text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const text = (await page.locator('#top [data-hero-text]').boundingBox())!;
  const photo = (await page.locator('#top [data-photo-slot]').boundingBox())!;
  expect(photo.x).toBeGreaterThan(text.x + text.width - 1);
});

test('on a phone the photo sits above the name', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const name = (await page.locator('#top h1').boundingBox())!;
  const photo = (await page.locator('#top [data-photo-slot]').boundingBox())!;
  expect(photo.y + photo.height).toBeLessThanOrEqual(name.y);
});

test('a proof item with several details shows each on its own line', async ({ page }) => {
  await page.goto('/');
  const lines = page.locator('#proof li', { hasText: "Deans' Honour List" }).locator('[data-detail-line]');
  await expect(lines).toHaveText(['2023–24', '2024–25', '2025–26']);
  const tops = await lines.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(3);
});

test('/projects leads to the projects section of the home page', async ({ page }) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator('#projects')).toBeVisible();
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

test('the menu lists sections in the order they appear on the page', async ({ page }) => {
  await page.goto('/');
  const targets = await page
    .locator('header nav ul a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!.replace('/#', '')));
  const sections = await page.locator('main > section').evaluateAll((els) => els.map((el) => el.id));
  const positions = targets.map((id) => sections.indexOf(id));
  expect(positions.length).toBeGreaterThan(1);
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test('the skills strip is exactly as wide as the rest of the content', async ({ page }) => {
  await page.goto('/');
  const strip = (await page.locator('[data-skills-viewport]').boundingBox())!;
  const list = (await page.locator('#experience ol').boundingBox())!;
  expect(Math.abs(strip.x - list.x)).toBeLessThan(1);
  expect(Math.abs(strip.width - list.width)).toBeLessThan(1);
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
  const pause = page.getByRole('checkbox', { name: 'Pause the skills strip' });
  await pause.check();
  expect(await track.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
  // Unchecking resumes at once, while the checkbox still has focus.
  await pause.uncheck();
  await expect(pause).toBeFocused();
  expect(await track.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('running');
});

test('skills strip pauses while the pointer is over it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('[data-skills-viewport]').hover();
  expect(await page.locator('#skills [data-track]').evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
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

test('all eight sections are in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['top', 'proof', 'experience', 'skills', 'projects', 'more-projects', 'about', 'contact']);
});

test('featured cards appear in order, each linking to its page', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#projects article');
  const hrefs = await cards.locator('h3 a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(featured.map((slug) => `/projects/${slug}`));
  await expect(cards.locator('img')).toHaveCount(featured.length);
  for (const [index, slug] of featured.entries()) {
    const { data } = project(slug);
    const card = cards.nth(index);
    await expect(card).toContainText(data.oneLiner);
    await expect(card).toContainText(data.result);
    if (data.award) await expect(card).toContainText(`${data.award.name} · ${data.award.event}`);
    await expect(card.getByRole('list', { name: 'Built with' }).getByRole('listitem')).toHaveText(data.stack);
  }
});

test('compact rows appear newest first and link to GitHub', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#more-projects li[data-category]');
  await expect(rows).toHaveCount(more.length);
  const hrefs = await rows.locator('h3 a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(more.map((slug) => project(slug).data.links?.repo).filter(Boolean));
  for (const [index, slug] of more.entries()) {
    const { data } = project(slug);
    const row = rows.nth(index);
    await expect(row.getByRole('list', { name: 'Built with' }).getByRole('listitem')).toHaveText(data.stack);
    // A project with no repository shows its title as plain text.
    await expect(row.locator('h3 a')).toHaveCount(data.links?.repo ? 1 : 0);
    await expect(row.locator('h3')).toHaveText(data.title);
    const live = row.getByRole('link', { name: `Live: ${data.title}` });
    await expect(live).toHaveCount(data.links?.live ? 1 : 0);
    if (data.links?.live) await expect(live).toHaveAttribute('href', data.links.live);
    await expect(row.locator('img')).toHaveCount(data.cover ? 1 : 0);
  }
});

test('some row shows a live link, so the check above is not empty', () => {
  expect(more.some((slug) => project(slug).data.links?.live)).toBe(true);
  expect(more.some((slug) => !project(slug).data.links?.repo)).toBe(true);
  expect(more.some((slug) => !project(slug).data.cover)).toBe(true);
});

test('a row with only required fields renders cleanly', async ({ page }) => {
  await page.goto('/');
  // The barest row on the page: no cover, and ideally no repository or date either.
  const bare = more
    .map((slug) => project(slug).data)
    .filter((data) => !data.cover)
    .sort((a, b) => Object.keys(a).length - Object.keys(b).length)[0]!;
  const row = page.locator('#more-projects li', { hasText: bare.title });
  await expect(row).toHaveCount(1);
  await expect(row.locator('img')).toHaveCount(0);
  await expect(row.locator('h3')).toHaveText(bare.title);
  await expect(row.locator('.category')).not.toBeEmpty();
  await expect(page.locator('a[href=""], a:not([href])')).toHaveCount(0);
  const broken = await page
    .locator('img')
    .evaluateAll((imgs) => imgs.filter((i) => !i.getAttribute('src') || i.getAttribute('alt') === null).length);
  expect(broken).toBe(0);
});

test('every image declares its size so nothing jumps', async ({ page }) => {
  await page.goto('/');
  const unsized = await page
    .locator('img')
    .evaluateAll((imgs) => imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length);
  expect(unsized).toBe(0);
});

test('about shows the bio, activities and the Hack the North caption', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toContainText('Carleton Tennis Club');
  await expect(page.locator('#about')).toContainText('Hack the North 2026, Waterloo');
  // Every photo in about.md is shown with its caption, side by side when there are several.
  const photos = readMarkdown('src/content/about.md').data.photos as { alt: string; caption: string }[];
  const figures = page.locator('#about figure');
  await expect(figures).toHaveCount(photos.length);
  for (const [index, photo] of photos.entries()) {
    await expect(figures.nth(index).locator('img')).toHaveAttribute('alt', photo.alt);
    await expect(figures.nth(index).locator('figcaption')).toHaveText(photo.caption);
  }
  if (photos.length > 1) {
    const first = (await figures.nth(0).boundingBox())!;
    const second = (await figures.nth(1).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(second.x).toBeGreaterThan(first.x + first.width - 1);
  }
});

test('contact has GitHub and LinkedIn and no email control', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#contact').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', site.links.github);
  await expect(page.locator('#contact').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', site.links.linkedin);
  await expect(page.locator('#contact').getByText(/email/i)).toHaveCount(0);
  await expect(page.locator('#contact')).toContainText(site.contactNote);
});
