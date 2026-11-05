import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH },
  },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
