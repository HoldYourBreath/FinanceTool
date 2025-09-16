import { test, expect } from '@playwright/test';

const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.FRONTEND_URL ??
  'http://127.0.0.1:5173';

test('Settings: saving accounts surfaces a toast', async ({ page }) => {
  await page.goto(new URL('/settings', FRONTEND).toString(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('page-settings')).toBeVisible();

  // Click and wait for the POST to /api/settings/accounts (backend returns 200/405 -> UI still shows a toast)
  const clickAndWait = Promise.all([
    page.waitForResponse(r =>
      r.url().includes('/api/settings/accounts') && r.request().method() === 'POST'
    ).catch(() => {}), // tolerate environments where the route might be stubbed
    page.getByRole('button', { name: 'Save Accounts' }).click(),
  ]);
  await clickAndWait;

  // Assert the toast appears (either success or failure message)
  const toast = page.getByTestId('toast');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(/Accounts (saved|Failed)/);
});
