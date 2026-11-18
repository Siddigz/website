# Rules for this repository

Design: `docs/superpowers/specs/2026-11-16-website-revamp-design.md`. Private notes: `CLAUDE.local.md` (git-ignored).

This repository is public. Everything committed here must be safe for anyone to read.

## Rules

**Privacy and the public repo**

1. No email address anywhere in the repo, the built site or its scripts.
2. No real resume in the repo. Only the blank placeholder.
3. Secrets and private settings live in Vercel settings and a git-ignored
   `.env`. Never in code.
4. Only public repositories are linked. Which projects are deliberately left
   off the site is recorded outside this repo (in a git-ignored
   `CLAUDE.local.md`), not here.
5. Experience entries have no description. Organisation, title, team, dates.
6. No employer or vendor product names in explainers or project text.
7. Nothing from another project's private data ever appears here.
8. Photos that show other people are used only with their consent. Consent
   was confirmed for the event photos gathered on 2026-11-16.
8a. Every photo has its location and camera metadata stripped before it is
   committed.

**Honesty**

9. Awards are worded exactly as given. Attendance is never worded as a win or
   a build.
10. Every project's `result` line must be true and checkable from the repo,
    a demo or an award.

**Speed**

11. Pages are built ahead of time. No page waits on a client-side fetch to
    show its content.
12. Budget, measured on a simulated mid-range phone before every ship:
    performance score 95 or higher, largest content visible within 1.8
    seconds, layout shift under 0.05, and at most 60 KB of compressed
    JavaScript on the home page, not counting analytics.
13. Images are served at the size the screen needs, in a modern format, with
    width and height set so nothing jumps.
14. Fonts are self-hosted. No third-party requests are needed to render a
    page.

**Motion**

15. Scrolling is never altered.
16. Every animation is garnish. With animations off, every page still reads
    completely and all controls work.
17. Reduced-motion settings are respected.
18. Interface transitions take 300 ms or less and never delay a click.

**Access**

19. Everything works with a keyboard. Focus is always visible.
20. Text contrast meets WCAG AA in both themes.
21. Every image has alt text. Audio buttons are labelled.
22. The site is checked at phone, tablet and desktop widths before ship.

**Code**

23. TypeScript in strict mode.
24. All colours, type, spacing and motion values are design tokens. No
    one-off values in components.
25. Content is never hard-coded in a component. It comes from `src/content/`.
26. Use the Modern Web Guidance skill for HTML, CSS and browser JavaScript
    work, and run its legacy scan before ship.
27. Work happens on a branch. `main` only receives changes the owner has
    approved, because `main` is production.
28. Commit messages and PR text carry no AI attribution.

## Adding a project

1. Create `src/content/projects/<slug>.md` with the fields in section 7. Reuse
   the README's one-liner.
2. Put images in `src/assets/projects/<slug>/`.
3. If it should be featured, set `featured` and write the three brief blocks.
4. Run the checks. Open the preview address. Confirm the card, the page and
   the preview image.
5. Update the GitHub profile README with the same one-liner.

## Commands

- `npm run dev`: local site at http://localhost:4321
- `npm run check`: type check
- `npm test`: unit and content tests
- `npm run build && npm run test:build`: build, then budget checks on the output
- `npm run test:e2e`: browser tests against the built site
