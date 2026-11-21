import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import sharp from 'sharp';
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
  // The neutral line is replaced by a greeting from the visitor's clock: see visitor.spec.ts.
  await expect(page.locator('#top [data-greeting]')).toHaveText(/\S/);
  await expect(page.locator('#top').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', site.links.github);
  await expect(page.locator('#top').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', site.links.linkedin);
  // The address is fetched on request (see email.spec.ts): until then there is a button and no mail link.
  await expect(page.locator('#top').getByRole('link', { name: /email/i })).toHaveCount(0);
  await expect(page.locator('#top').getByRole('button', { name: 'Email' })).toHaveCount(1);
});

test('looking-for line follows the switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-looking-for]')).toHaveCount(site.lookingFor.enabled ? 1 : 0);
  if (site.lookingFor.enabled) await expect(page.locator('[data-looking-for]')).toHaveText(site.lookingFor.text);
});

test('there is no Resume link while the switch is off', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: site.resumeLabel })).toHaveCount(0);
  await expect(page.locator('a[href*="resume"]')).toHaveCount(0);
});

test('with the switch on, a Resume link sits with the other buttons at the top', async ({ page }) => {
  await page.goto('/dev/resume-on');
  const link = page.locator('#top .links').getByRole('link', { name: site.resumeLabel });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/resume.pdf');
  // It opens beside the site, in a new tab, without handing that tab a way back into this one.
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const order = await page.locator('#top .links > li').evaluateAll((items) => items.map((item) => (item as HTMLElement).innerText.trim()));
  expect(order).toEqual(['GitHub', 'LinkedIn', 'Email', site.resumeLabel]);
});

test('a test-only page asks not to be indexed', async ({ page }) => {
  await page.goto('/dev/no-looking-for');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
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

test('the photo fills the width on a phone and is large on a wide screen', async ({ page }) => {
  test.skip(!site.photo, 'site.yaml has no photo');
  // The photo's own size and where its slot sits. The look tilts the photo a
  // little, which widens the box drawn around it but not the photo itself.
  const photoBox = async () => ({
    x: (await page.locator('#top [data-photo-slot]').boundingBox())!.x,
    ...(await page
      .locator('#top [data-photo-slot] img')
      .evaluate((img: HTMLElement) => ({ width: img.offsetWidth, height: img.offsetHeight }))),
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const text = (await page.locator('#top [data-hero-text]').boundingBox())!;
  const narrow = await photoBox();
  expect(Math.abs(narrow.x - text.x)).toBeLessThan(1);
  expect(Math.abs(narrow.width - text.width)).toBeLessThan(1);
  expect(Math.abs(narrow.width - narrow.height)).toBeLessThan(1);

  await page.setViewportSize({ width: 1280, height: 800 });
  const wide = await photoBox();
  expect(Math.round(wide.width)).toBe(352);
  expect(Math.abs(wide.width - wide.height)).toBeLessThan(1);
});

test('a proof item with several details shows each on its own line', async ({ page }) => {
  await page.goto('/');
  const lines = page.locator('#proof li', { hasText: 'Deans’ Honour List' }).locator('[data-detail-line]');
  const years: string[] = parse(readFileSync('src/content/proof.yaml', 'utf8'))['honour-list'].detail;
  expect(years.length).toBeGreaterThan(1);
  await expect(lines).toHaveText(years);
  const tops = await lines.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(years.length);
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
  await expect(page.locator('#proof li').nth(0)).toContainText('People’s Choice');
  await expect(page.locator('#proof li').nth(0)).toContainText('cuHacking 7');
  await expect(page.locator('#proof li').nth(1)).toContainText('Best AI for Environmental Impact');
});

test('each award links where proof.yaml says, or nowhere', async ({ page }) => {
  await page.goto('/');
  const proof = Object.values(parse(readFileSync('src/content/proof.yaml', 'utf8'))) as {
    label: string;
    link?: string;
    order: number;
  }[];
  const items = page.locator('#proof li');
  for (const [index, item] of proof.sort((a, b) => a.order - b.order).entries()) {
    const link = items.nth(index).getByRole('link', { name: item.label });
    await expect(link).toHaveCount(item.link ? 1 : 0);
    if (item.link) await expect(link).toHaveAttribute('href', item.link);
  }
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

/** Where the moving strip is, and how fast it is running (1 is full speed, 0 is stopped). */
const stripState = (page: Page) =>
  page.locator('#skills [data-track]').evaluate((track) => {
    const animation = track.getAnimations()[0];
    return { x: track.getBoundingClientRect().x, rate: animation?.playbackRate ?? null, state: animation?.playState ?? null };
  });
const stopped = async (page: Page) => {
  const { state, rate } = await stripState(page);
  return state === 'paused' || rate === 0;
};
/** Records the strip's speed on every frame until `stopRecording` is called, so a test can see how it changed. */
const startRecording = (page: Page) =>
  page.evaluate(() => {
    const animation = document.querySelector('#skills [data-track]')!.getAnimations()[0]!;
    const rates: number[] = [];
    (window as any).rates = rates;
    (window as any).recording = true;
    const sample = () => {
      rates.push(animation.playState === 'paused' ? 0 : animation.playbackRate);
      if ((window as any).recording) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
const stopRecording = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    (window as any).recording = false;
    return (window as any).rates as number[];
  });

test('skills strip moves, and the pause control stops it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const track = page.locator('#skills [data-track]');
  expect(await track.evaluate((e) => getComputedStyle(e).animationName)).not.toBe('none');
  const before = await stripState(page);
  expect(before.state).toBe('running');
  await expect.poll(async () => (await stripState(page)).x).not.toBe(before.x);
  const pause = page.getByRole('checkbox', { name: 'Pause the skills strip' });
  await pause.check();
  await expect.poll(() => stopped(page)).toBe(true);
  const held = (await stripState(page)).x;
  await page.waitForTimeout(300);
  expect((await stripState(page)).x).toBe(held);
  // Unchecking resumes, while the checkbox still has focus. Done from
  // the keyboard, because Safari does not focus a checkbox that is clicked.
  await pause.focus();
  await page.keyboard.press('Space');
  await expect(pause).not.toBeChecked();
  await expect(pause).toBeFocused();
  await expect.poll(async () => (await stripState(page)).rate).toBe(1);
  await expect.poll(async () => (await stripState(page)).x).not.toBe(held);
});

test('skills strip stops while the pointer is over it, and carries on when it leaves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('[data-skills-viewport]').hover();
  await expect.poll(() => stopped(page)).toBe(true);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await stripState(page)).rate).toBe(1);
  expect((await stripState(page)).state).toBe('running');
});

test('skills strip eases to a stop and back up to speed, rather than jerking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#skills').scrollIntoViewIfNeeded();
  // Recording runs for as long as the change takes, however slow the machine is.
  await startRecording(page);
  await page.locator('[data-skills-viewport]').hover();
  await expect.poll(() => stopped(page)).toBe(true);
  await page.waitForTimeout(100);
  const slowing = await stopRecording(page);
  // Full speed, then at least one speed in between, then stopped: never straight from one to the other.
  expect(slowing[0]).toBe(1);
  expect(slowing.at(-1)).toBe(0);
  expect(slowing.filter((rate) => rate > 0 && rate < 1).length).toBeGreaterThanOrEqual(1);
  for (let index = 1; index < slowing.length; index += 1) expect(slowing[index]!).toBeLessThanOrEqual(slowing[index - 1]!);

  await startRecording(page);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await stripState(page)).rate).toBe(1);
  await page.waitForTimeout(100);
  const rising = await stopRecording(page);
  expect(rising[0]).toBe(0);
  expect(rising.at(-1)).toBe(1);
  expect(rising.filter((rate) => rate > 0 && rate < 1).length).toBeGreaterThanOrEqual(1);
  for (let index = 1; index < rising.length; index += 1) expect(rising[index]!).toBeGreaterThanOrEqual(rising[index - 1]!);
});

test('with scripts off the skills strip still pauses under the pointer', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('[data-skills-viewport]').hover();
  expect(await page.locator('#skills [data-track]').evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
  await context.close();
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

test('every section is in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['top', 'proof', 'experience', 'skills', 'projects', 'more-projects', 'explainers', 'activity', 'about', 'contact']);
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

test('compact rows appear in their set order and link to GitHub', async ({ page }) => {
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

test('a compact row thumbnail shows its whole image unless it is a photo', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#more-projects li[data-category]');
  let whole = 0;
  for (const [index, slug] of more.entries()) {
    const { data } = project(slug);
    if (!data.cover) continue;
    const thumb = rows.nth(index).locator('img');
    // Thumbnails load lazily, so bring each into view and wait for it.
    await thumb.scrollIntoViewIfNeeded();
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const shown = await thumb.evaluate((img: HTMLImageElement) => ({
      ratio: img.naturalWidth / img.naturalHeight,
      fit: getComputedStyle(img).objectFit,
      box: img.clientWidth / img.clientHeight,
    }));
    // Every thumbnail box has the same wide shape, so the text beside them lines up.
    expect(Math.abs(shown.box - 1.6), slug).toBeLessThan(0.05);
    if (data.coverFit !== 'contain') continue;
    whole += 1;
    const source = await sharp(join('src/content/projects', data.cover)).metadata();
    expect(shown.fit, slug).toBe('contain');
    // The file the browser got has the source's shape: nothing was cut off when it was built.
    expect(Math.abs(shown.ratio - source.width / source.height), slug).toBeLessThan(0.03);
  }
  expect(whole).toBeGreaterThan(0);
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
  // Every activity in about.md is shown, name and role.
  const activities = readMarkdown('src/content/about.md').data.activities as { name: string; role: string; link?: string }[];
  const items = page.locator('#about .activities li');
  await expect(items).toHaveCount(activities.length);
  expect(activities.some((activity) => activity.link)).toBe(true);
  for (const [index, activity] of activities.entries()) {
    await expect(items.nth(index)).toContainText(activity.name);
    await expect(items.nth(index)).toContainText(activity.role);
    // An activity with a link shows its name as that link.
    const link = items.nth(index).getByRole('link', { name: activity.name });
    await expect(link).toHaveCount(activity.link ? 1 : 0);
    if (activity.link) await expect(link).toHaveAttribute('href', activity.link);
  }
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

test('contact has GitHub, LinkedIn and an Email button, and no mail link until it is pressed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#contact').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', site.links.github);
  await expect(page.locator('#contact').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', site.links.linkedin);
  // The address is fetched on request: see email.spec.ts.
  await expect(page.locator('#contact').getByRole('button', { name: 'Email' })).toBeVisible();
  await expect(page.locator('#contact a[href^="mail"]')).toHaveCount(0);
  await expect(page.locator('#contact')).toContainText(site.contactNote);
});

test('the profile links come in the same order at the top and in Contact', async ({ page }) => {
  await page.goto('/');
  const hrefs: string[] = Object.values(site.links);
  const order = (scope: string) =>
    page
      .locator(`${scope} a`)
      .evaluateAll((links, wanted) => links.map((a) => a.getAttribute('href')!).filter((href) => wanted.includes(href)), hrefs);
  const top = await order('#top');
  expect(top).toEqual(hrefs);
  expect(await order('#contact')).toEqual(top);
});
