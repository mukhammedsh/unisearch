// @ts-check
const { defineConfig } = require("@playwright/test");

const isCI = !!process.env.CI;
// E2E runs its own API and frontend on dedicated ports so a running development server
// (API 8000 with rate limits, frontend 5501 pointing at it) is never reused by mistake.
const backendPort = Number(process.env.UNISEARCH_E2E_BACKEND_PORT) || 8010;
process.env.UNISEARCH_E2E_BACKEND_PORT = String(backendPort);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5510",
    // The default currency follows the device time zone and language; specs expect the US-dollar default.
    timezoneId: "UTC",
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium" },
    { name: "firefox" },
    { name: "webkit" },
  ],
  webServer: [
    {
      command: `python -m uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}`,
      cwd: "backend",
      url: `http://127.0.0.1:${backendPort}/health`,
      timeout: 120_000,
      reuseExistingServer: !isCI,
      env: {
        ...process.env,
        FRONTEND_ORIGINS: "http://127.0.0.1:5510",
        AUTO_WARMUP_ON_STARTUP: "0",
        ML_INTEREST_TRANSLATION_ENABLED: "0",
        ML_SEMANTIC_EMBEDDINGS_ENABLED: "0",
        RATE_LIMIT_ENABLED: "0",
        REDIS_URL: "",
      },
    },
    {
      command: `python scripts/frontend_dev_server.py --host 127.0.0.1 --port 5510 --directory frontend --api-port ${backendPort}`,
      cwd: ".",
      url: "http://127.0.0.1:5510/index.html",
      timeout: 60_000,
      reuseExistingServer: !isCI,
    },
  ],
});
