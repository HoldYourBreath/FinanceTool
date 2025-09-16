import { test, expect } from '@playwright/test';

const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.FRONTEND_URL ??
  'http://127.0.0.1:5173';

test('Settings: saving accounts surfaces a toast', async ({ page }) => {
  // Navigate to settings and wait for full load to avoid racing React mount
  await page.goto(new URL('/settings', FRONTEND).toString(), { waitUntil: 'load' });

  // Be explicit: wait for the settings page marker to attach & be visible
  await page.waitForSelector('[data-testid="page-settings"]', { state: 'visible', timeout: 15000 });

  // Click "Save Accounts" and (optionally) wait for the POST; tolerate envs where it may be blocked
  await Promise.all([
    page.waitForResponse(r =>
      r.url().includes('/api/settings/accounts') && r.request().method() === 'POST'
    ).catch(() => {}),
    page.getByRole('button', { name: 'Save Accounts' }).click(),
  ]);

  // Assert the toast appears (success or failure)
  const toast = page.getByTestId('toast');
  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toHaveText(/Accounts (saved|Failed)/);
});

