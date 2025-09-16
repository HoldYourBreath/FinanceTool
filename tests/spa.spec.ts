import { test, expect } from '@playwright/test';

const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.FRONTEND_URL ??
  'http://127.0.0.1:5173';

test.describe('SPA shell', () => {
  test('unknown route falls back to app shell', async ({ page }) => {
    const url = new URL('/totally-unknown-route', FRONTEND).toString();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `fallback should be 2xx/3xx, got ${res?.status()}`).toBeTruthy();
    await expect(page.locator('#root')).toBeVisible();
  });

  test('header nav switches tabs (no crash)', async ({ page }) => {
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Spending' }).click();
    await expect(page.getByTestId('page-spending')).toBeVisible();
    await page.getByRole('link', { name: 'Past Months' }).click();
    await expect(page.getByTestId('page-past-months')).toBeVisible();
  });
});
