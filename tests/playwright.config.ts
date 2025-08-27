// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
const isWin = process.platform === 'win32';

function sh(cwdRelFromFrontend: string, cmd: string) {
  return isWin
    ? `cmd /d /s /c "cd /d ${cwdRelFromFrontend} && ${cmd}"`
    : `bash -lc "cd ${cwdRelFromFrontend} && ${cmd}"`;
}

export default defineConfig({
  testDir: path.join(__dirname, '..', 'tests'),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['list']] : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Backend (Flask)
      command: sh('..\\backend', 'python -m flask --app app run --host 127.0.0.1 --port 5000'),
      url: 'http://127.0.0.1:5000/api/health', // ← must return 200
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
    {
      // Frontend (Vite). If you use `preview`, ensure it's built first.
      // Option A: dev server (has /api proxy):
      // command: sh('..\\frontend', 'npm run dev -- --host 127.0.0.1 --port 5173'),
      // Option B: preview (prod build served):
      command: sh('..\\frontend', 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173 --strictPort'),
      url: 'http://127.0.0.1:5173/',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
