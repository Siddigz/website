# siddigz.com

The source of my personal site: who I am, what I have built, and a couple of
interactive explainers. Live at [siddigz.com](https://siddigz.com).

## How it is built

- **[Astro](https://astro.build), TypeScript in strict mode, plain CSS.** Every
  page is built ahead of time. No UI framework is sent to the browser: each
  interactive piece is a small script of a few kilobytes.
- **Content is data.** Projects, experience, awards and every sentence on the
  site live in `src/content/`. Components only lay them out.
- **Design tokens.** Every colour, size, spacing and motion value comes from
  `src/styles/tokens.css`, in a light and a dark theme.
- **A small server side**, on Vercel, for the few things that must not be in a
  static file: the contact address (handed out only for a short-lived signed
  token), an optional resume, and a daily rebuild that keeps the GitHub
  activity current. Secrets are settings on the host, never in this repo.
- **Fast and private by default.** Self-hosted fonts, no third-party requests
  to render a page, a strict content security policy, and cookie-free
  analytics.

## What is tested

Every push runs, in order: a type check, unit and content tests, a production
build, checks on the built files, browser tests in Chrome, Firefox and Safari's
engine at phone, tablet and laptop sizes (including accessibility scans in both
themes), and a speed measurement on a simulated mid-range phone with a fixed
budget.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local site at http://localhost:4321 |
| `npm run check` | Type check |
| `npm test` | Unit and content tests |
| `npm run build && npm run test:build` | Build, then checks on the output |
| `npm run test:e2e` | Browser tests against a test build |
| `npm run test:speed` | Speed budget on a simulated phone |

Copy `.env.example` to `.env` to try the server-side pieces locally. Nothing
needs a setting to build: without them, those pieces are simply left out.

## Where things are

| Path | What is there |
|---|---|
| `src/content/` | All content and wording |
| `src/components/`, `src/pages/`, `src/layouts/` | Layout |
| `src/lib/` | Logic, unit tested, shared by the build, the server and the browser |
| `src/scripts/` | The browser side of each interactive piece |
| `src/styles/tokens.css` | Design tokens |
| `tests/` | Unit, content, build and browser tests |
| `CLAUDE.md` | The rules this repository keeps, and how to add a project |
| `docs/` | The design, the build plans and the hosting checklist |
