// tests/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
const isWin = process.platform === 'win32';

const HOST = '127.0.0.1';
const API_PORT = 5000;
const WEB_PORT = 5173;

// Run a command from a path relative to THIS file (tests/)
function sh(relFromTests: string, cmd: string): string {
  const cwd = path.join(__dirname, relFromTests);
  const cwdFixed = isWin ? cwd.replace(/\//g, '\\') : cwd;
  return isWin
    ? `cmd /d /s /c "cd /d ${cwdFixed} && ${cmd}"`
    : `bash -lc "cd ${cwdFixed} && ${cmd}"`;
}

function killPort(port: number): string {
  return isWin
    ? `for /f "tokens=5" %a in ('netstat -ano ^| find ":${port} " ^| find "LISTENING"') do taskkill /F /PID %a`
    : `fuser -k ${port}/tcp || true`;
}

export default defineConfig({
  testDir: __dirname,                          // tests live next to this config
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['line']] : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${WEB_PORT}/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Let Playwright manage both servers.
  webServer: [
    // Backend (Flask)
    {
      command: sh(
        '../backend',
        `${isCI ? `${killPort(API_PORT)} && ` : ''}` +
        // factory target + no reload for stability
        `python -m flask --app "app:create_app" run --host ${HOST} --port ${API_PORT} --no-reload`
      ),
      url: `http://${HOST}:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        // repo root for imports like "from backend import …" if your code does that
        PYTHONPATH: path.resolve(__dirname, '..'),
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        // simple DB for CI runs (adjust if you prefer Postgres)
        SQLALCHEMY_DATABASE_URI: process.env.SQLALCHEMY_DATABASE_URI || 'sqlite:///e2e.db',
        DATABASE_URL: process.env.DATABASE_URL || 'sqlite:///e2e.db',
        APP_ENV: process.env.APP_ENV || 'demo',
      },
    },

    // Frontend (Vite preview)
    {
      command: sh(
        '../frontend',
        `${isCI ? `${killPort(WEB_PORT)} && ` : ''}` +
        // assume deps installed already in CI; locally this also works if you've run npm ci
        `npm run build && npm run preview -- --host ${HOST} --port ${WEB_PORT} --strictPort`
      ),
      url: `http://${HOST}:${WEB_PORT}/`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
