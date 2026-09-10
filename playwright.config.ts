import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000, // 90s test timeout to support 30s+ active survival playtests
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,

  webServer: {
    command: 'kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 960, height: 540 },
        deviceScaleFactor: 1,
        launchOptions: {
          args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
        },
      },
    },
  ],
});
