import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /performance\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-performance' }]],
  outputDir: 'test-results-performance',
  globalSetup: './e2e/fixtures/preview-server.js',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174',
    locale: 'es-CR',
    timezoneId: 'America/Costa_Rica',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'web-performance', use: { ...devices['Desktop Chrome'] } }],
})
