# Website revamp: design

Date: 2026-11-16
Status: draft, awaiting approval
Branch: `revamp` (the live site on `main` is untouched until ship)

This repository is public. This document, and everything else committed here,
must be safe to read by anyone. See "Rules" for what never goes in the repo.

## 1. Intent

Replace the current single-file portfolio with a personal site that a recruiter
can read in 30 seconds and an interviewer can dig into for five minutes.

The site is for software engineering internship and new-grad applications at
large tech companies. The current site frames its owner as a low-level systems
programmer. The new one frames him as a software engineer who ships: it leads
with results (awards, working products, numbers), puts web, app and data work
first and systems work after, and feels like a polished product itself.

The owner will keep building projects. Adding one must take minutes, and he
will usually ask Claude to do it, so the steps are written down as a recipe.

## 2. Audience

| Visitor | Time | What they need |
|---|---|---|
| Recruiter, arriving from a resume or LinkedIn | ~30 seconds | Who he is, what term he is looking for, proof he is good, how to reach him |
| Engineer or interviewer | ~5 minutes | What each strong project does, what he built, the result, a demo |
| A friend or fellow student | Any | Something fun to poke at |

## 3. Goals, non-goals, anti-goals

**Goals**

- The top two screens of the home page answer the recruiter's questions on
  their own.
- Every featured project has a brief page: problem, what was built, result,
  demo.
- Fast on every device. See the speed budget in "Rules".
- Small interactive details that respond to the visitor, in the spirit of
  joshwcomeau.com.
- Adding a project is one new file plus its images.
- A good-looking preview card when the link is pasted into LinkedIn or a
  message.
- The contact email is reachable by a human in one click and is not readable
  by scrapers.

**Non-goals**

- No blog or writing section.
- No "ask an AI about me" chatbot.
- The resume is not a content source for the site. They are maintained
  separately.
- No ongoing automatic sync with the GitHub profile README. One manual commit
  at ship brings the README in line (see "Ship checklist").
- No CMS or admin screen. Content is files in the repo.

**Anti-goals** (the site fails if any of these are true, even if it works)

- Scroll hijacking, or any navigation that does not behave like a normal page.
- An animation that delays reading, blocks content, or causes layout to jump.
- A bland text-only page with no personality.
- Wording that claims more than is true (for example, presenting attendance at
  an event as a win).
- Any personal data, secret or private repository name in the repo.

## 4. Constraints

- **Hosting:** Vercel, as today. Four domains point at the site. Today
  `siddig.net` is the primary one and the rest redirect to it. The new site
  uses `siddigz.com` as the primary address everywhere; the owner switches
  the primary domain in Vercel at ship. The address is one value in
  `site.yaml`, so changing it later is a one-line edit.
- **Deploys:** a push to `main` deploys to production. All revamp work happens
  on the `revamp` branch, which gets its own Vercel preview address on every
  push.
- **Public repo:** see "Rules".
- **Photos of the owner:** not available yet. The top of the home page must
  look complete with no photo and accept one later with no redesign.
- **Voice recordings:** not available yet. Placeholder sounds stand in.
- **Employer detail:** experience entries show organisation, title, team and
  dates only.
- **Vercel access:** the builder has no access to the Vercel account. Anything
  that can be set from the repo is set there (framework and build settings go
  in `vercel.json`). Everything else is a short written checklist the owner
  follows in the Vercel dashboard: private settings for both Preview and
  Production, turning on Analytics, a rate-limit rule, and a deploy hook.
- **Source material outside the repo** (on the owner's machine, copied in at
  the start of the build):
  - The two explainers: two self-contained HTML files in `~/personal/demos/`.
    Porting them is a restyle, not a rewrite.
  - Event photos: four zip files in `~/Downloads/`, one per event (cuHacking 7,
    AGI hackathon, Hack the North, uOttaHack). The zips and the unused photos
    never enter the repo. Only the handful of shots actually shown on a page
    are copied in, resized, with location and camera metadata stripped.

## 5. Approaches considered

**A. Astro (chosen).** A static-site tool built for content sites. Content
lives in typed files; pages are built ahead of time into plain HTML; almost no
JavaScript is sent unless a component asks for it. Page-to-page transitions
and responsive images are built in. One small server function on Vercel
handles the email reveal and the resume switch.
Trade-off: less widely known than React.

**B. Next.js (React).** Widely recognised, and complex interactive widgets are
easy. Trade-off: it sends far more JavaScript for what is mostly a reading
site, so speed needs ongoing effort, and there is more to maintain.

**C. Hand-written HTML, as today.** Rejected. Adding a project means editing
several places by hand, and six project pages would duplicate one layout.

The owner chose A. It matches the three priorities directly: fast by default,
content as files, interactivity added only where wanted.

## 6. Site structure

### Pages

| Address | What it is |
|---|---|
| `/` | Home: one normal scrolling page with the whole story |
| `/projects/<slug>` | One brief page per featured project |
| `/explainers/<slug>` | One page per interactive explainer |
| `/404` | Not-found page |

### Home, top to bottom

```
┌──────────────────────────────────────────────────────────┐
│ Siddig Ahmed      Projects  Experience  About    ⌘K  ◐   │ nav
├──────────────────────────────────────────────────────────┤
│ [Siddig] [Ahmed]                             (photo slot, │ top
│ One-line pitch                                empty until │
│ Looking-for line (can be switched off)        a photo is  │
│ School line · GPA · Expected April 2028       supplied)   │
│ Greeting line (differs per visitor)                       │
│ GitHub · LinkedIn · Email · (Resume, when on)             │
├──────────────────────────────────────────────────────────┤
│ Proof strip: awards, scholarship, honours                 │
├──────────────────────────────────────────────────────────┤
│ ‹ Python · TypeScript · React · C++ · SQL · Docker · … ›  │ skills strip,
├──────────────────────────────────────────────────────────┤ always moving
│ Experience: one line per role                             │
├──────────────────────────────────────────────────────────┤
│ Featured projects: large cards, each opens its page       │
├──────────────────────────────────────────────────────────┤
│ More projects: compact rows, filter by category           │
├──────────────────────────────────────────────────────────┤
│ Explainers                                                │
├──────────────────────────────────────────────────────────┤
│ GitHub activity                                           │
├──────────────────────────────────────────────────────────┤
│ About: short bio, event photos, activities, tools I use   │
├──────────────────────────────────────────────────────────┤
│ Contact                                                   │
└──────────────────────────────────────────────────────────┘
```

Decisions behind the order:

- Experience sits above projects because internships are the first thing a
  recruiter checks, and with one line per role it costs little space.
- The old "Involvement" section is split. Hackathon wins go to the proof strip
  and the project pages. Clubs, organising and volunteering go to About.
- Skills are a single moving strip near the top, not a section of lists (see
  "Skills strip" in section 8). Each project also shows its own stack.
- Navigation is a top bar, the same on every page and on phones. It shows the
  current section with an animated indicator.

### Project page

Brief by rule: at most about 120 words of body text, in three short blocks.

1. Title, one-liner, award badge if any, links (repo, live app, video)
2. **Problem** (one or two sentences)
3. **What I built** (two to four sentences, names the stack in context)
4. **Result** (a number, an award, or what it enabled)
5. Media: embedded video or live demo if one exists, then screenshots
6. Link to the next featured project

Body text is drafted by Claude from the project's README and code. The owner
corrects it. He does not write it from scratch.

## 7. Content model

All content is files under `src/content/`, checked against a schema at build
time. A file with a missing or wrong field fails the build with a clear
message.

### Projects: `src/content/projects/<slug>.md`

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `oneLiner` | yes | Same sentence as the GitHub profile README uses |
| `category` | yes | `web-apps`, `ai-data` or `systems` |
| `stack` | yes | List of technologies |
| `date` | yes | Year and month, for ordering |
| `links.repo` | yes | Public repository only |
| `links.live`, `links.video` | no | |
| `featured` | no | A number. Sets the order among featured projects. Present means the project gets a large card and its own page. |
| `result` | featured only | One short measurable line shown on the card |
| `award` | no | `{ name, event }`. Shown as a badge. |
| `cover` | featured: yes; others: optional | Image shown on the card and the preview card |
| `gallery` | no | Extra images for a featured project's page |
| body | featured only | The three short blocks |

Projects without `featured` appear as compact rows that link to the
repository. A row with a `cover` shows it as a small thumbnail; a row without
one shows none.

### Other content

- `src/content/explainers/`: title, summary, order, and the explainer itself.
- `src/content/experience.yaml`: organisation, title, team, start, end, logo.
  No description field exists, by design.
- `src/content/proof.yaml`: the proof-strip items, each with a label, a
  detail and an optional link.
- `src/content/skills.yaml`: the ordered list shown in the skills strip.
- `src/content/about.md`: the bio and activities.
- `src/content/site.yaml`: name, pitch, the "looking for" line, school line,
  GPA, expected graduation, social links, home city and time zone for the
  greeting.

## 8. Features

### "Looking for" line

One generic line at the top, for example "Open to software engineering
internships". It names no term or year, so it does not go stale. It has an
on/off switch in `site.yaml`. When off, the line is not rendered and the top
closes up with no gap. Changing the switch or the wording is a one-line edit.

### Name pronunciation

The two words of the name at the top are separate buttons. Clicking one plays
a short recording of that word. There is no instruction text; a small speaker
icon appears on hover and focus. Placeholder sounds ship until real recordings
are supplied. The audio files load only when first needed.

### Skills strip

One horizontal strip that scrolls sideways on its own, continuously, and loops
through every skill in `skills.yaml`. The order in the file puts the skills
large tech companies screen for first.

- It pauses when hovered or focused.
- With reduced motion set, it does not move. It becomes a normal wrapped list.
- It is built with CSS only, so it costs no JavaScript.
- Screen readers get one plain list. The duplicate copy needed for a seamless
  loop is hidden from them.
- It moves on its own track and never affects page scrolling.

### Greeting that differs per visitor

One line near the top built from the visitor's own clock and the owner's time
zone. It changes by time of day and shows both local times. It uses only the
browser's clock: no location lookup, nothing sent anywhere. The server-built
page contains a neutral line of the same height, so nothing jumps when the
real line appears.

### Welcome back

On a second or later visit the greeting says so, and project cards the visitor
has already opened are marked as seen. This is stored only in the visitor's
browser. If storage is unavailable the site behaves as a first visit.

### Email reveal

The address appears nowhere in the repository, the built pages or the scripts.

- "Email" is a button. The page itself stays prebuilt and contains no token.
- Clicking it makes two calls to server functions. The first returns a
  short-lived signed token. The second accepts only a valid, unexpired token
  and returns the address. A bare request to the second function fails.
- The second function reads the address from a private Vercel setting.
- The page then shows the address with a copy button and opens the mail app.
- Without JavaScript, the button is replaced by a line pointing to LinkedIn.
- Rate limiting is a Vercel firewall rule on those two addresses, set by the
  owner from the checklist. If the plan does not offer one, the functions
  apply a best-effort limit themselves and no outside service is added.
- Vercel's built-in bot protection is turned on as well if the plan has it.
- The private setting exists for Preview too, so the whole flow can be tried
  on the preview address before ship.

### Resume download (built, off)

- A private Vercel setting turns it on or off. It ships off.
- While off: no button is rendered, and the resume address returns not found.
- The repo only ever contains a blank placeholder PDF, used in previews and
  tests.
- When turned on later, the real PDF is stored outside the repo. Where is left
  to the builder (see section 13).

### Project filter

Buttons above "More projects": All, Web & apps, AI & data, Systems. Filtering
is instant and animates the rows. The chosen filter is reflected in the
address so it can be linked.

### Command menu

`⌘K` on Mac, `Ctrl K` elsewhere, or a click on the key hint in the nav. It
lists sections, projects, explainers, outside links and the theme switch, and
filters as the visitor types. The key hint in the nav is a drawn keyboard key
that visibly presses when clicked.

### GitHub activity

A contribution heatmap for the past year and the most recent public commits.
Data is fetched when the site is built, not in the visitor's browser, and the
site rebuilds once a day. If the fetch fails, the build still succeeds and the
section shows the last good data or hides itself. The access token is
read-only, lives in a private Vercel setting, and is created by the owner.

### Explainers

The owner's two interactive demos, ported as pages and restyled to the site's
theme, including dark mode:

1. One packet, hop by hop: which headers change
2. NRZ vs PAM4: levels, noise and misread symbols

They keep their behaviour. They contain no employer or vendor product names.

### Light and dark mode

Follows the system setting, with a toggle that overrides it and is remembered.
No flash of the wrong theme on load. Some decorative elements change with the
theme, not only the colours.

### Page transitions

Moving between the home page and a project page animates: the card's image and
title carry over into the page header. Browsers without support get a normal
page load.

### Link previews and being found

- Every page has a title, description and canonical address on `siddigz.com`.
- A preview image (1200×630) for the home page, and one generated per project
  page from its title, one-liner and cover.
- Checked with LinkedIn's preview inspector before ship.
- A sitemap, and structured data describing the owner as a person.

### Analytics

Vercel Web Analytics: page views and referrers, no cookies.

### Interactive detail backlog

Candidates the owner liked on reference sites. Each is optional, and each must
obey the motion rules. Which ones ship is decided at the visual-direction step.

- Hover effects on cards that respond to cursor speed
- Small toggles inside sentences that swap a value in place
- A photo with subtle motion, once a suitable photo exists
- Decorative elements that change between light and dark mode

## 9. Visual direction

Decided:

- Conventional layout, normal scrolling, lots of small responsive details.
  Reference for feel: joshwcomeau.com. Opposite of the goal: a bare,
  text-only minimalist page.
- Liked elsewhere: a nav that animates to show the current section; a photo
  with subtle motion.
- The site must feel fast and precise before it feels playful.

Not decided: typefaces, colours, card style, how playful.

How it gets decided: the first build stage produces the home page structure
with real content and a neutral theme driven entirely by design tokens. Then
Claude builds two or three visual directions as live variants of that page.
The owner picks one or mixes them. Only then is the look applied everywhere.
This is why all colour, type, spacing and motion values must be tokens.

## 10. Rules

These also go into the repository's `CLAUDE.md` so every future session
follows them.

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

## 11. Content at launch

**Featured, in order:** cuRiding, alternative-signals, brightspace-deadlines,
VisionCompanion, EcoCart, CPU-Cache-Benchmark.

cuRiding is one project made of two repositories (the device and the server).
Its page links both.

**More projects:** curate, Schedule Scoop, North-Star, PDF-merger, Markit,
Student Management System, Relational Algebra Query Processor.

The current site also lists a "Home Server" project. Whether it stays is the
owner's call when reviewing the first draft of the content.

**Proof strip:** People's Choice at cuHacking 7; Best AI for Environmental
Impact at AGI Ventures Canada Hackathon 3.0; Jacob Freedman Scholarship;
Deans' Honour List, three years; GPA.

**Experience:** three roles, as on the current site, one line each.

**About:** rewritten bio; Carleton Tennis Club (VP Finance); Hack the Hill III
sponsorship team; volunteer notetaking; a photo captioned "Hack the North
2026, Waterloo"; event photos.

**Skills strip:** starts from the skills listed on the current site,
reordered so web, backend, data and cloud skills come before low-level ones.
The owner reviews the list with the first content draft.

**Media on hand**

| Project | Media |
|---|---|
| cuRiding | YouTube Short; event photos of the hardware, the team and the award |
| VisionCompanion | YouTube demo, live app, four images in the repo |
| EcoCart | YouTube demo; award photo |
| alternative-signals | Three charts in the repo |
| brightspace-deadlines | Four screenshots in the repo (sample data) |
| CPU-Cache-Benchmark | Four result plots in the repo |
| curate, PDF-merger | One screenshot each |
| North-Star | A photo of the route map on screen; Claude captures screenshots by running it |
| Schedule Scoop | Screenshot to be supplied by the owner |

## 12. Workflow

### Adding a project (the recipe)

1. Create `src/content/projects/<slug>.md` with the fields in section 7. Reuse
   the README's one-liner.
2. Put images in `src/assets/projects/<slug>/`.
3. If it should be featured, set `featured` and write the three brief blocks.
4. Run the checks. Open the preview address. Confirm the card, the page and
   the preview image.
5. Update the GitHub profile README with the same one-liner.

### Checks

- Build fails on any content file that breaks the schema.
- Unit tests for the small logic: greeting, seen-projects store, filter.
- Browser tests: home loads; a project page loads; the filter works; the email
  button reveals an address from a mocked function; the resume address returns
  not found while off; the command menu opens and navigates.
- A speed-budget check against rule 12.
- A link check over the built site.
- All of the above run on every push to a branch.

### Ship checklist

1. Owner approves the preview address on phone and laptop.
2. Speed budget, link check and legacy scan all pass.
3. Preview card checked in LinkedIn's inspector.
4. Private settings are set in Vercel: contact address, resume switch (off),
   GitHub token. `siddigz.com` is made the primary domain.
5. Merge `revamp` into `main`.
5a. Run the private pre-ship steps recorded in the git-ignored
   `CLAUDE.local.md`. They need the owner's go-ahead at the time.
6. One commit to the GitHub profile README: add the site back and match the
   project one-liners.
7. Replace this repo's README, which still describes the old site.
8. Remind the owner to bring LinkedIn in line with the site and README.

## 13. Left to the builder

- Astro version, folder layout beyond `src/content/`, and package choices.
- Whether interactive pieces are plain scripts, custom elements, or a small
  UI library for the command menu only.
- Plain CSS with tokens is assumed. A CSS framework is allowed if tokens
  remain the single source of values.
- How the daily rebuild is triggered.
- Where the real resume PDF is stored when the feature is turned on.
- Exact wording of greetings.
- Test tooling.

## 14. Who decided what

**Decided by the owner:** the framing; Astro; rebuild on a branch; GPA shown;
graduation shown as April 2028; no experience descriptions; resume built but
off and never exposed; real email given to visitors, hidden from scrapers;
no blog; no AI chatbot; GitHub activity in; both per-visitor features; brief
project pages; no "click to hear" label; empty photo slot for now; placeholder
sounds for now; one-time README commit; Hack the North mentioned quietly;
basic analytics only; a moving skills strip; `siddigz.com` as the primary
address.

**Claude's calls, open to correction:** section order on the home page;
where the skills strip sits and how it behaves; top-bar navigation; the
content fields; the
email-reveal mechanism; the speed budget numbers; self-hosted fonts; the
120-word limit; deciding the look from live variants after the structure
exists; keeping the project exclusion list out of the public repo; the two-call token design for the
email; the owner doing Vercel dashboard steps from a checklist; thumbnails on
compact rows; stripping photo metadata.

## 15. Still needed from the owner

None of these block the build.

- Photos of himself.
- Two recordings: "Siddig" and "Ahmed".
- A Schedule Scoop screenshot.
- A read-only GitHub token, added to Vercel, for the activity section.
- The Vercel dashboard checklist, when it is handed over.
