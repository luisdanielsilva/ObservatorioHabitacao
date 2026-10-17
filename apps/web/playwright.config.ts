import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (WBS 11.5) against a running server:
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e -w @observatorio-habitacao/web
 * Set E2E_SERVER_LOG to the dev server's log file to also run the magic-link sign-in test.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://100.93.94.115:3100",
    trace: "retain-on-failure",
    locale: "pt-PT",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
