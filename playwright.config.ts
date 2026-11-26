import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: process.env.CI ? 2 : 4,
  use: { baseURL: 'http://127.0.0.1:4321', headless: true },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock', url: 'http://127.0.0.1:4321/dzs-new/', reuseExistingServer: false, timeout: 30_000 },
  reporter: [['list']],
});
