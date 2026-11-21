# Website revamp, stage 3: interactive features and ship

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add everything a visitor can click, hear or be greeted by, the server-side pieces (email, resume switch, GitHub activity), the explainers and the link previews, then put the new site live.

**Architecture:** Pages stay prebuilt. The Vercel adapter adds one server function that answers four small addresses (two for the email, one for the resume, one for the daily rebuild). Every interactive piece is a small plain script with its logic in `src/lib/`, where it is unit tested. GitHub data is fetched while the site is built, never in the visitor's browser.

**Tech stack:** Astro 7 with `@astrojs/vercel` and `@astrojs/sitemap`, plain CSS with tokens, plain TypeScript in the browser (no UI library), `satori` and `sharp` for preview images, Vitest, Playwright, Lighthouse.

**Spec:** `docs/superpowers/specs/2026-11-16-website-revamp-design.md`, sections 8, 10 and 12.

## What the owner does or decides

1. **New text.** Every new sentence, label and button is listed under "New text". None of it is approved until the owner says so. It can be approved from this list or on the preview, part by part.
2. **Vercel settings.** The owner sets every one himself; the builder only names them. One is done (`GITHUB_ACTIVITY_TOKEN`). Four more are needed; Task 17 writes the checklist.
3. **Two recordings** of the name, whenever convenient. Placeholder tones stand in until then.
4. **How the builder sees the real preview.** Settled on 2026-11-20: the owner signed in to Vercel in the app's browser pane, so the builder can open the preview there. A speed measurement cannot run in that pane, so the one on the real address happens on the live site right after ship.
5. **One wording change in an explainer** (see "Decisions made here", item 7). Approved on 2026-11-20.
6. **At ship:** merge the pull request, make `siddigz.com` the primary domain, the private history steps, the six pinned repositories, LinkedIn.

## Global constraints

- Text and structure approved in stages 1 and 2 do not change. Anything visible that is new is in "New text".
- No address, secret or private setting in the repo, the built site or the tests. Settings are named in `.env.example` with no values. Tests that need an address build a fake one from parts.
- Pages are prebuilt. No page waits on a fetch to show its content (rule 11).
- Home page: at most 60 KB of compressed JavaScript, not counting analytics (rule 12).
- Nothing third-party is fetched to render a page (rule 14).
- Scrolling is never altered. Every animation is garnish, declared only inside `@media (prefers-reduced-motion: no-preference)`, and takes 300 ms or less (rules 15 to 18).
- Keyboard, visible focus, WCAG AA in both themes, alt text, labelled audio buttons (rules 19 to 21).
- All colour, type, spacing and motion values are tokens in `src/styles/tokens.css`. No hex colours in scripts: canvas and SVG read tokens.
- Global stylesheets use no CSS nesting. TypeScript is strict.
- The Modern Web Guidance skill is consulted at the start of every task that writes HTML, CSS or browser JavaScript.
- Work stays on `revamp`. Each task ends with a commit and a push, and CI is green before the next task starts. No AI attribution anywhere.

**How every task runs:** write the listed tests; run them and see them fail; build the thing; run `npm run check`, `npm test`, `npm run build && npm run test:build`, `npm run test:e2e`; commit; push; confirm CI.

## Facts checked before writing (2026-11-20)

- With `@astrojs/vercel` 11.0.22 the prebuilt pages land in `dist/client/`, not `dist/`. The `/projects` redirect becomes a host rule in `.vercel/output/config.json` and no longer has a page of its own. There is one function, on Node 24. The adapter must be listed in `package.json`, or the build fails.
- The owner's public GitHub graph already counts private work, as numbers only (1,400 in the last year, 1,054 of them private). The site shows the same graph. No private repository or commit is ever named.
- One GitHub GraphQL request returns the contribution calendar (53 weeks, a count and a level per day) and recent commits per repository. Checked with a signed-in command-line client, not with the new token, so whether a token with no permissions is enough is still open (Task 9).
- The two explainer source files are self-contained (about 15 KB and 19 KB, no outside requests). One names a company (see decision 7).
- Astro 7 has a built-in content security policy option (`security.csp`). It does not work with Astro's own client router, which this site does not use.
- The Mac has `afconvert` for audio and no `ffmpeg`.

## Decisions made here (the spec left them to the builder)

The owner said yes to items 4 to 8 on 2026-11-20.

1. **Server functions** run on Vercel through the adapter. Everything else stays prebuilt.
2. **Daily rebuild:** a Vercel cron job calls `/api/rebuild` once a day, which calls a Vercel deploy hook. Both addresses are private settings.
3. **Real resume, if ever turned on:** a private file address in a setting (`RESUME_URL`) that the function fetches. The file itself never enters the repo.
4. **Recent commits come only from repositories this site already links, plus the site's own.** A commit to any other public repository is not shown. This keeps the projects that are deliberately left off the site out of the activity list without naming them here.
5. **If GitHub cannot be reached while building,** the section is left out and the build still succeeds.
6. **"Welcome back"** means a new browser session after an earlier one. Reloading, or going to a project and back, does not count.
7. **Explainer wording:** the packet explainer's source says the packet travels to a "Google server" and uses a real address of that company. Rule 6 keeps company names out of explainers. It becomes "Web server", "Edge router", and an address from the range reserved for examples (`198.51.100.7`). Both source files were searched on 2026-11-20 for the employer's name and its product names and hold neither.
8. **Placeholder sounds** are two short soft tones made by a script.
9. **The filter** is written into the address as `?filter=systems`.
10. **Preview images** are drawn while the site is built, from the same text and covers the pages use.
11. **Favicon:** the owner's initials on the accent blue, drawn from `site.yaml` and the tokens.
12. **Test builds:** `SITE_FIXTURES=1` builds with sample GitHub data and the test-only pages. A normal build has neither.

## Review focus

Each line is pinned by a test in the task named.

1. **Storage blocked or throwing** (private windows): the greeting and the seen marks behave as on a first visit, with no error. (Task 3)
2. **A server function called directly,** with an expired or altered token, from another site, or with settings missing: the address is never returned and no setting leaks into an error. (Tasks 7, 8, 9)
3. **GitHub down, token missing or expired, or a repository renamed** while building: the build succeeds, the section is absent, and nothing links to it. (Task 9)
4. **Odd clocks:** the visitor shares the owner's time, is half an hour off, or reports a time zone the browser cannot use. The greeting stays one correct sentence, or the neutral line stays. (Task 3)
5. **Bad input from the visitor's side:** a `?filter=` that is not a category, a menu search that matches nothing, audio that fails to load or is refused. The page stays usable, shows no error and does not move. (Tasks 2, 4, 5)

## New text

Not approved until the owner says so. `{…}` marks a value filled in.

| Where | Text |
|---|---|
| Greeting, by time of day | "Good morning." / "Good afternoon." / "Good evening." / "You’re up late." |
| Greeting, second visit | "Welcome back." (replaces the time-of-day words) |
| Greeting, the times | "It’s {your time} for you and {my time} in {city}." |
| Greeting, same time | "It’s {time} for both of us." |
| Example | "Good evening. It’s 9:14 PM for you and 3:14 PM in Ottawa." |
| Name buttons (screen readers only) | "Plays a recording of this name." |
| Project card already opened | "Seen" |
| Email button | "Email" |
| After the reveal | the address, then "Copy", which becomes "Copied" |
| Email failed | "That didn’t work. Message me on LinkedIn instead." |
| Email, JavaScript off | "Email needs JavaScript. Message me on LinkedIn instead." |
| Resume button (off at launch) | "Resume" |
| Filter buttons | "All", "Web & apps", "AI & data", "Systems" |
| Filter (screen readers only) | "Filter projects"; "Showing {n} of {total} projects." |
| Menu button (screen readers only) | "Open the command menu" |
| Menu search box | "Search or jump to…" |
| Menu groups | "Sections", "Projects", "Explainers", "Links", "Theme" |
| Menu, nothing found | "Nothing matches." |
| New section titles | "Explainers", "GitHub activity" |
| Explainer 1 | "One packet, hop by hop: which headers change". Summary: "Follow one web request from a laptop to a server and see which headers each device rewrites." |
| Explainer 2 | "NRZ vs PAM4: levels, noise and misread symbols". Summary: "See why packing more levels into the same signal range makes the same noise cause more errors." |
| Explainer pages | "Back to explainers"; the owner's own captions and labels, with the change in decision 7 |
| GitHub activity | "{n} contributions in the last year"; "Less", "More"; "Recent commits"; dates as "Nov 18" |
| Repo README | drafted in Task 17 |

## File map

| Path | Responsibility |
|---|---|
| `src/lib/greeting.ts`, `visits.ts` | Greeting sentence; visit count and seen projects |
| `src/lib/filter.ts` | Filter value to and from the address |
| `src/lib/command.ts`, `command-items.ts` | Menu search; the list of menu entries |
| `src/lib/contact-token.ts`, `rate-limit.ts`, `contact-handlers.ts` | Email reveal, server side |
| `src/lib/resume.ts`, `rebuild.ts` | Resume switch; daily rebuild |
| `src/lib/github-activity.ts` | Fetch and shape GitHub data at build time |
| `src/lib/explainers/packet.ts`, `signal.ts` | The explainers' logic |
| `src/lib/og.ts` | Draws a preview image |
| `src/lib/build-env.ts` | Reads build switches (`SITE_FIXTURES`, `VERCEL`) |
| `src/scripts/*.ts` | Browser side of each feature, one file each |
| `src/pages/api/contact/token.ts`, `address.ts`, `src/pages/api/rebuild.ts`, `src/pages/resume.pdf.ts` | The four server addresses, each a thin wrapper |
| `src/pages/explainers/[slug].astro`, `src/content/explainers/*.md`, `src/components/explainers/*` | Explainer pages |
| `src/pages/og/…`, `favicon.svg.ts`, `apple-touch-icon.png.ts`, `robots.txt.ts` | Generated images and files |
| `src/pages/dev/[page].astro` | Test-only pages, built only with `SITE_FIXTURES=1` |
| `docs/vercel-checklist.md`, `.env.example` | What the owner sets, and the names |

---

## Part A: foundations

### Task 1: Vercel adapter, build layout, test builds

**Built on 2026-11-21.** One difference from what is written below: the adapter only moves the pages to `dist/client/` once a request-time address exists, so the tests and the local server read `.vercel/output/static` instead. That is the folder the host serves, and it is the same either way.

**Files:** `package.json`, `astro.config.mjs`, `vercel.json`, `scripts/serve-dist.mjs`, `src/lib/build-env.ts`, `src/pages/dev/[page].astro` (replaces `no-looking-for.astro`), `.env.example`, `tests/build/budget.test.ts`, `tests/content/helpers.ts`, `.github/workflows/ci.yml`.

**Produces:**
- `adapter: vercel()` in the config; `outputDirectory` removed from `vercel.json`.
- Scripts: `build:test` = `SITE_FIXTURES=1 astro build`; `test:e2e` = `npm run build:test && playwright test`.
- `src/lib/build-env.ts`: `fixtures: boolean` and `onVercel: boolean`, each read from `process.env`.
- `serve-dist.mjs` serves `dist/client/` and follows the redirects listed in `.vercel/output/config.json`.
- `src/pages/dev/[page].astro`: `getStaticPaths()` returns the test pages when `fixtures`, otherwise none.

- [ ] Build tests: `dist/client/index.html` exists; a normal build has no `dist/client/dev` folder and no link to `/dev/`; every existing budget check passes against `dist/client`.
- [ ] Browser tests (existing): `/projects` still leads to `/#projects`; `/dev/no-looking-for` still shows no looking-for line.
- [ ] CI order stays: check, unit tests, `npm run build`, build tests, browser tests.
- [ ] Push and confirm on the owner's side that the preview still deploys (the owner sees the site load; the builder cannot).

## Part B: what the visitor can poke at

### Task 2: name audio

**Files:** `scripts/make-placeholder-audio.mjs`, `scripts/import-audio.mjs`, `src/assets/audio/name-first.wav`, `name-last.wav`, `src/content/site.yaml` (`name.audio.first`, `name.audio.last`: file names), `src/content/schemas.ts`, `src/components/Hero.astro`, `src/scripts/name-audio.ts`, `src/styles/tokens.css`, `tests/unit/placeholder-audio.test.ts`, `tests/e2e/name-audio.spec.ts`.

**Produces:**
- `toneWav(options: { notes: number[]; seconds: number; rate: number }): Buffer` (mono, 16-bit).
- Markup: each `[data-name-part]` is a `<button type="button">` inside the one `<h1>`, its text the plain word, with `data-audio` holding the file's address and `aria-describedby` pointing at a hidden hint. A speaker icon sits outside the text flow and shows on hover and keyboard focus.
- Behaviour: the file is fetched on the first click, not before. While it plays the button has `data-playing`. Starting one word stops the other. The letters are split into spans only for the length of the wave and only when motion is allowed, with the button's width held, then put back.
- Tokens: `--lift-letter`, `--stagger-letter`, `--duration-letter` (300 ms or less).
- `import-audio.mjs <file> first|last`: converts a recording to mono AAC with `afconvert`, which also drops the phone's metadata, and updates `site.yaml`.

- [ ] Unit: `toneWav({ notes: [440, 660], seconds: 0.35, rate: 22050 })` starts with `RIFF` and is `44 + 22050 * 0.35 * 2` bytes, rounded to a whole sample.
- [ ] Browser: the heading reads "{first} {last}" from `site.yaml`; both words are buttons with a description; no audio request before a click and exactly one after; `data-playing` is set on click and cleared on `ended`; Enter on a focused word plays it; the focus ring is visible.
- [ ] Browser, reduced motion: a click plays and `document.getAnimations()` is empty.
- [ ] Browser, refused playback (`play()` rejects) and a missing file (the request answers 404): no page error, `data-playing` cleared, nothing moves.
- [ ] Browser: the heading's box is the same before, during and after a click.
- [ ] Build: each placeholder is under 20 KB.

### Task 3: greeting, welcome back, seen projects

**Files:** `src/lib/greeting.ts`, `src/lib/visits.ts`, `src/scripts/visitor.ts`, `src/content/site.yaml` (`greeting` block holding the seven phrases), `src/content/schemas.ts`, `src/components/Hero.astro`, `src/components/ProjectCard.astro`, `src/pages/projects/[slug].astro`, tokens, `tests/unit/greeting.test.ts`, `tests/unit/visits.test.ts`, `tests/e2e/visitor.spec.ts`.

**Produces:**

```ts
// greeting.ts
export type GreetingWords = { morning: string; afternoon: string; evening: string; night: string; returning: string; times: string; sameTime: string };
export function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night'; // 5–11, 12–16, 17–21, 22–4
export function greeting(input: { now: Date; visitorZone: string; home: { city: string; timeZone: string };
  returning: boolean; words: GreetingWords; locale?: string }): string | null; // null when a zone is unusable
// visits.ts — keys: localStorage `visits` (a count), sessionStorage `visit`, localStorage `seen-projects` (a JSON list, at most 50)
export function startVisit(local: Storage | undefined, session: Storage | undefined): { returning: boolean };
export function seenProjects(local: Storage | undefined): string[];
export function markSeen(local: Storage | undefined, slug: string): void;
```

- The greeting line keeps its place in the page source with the neutral text. Its slot reserves the height of the longest greeting at each width (`--greeting-lines`).
- A card's "Seen" mark is in the markup, hidden, and placed over a corner of the cover so showing it moves nothing.

- [ ] Unit, with `now = 2026-11-20T02:14:00Z`, home Ottawa (`America/Toronto`), locale `en-US`, comparing after turning every kind of space into a plain one:
  - `Europe/Berlin` → "You’re up late. It’s 3:14 AM for you and 9:14 PM in Ottawa."
  - `America/New_York` → "Good evening. It’s 9:14 PM for both of us."
  - `Asia/Kolkata` → "Good morning. It’s 7:44 AM for you and 9:14 PM in Ottawa."
  - `returning: true`, Berlin → "Welcome back. It’s 3:14 AM for you and 9:14 PM in Ottawa."
  - `visitorZone: 'Mars/Olympus'` → `null`.
  - `partOfDay`: 4 night, 5 morning, 11 morning, 12 afternoon, 16 afternoon, 17 evening, 21 evening, 22 night.
- [ ] Unit, visits: first call → `returning: false`, count 1; second call in the same session → still false, count 1; a new session → true, count 2; storage that throws on read or write → false and no throw; `seen-projects` holding `{oops` → `[]`; `markSeen` twice with one slug → one entry.
- [ ] Browser: the page source contains the neutral line; with a fixed clock and time zone the exact sentence shows; a second browser session starts with "Welcome back."; no `fetch` or XHR request happens on loading the home page.
- [ ] Browser: at 320, 375, 768 and 1280 wide, the buttons under the greeting sit at the same height with JavaScript on and off.
- [ ] Browser: after opening one project page, that card alone shows "Seen", and its box is unchanged.
- [ ] Browser, storage blocked: the greeting shows, no page error, no card is marked.

### Task 4: project filter

**Files:** `src/lib/filter.ts`, `src/components/ProjectFilter.astro`, `src/scripts/filter.ts`, `src/pages/index.astro`, tokens, `tests/unit/filter.test.ts`, `tests/e2e/filter.spec.ts`.

**Produces:**

```ts
export const FILTERS = ['all', ...CATEGORIES] as const;
export type Filter = (typeof FILTERS)[number];
export function parseFilter(search: string): Filter;       // exact match on the first `filter` value, otherwise 'all'
export function withFilter(url: URL, filter: Filter): URL; // sets or removes `filter`; keeps other values and the hash
```

- A group labelled "Filter projects" above the rows, one button per category that has at least one row, with `aria-pressed`. A hidden status line announces the count.
- Rows are hidden with the `hidden` attribute. The address is updated in place (no new history entry). Where the browser can animate between two states of a page, the rows animate, in 300 ms or less.

- [ ] Unit: `parseFilter('')` → `'all'`; `'?filter=ai-data'` → `'ai-data'`; `'?filter=AI-DATA'` → `'all'`; `'?filter=nope'` → `'all'`; `'?filter=systems&filter=web-apps'` → `'systems'`. `withFilter(new URL('https://x.test/?a=1#more-projects'), 'systems').href` is `https://x.test/?a=1&filter=systems#more-projects`; with `'all'` the value is removed.
- [ ] Browser, counts read from the content files: "All" is pressed at first; pressing "Systems" leaves only systems rows, ends the address with `?filter=systems`, and the status reads "Showing {n} of {total} projects."; opening `/?filter=ai-data#more-projects` arrives filtered; `/?filter=nope` shows every row with "All" pressed; pressing "All" removes the value; `history.length` does not grow.
- [ ] Browser: buttons work with Tab and Space; with reduced motion nothing animates; with JavaScript off the buttons are not shown and every row is.

### Task 5: command menu

**Files:** `src/lib/command.ts`, `src/lib/command-items.ts`, `src/components/CommandMenu.astro`, `src/scripts/command-menu.ts`, `src/scripts/theme.ts` (the theme switch, moved out of `ThemeToggle.astro` so both use it), `src/components/Nav.astro`, `src/layouts/BaseLayout.astro`, tokens, `tests/unit/command.test.ts`, `tests/e2e/command-menu.spec.ts`.

**Produces:**

```ts
export type CommandItem = { id: string; group: 'Sections' | 'Projects' | 'Explainers' | 'Links' | 'Theme';
  label: string; href?: string; action?: 'toggle-theme'; keywords?: string };
export function filterItems(items: CommandItem[], query: string): CommandItem[]; // every word of the query is in label or keywords; case and accents ignored; order kept
export function moveActive(count: number, current: number, step: 1 | -1): number; // wraps; -1 when count is 0
export function commandItems(input: { sections: { id: string; label: string }[];
  projects: { title: string; href: string; keywords: string }[]; explainers: { title: string; href: string }[];
  links: { label: string; href: string }[] }): CommandItem[];
```

- A native `<dialog>` opened with `showModal()`, holding a search box (`role="combobox"`) and a list (`role="listbox"`), all in the page's HTML at build time.
- The nav button is a drawn key: "Ctrl K", or "⌘K" on Apple devices, in a slot of fixed width; on touch screens it shows a search icon. It presses down when clicked.
- Featured projects lead to their pages, other projects to their repositories. Sections that are absent (GitHub activity when hidden) are not listed.

- [ ] Unit: `filterItems(items, 'cur rid')` → only cuRiding; `'ECO'` → EcoCart; `''` → all; `'zzz'` → `[]`. `moveActive(3, 2, 1)` → 0; `moveActive(3, 0, -1)` → 2; `moveActive(0, -1, 1)` → -1.
- [ ] Browser: Ctrl+K, ⌘K and the nav button each open it with the search box focused; typing "eco" leaves one option and Enter opens `/projects/ecocart`; the arrow keys move `aria-activedescendant` and wrap; Esc closes and focus returns to the nav button; "theme" then Enter switches the theme and closes.
- [ ] Browser: a search that matches nothing shows "Nothing matches." and Enter does nothing; from a project page a section entry leads to `/#…`.
- [ ] Browser: the list holds every section on the page, every project, both explainers and both profile links; an accessibility scan with the menu open finds nothing, in both themes; no sideways overflow at 320 wide; with JavaScript off the nav button is not shown.

### Task 6: page transitions

**Files:** `src/styles/base.css`, `src/scripts/page-transition.ts`, `src/components/ProjectCard.astro`, `src/pages/projects/[slug].astro`, tokens, `tests/e2e/transitions.spec.ts`.

**Produces:** cross-page transitions switched on in CSS, inside the motion media query. A project page's title and lead image carry fixed transition names. On the home page the same names are given to the one card being left or returned to, at the moment of navigation, so no two elements ever share a name. The image is left out when its place on the new page is off screen.

- [ ] Browser (Chrome): going from a card to its page starts a transition (`pagereveal` reports one); with reduced motion it does not.
- [ ] Browser (all engines): card to page, "Back to projects" and "Next" each land on the right page.
- [ ] Browser: at any moment no two elements on a page have the same transition name.

## Part C: server side

### Task 7: email reveal

**Files:** `src/lib/contact-token.ts`, `src/lib/rate-limit.ts`, `src/lib/contact-handlers.ts`, `src/pages/api/contact/token.ts`, `src/pages/api/contact/address.ts`, `src/components/EmailReveal.astro`, `src/scripts/email-reveal.ts`, `src/components/Hero.astro`, `src/components/Contact.astro`, `src/layouts/BaseLayout.astro`, `.env.example`, `tests/unit/contact.test.ts`, `tests/e2e/email.spec.ts`, `tests/build/budget.test.ts`.

**Produces:**

```ts
export const TOKEN_LIFETIME_MS = 60_000;
export function issueToken(secret: string, now: number): string;   // `${expiresAt}.${nonce}.${signature}`, HMAC-SHA-256
export function verifyToken(secret: string, token: unknown, now: number): boolean; // constant-time; false for anything malformed
export function createLimiter(limit: number, windowMs: number): (key: string, now: number) => boolean; // at most 10 000 keys kept
export type ContactEnv = { CONTACT_ADDRESS?: string; CONTACT_TOKEN_SECRET?: string };
export function handleToken(request: Request, env: ContactEnv, now: number): Response;
export function handleAddress(request: Request, env: ContactEnv, now: number): Promise<Response>;
```

- Both answer JSON with `cache-control: no-store` and `x-robots-tag: noindex`. POST only (405 otherwise). A request whose `Origin` is another site gets 403. More than 10 a minute from one client gets 429. Missing settings give 503 `{ "error": "unavailable" }`.
- `token`: 200 `{ token }`. `address`: body `{ token }`; a valid token gives 200 `{ address }`; a missing, altered or expired one 403; a malformed or oversized body 400.
- The page: "Email" in the top links (after LinkedIn) and in Contact. One reveal fills every Email button on the page with the address as a link, plus "Copy", and opens the mail app. With JavaScript off the buttons are hidden and Contact shows the LinkedIn line.

- [ ] Unit, token: valid at `now` and at `now + 59_999`; invalid at `now + 60_001`; invalid with a changed signature, with the expiry edited later, from another secret, and for `''`, `123` and `'a.b'`.
- [ ] Unit, limiter: ten calls allowed, the eleventh refused, allowed again after the window.
- [ ] Unit, handlers: address without a token → 403 and the body has no `@`; GET → 405; valid → the address from `env`; settings missing → 503; `Origin: https://other.test` → 403; no error body contains a setting's value.
- [ ] Browser, with both addresses mocked and a fake address built from parts: a click shows the address as a link and "Copy"; the second call carries the first call's token; "Copy" puts it on the clipboard and reads "Copied"; a mail link is opened once; the other Email button shows the address too with no further calls.
- [ ] Browser: a failed first call, and a 403 on the second, each show the failure line and leave the button usable.
- [ ] Browser, JavaScript off: no Email button; the LinkedIn line is visible.
- [ ] Build: no built file contains an address or `mailto:`.

### Task 8: resume switch

**Files:** `src/lib/resume.ts`, `src/pages/resume.pdf.ts`, `scripts/make-placeholder-pdf.mjs`, `src/assets/resume-placeholder.pdf`, `src/components/Hero.astro` (`resumeOverride` prop for the test page), `src/pages/dev/[page].astro` (`resume-on`), `tests/unit/resume.test.ts`, `tests/e2e/home.spec.ts`.

**Produces:**

```ts
export type ResumeEnv = { RESUME_ENABLED?: string; RESUME_URL?: string };
export function resumeEnabled(env: ResumeEnv): boolean; // only the exact value 'true'
export function handleResume(env: ResumeEnv, placeholder: Uint8Array, fileName: string, fetchImpl?: typeof fetch): Promise<Response>;
```

Off: 404. On with `RESUME_URL`: that file's bytes as `application/pdf`, shown in the browser under `fileName`, never cached. On without it: the blank placeholder. A failed fetch: 404. The "Resume" button is rendered only when the switch is on at build time.

- [ ] Unit: unset, `'TRUE'` and `'1'` → 404; `'true'` with no address → 200 and a body starting `%PDF-`; with an address and a stand-in fetch → those bytes; a fetch that fails → 404.
- [ ] Unit: the placeholder is under 1 KB and holds no text.
- [ ] Browser: the home page has no "Resume" link; `/dev/resume-on` has one, to `/resume.pdf`.
- [ ] Build: a normal build has no resume file in `dist/client`.

## Part D: more to read

### Task 9: GitHub activity and the daily rebuild

**Built first, on 2026-11-20, because the owner asked to see it:** the data, the section, its tests and the `build:test` script. Still to do here: the daily rebuild (it needs Task 1's adapter) and the check on the first preview build. Differences from what is written below: the site's own repository is `repository` in `site.yaml`; the squares are green, like GitHub's own graph, stepping up to the availability light's green; three commits are shown, one line each, so the list is as tall as the year beside it; month names sit above the grid where there is room.

**Files:** `src/lib/github-activity.ts`, `src/lib/rebuild.ts`, `src/pages/api/rebuild.ts`, `src/components/GitHubActivity.astro`, `src/pages/index.astro`, `src/content/site.yaml` (`links.siteRepo`), `src/content/schemas.ts`, `vercel.json` (`crons`), tokens (`--color-heat-0` to `--color-heat-4`), `tests/fixtures/github-activity.json` (made-up data), `tests/unit/github-activity.test.ts`, `tests/unit/rebuild.test.ts`, `tests/e2e/activity.spec.ts`, `tests/build/budget.test.ts`.

**Produces:**

```ts
export type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Commit = { message: string; repo: string; url: string; date: string };
export type Activity = { total: number; weeks: Day[][]; commits: Commit[] };
export function allowedRepos(projects: { data: { links: { repo?: string; extraRepos?: string[] } } }[], siteRepo: string): string[];
export function activityQuery(login: string, repos: string[]): string; // one request: calendar, plus recent commits of each repo
export function parseActivity(json: unknown, login: string, limit?: number): Activity | null;
export function loadActivity(options: { token?: string; login: string; repos: string[]; fixture?: string; fetchImpl?: typeof fetch }): Promise<Activity | null>;
export function handleRebuild(request: Request, env: { CRON_SECRET?: string; DEPLOY_HOOK_URL?: string }, fetchImpl?: typeof fetch): Promise<Response>;
```

- `loadActivity` never throws. A fixture path wins. No token, a refusal, an error body, a failed request or ten seconds without an answer each give `null` and one log line that holds no token.
- Commits: written by the owner, in an allowed public repository, newest first, five at most, headline cut at 80 characters.
- The section (`#activity`, after Explainers and before About): the count line, a 7-row grid of days that scales to any width, a "Less … More" key, and the commits with repository and date. The grid is one image to a screen reader, named by the count line.
- `/api/rebuild`: 401 unless the request carries `Authorization: Bearer {CRON_SECRET}`; then one POST to the deploy hook; 502 if that fails. The hook's address is never echoed. Vercel calls it daily at 10:00 UTC.

- [ ] Unit: the five GitHub level names map to 0–4; 53 weeks and the total pass through; a commit by someone else, in a repository off the list, or in a private one is dropped; a repository that came back empty is skipped; six commits in → the newest five out.
- [ ] Unit: `allowedRepos` returns every repository linked in the content plus the site's, and nothing else.
- [ ] Unit, `loadActivity`: no token → `null` and no request made; a rejected request → `null`; status 401 → `null`; a body with only `errors` → `null`; a good body → the data; the token appears in no log line.
- [ ] Unit, rebuild: no header → 401; wrong secret → 401; unset secret → 401; right secret → one POST to the hook and 200; hook failure → 502 and the hook address is not in the body.
- [ ] Browser (test build): the section sits between Explainers and About; the image's name is the formatted count line; five commits, each linking to a commit in one of the owner's repositories; no sideways overflow at 320; accessibility scan clean in both themes.
- [ ] Build (normal build, no token): the home page has no `id="activity"`, no link to `#activity`, and the menu has no "GitHub activity".
- [ ] On the first preview deploy the owner says whether the section shows. If it does not, the owner reads out the one log line and the token's access is widened.

### Task 10: explainer pages, and "One packet, hop by hop"

**Files:** `src/content/explainers/one-packet-hop-by-hop.md`, `src/content.config.ts`, `src/content/schemas.ts` (`explainerSchema`: `title`, `summary`, `order`), `src/pages/explainers/[slug].astro`, `src/components/Explainers.astro`, `src/components/explainers/index.ts`, `src/components/explainers/PacketHops.astro`, `src/lib/explainers/packet.ts`, `src/scripts/explainers/packet.ts`, `src/pages/index.astro`, tokens, `tests/content/helpers.ts` (`pagePaths` gains the explainers), `tests/unit/packet.test.ts`, `tests/e2e/explainers.spec.ts`, `tests/content/explainers.test.ts`.

**Produces:**

```ts
export type Field = 'eDst' | 'eSrc' | 'ipSrc' | 'ttl';
export const HOPS: readonly { name: string; short: string; caption: string; eDst: string; eSrc: string; ipSrc: string; ttl: number }[]; // the 11 stops in the owner's file
export const DESTINATION_IP = '198.51.100.7';
export const PORT = 443;
export function changedFields(step: number): Field[];
export function historyRows(step: number): { link: string; eDst: string; eSrc: string; ipDst: string; ttl: number }[];
```

- A home section `#explainers` after "More projects": one card per explainer with title and summary.
- A page per explainer: "Back to explainers", title, summary, then the widget named for its slug in `src/components/explainers/index.ts`. A content file with no widget fails the build with a message naming the slug.
- The widget keeps the source's behaviour: Previous, Next hop, Reset; the packet moves along the diagram; changed values flash; the old Ethernet header peels off and a new one attaches; the note about address translation shows at the home router only; a history table grows a row per hop. Movement is a CSS transition from tokens, 300 ms or less, so with reduced motion values simply change. A click during a move finishes the move at once. The caption is announced to screen readers. The diagram scrolls sideways inside its own labelled box on narrow screens.

- [ ] Unit: `changedFields(0)` → `[]`; `(1)` → all four; `(2)` → `['eDst', 'eSrc', 'ttl']`; `(3)` to `(6)` → `[]`; `(7)` and `(8)` → `['eDst', 'eSrc', 'ttl']`; `(9)`, `(10)` → `[]`. TTL runs 64, 63, 62, 62, 62, 62, 62, 61, 60, 60, 60. `historyRows(10)` has 11 rows, each with the same destination, the last starting "Delivered at".
- [ ] Browser: starts at "Step 0 of 10" with Previous disabled; Next shows "Step 1 of 10 · now at: Home router", TTL 63 and the translation note; at step 2 the note is gone; at step 10 Next is disabled and "Packet delivered." shows; Reset returns to step 0; the table has one more row than the step.
- [ ] Browser: all three buttons work from the keyboard; with reduced motion nothing animates after Next; accessibility scan clean in both themes; the page does not scroll sideways at 320.
- [ ] Content: no explainer file or script contains a hex colour, any organisation named in `experience.yaml`, or the company name removed under decision 7.

### Task 11: "NRZ vs PAM4"

**Files:** `src/content/explainers/nrz-vs-pam4.md`, `src/components/explainers/SignalLevels.astro`, `src/lib/explainers/signal.ts`, `src/scripts/explainers/signal.ts`, tokens (`--color-wrong` for misread symbols), `tests/unit/signal.test.ts`, `tests/e2e/explainers.spec.ts`.

**Produces:**

```ts
export type Levels = 2 | 4 | 8;
export function mulberry32(seed: number): () => number;
export function gauss(rng: () => number): number;
export function erfc(x: number): number;
export function theorySER(levels: Levels, sigma: number): number;
export function levelsOf(levels: Levels): number[];
export function labelsOf(levels: Levels, gray: boolean): string[];
export function decide(received: number, levels: Levels): number;
export function simulate(levels: Levels, sigma: number, seed: number, symbols?: number): { errors: number; ok: number[]; bad: number[]; bins: number };
```

The widget keeps the source's behaviour: three format buttons, the Gray-code switch, Resample, the noise slider, four readouts, and three drawings (waveform, eye diagram, histogram). The drawings take their colours from the tokens and are redrawn when the theme or the width changes. Each drawing is an image to a screen reader with a one-line name; the numbers are already text in the readouts. Wrong decisions keep their × mark, so colour is never the only signal.

- [ ] Unit: `levelsOf(4)` → `[0, 1/3, 2/3, 1]`; `labelsOf(4, true)` → `['00', '01', '11', '10']`; `labelsOf(8, false)[7]` → `'111'`; `decide(0.4, 4)` → 1; `decide(-3, 4)` → 0; `decide(9, 4)` → 3; `erfc(0)` → 1 and `erfc(1)` → 0.157299, each within 1e-6; `theorySER(2, 0)` → 0; `theorySER(4, 0.05)` within 5% of 6.4e-4; for σ of 0.05, 0.1, 0.2, 0.3: `theorySER(4, σ) > theorySER(2, σ)`.
- [ ] Unit: `simulate` with one seed twice gives the same result; `simulate(2, 0, 1).errors` → 0; `simulate(4, 0.05, 20260101).errors / 20000` within 30% of the theory value.
- [ ] Browser: PAM4 is pressed at first, σ reads 0.050, gap "1/3", bits "2"; pressing NRZ gives gap "1", bits "1"; the slider at 0 gives "< 1 in 20,000" and "0"; arrow keys on the slider change the σ readout.
- [ ] Browser: each drawing has size and is not blank; switching the theme changes its pixels; no sideways scroll at 320; accessibility scan clean in both themes.

## Part E: being found

### Task 12: link previews, sitemap, structured data

**Files:** `package.json` (`satori`, `@astrojs/sitemap`, and the two static font packages, for build only), `astro.config.mjs`, `src/lib/og.ts`, `src/pages/og/home.png.ts`, `src/pages/og/projects/[slug].png.ts`, `src/pages/robots.txt.ts`, `src/layouts/BaseLayout.astro` (props `image?`, `imageAlt?`), `src/pages/index.astro`, `tests/build/previews.test.ts`.

**Produces:**
- `renderOg(card: { title: string; line: string; badge?: string; picture?: Buffer; contain?: boolean; address: string }): Promise<Buffer>`: a 1200×630 PNG in the site's fonts and light-theme colours, read from the tokens.
- Home card: name, pitch, portrait, address. Project card: award pill if any, title, one-liner, cover, address. Explainer pages use the home card.
- Every page: `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:image` with width, height and alt, and `twitter:card`.
- Home page: structured data for a person (name, address, picture, pitch, the two profile links). No contact field.
- `sitemap-index.xml` listing the real pages only; `robots.txt` pointing at it.

- [ ] Build: every real page carries the tags; `og:url` equals the canonical address; each `og:image` is on the site's own address, exists, measures 1200×630 and is under 300 KB; there are seven of them.
- [ ] Build: the sitemap lists exactly the real pages, on the site's address, with no `/dev/` or `/og/` entry; the structured data parses, is a `Person`, and its links equal `site.yaml`'s.
- [ ] The owner sees all seven pictures and approves the look.

### Task 13: favicon

**Files:** `src/pages/favicon.svg.ts`, `src/pages/favicon-32.png.ts`, `src/pages/apple-touch-icon.png.ts`, `astro.config.mjs` (redirect `/favicon.ico`), `src/layouts/BaseLayout.astro`, `tests/build/previews.test.ts`.

- [ ] Build: every page links the three icons; the PNGs measure 32 and 180; the SVG holds shapes only (no text element, no font); its background equals the accent token.
- [ ] The owner sees it in a tab, light and dark, and approves it.

### Task 14: analytics

**Files:** `src/layouts/BaseLayout.astro`, `tests/build/budget.test.ts`.

Vercel Web Analytics: one deferred script tag for `/_vercel/insights/script.js` in the layout, rendered only when `onVercel` is true, so local and CI builds never ask for it. The owner switches Analytics on in the dashboard (Task 17).

- [ ] Build: a local build makes no reference to `/_vercel/`; the JavaScript budget test ignores the analytics script.
- [ ] Checked on the preview or the live site: one analytics request on a page view, and no cookie set.

### Task 15: security headers and content security policy

**Files:** `vercel.json` (`headers`), `astro.config.mjs` (`security.csp`), `tests/content/headers.test.ts`, `tests/build/budget.test.ts`, `tests/e2e/csp.spec.ts`.

- Headers on every address: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security: max-age=63072000`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Policy in each page: `default-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `media-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`; scripts and styles allowed by hash.
- If some style cannot be covered by a hash, styles alone fall back to `'unsafe-inline'`, scripts stay hashed, and the reason is written here.

- [ ] Content: `vercel.json` holds exactly the headers above.
- [ ] Build: every page has the policy; its script rule has no `'unsafe-inline'` and no `'unsafe-eval'`; no built page has a `style="…"` attribute.
- [ ] Browser, every engine: loading each page and using each feature (theme, menu, filter, name audio, email with mocks, both explainers) raises no policy violation.

## Part F: checks and ship

### Task 16: speed in CI, tablet width, links

**Files:** `scripts/measure-speed.mjs`, `package.json` (`test:speed`), `.github/workflows/ci.yml`, `playwright.config.ts` (a `tablet` project, 768×1024), `tests/e2e/links.spec.ts`.

- `measure-speed.mjs` serves the test build, runs a pinned Lighthouse three times on the home page, the first featured project and one explainer on a simulated mid-range phone, takes the middle run, prints a table, and fails unless: score 95 or higher, largest content within 1.8 s, layout shift under 0.05.
- [ ] CI runs it after the browser tests.
- [ ] Every browser test passes at tablet width.
- [ ] Links: every internal link resolves, explainers included; every outside link is `https` and on a host the content files name.

### Task 17: repository README and the Vercel checklist

**Files:** `README.md`, `docs/vercel-checklist.md`, `.env.example`, `CLAUDE.md` (commands), `tests/content/settings.test.ts`.

- README: what the site is, how it is built, the commands, where the rules and the add-a-project recipe live. The owner approves the text.
- Checklist, in the order the owner does it: the settings (`CONTACT_ADDRESS`, `CONTACT_TOKEN_SECRET`, `CRON_SECRET`, `DEPLOY_HOOK_URL`, and `GITHUB_ACTIVITY_TOKEN`, already set), with which need Preview as well as Production and how to make a random value without it passing through a chat; a deploy hook for `main`; Analytics on; a firewall rule limiting `/api/contact/` to 10 requests a minute per visitor, and bot protection if the plan has it; `siddigz.com` as the primary domain at ship.

- [ ] Content: every setting read anywhere in `src/` is named in `.env.example` and in the checklist; `.env.example` holds no values.

### Task 18: checks before ship

No new code unless a check fails.

- [ ] The whole suite, the speed check, and the Modern Web Guidance legacy scan, with each finding looked at.
- [ ] Pictures at phone, tablet and laptop width, both themes, sent to the owner.
- [ ] Every outside link fetched once by hand.
- [ ] The built site searched once more for an address or a setting's value.
- [ ] With access to the preview (owner's choice, item 4 at the top): the email flow end to end, the activity section showing, the headers present, one analytics request, speed measured on the real address, and the preview card in LinkedIn's inspector if the address is public by then.
- [ ] The owner reads every new piece of text on the preview and says so. The approval is recorded in the private notes.
- [ ] With the owner's yes, a second reviewer reads the whole branch before the pull request.

### Task 19: ship

- [ ] Open a pull request from `revamp` into `main`, with a plain description. The owner merges it.
- [ ] The owner makes `siddigz.com` the primary domain.
- [ ] On the live site: every page answers; headers; email; analytics; the preview card in LinkedIn's inspector; speed on the real address, if not done in Task 18.
- [ ] The private steps recorded in the git-ignored notes, each with the owner's go-ahead at the time.
- [ ] The next morning: the daily rebuild ran.
- [ ] One commit to the GitHub profile README (the owner sees the text first). The owner sets the six pinned repositories.
- [ ] Reminders to the owner: the LinkedIn items and the GPA in three places. The matching inbox items are marked done as they are done.
- [ ] Whenever the recordings arrive: `scripts/import-audio.mjs`, listen, commit.
