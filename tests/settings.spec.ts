// tests/settings.spec.ts
import { test, expect } from '@playwright/test';

test('Settings: saving accounts surfaces a toast', async ({ page }) => {
  // Land on the app, let the SPA boot.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Stub the accounts save endpoint so UI can succeed even if backend is read-only.
  await page.route('**/api/settings/accounts', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  );

  // Helper: reach Settings either by direct route or header nav fallback.
  const reachSettingsAndFindSave = async () => {
    // 1) Try direct route first
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    const saveBtn = page
      .locator(
        [
          '[data-testid="btn-save-accounts"]',       // preferred stable hook (if present)
          'button:has-text("Save Accounts")',        // fallback by text
          'button:has-text("Save")',                 // extra fallback
        ].join(', ')
      )
      .first();

    try {
      await expect(saveBtn).toBeVisible({ timeout: 5000 });
      return saveBtn;
    } catch {
      // 2) Fallback: click the header nav link to ensure panel is mounted
      const settingsLink = page.getByRole('link', { name: /settings/i }).first();
      if (await settingsLink.count()) {
        await settingsLink.click();
        await page.waitForLoadState('networkidle');
      }
      await expect(saveBtn).toBeVisible({ timeout: 10000 });
      return saveBtn;
    }
  };

  const saveBtn = await reachSettingsAndFindSave();
  await saveBtn.click();

  // Look for a toast or polite status text indicating success.
  const toastPolite = page
    .locator('[data-testid="toast"], [role="status"], [role="alert"]')
    .first();
  const toastText = page.getByText(/saved|sparat|uppdaterat/i).first();

  await Promise.race([
    toastPolite.waitFor({ state: 'visible', timeout: 8000 }),
    toastText.waitFor({ state: 'visible', timeout: 8000 }),
  ]);
});
