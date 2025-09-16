// tests/urls.spec.ts
import { test, expect } from '@playwright/test';
const BASE = process.env.API_URL ?? process.env.API ?? 'http://127.0.0.1:5000';
const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.FRONTEND_URL ??
  'http://127.0.0.1:5173';

const pages = [
  { path: '/',               testId: 'page-home' },
  { path: '/spending',       testId: 'page-spending' },
  { path: '/past-months',    testId: 'page-past-months' },
  { path: '/investments',    testId: 'page-investments' },
  { path: '/house-costs',    testId: 'page-house-costs' },
  { path: '/settings',       testId: 'page-settings' },
  { path: '/car-evaluation', testId: 'page-car-evaluation' },
];

test.describe('Frontend routes', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const { path, testId } of pages) {
    test(`renders ${path}`, async ({ page }, testInfo) => {
      const url = new URL(path, FRONTEND).toString();

      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));

      const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (!res?.ok()) {
        await testInfo.attach('response-body', {
          body: (await res?.text()) ?? 'no body',
          contentType: 'text/plain',
        });
      }
      expect(res?.ok(), `${path} should respond 2xx, got ${res?.status()}`).toBeTruthy();

      // assert page-specific marker
      await expect(page.getByTestId(testId)).toBeVisible();

      if (errors.length) {
        await testInfo.attach('console-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain',
        });
      }
    });
  }
});

const endpoints = [
  '/api/acc_info',
  '/api/months',
  '/api/investments',
  '/api/planned_purchases',
  '/api/financing',
  '/api/cars',
  '/api/expenses',
  '/api/house_costs',
  '/api/incomes',
  '/api/land_costs',
  '/api/loan_adjustments',
  '/api/settings/prices',
];

test.describe('API smoke', () => {
  // Run each endpoint check in parallel
  test.describe.configure({ mode: 'parallel' });

  for (const p of endpoints) {
    test(`GET ${p} responds 2xx`, async ({ request }, testInfo) => {
      const url = new URL(p, BASE).toString();
      const res = await request.get(url);
      const body = await res.text();

      if (!res.ok()) {
        await testInfo.attach('response-body', {
          body,
          contentType: 'text/plain',
        });
      }

      expect(
        res.ok(),
        `${p} should respond 2xx, got ${res.status()} ${body.slice(0, 200)}`
      ).toBeTruthy();
    });
  }
});


