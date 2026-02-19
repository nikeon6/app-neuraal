import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Usage:
 *   pnpm test:e2e          — run all E2E tests
 *   pnpm test:e2e --ui     — interactive mode
 *
 * Browsers must be installed first:
 *   pnpm exec playwright install
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run dev server for E2E in both local and CI.
  webServer: {
    command: "node scripts/e2e/dev-server.mjs",
    url: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180_000 : 60_000,
  },
});
