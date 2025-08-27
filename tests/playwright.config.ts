// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
const isWin = process.platform === 'win32';

const HOST = '127.0.0.1';
const API_PORT = 5000;
const WEB_PORT = 5173;

// Run a command in a directory relative to this config (frontend/)
function sh(relFromFrontend: string, cmd: string): string {
  const cwd = relFromFrontend.replace(/\//g, isWin ? '\\' : '/');
  return isWin
    ? `cmd /d /s /c "cd /d ${cwd} && ${cmd}"`
    : `bash -lc "cd ${cwd} && ${cmd}"`;
}

// Kill a TCP port (Linux CI vs Windows local)
function killPort(port: number): string {
  return isWin
    ? `for /f "tokens=5" %a in ('netstat -ano ^| find ":${port} " ^| find "LISTENING"') do taskkill /F /PID %a`
    : `fuser -k ${port}/tcp || true`;
}

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

  // Let Playwright manage both servers.
  // Key: reuseExistingServer:true avoids the "already used" crash if something is on the port.
  webServer: [
    // Backend (Flask)
    {
      command: sh(
        '../backend',
        `${isCI ? `${killPort(API_PORT)} && ` : ''}python -m flask --app app run --host ${HOST} --port ${API_PORT}`
      ),
      url: `http://${HOST}:${API_PORT}/api/health`,
      reuseExistingServer: true,          // <-- important for CI
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },

    // Frontend (Vite preview)
    {
      command: sh(
        '../frontend',
        `${isCI ? `${killPort(WEB_PORT)} && ` : ''}npm run build && npm run preview -- --host ${HOST} --port ${WEB_PORT} --strictPort`
      ),
      url: `http://${HOST}:${WEB_PORT}/`,
      reuseExistingServer: true,          // <-- important for CI
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
