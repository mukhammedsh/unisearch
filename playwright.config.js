// @ts-check
const { defineConfig } = require("@playwright/test");

const isCI = !!process.env.CI;

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
    baseURL: "http://127.0.0.1:5501",
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
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "backend",
      url: "http://127.0.0.1:8000/health",
      timeout: 120_000,
      reuseExistingServer: !isCI,
      env: {
        ...process.env,
        FRONTEND_ORIGIN: "http://127.0.0.1:5501",
        AUTO_WARMUP_ON_STARTUP: "0",
        ML_INTEREST_TRANSLATION_ENABLED: "0",
        REDIS_URL: "",
      },
    },
    {
      command: "python -m http.server 5501",
      cwd: "frontend",
      url: "http://127.0.0.1:5501/index.html",
      timeout: 60_000,
      reuseExistingServer: !isCI,
    },
  ],
});
