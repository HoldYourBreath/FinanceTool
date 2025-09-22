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
  testDir: __dirname,
  fullyParallel: true,               // global, not per-project
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // keep global workers fast for stateless; we’ll override via CLI for stateful
  reporter: isCI ? [['github'], ['line']] : 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${WEB_PORT}/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: [
    // Backend (Flask)
    {
      command: sh(
        '../backend',
        `${isCI ? `${killPort(API_PORT)} && ` : ''}` +
          `python -m flask --app "app:create_app" run --host ${HOST} --port ${API_PORT} --no-reload`
      ),
      url: `http://${HOST}:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PYTHONPATH: path.resolve(__dirname, '..'),
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
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
          `npm run build && npm run preview -- --host ${HOST} --port ${WEB_PORT} --strictPort`
      ),
      url: `http://${HOST}:${WEB_PORT}/`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    // 1) parallel-safe suites
    {
      name: 'stateless',
      testMatch: [
        /api\.(cars|cors|health|housecosts|investments|monthly)\.spec\.ts/,
        /spa\.spec\.ts/,
        /urls\.spec\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
    },

    // 2) settings-mutating suites — run AFTER stateless
    {
      name: 'stateful',
      dependencies: ['stateless'],
      testMatch: [
        /api\.settings\.spec\.ts/,
        /api\.tco-financing\.spec\.ts/,
        /settings\.current-month\.spec\.ts/,
        /settings\.spec\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
      // no per-project `workers` here (not supported by many versions)
    },
  ],
});
