// tests/settings.spec.ts
import { test, expect } from '@playwright/test';

test('Settings: saving accounts surfaces a toast', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Page presence: accept either marker or heading
  const marker = page.locator('[data-testid="page-settings"]').first();
  const heading = page.getByRole('heading', { name: /settings/i }).first();
  await Promise.race([
    marker.waitFor({ state: 'visible', timeout: 15000 }),
    heading.waitFor({ state: 'visible', timeout: 15000 }),
  ]);

  // Stub the save endpoint so UI can show success toast reliably
  await page.route('**/api/settings/accounts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Find & click the Save button (fallbacks keep this resilient)
  const saveBtn = page
    .locator(
      [
        '[data-testid="btn-save-accounts"]',
        'button:has-text("Save Accounts")',
        'button:has-text("Save")',
      ].join(', ')
    )
    .first();

  await expect(saveBtn).toBeVisible({ timeout: 10000 });
  await saveBtn.click();

  // ✅ Do NOT mix selector engines in one CSS list.
  // Option A: semantic roles/testids
  const toastPolite = page
    .locator('[data-testid="toast"], [role="status"], [role="alert"]')
    .first();

  // Option B: text content (EN/SV variants)
  const toastText = page.getByText(/saved|sparat|uppdaterat/i).first();

  await Promise.race([
    toastPolite.waitFor({ state: 'visible', timeout: 5000 }),
    toastText.waitFor({ state: 'visible', timeout: 5000 }),
  ]);
});
