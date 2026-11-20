# Website revamp, stage 2: visual directions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put three complete looks on the preview so the owner can pick one or mix them, then apply the chosen look everywhere.

**Architecture:** A look is a value of `data-look` on `<html>`. Each look is one stylesheet in `src/styles/looks/` that overrides the design tokens and adds the few rules that are unique to it. Components read tokens only, so the same markup serves all three. A preview-only switcher sets the attribute and remembers it.

**Tech stack:** Astro 7 (its built-in fonts feature with the `npm` provider), plain CSS, a few lines of browser JavaScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-website-revamp-design.md`, section 9.

## Global constraints

- Text and page structure stay exactly as approved on 2026-11-19. No new visible text on the site itself.
- Rule 14: fonts are self-hosted. Nothing third-party is fetched to render a page, and nothing is fetched from a CDN at build time (`remote: false`).
- Rule 15 to 18: scrolling is never altered; every animation is garnish; reduced motion is respected; transitions take 300 ms or less.
- Rule 19 to 22: keyboard, visible focus, WCAG AA contrast in both themes, checked at phone and desktop widths.
- Rule 24: every colour, type, spacing and motion value is a token. A look file declares its values as custom properties and its rules use `var()` only.
- Rule 12: at most 60 KB of compressed JavaScript on the home page.
- Global stylesheets use no CSS nesting.

## Review focus

- A stored look name that no longer exists (after the choice is made) must fall back to the default, not leave the page unstyled.
- Storage blocked or throwing: the switcher still switches for this visit.
- With JavaScript off the default look renders completely.
- Each look at 375 px wide: nothing overflows sideways.
- Reduced motion: no look leaves anything moving.

---

## Part A: three looks to choose from (this pass)

### Task 1: the look value

**Files:** create `src/lib/look.ts`, `tests/unit/look.test.ts`.

**Produces:** `LOOKS = ['crisp', 'warm', 'editorial'] as const`, `type Look`, `DEFAULT_LOOK = 'crisp'`, `LOOK_LABELS: Record<Look, string>`, `LOOK_STORAGE_KEY = 'look'`, `isLook(value): value is Look`, `pickLook(fromAddress: unknown, stored: unknown): Look` (address wins, then storage, then the default).

- [ ] Test: `pickLook('warm', 'crisp') === 'warm'`; `pickLook(null, 'editorial') === 'editorial'`; `pickLook('nope', 'nope') === 'crisp'`; `pickLook(null, null) === 'crisp'`.
- [ ] Implement, run `npm test`.

### Task 2: fonts

**Files:** `package.json` (dev dependencies), `astro.config.mjs`, `src/layouts/BaseLayout.astro`, `tests/build/budget.test.ts`.

| Look | Headings | Body | Labels |
|---|---|---|---|
| Crisp | Geist | Geist | Geist Mono |
| Warm | Bricolage Grotesque | Figtree | Figtree |
| Editorial | Fraunces | IBM Plex Sans | IBM Plex Mono |

- [ ] Install the `@fontsource` packages as dev dependencies. Configure each family under `fonts` with `fontProviders.local()`, naming the Latin `.woff2` file inside the package, and a `cssVariable` named `--font-<family>`. (The `npm` provider with `remote: false` hands Astro `file://` addresses it cannot read.)
- [ ] Render one `<Font>` per family in the layout head. Preload only the default look's body font.
- [ ] Build test: every `url()` in the built CSS and HTML that ends in `.woff2` is a same-site path, and at least seven `.woff2` files exist in `dist/`.

### Task 3: the switcher and the attribute

**Files:** create `src/components/LookSwitcher.astro`, `tests/e2e/looks.spec.ts`; modify `src/layouts/BaseLayout.astro`.

- `<html data-look="crisp">` is rendered by the server. The inline head script that already applies the stored theme also applies `pickLook(address ?look=, localStorage look)` before first paint.
- The switcher is a fixed bar at the bottom: a group labelled "Preview look" with one button per look, `aria-pressed` on the current one. It is not rendered when `VERCEL_ENV` is `production`.
- [ ] Browser tests: three buttons; a click changes `data-look`, the pressed state and the page background; the choice survives a reload and carries to a project page; `/?look=warm` selects Warm; `/?look=nope` gives the default; blocked storage still switches; the bar never covers the end of the page (the body reserves its height).

### Task 4: component tokens

**Files:** `src/styles/tokens.css`, `src/styles/base.css`, the components.

New tokens with neutral defaults, read by the components in place of the generic ones: `--font-heading`, `--weight-heading`, `--tracking-heading`, `--tracking-display`, `--radius-card`, `--radius-button`, `--radius-photo`, `--radius-thumb`, `--radius-pill`, `--shadow-card`, `--shadow-card-hover`, `--shadow-photo`, `--shadow-button`, `--color-card-border`, `--color-accent-2`, `--color-on-accent`, `--ease-spring`.

- [ ] All existing tests still pass with the neutral values (no visible change).

### Task 5: nav shows the current section

**Files:** `src/components/Nav.astro`, `tests/e2e/looks.spec.ts`.

- An `IntersectionObserver` marks the link of the section under the middle of the screen with `aria-current="true"`. The mark slides between links with CSS anchor positioning where it exists; elsewhere the current link gets a static underline.
- [ ] Browser test: scrolling to Projects sets `aria-current` on the Projects link and on no other; at the top of the page no link is current.

### Task 6 to 8: the three looks

**Files:** create `src/styles/looks/crisp.css`, `warm.css`, `editorial.css`; modify `tests/content/styles.test.ts` to cover them.

| | Crisp product | Warm and playful | Editorial engineer |
|---|---|---|---|
| Background | near-white / near-black, faint dot grid behind the top | cream / deep navy, soft colour glow; stars in dark | warm paper with grain / warm ink |
| Accent | one blue | violet to pink | vermilion |
| Headings | medium weight, tight | heavy, friendly | serif, numbered sections |
| Cards | flat, hairline, small corners, light follows the cursor | big corners, tinted shadow, springy lift and tilt | no boxes: ruled figures, image zooms inside its frame |
| Photo | small corners, hairline ring | tilted, floats gently, straightens on hover | square, hard offset block of accent |
| Buttons | first is solid, rest outlined | pills that press down | ink-ruled boxes that fill with ink |

- [ ] Content test (`tests/content/looks.test.ts`): each look file uses no nesting, declares every colour for light and for dark, and its text colours meet WCAG AA against its backgrounds, worked out from the declared values.
- [ ] Browser tests, for each look in both themes: no accessibility violations on the home page and one project page; no sideways overflow at 375 px; the heading font is the look's own and is loaded from this site; with reduced motion nothing is animating.

### Task 9: checks and hand-over

- [ ] `npm run check`, `npm test`, `npm run build && npm run test:build`, `npm run test:e2e`.
- [ ] Screenshots of all three, light and dark, phone and desktop. Push. Give the owner the preview address.

## Part A2: the owner chose Warm; three accent colours (2026-11-19)

Done in one pass after the owner's review of Part A.

- Warm became the one look: `src/styles/looks/warm.css` moved to `src/styles/look.css`, its rules now under `:root[data-look]`. Crisp and Editorial and their five font packages are deleted.
- Changes the owner asked for: the name in one colour; the availability dot is green and pings three times.
- `LOOKS` is now `['blue', 'teal', 'orange']`. Each has a file in `src/styles/looks/` that sets only its accents, the shadow tint and two glows. The switcher is labelled "Colour".
- Two colours are mixed in oklab, not oklch: with white or black on one side, oklch drifts the hue through pink.
- Tests follow: contrast is worked out from the shared values plus each version's accents; the photo test measures the photo itself, because the tilt widens the box drawn around it.

## Part B: the owner chose blue; the look becomes the site's own (2026-11-19)

Done.

- `look.css` and the blue values are folded into `tokens.css`, `base.css` and the components. The other colours, the switcher, the `look` helper, the `data-look` attribute and their tests are deleted. The tokens that only existed to let looks differ (`--color-card-*`, `--color-header-bg`, `--tracking-label`, `--transform-label`, `--style-result`, `--font-mono`) are gone.
- `.button` and `.pill` are shared classes in `base.css`. The first button in a list is the filled one.
- Browser tests run in Chrome (laptop and phone size), Firefox (laptop) and Safari's engine (laptop and phone size): 478 tests. Two tests were adjusted for Safari's habits (a clicked checkbox is not focused; Tab reaches links only with Option held).
- Left from stage 1 and now done: a `theme-color` meta that takes the page background from the tokens (`src/lib/colour.ts`) and follows a pinned theme; a tap-highlight colour; curly apostrophes in the plain content strings, with a test that keeps them.
- The blanket reduced-motion rule from stage 1 is removed. Safari reported its 0.01 ms transitions as still running, and nothing needs it: all movement is opt-in.
- Speed, on Lighthouse's simulated mid-range phone, three runs, local build served compressed: home page score 100, largest content at 1.66 s (budget 1.8 s), layout shift 0. A project page: score 100, 0.61 s, shift 0. To get there the stylesheets are now inlined in each page (`build.inlineStylesheets: 'always'`), and the test server compresses text as a host does. Before both changes the home page measured 2.03 s.

Decided by the owner on 2026-11-20:

- No section numbers.
- Section titles stay in sentence case ("Featured projects").
- Skill pills keep their three tints by position. The colour stays decorative; the skills are not grouped.

The owner approved the finished look on 2026-11-20, from pictures of the home page (laptop and phone, light and dark) and one project page. Stage 2 is complete.

For stage 3: run the speed measurement in CI, and measure once more on the real preview address.
