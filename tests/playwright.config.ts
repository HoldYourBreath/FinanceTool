// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
const isWin = process.platform === 'win32';

// Run a command in a directory relative to this config (frontend/)
function sh(relFromFrontend: string, cmd: string): string {
  const cwd = relFromFrontend.replace(/\//g, isWin ? '\\' : '/');
  return isWin
    ? `cmd /d /s /c "cd /d ${cwd} && ${cmd}"`
    : `bash -lc "cd ${cwd} && ${cmd}"`;
}

export default defineConfig({
  // tests live in ../tests relative to this file
  testDir: path.join(__dirname, '..', 'tests'),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['list']] : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Let Playwright own the app lifecycle (no manual starts in CI)
  webServer: [
    // Backend (Flask)
    {
      command: sh('..\\backend', 'python -m flask --app app run --host 127.0.0.1 --port 5000'),
      url: 'http://127.0.0.1:5000/api/health', // must return 200
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },

    // Frontend (Vite). Uses preview with strictPort to avoid races.
    {
      // If you prefer dev server (with proxy), swap to:
      // command: sh('..\\frontend', 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort'),
      command: sh('..\\frontend', 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173 --strictPort'),
      url: 'http://127.0.0.1:5173/',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
