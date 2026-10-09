import { defineConfig, devices } from "@playwright/test";

// The app's smoke suite (e2e/): the production build, served by vite
// preview, in Chromium. pnpm test:e2e builds first and runs it on the mock
// fixtures; pnpm smoke:live (e2e/live.mjs) runs it against the laptop agent,
// read only. E2E_PORT picks the port (1421–1439 leave the dev app's 1420
// alone).

const port = Number(process.env.E2E_PORT ?? 1434);
const live = process.env.BERTH_E2E_LIVE === "1";

export default defineConfig({
  testDir: "e2e",
  outputDir: "node_modules/.e2e-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A failure is a failure: the fixtures are fixed and nothing waits on time.
  retries: 0,
  // E2E_WORKERS: CI sets 6 on omarchy (16 cores), 2 on hosted runners.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : process.env.CI ? 2 : live ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // E2E_DEV=1 serves the source through Vite's dev server, and reuses one
  // already running: no build between an edit and a look. The suite of
  // record still runs against the built app.
  webServer: {
    command: process.env.E2E_DEV === "1" ? `pnpm exec vite --port ${port} --strictPort` : `pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: process.env.E2E_DEV === "1",
    timeout: 30_000,
  },
});
