# Website Revamp, Stage 1: Structure and Content. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old single-file site on the `revamp` branch with an Astro site that shows the real home page and six brief project pages in a neutral, token-driven look, live on a Vercel preview address.

**Architecture:** A fully prerendered Astro site. All content lives in typed files under `src/content/` and is validated at build time. Every visual value is a design token, so stage 2 can swap the look without touching components. No server functions and no client framework in this stage.

**Tech Stack:** Astro 7, TypeScript 6 (strict), plain CSS with custom properties, Vitest 5, Playwright, sharp, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-16-website-revamp-design.md`. Read it before starting. This plan implements its sections 6, 7, 10, 11 and the parts of 8 listed under "In this stage".

## Stages

This is stage 1 of three. Each ends in something the owner can look at.

| Stage | Delivers | Plan |
|---|---|---|
| 1 | Structure, real content, project pages, neutral look, preview address | This document |
| 2 | Two or three visual directions; the chosen look applied | Written after stage 1 is reviewed |
| 3 | Interactive features, explainers, email and resume functions, GitHub activity, preview cards, ship | Written after the look is chosen |

**In this stage:** home page sections, "looking for" switch, skills strip, light and dark mode, project pages, 404, content model, checks, CI.

**Not in this stage (do not build):** name audio, per-visitor greeting text, welcome back, email reveal, resume download, project filter, command menu, GitHub activity, explainers, page transitions, the animated current-section indicator in the nav, preview images, sitemap, analytics, the Vercel adapter, the measured speed score. The Email button and the Explainers and GitHub activity sections are simply absent until stage 3. Stage 1 enforces the JavaScript budget and the no-third-party rule; the full speed measurement is a stage 3 ship check.

**Carried forward:** the test-only page `/dev/no-looking-for` (Task 6) must be removed or excluded from the production build before ship. Stage 3's plan owns that.

## Global Constraints

Copied from the spec's rules. Every task's requirements include these.

- The repo is public. No email address anywhere in the repo or the built site. No real resume. No secrets.
- Only public repositories under `https://github.com/Siddigz/` are linked. The list of projects left off the site is in the git-ignored `CLAUDE.local.md`; read it before writing content, and never copy it into a committed file.
- Experience entries have organisation, title, team and dates. No description.
- No employer or vendor product names in project text.
- Awards are worded exactly as given in the spec's section 11. Attendance is never worded as a win.
- Pages are prerendered. No page waits on a client-side fetch to show content.
- Home page JavaScript: at most 60 KB compressed.
- No third-party requests are needed to render a page. Stage 1 uses the system font stack; no font files and no font CDN.
- Images have `width`, `height` and `alt`, and are served through Astro's image components.
- Every photo has its location and camera metadata stripped before it is committed (use `scripts/import-photo.mjs`, Task 4).
- Scrolling is never altered. Every animation is optional: with animations off or reduced motion set, all content reads and all controls work. Interface transitions are 300 ms or less.
- Everything works with a keyboard, with visible focus. Text contrast meets WCAG AA in both themes.
- TypeScript strict. All colour, type, spacing and motion values are tokens in `src/styles/tokens.css`; no raw values in components.
- Content is never hard-coded in a component. It comes from `src/content/`.
- Use the `modern-web-guidance` skill before writing HTML, CSS or browser JavaScript.
- Work only on the `revamp` branch. Never push to `main`. Commit messages carry no AI attribution.
- Project body text: at most 120 words, under exactly three headings: `## Problem`, `## What I built`, `## Result`.
- Astro 7 specifics (verified against the docs on 2026-11-16): content config is `src/content.config.ts`; import `defineCollection` from `astro:content`, `glob` and `file` from `astro/loaders`, `z` from `astro/zod`; render a Markdown body with `render(entry)` from `astro:content`; images use `Image` and `Picture` from `astro:assets`; unclosed tags are build errors. `@astrojs/check` requires TypeScript `^5 || ^6`, so pin `typescript@^6`. Node 22.23.4 or newer.

## Review Focus

Conditions the spec implies that are easy to miss. Each has a test in the task named.

1. **JavaScript is off.** Every section and every project page still shows all its content, and the theme follows the system. (Task 7)
2. **A 320 px wide phone.** No horizontal page scroll anywhere, including beside the moving skills strip and long project titles. (Task 7)
3. **Browser storage is blocked** (private mode throws on access). The page renders and the theme toggle still works for that visit. (Task 2)
4. **A project with only the required fields** (no live link, video, award or cover). Its row renders with no empty badge, no empty link and no broken image. (Task 6)
5. **The "looking for" switch is off.** The line is gone and nothing in the top shifts or leaves a gap. (Task 5)

## File Structure

```
astro.config.mjs            site URL, image defaults
package.json  tsconfig.json  vercel.json
vitest.config.ts  playwright.config.ts
CLAUDE.md                   the rules and the add-a-project recipe
.github/workflows/ci.yml
scripts/import-photo.mjs    resize + strip metadata
src/
  content.config.ts         collection definitions
  content/
    schemas.ts              zod schemas (unit-testable)
    site.yaml  experience.yaml  proof.yaml  skills.yaml  about.md
    projects/<slug>.md      13 files
  assets/
    logos/                  moved from assets/logos
    projects/<slug>/        covers and gallery images
    about/                  event photos
  lib/
    projects.ts             ordering helpers
    text.ts                 wordCount
    theme.ts                stored-scheme helpers
  styles/tokens.css  styles/base.css
  layouts/BaseLayout.astro
  components/
    Nav.astro  ThemeToggle.astro
    Hero.astro  ProofStrip.astro  SkillsStrip.astro  Experience.astro
    ProjectCard.astro  ProjectRow.astro  About.astro  Contact.astro
  pages/index.astro  pages/projects/[slug].astro  pages/404.astro
tests/
  unit/      theme, projects, text, schemas, import-photo
  content/   projects, privacy, copy
  build/     budget
  e2e/       smoke, theme, home, project-pages, robustness, links
```

---

### Task 1: Scaffold the Astro project

**Files:**
- Delete: `index.html`, `style.css`, `app.js`, `assets/images/profile.jpg` (they stay on `main`)
- Move: `assets/logos/*` to `src/assets/logos/`
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vercel.json`, `playwright.config.ts`, `vitest.config.ts`, `src/pages/index.astro`, `CLAUDE.md`, `tests/e2e/smoke.spec.ts`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `.astro/`, `test-results/`, `playwright-report/`)
- Modify (local, untracked): `.claude/launch.json` to run `npm run dev` on port 4321

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `check` (`astro check`), `test` (`vitest run tests/unit tests/content`), `test:build` (`vitest run tests/build`), `test:e2e` (`playwright test`). Playwright serves the built site at `http://localhost:4321` via `webServer: { command: 'npm run build && npm run preview -- --port 4321' }` and has two projects: `desktop` (1280×800) and `phone` (375×812).

- [ ] **Step 1: Install.** `npm init -y`, then `npm install astro@^7` and `npm install -D typescript@^6 @astrojs/check vitest@^5 @playwright/test yaml sharp`, then `npx playwright install chromium`. Set `"type": "module"`, `"private": true` and `"engines": { "node": ">=22.23.4" }` in `package.json`.

- [ ] **Step 2: Write the failing test** in `tests/e2e/smoke.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('home page is served', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Siddig Ahmed');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

- [ ] **Step 3: Run it.** `npm run test:e2e`. Expected: FAIL, the build has no pages.

- [ ] **Step 4: Create the config and a placeholder page.**
  - `astro.config.mjs`: `defineConfig({ site: 'https://siddigz.com', image: { layout: 'constrained', responsiveStyles: true } })`.
  - `tsconfig.json`: `{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"] }`.
  - `vercel.json`: `{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "astro", "installCommand": "npm ci", "buildCommand": "npm run build", "outputDirectory": "dist" }`.
  - `src/pages/index.astro`: a valid HTML document with `<html lang="en">` and `<title>Siddig Ahmed</title>`.

- [ ] **Step 5: Write `CLAUDE.md`.** Copy every rule from the spec's section 10 and the "Adding a project" recipe from section 12, verbatim. Add one line at the top: "Design: `docs/superpowers/specs/2026-11-16-website-revamp-design.md`. Private notes: `CLAUDE.local.md` (git-ignored)."

- [ ] **Step 6: Run.** `npm run test:e2e` and `npm run check`. Expected: PASS, and 0 errors.

- [ ] **Step 7: Commit.** `git add -A && git commit -m "Scaffold the Astro project and remove the old site files"`

---

### Task 2: Tokens, base layout, theme and navigation

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/layouts/BaseLayout.astro`, `src/components/Nav.astro`, `src/components/ThemeToggle.astro`, `src/lib/theme.ts`, `src/pages/404.astro`
- Modify: `src/pages/index.astro` (use the layout)
- Test: `tests/unit/theme.test.ts`, `tests/e2e/theme.spec.ts`

**Interfaces:**
- Produces:
  - `BaseLayout.astro` props: `{ title: string; description: string; path: string }`. It renders `<title>`, the description, `<link rel="canonical" href={new URL(path, Astro.site)}>`, the nav, a `<main id="main">` slot, and a skip link to `#main`.
  - `src/lib/theme.ts`: `type Scheme = 'light' | 'dark'`; `STORAGE_KEY = 'color-scheme'` (the old site's key, so returning visitors keep their choice); `readStoredScheme(storage: Pick<Storage, 'getItem'> | undefined): Scheme | null`; `nextScheme(current: Scheme): Scheme`.
  - The chosen scheme is the `data-theme` attribute on `<html>`. Absent means follow the system.
  - `Nav.astro`: links to `/#projects`, `/#experience`, `/#about`, and the toggle, a `<button>` with accessible name "Switch to dark theme" or "Switch to light theme".
  - Token names later tasks use: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--font-sans`, `--font-mono`, `--text-sm|base|lg|xl|2xl|3xl`, `--space-1` to `--space-8`, `--radius-sm|md|lg`, `--duration-fast` (150ms), `--duration-base` (250ms), `--ease-out`, `--content-width` (72rem), `--gutter`.

- [ ] **Step 1: Write the failing unit test** in `tests/unit/theme.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readStoredScheme, nextScheme } from '../../src/lib/theme';

describe('readStoredScheme', () => {
  it('returns a stored valid scheme', () => {
    expect(readStoredScheme({ getItem: () => 'dark' })).toBe('dark');
  });
  it('ignores anything else', () => {
    expect(readStoredScheme({ getItem: () => 'purple' })).toBeNull();
    expect(readStoredScheme({ getItem: () => null })).toBeNull();
  });
  it('returns null when storage is missing or throws', () => {
    expect(readStoredScheme(undefined)).toBeNull();
    expect(readStoredScheme({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});

it('nextScheme flips', () => {
  expect(nextScheme('light')).toBe('dark');
  expect(nextScheme('dark')).toBe('light');
});
```

- [ ] **Step 2: Write the failing e2e test** in `tests/e2e/theme.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('toggle switches the theme and it survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('no stored choice follows the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe(bgLight);
});

test('blocked storage does not break the page or the toggle', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('unknown address shows the not-found page', async ({ page }) => {
  const response = await page.goto('/nope');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
});
```

- [ ] **Step 3: Run.** `npm test && npm run test:e2e`. Expected: FAIL, modules and elements missing.

- [ ] **Step 4: Implement.**
  - `tokens.css`: every token named above. Colours use `light-dark()` with `color-scheme: light dark` on `:root`; `:root[data-theme="light"] { color-scheme: light }` and the same for dark. Neutral greys and one accent; this is the placeholder look.
  - `base.css`: reset, body type, focus ring, `.container` (max `--content-width`, side padding `--gutter`), skip link, `@media (prefers-reduced-motion: reduce)` setting animation and transition durations to near zero.
  - `BaseLayout.astro`: an inline `<script is:inline>` in `<head>` that applies a stored scheme to `<html data-theme>` before first paint, inside try/catch. `<meta name="color-scheme" content="light dark">`.
  - `ThemeToggle.astro`: a button plus a module script using `theme.ts`. It writes to storage inside try/catch and always updates `data-theme` and its own accessible name.
  - `404.astro`: heading, one line, a "Back to home" link.

- [ ] **Step 5: Run.** `npm test && npm run test:e2e && npm run check`. Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -am "Add design tokens, base layout, theme toggle, nav and 404"` (add new files first).

---

### Task 3: Content schemas and collections

**Files:**
- Create: `src/content/schemas.ts`, `src/content.config.ts`
- Test: `tests/unit/schemas.test.ts`

**Interfaces:**
- Produces, from `src/content/schemas.ts`:
  - `CATEGORIES = ['web-apps', 'ai-data', 'systems'] as const`; `type Category`; `CATEGORY_LABELS: Record<Category, string>` = `Web & apps`, `AI & data`, `Systems`.
  - `projectSchema(image: () => z.ZodType)`: fields
    `title`, `oneLiner` (strings); `category` (enum); `stack` (string[], min 1); `date` (`YYYY-MM`); `links: { repo, extraRepos?: string[], live?, video? }` where `repo` and each `extraRepos` item must start with `https://github.com/Siddigz/`; `featured?` (positive int); `result?`; `award?: { name, event }`; `cover?: image()`; `coverAlt?`; `gallery?: { src: image(), alt: string }[]`.
    Rules: `featured` set requires `result`, `cover` and `coverAlt`. `cover` set requires `coverAlt`.
  - `experienceSchema`: `organisation`, `title`, `team`, `start` (`YYYY-MM`), `end?` (`YYYY-MM`, absent means present), `logo?: 'ciena' | 'carleton'`, `order` (number), `id?`. Strict: unknown keys are an error, so a `description` cannot be added.
  - `proofSchema`: `label`, `detail`, `link?` (URL), `order`, `id?`.
  - `skillsSchema`: `items` (string[], min 1), `id?`.
  - `siteSchema`: `url`, `name: { first, last }`, `pitch`, `lookingFor: { enabled: boolean, text: string }`, `school`, `gpa`, `expectedGraduation`, `links: { github, linkedin }`, `home: { city, timeZone }`, `id?`.
  - `aboutSchema`: `title`.
- Produces, from `src/content.config.ts`: collections `projects` (`glob({ pattern: '*.md', base: './src/content/projects' })`), `about` (`glob` matching `about.md` in `./src/content`), and `experience`, `proof`, `skills`, `site` (each `file('src/content/<name>.yaml')`). All four YAML files are objects keyed by entry id. `skills.yaml` and `site.yaml` hold one entry with id `main`. Entry ids for projects are the file slugs. `schemas.ts` imports only `astro/zod`, never `astro:content`, so Vitest can load it.

- [ ] **Step 1: Write the failing test** in `tests/unit/schemas.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { projectSchema, experienceSchema } from '../../src/content/schemas';

const schema = projectSchema(() => z.string());
const base = {
  title: 'X', oneLiner: 'Does X.', category: 'web-apps', stack: ['TypeScript'],
  date: '2026-01', links: { repo: 'https://github.com/Siddigz/x' },
};

describe('projectSchema', () => {
  it('accepts a project with only required fields', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it('rejects an unknown category', () => {
    expect(schema.safeParse({ ...base, category: 'games' }).success).toBe(false);
  });
  it('rejects a repo outside the owner account', () => {
    expect(schema.safeParse({ ...base, links: { repo: 'https://github.com/other/x' } }).success).toBe(false);
  });
  it('rejects a featured project without result, cover and coverAlt', () => {
    expect(schema.safeParse({ ...base, featured: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, featured: 1, result: 'Won.', cover: './c.png', coverAlt: 'c' }).success).toBe(true);
  });
  it('rejects a cover with no alt text', () => {
    expect(schema.safeParse({ ...base, cover: './c.png' }).success).toBe(false);
  });
  it('rejects a malformed date', () => {
    expect(schema.safeParse({ ...base, date: 'Jan 2026' }).success).toBe(false);
  });
});

describe('experienceSchema', () => {
  const role = { organisation: 'Org', title: 'Intern', team: 'Team', start: '2026-01', order: 1 };
  it('accepts a role with no end date', () => {
    expect(experienceSchema.safeParse(role).success).toBe(true);
  });
  it('rejects a description', () => {
    expect(experienceSchema.safeParse({ ...role, description: 'Did things' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run.** `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `schemas.ts` and `content.config.ts` as specified. The config passes Astro's `image` helper: `schema: ({ image }) => projectSchema(image)`.
- [ ] **Step 4: Run.** `npm test && npm run check`. Expected: PASS. (`npm run build` will warn about empty collections until Task 5; that is expected.)
- [ ] **Step 5: Commit.** `git commit -m "Add content schemas and collections"`

---

### Task 4: Photo import script

**Files:**
- Create: `scripts/import-photo.mjs`
- Test: `tests/unit/import-photo.test.ts`

**Interfaces:**
- Produces: `importPhoto(source: string, dest: string): Promise<void>`. It applies the photo's stored rotation, limits width to 2000 px without enlarging, writes the format given by `dest`'s extension (`.jpg` at quality 85, or `.png`), and writes no metadata. CLI: `node scripts/import-photo.mjs <source> <dest>`.

- [ ] **Step 1: Write the failing test**

```ts
import { it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPhoto } from '../../scripts/import-photo.mjs';

it('strips metadata and limits width', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'photo-'));
  const src = join(dir, 'in.jpg');
  const out = join(dir, 'out.jpg');
  await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#888' } })
    .withExif({ IFD0: { Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N' } })
    .jpeg().toFile(src);
  expect((await sharp(src).metadata()).exif).toBeDefined();

  await importPhoto(src, out);

  const meta = await sharp(out).metadata();
  expect(meta.exif).toBeUndefined();
  expect(meta.width).toBe(2000);
  expect(meta.height).toBe(1000);
});

it('does not enlarge a small image', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'photo-'));
  const src = join(dir, 'in.png');
  const out = join(dir, 'out.png');
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#888' } }).png().toFile(src);
  await importPhoto(src, out);
  expect((await sharp(out).metadata()).width).toBe(800);
});
```

- [ ] **Step 2: Run.** `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `importPhoto` with sharp (`rotate()`, `resize({ width: 2000, withoutEnlargement: true })`); sharp omits metadata unless asked to keep it. Create the destination folder if missing.
- [ ] **Step 4: Run.** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add photo import script that strips metadata"`

---

### Task 5: Enter the content

**Files:**
- Create: `src/content/site.yaml`, `experience.yaml`, `proof.yaml`, `skills.yaml`, `about.md`, `src/content/projects/*.md` (13), images under `src/assets/projects/<slug>/` and `src/assets/about/`
- Create: `src/lib/text.ts`
- Test: `tests/unit/text.test.ts`, `tests/content/projects.test.ts`, `tests/content/privacy.test.ts`, `tests/content/copy.test.ts`

**Interfaces:**
- Produces: `wordCount(markdown: string): number` from `src/lib/text.ts`. It ignores heading lines and Markdown punctuation and counts whitespace-separated words.
- Produces: the content entries every later task renders.

**Sources**

- One-liners and descriptions: the GitHub profile README, `gh api repos/Siddigz/Siddigz/readme -H "Accept: application/vnd.github.raw"`. Reuse each project's sentence as `oneLiner`.
- Body text for featured projects: draft from each repo's README (`gh api repos/Siddigz/<repo>/readme -H "Accept: application/vnd.github.raw"`).
- `date`: the month of `gh api repos/Siddigz/<repo> --jq .created_at`.
- A file from a repo: `gh api "repos/Siddigz/<repo>/contents/<path>" -H "Accept: application/vnd.github.raw" > <tmp file>`.
- A photo from a zip: `unzip -j -o ~/Downloads/"<zip>" "<file>" -d <tmp dir>`. Use a temp folder outside the repo. Never copy a zip or an unused photo into the repo.
- Every image goes through `node scripts/import-photo.mjs <tmp file> <dest>`.

**Projects**

| Slug | Repo | `featured` | `category` | Extra |
|---|---|---|---|---|
| `curiding` | `cuRiding-pi` | 1 | `ai-data` | `extraRepos`: `cuRiding-Server`. `video`: `https://www.youtube.com/shorts/Ubc34F7nnvk`. Award: `People's Choice`, `cuHacking 7` |
| `alternative-signals` | `alternative-signals` | 2 | `ai-data` | |
| `brightspace-deadlines` | `brightspace-deadlines` | 3 | `web-apps` | |
| `visioncompanion` | `VisionCompanion` | 4 | `ai-data` | `live`: `https://visioncompanion.vercel.app`. `video`: `https://www.youtube.com/watch?v=HKM--zb6ZgE` |
| `ecocart` | `EcoCart` | 5 | `web-apps` | `video`: `https://youtu.be/w-SaoFrLJkc`. Award: `Best AI for Environmental Impact`, `AGI Ventures Canada Hackathon 3.0` |
| `cpu-cache-benchmark` | `CPU-Cache-Benchmark` | 6 | `systems` | |
| `curate` | `curate` | | `systems` | |
| `schedule-scoop` | `schedule-scoop` | | `web-apps` | `live`: the Chrome Web Store link in `git show main:index.html`. Describe what the extension does. |
| `north-star` | `North-Star` | | `ai-data` | |
| `pdf-merger` | `PDF-merger` | | `web-apps` | |
| `markit` | `Markit` | | `web-apps` | |
| `student-management-system` | `Student-Management-System-SMS` | | `systems` | |
| `relational-algebra-query-processor` | `Relational-Algebra-Query-Processor` | | `systems` | |

Where the profile README groups a project differently, the README's group wins.

**Images**

| Destination | Source |
|---|---|
| `projects/curiding/cover.jpg` | `cuhacking 7.zip` : `20260712_063343.jpg` |
| `projects/curiding/team.jpg` (gallery) | `cuhacking 7.zip` : `P1170515.JPG` |
| `projects/curiding/award.jpg` (gallery) | `cuhacking 7.zip` : `IMG_1865.JPG` |
| `projects/alternative-signals/cover.png` | repo `docs/signals.png` |
| `projects/brightspace-deadlines/cover.png` | repo `docs/screenshots/deadlines.png` |
| `projects/visioncompanion/cover.jpg` | repo `docs/img/hazard-map.jpg` |
| `projects/ecocart/cover.jpg` | `agi hackathon.zip` : `DSC08247.jpg` |
| `projects/cpu-cache-benchmark/cover.png` | repo `Example results/plots_sequential.png` |
| `projects/curate/cover.png` | repo `docs/screenshot.png` |
| `projects/pdf-merger/cover.png` | repo `docs/screenshot.png` |
| `projects/north-star/cover.jpg` | `uottawahack.zip` : `IMG_20260119_230756_752.jpg` |
| `about/hack-the-north.jpg` | `hack the north.zip` : `IMG_20260921_134958_581.jpg` |

`schedule-scoop`, `markit`, `student-management-system` and `relational-algebra-query-processor` have no cover in this stage.

**Fixed values**

- `site.yaml` (`main`): `url: https://siddigz.com`; `name: { first: Siddig, last: Ahmed }`; `lookingFor: { enabled: true, text: "Open to software engineering internships" }`; `school: "Computer Science (Honours), Software Engineering stream, Minor in Mathematics · Carleton University"`; `gpa: "3.91/4.00"`; `expectedGraduation: "April 2028"`; `links: { github: https://github.com/Siddigz, linkedin: https://linkedin.com/in/siddigz }`; `home: { city: Ottawa, timeZone: America/Toronto }`; `pitch`: draft, one sentence of at most 22 words, leading with shipped work and results, for the owner to correct. Starting draft: "I build software people actually use, from award-winning hackathon projects to student tools, with two software engineering internships behind me."
- `experience.yaml`, in this order:
  1. Ciena, Embedded Software Engineering Intern, Modem Control Software, start `2026-09`, no end, logo `ciena`
  2. Ciena, Software Engineering Intern, Tooling & Infrastructure Automation, `2026-01` to `2026-08`, logo `ciena`
  3. Carleton University, Undergraduate Teaching Assistant, Programming and Algorithms, `2025-09` to `2025-12`, logo `carleton`
- `proof.yaml`, in this order: `People's Choice` / `cuHacking 7`; `Best AI for Environmental Impact` / `AGI Ventures Canada Hackathon 3.0`; `Jacob Freedman Scholarship` / `$16,000, academic achievement in Computer Science`; `Deans' Honour List` / `2023–24, 2024–25, 2025–26`; `GPA 3.91/4.00` / `Carleton University`. Links, where the old page had one, come from `git show main:index.html`.
- `skills.yaml` (`main`), `items` in this order: Python, TypeScript, JavaScript, Java, C++, C, SQL, React, React Native, FastAPI, Node.js, PostgreSQL, MongoDB, PyTorch, Docker, GitHub Actions, CI/CD, Git, Linux, Bash, CMake.
- `about.md`: a bio of at most 80 words, drafted from the old page's intro (`git show main:index.html`) and reframed per the spec's section 1. Then a short list: Carleton Tennis Club, VP Finance (May 2025 to April 2026); Hack the Hill III, Sponsorship Team; Paul Menton Centre, Volunteer Notetaker. The Hack the North photo is captioned exactly "Hack the North 2026, Waterloo".

- [ ] **Step 1: Write the failing tests.**

`tests/unit/text.test.ts`:

```ts
import { it, expect } from 'vitest';
import { wordCount } from '../../src/lib/text';

it('counts words and ignores headings and markup', () => {
  expect(wordCount('## Problem\n\nRiders **crash** and `nobody` knows.\n')).toBe(5);
  expect(wordCount('')).toBe(0);
});
```

`tests/content/projects.test.ts` (read `src/content/projects/*.md`, split the frontmatter, parse it with the `yaml` package):

```ts
const FEATURED = ['curiding', 'alternative-signals', 'brightspace-deadlines',
  'visioncompanion', 'ecocart', 'cpu-cache-benchmark'];
const MORE = ['curate', 'schedule-scoop', 'north-star', 'pdf-merger', 'markit',
  'student-management-system', 'relational-algebra-query-processor'];

it('has exactly the launch projects', () => {
  expect(slugs.sort()).toEqual([...FEATURED, ...MORE].sort());
});
it('features the six in the agreed order', () => {
  const order = projects.filter((p) => p.data.featured).sort((a, b) => a.data.featured - b.data.featured);
  expect(order.map((p) => p.slug)).toEqual(FEATURED);
  expect(order.map((p) => p.data.featured)).toEqual([1, 2, 3, 4, 5, 6]);
});
it.each(FEATURED)('%s has a brief three-part body', (slug) => {
  const { body } = bySlug(slug);
  expect(body.match(/^## .+$/gm)).toEqual(['## Problem', '## What I built', '## Result']);
  expect(wordCount(body)).toBeLessThanOrEqual(120);
});
it.each(MORE)('%s has no body', (slug) => {
  expect(bySlug(slug).body.trim()).toBe('');
});
```

`tests/content/privacy.test.ts` (walk `src/` and `public/` if present; text files only):

```ts
it('contains no email address', () => {
  // any match of /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ in any file fails
  expect(hits).toEqual([]);
});
it('links only the owner\'s public repositories', () => {
  // every github.com URL in src/content starts with https://github.com/Siddigz
  expect(foreign).toEqual([]);
});
it('does not mention projects that are deliberately left off', () => {
  // If CLAUDE.local.md exists, take the names on its "Do not feature or link:" line
  // and assert none appears in src/content. If the file is absent (CI), skip.
});
```

`tests/content/copy.test.ts`:

```ts
it('avoids the old framing', () => {
  // none of these, case-insensitive, anywhere in src/content:
  // 'close to the metal', 'no framework', 'no build step', 'linux internals'
});
it('about bio is at most 80 words', () => { /* first paragraph of about.md */ });
it('words the Hack the North caption exactly', () => {
  expect(aboutSource).toContain('Hack the North 2026, Waterloo');
});
it('pitch is one sentence of at most 22 words', () => { /* site.yaml main.pitch */ });
```

- [ ] **Step 2: Run.** `npm test`. Expected: FAIL, no content.
- [ ] **Step 3: Read `CLAUDE.local.md`,** then implement `wordCount`, import the images, and write every content file from the tables above.
- [ ] **Step 4: Run.** `npm test && npm run build`. Expected: PASS, and the build validates every entry against its schema with no errors.
- [ ] **Step 5: Check staged files.** `git add -A && git diff --cached --stat`. Confirm no zip, no file outside the tables, and no image over 1 MB.
- [ ] **Step 6: Commit.** `git commit -m "Add site content and project images"`

---

### Task 6: Home page, top half

**Files:**
- Create: `src/components/Hero.astro`, `ProofStrip.astro`, `SkillsStrip.astro`, `Experience.astro`
- Modify: `src/pages/index.astro`
- Test: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: collections from Task 3 (`getEntry('site', 'main')`, `getCollection('experience' | 'proof')`, `getEntry('skills', 'main')`); tokens and `BaseLayout` from Task 2.
- Produces: sections with these ids, in this order: `top`, `proof`, `skills`, `experience`. Experience, proof and skills render in `order` / file order.
- `Experience.astro`: one `<li>` per role with organisation, title, team and dates as "Sep 2026 – Present" or "Jan 2026 – Aug 2026". No `<p>` elements.
- `Hero.astro` markup contract (stage 3 hooks onto it):
  - A wrapper `[data-hero-text]` whose direct children are the name, pitch, looking-for line, school facts, greeting and links, each rendered only when it has content. The photo slot sits outside this wrapper.
  - `<h1>` contains two elements `[data-name-part="first"]` and `[data-name-part="last"]`.
  - The looking-for line is `[data-looking-for]`, rendered only when `lookingFor.enabled`.
  - A greeting placeholder `[data-greeting]` containing the neutral text "Hello, and welcome." with a fixed min-height of one line.
  - A photo slot `[data-photo-slot]` that renders nothing visible and takes no space while no photo exists.
  - Links with accessible names "GitHub" and "LinkedIn".
  - `Hero.astro` accepts an optional prop `lookingForOverride?: boolean` used only by the test page below.
- `SkillsStrip.astro`: a `<ul aria-label="Skills">` with one `<li>` per skill, followed by a duplicate list with `aria-hidden="true"` for the loop. The track moves with a CSS animation only. It pauses on `:hover` and `:focus-within`. Under `prefers-reduced-motion: reduce` the duplicate is `display: none`, the animation is off, and the list wraps.
- Create `src/pages/dev/no-looking-for.astro`: renders `BaseLayout` and `<Hero lookingForOverride={false} />` only, with `<meta name="robots" content="noindex">`. It exists so the off state can be tested.

- [ ] **Step 1: Write the failing test** in `tests/e2e/home.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const site = parse(readFileSync('src/content/site.yaml', 'utf8')).main;
const skills = parse(readFileSync('src/content/skills.yaml', 'utf8')).main.items;

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
  await expect(page.locator('#top')).toContainText('3.91/4.00');
  await expect(page.locator('#top')).toContainText('April 2028');
  await expect(page.locator('#top').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', site.links.github);
  await expect(page.locator('#top').getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', site.links.linkedin);
  await expect(page.locator('#top').getByRole('link', { name: /email/i })).toHaveCount(0);
});

test('looking-for line follows the switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-looking-for]')).toHaveCount(site.lookingFor.enabled ? 1 : 0);
  if (site.lookingFor.enabled) await expect(page.locator('[data-looking-for]')).toHaveText(site.lookingFor.text);
});

test('with the switch off the line is gone and leaves no gap', async ({ page }) => {
  await page.goto('/dev/no-looking-for');
  await expect(page.locator('[data-looking-for]')).toHaveCount(0);
  const empties = await page.locator('#top [data-hero-text] > *').evaluateAll((els) =>
    els.filter((e) => !e.textContent?.trim()).length);
  expect(empties).toBe(0);
});

test('experience lists three roles and no descriptions', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#experience li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Embedded Software Engineering Intern');
  await expect(rows.nth(0)).toContainText('Present');
  await expect(page.locator('#experience p')).toHaveCount(0);
});

test('proof strip shows the awards as worded', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#proof')).toContainText("People's Choice");
  await expect(page.locator('#proof')).toContainText('Best AI for Environmental Impact');
});

test('skills strip lists every skill once for assistive tech', async ({ page }) => {
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Skills' });
  await expect(list.getByRole('listitem')).toHaveText(skills);
  await expect(page.locator('#skills [aria-hidden="true"]')).toHaveCount(1);
});

test('skills strip is still under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const running = await page.locator('#skills *').evaluateAll((els) =>
    els.some((e) => getComputedStyle(e).animationName !== 'none'));
  expect(running).toBe(false);
  await expect(page.locator('#skills [aria-hidden="true"]')).toBeHidden();
});
```

- [ ] **Step 2: Run.** `npm run test:e2e`. Expected: FAIL.
- [ ] **Step 3: Implement** the four components and compose them in `index.astro` inside `BaseLayout` (`title="Siddig Ahmed"`, description from the pitch, `path="/"`). Logos come from `src/assets/logos/` through a small map from the `logo` key to the imported file.
- [ ] **Step 4: Run.** `npm run test:e2e && npm run check`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add hero, proof strip, skills strip and experience"`

---

### Task 7: Home page, projects, about and contact

**Files:**
- Create: `src/lib/projects.ts`, `src/components/ProjectCard.astro`, `ProjectRow.astro`, `About.astro`, `Contact.astro`
- Modify: `src/pages/index.astro`
- Test: `tests/unit/projects.test.ts`, `tests/e2e/home.spec.ts` (extend), `tests/e2e/robustness.spec.ts`

**Interfaces:**
- Produces, from `src/lib/projects.ts`:
  - `type ProjectLike = { id: string; data: { featured?: number; date: string } }`
  - `featuredProjects<T extends ProjectLike>(entries: T[]): T[]`: only featured, ascending by `featured`.
  - `moreProjects<T extends ProjectLike>(entries: T[]): T[]`: only non-featured, newest `date` first, ties by `id` ascending.
  - `nextFeatured<T extends ProjectLike>(entries: T[], id: string): T`: the next featured project, wrapping from last to first.
- Produces: sections `projects`, `more-projects`, `about`, `contact` after the four from Task 6.
- `ProjectCard.astro`: an `<article>` whose title links to `/projects/<id>`; shows cover, title, one-liner, `result`, and the award as "name · event" when present.
- `ProjectRow.astro`: an `<li data-category={category}>` with title linking to `links.repo`, the one-liner, the category label, and a thumbnail only when `cover` exists.
- `Contact.astro`: GitHub and LinkedIn links. No email control in this stage.

- [ ] **Step 1: Write the failing unit test** in `tests/unit/projects.test.ts`

```ts
import { it, expect } from 'vitest';
import { featuredProjects, moreProjects, nextFeatured } from '../../src/lib/projects';

const p = (id: string, date: string, featured?: number) => ({ id, data: { date, featured } });
const all = [p('c', '2025-03'), p('a', '2026-01', 2), p('b', '2025-03'), p('d', '2024-05', 1), p('e', '2026-06')];

it('featuredProjects sorts by featured number', () => {
  expect(featuredProjects(all).map((x) => x.id)).toEqual(['d', 'a']);
});
it('moreProjects sorts newest first, then by id', () => {
  expect(moreProjects(all).map((x) => x.id)).toEqual(['e', 'b', 'c']);
});
it('nextFeatured wraps around', () => {
  expect(nextFeatured(all, 'd').id).toBe('a');
  expect(nextFeatured(all, 'a').id).toBe('d');
});
```

- [ ] **Step 2: Extend** `tests/e2e/home.spec.ts`

```ts
test('all eight sections are in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['top', 'proof', 'skills', 'experience', 'projects', 'more-projects', 'about', 'contact']);
});

test('six featured cards in order, each linking to its page', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('#projects article h3 a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(['/projects/curiding', '/projects/alternative-signals', '/projects/brightspace-deadlines',
    '/projects/visioncompanion', '/projects/ecocart', '/projects/cpu-cache-benchmark']);
  await expect(page.locator('#projects article').first()).toContainText("People's Choice · cuHacking 7");
});

test('seven compact rows link to GitHub', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#more-projects li[data-category]');
  await expect(rows).toHaveCount(7);
  for (const href of await rows.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))
    expect(href).toMatch(/^https:\/\/github\.com\/Siddigz\//);
});

test('a row with only required fields renders cleanly', async ({ page }) => {
  await page.goto('/');
  const row = page.locator('#more-projects li', { hasText: 'Markit' });
  await expect(row.locator('img')).toHaveCount(0);
  await expect(page.locator('a[href=""], a:not([href])')).toHaveCount(0);
  const broken = await page.locator('img').evaluateAll((imgs) =>
    imgs.filter((i) => !(i as HTMLImageElement).getAttribute('src') || !(i as HTMLImageElement).alt).length);
  expect(broken).toBe(0);
});

test('about shows the Hack the North caption', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toContainText('Hack the North 2026, Waterloo');
});
```

- [ ] **Step 3: Write** `tests/e2e/robustness.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every section shows its content', async ({ page }) => {
    await page.goto('/');
    for (const id of ['top', 'proof', 'skills', 'experience', 'projects', 'more-projects', 'about', 'contact'])
      await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator('#projects article')).toHaveCount(6);
    await expect(page.locator('h1')).toContainText('Siddig');
  });
});

for (const path of ['/', '/projects/curiding', '/does-not-exist']) {
  test(`no sideways scroll at 320px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

(The `/projects/curiding` case passes once Task 8 lands; until then it checks the 404 page, which must also not overflow.)

- [ ] **Step 4: Run.** `npm test && npm run test:e2e`. Expected: FAIL.
- [ ] **Step 5: Implement** `projects.ts`, the four components, and add them to `index.astro`. The skills strip's track must be clipped by its own container (`overflow: clip`) so it cannot widen the page.
- [ ] **Step 6: Run.** `npm test && npm run test:e2e && npm run check`. Expected: PASS.
- [ ] **Step 7: Commit.** `git commit -m "Add project sections, about and contact"`

---

### Task 8: Project pages

**Files:**
- Create: `src/pages/projects/[slug].astro`
- Test: `tests/e2e/project-pages.spec.ts`

**Interfaces:**
- Consumes: `featuredProjects`, `nextFeatured` (Task 7); `render` from `astro:content`; `BaseLayout`.
- Produces: one prerendered page per featured project at `/projects/<id>`, from `getStaticPaths`. Non-featured projects get no page.
- Page content, in order: `<h1>` title; one-liner; award as "name · event" when present; links named "Repository" (one per repo, the extras labelled with the repo name), "Live app" and "Watch demo" when present; the rendered body; the cover and gallery images; a link "Next: <title>" to the next featured project; a "Back to projects" link to `/#projects`.
- Video is a plain link in this stage. No embedded player.

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';

const FEATURED = ['curiding', 'alternative-signals', 'brightspace-deadlines',
  'visioncompanion', 'ecocart', 'cpu-cache-benchmark'];

for (const [i, slug] of FEATURED.entries()) {
  test(`${slug} page`, async ({ page }) => {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Problem', 'What I built', 'Result']);
    await expect(page.getByRole('link', { name: 'Repository' }).first()).toHaveAttribute('href', /^https:\/\/github\.com\/Siddigz\//);
    await expect(page.getByRole('link', { name: /^Next: / })).toHaveAttribute('href', `/projects/${FEATURED[(i + 1) % 6]}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://siddigz.com/projects/${slug}`);
    await expect(page.locator('iframe')).toHaveCount(0);
  });
}

test('cuRiding links both repositories and the demo', async ({ page }) => {
  await page.goto('/projects/curiding');
  await expect(page.locator('a[href="https://github.com/Siddigz/cuRiding-pi"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://github.com/Siddigz/cuRiding-Server"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Watch demo' })).toBeVisible();
  await expect(page.getByText("People's Choice · cuHacking 7")).toBeVisible();
});

test('a non-featured project has no page', async ({ page }) => {
  const response = await page.goto('/projects/markit');
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 2: Run.** `npm run test:e2e`. Expected: FAIL.
- [ ] **Step 3: Implement** the page.
- [ ] **Step 4: Run.** `npm run test:e2e && npm run check`. Expected: PASS, including the 320 px check from Task 7.
- [ ] **Step 5: Commit.** `git commit -m "Add brief project pages"`

---

### Task 9: Budgets, link check and CI

**Files:**
- Create: `tests/build/budget.test.ts`, `tests/e2e/links.spec.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the built site in `dist/`.
- Produces: `npm run test:build`, and a CI workflow named `CI` that runs on every push.

- [ ] **Step 1: Write the tests.**

`tests/build/budget.test.ts` (reads `dist/`; run after `npm run build`):

```ts
it('home page ships at most 60 KB of compressed JavaScript', () => {
  // gzip every <script src> file referenced by dist/index.html plus every inline <script> body
  expect(totalGzipBytes).toBeLessThanOrEqual(60 * 1024);
});
it('no page needs a third-party request to render', () => {
  // in every dist/**/*.html: no <script src>, <link rel="stylesheet" href>, <img src>,
  // <source srcset>, <iframe src> or CSS url() pointing at an http(s) origin
  expect(external).toEqual([]);
});
it('the dev test page is not in the sitemap or linked from any page', () => {
  expect(linksToDevPages).toEqual([]);
});
it('no built file contains an email address', () => {
  // same pattern as tests/content/privacy.test.ts, over dist/**/*.{html,js,css}
  expect(hits).toEqual([]);
});
```

`tests/e2e/links.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('every internal link resolves', async ({ page, request }) => {
  const seen = new Set<string>();
  const queue = ['/'];
  while (queue.length) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    if (!(response.headers()['content-type'] ?? '').includes('text/html')) continue;
    await page.goto(path);
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) =>
      as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    queue.push(...hrefs);
  }
  expect(seen.size).toBeGreaterThanOrEqual(7);
});
```

- [ ] **Step 2: Run.** `npm run build && npm run test:build && npm run test:e2e`. Expected: PASS if earlier tasks followed the constraints; fix whatever fails at its source.

- [ ] **Step 3: Write** `.github/workflows/ci.yml`: on `push` to any branch; one job on `ubuntu-latest`; `actions/checkout`, `actions/setup-node` with Node 24 and npm cache; `npm ci`; `npx playwright install --with-deps chromium`; then `npm run check`, `npm test`, `npm run build`, `npm run test:build`, `npm run test:e2e`. `permissions: contents: read`.

- [ ] **Step 4: Commit and push.** `git commit -m "Add budgets, link check and CI"`, then `git push`.
- [ ] **Step 5: Verify CI.** `gh run watch --exit-status` on the run for this push. Expected: success.

---

### Task 10: Preview and hand-over

**Files:** none, unless a fix is needed.

- [ ] **Step 1: Find the preview address.** `gh api "repos/Siddigz/website/deployments?ref=revamp" --jq '.[0].id'`, then `gh api repos/Siddigz/website/deployments/<id>/statuses --jq '.[0] | {state, environment_url}'`. Expected: `state` is `success` and there is an `environment_url`.
- [ ] **Step 2: If the deployment failed,** read its log link from the status. If the cause is in the repo, fix it. If the cause is a Vercel dashboard setting (framework preset, build command override, Node version), do not guess: write the exact setting to change as a one-line item for the owner and stop this task there.
- [ ] **Step 3: Check the live preview** in a browser at 375 px, 768 px and 1280 px, in light and dark: every section present, images load, no sideways scroll, theme toggle works, each featured card opens its page.
- [ ] **Step 4: Confirm `main` is untouched.** `git log origin/main -1 --format=%h` still prints `c15929d`, and the live site is unchanged.
- [ ] **Step 5: Hand over** the preview address with this review list for the owner:
  1. The pitch sentence and the bio (drafts).
  2. The six project pages' text (drafted from the READMEs).
  3. The skills list and its order.
  4. Whether "Home Server" from the old site should come back.
  5. Which cover images to replace.
  6. Reminder that the look is a placeholder; choosing it is stage 2.

---

## What changed during the build

Stage 1 is built. These are the places where the result differs from the tasks
above. Later plans should build on this section, not on the task text.

- **Theme.** The chosen scheme lives in the content of `<meta name="color-scheme">`
  (`light dark`, `light` or `dark`), not in an `html[data-theme]` attribute. CSS maps
  it with `:root:has(> head > meta[...])`. Toggling back to the system's scheme
  clears the stored choice. Helpers are in `src/lib/theme.ts`.
- **Browser tests** serve `dist/` with `scripts/serve-dist.mjs`, because Astro 7
  detaches `astro preview` into the background when an agent runs it.
  `npm run test:e2e` builds first.
- **Skills strip.** It has a CSS-only Pause checkbox, and it only moves when
  reduced motion is not set.
- **Site settings** are read through `getSite()` in `src/lib/site.ts`. The site
  address is the `url` in `site.yaml`; `astro.config.mjs` reads it. The Contact
  sentence is `contactNote`.
- **Projects.** `coverFit: contain` shows a whole chart or screenshot instead of
  cropping it. Rows show the stack and any live or demo link. Cards show the stack.
- **Tests derive their lists from the content files.** Adding, removing or
  reordering a project needs no test edit.
- **Checks added:** accessibility scan (axe, WCAG 2.2 AA) on three pages in both
  themes; image metadata and size; no CSS nesting in the global stylesheets; no
  email in any tracked file; the owner's name is not hard-coded in components.
- **Global stylesheets use no CSS nesting**, so older Safari still gets every token.
- **Categories** follow the GitHub profile README.
- **Not yet done:** tests run in Chromium only. Add WebKit and Firefox when the
  real look lands in stage 2.

### Changes after the owner's first review (2026-11-18)

- The skills strip moved below Experience.
- The top shows a generic placeholder figure in the photo slot: beside the text
  on wide screens, above the name on phones.
- The school line is split into `program` and `school` in `site.yaml`, and each
  fact stays on one line.
- A proof item's `detail` may be a list, shown line by line.
- `/projects` redirects to `/#projects`. Project pages have a back link at the
  top and the bottom, and a two-column gallery under the cover.
- Projects gained `coverPosition`; `links.repo` is optional for compact rows
  (Home Server has none).
- Dates are formatted with `Intl.DateTimeFormat`. Brand and technology names
  carry `translate="no"`. Tappable elements set `touch-action: manipulation`.
- Audited against Vercel's Web Interface Guidelines. Left for stage 2, with the
  real look: a `theme-color` meta that matches the background, curly quotes,
  an intentional tap-highlight colour, and the Title Case question.

### Changes after the owner's second review (2026-11-19)

- GPA corrected to 3.91/4.00 everywhere. A test keeps the proof strip and the
  top of the page in step.
- Categories changed for three projects: cuRiding and VisionCompanion are
  AI & data, Student Management System is Web & apps. The GitHub profile README
  is matched at ship.
- A project's `date` is optional and only orders the list. Home Server has none
  and goes last.
- `site.yaml` gained an optional `photo`. The top of the page shows it, loaded
  first and never lazily; the placeholder figure remains the fallback.
- North-Star, Markit, Student Management System and Relational Algebra Query
  Processor have thumbnails, cropped from the images in their repositories.
- Experience logos and row thumbnails grow with the screen, up to 104 px and
  80 px.
- The menu lists sections in page order: Experience, Projects, About.
- The skills strip is exactly as wide as the other sections and fades at both
  ends.
- About shows its photos side by side. A second photo, from the Ottawa 10K, sits
  beside the Hack the North one.
