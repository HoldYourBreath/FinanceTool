// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
const isWin = process.platform === 'win32';
const PRESTARTED = process.env.PRESTARTED_SERVERS === '1';

const HOST = '127.0.0.1';
const API_PORT = 5000;
const WEB_PORT = 5173;

// run a command in a directory relative to this config (frontend/)
function sh(relFromFrontend: string, cmd: string): string {
  const cwd = relFromFrontend.replace(/\//g, isWin ? '\\' : '/');
  return isWin
    ? `cmd /d /s /c "cd /d ${cwd} && ${cmd}"`
    : `bash -lc "cd ${cwd} && ${cmd}"`;
}

// a no-op command to satisfy Playwright types when servers are already running
const NOOP = 'node -e "process.exit(0)"';

export default defineConfig({
  testDir: path.join(__dirname, '..', 'tests'),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['list']] : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${WEB_PORT}/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: [
    // Backend (Flask)
    PRESTARTED
      ? {
          command: sh('../backend', NOOP), // satisfies typing
          url: `http://${HOST}:${API_PORT}/api/health`,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      : {
          command: sh('../backend', `python -m flask --app app run --host ${HOST} --port ${API_PORT}`),
          url: `http://${HOST}:${API_PORT}/api/health`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
          env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
        },

    // Frontend (Vite)
    PRESTARTED
      ? {
          command: sh('../frontend', NOOP), // satisfies typing
          url: `http://${HOST}:${WEB_PORT}/`,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      : {
          command: sh('../frontend', `npm run build && npm run preview -- --host ${HOST} --port ${WEB_PORT} --strictPort`),
          url: `http://${HOST}:${WEB_PORT}/`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
  ],

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
