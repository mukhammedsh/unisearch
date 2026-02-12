const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 12000 },
  use: {
    baseURL: 'http://127.0.0.1:5510',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      cwd: 'backend',
      url: 'http://127.0.0.1:8000/health',
      timeout: 120000,
      reuseExistingServer: true,
      env: {
        ...process.env,
        FRONTEND_ORIGIN: 'http://127.0.0.1:5510',
        FRONTEND_ORIGINS: 'http://127.0.0.1:5501,http://127.0.0.1:5510',
        AUTO_WARMUP_ON_STARTUP: '0',
        ML_INTEREST_TRANSLATION_ENABLED: '0',
        REDIS_URL: '',
      },
    },
    {
      command: 'python -m http.server 5510 --bind 127.0.0.1',
      cwd: 'frontend',
      url: 'http://127.0.0.1:5510/index.html',
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
