const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@playwright/test');

const localBackendPython = process.platform === 'win32'
  ? path.join(__dirname, 'backend', '.venv', 'Scripts', 'python.exe')
  : path.join(__dirname, 'backend', '.venv', 'bin', 'python');
const backendPython = process.env.PLAYWRIGHT_BACKEND_PYTHON
  || (fs.existsSync(localBackendPython) ? `"${localBackendPython}"` : 'python');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: process.platform === 'win32' ? 1 : (process.env.CI ? 1 : 2),
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
      command: `${backendPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: 'backend',
      url: 'http://127.0.0.1:8000/health',
      timeout: 120000,
      reuseExistingServer: true,
      env: {
        ...process.env,
        FRONTEND_ORIGINS: 'http://127.0.0.1:5501,http://127.0.0.1:5510',
        AUTO_WARMUP_ON_STARTUP: '0',
        ML_INTEREST_TRANSLATION_ENABLED: '0',
        ML_SEMANTIC_EMBEDDINGS_ENABLED: '0',
        RATE_LIMIT_ENABLED: '0',
        REDIS_URL: '',
      },
    },
    {
      command: `${backendPython} -m http.server 5510 --bind 127.0.0.1`,
      cwd: 'frontend',
      url: 'http://127.0.0.1:5510/index.html',
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
