import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', fullyParallel: false, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 1000}}},
    {name: 'mobile', use: {...devices['Pixel 7'], viewport: {width: 393, height: 851}}}
  ],
  webServer: {command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true}
});
