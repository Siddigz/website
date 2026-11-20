import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321', actionTimeout: 5_000 },
  expect: { timeout: 3_000 },
  webServer: {
    command: 'node scripts/serve-dist.mjs 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  // Chrome at both sizes, Firefox on a laptop, and Safari's engine on a laptop
  // and at phone size (every iPhone browser uses it).
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    { name: 'safari', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    { name: 'safari-phone', use: { ...devices['Desktop Safari'], viewport: { width: 375, height: 812 } } },
  ],
});
