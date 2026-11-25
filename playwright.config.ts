import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // On CI every test's time is listed as well. Nothing is retried: a test that
  // fails once is a failure, so an occasional stall cannot hide behind a second try.
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // CI's Linux build of Safari's engine draws only a few frames a second, and a
  // move from one page to another waits on frames, so CI is given more time.
  use: { baseURL: 'http://localhost:4321', actionTimeout: process.env.CI ? 20_000 : 5_000 },
  expect: { timeout: process.env.CI ? 10_000 : 3_000 },
  webServer: {
    command: 'node scripts/serve-dist.mjs 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  // Chrome at laptop, phone and tablet size, Firefox on a laptop, and Safari's engine on a laptop
  // and at phone size (every iPhone browser uses it).
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    { name: 'safari', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    { name: 'safari-phone', use: { ...devices['Desktop Safari'], viewport: { width: 375, height: 812 } } },
  ],
});
