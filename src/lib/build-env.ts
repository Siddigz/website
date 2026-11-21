/*
 * Switches read from the environment while the site is built.
 * SITE_FIXTURES=1 makes a test build: saved sample data instead of live
 * requests, so browser tests see the same page every time.
 */
export const fixtures = process.env.SITE_FIXTURES === '1';

/** Saved GitHub data for test builds. */
export const ACTIVITY_FIXTURE = 'tests/fixtures/github-activity.json';

/** True while Vercel builds the site, so local and CI builds can leave host-only pieces out. */
export const onVercel = process.env.VERCEL === '1';
