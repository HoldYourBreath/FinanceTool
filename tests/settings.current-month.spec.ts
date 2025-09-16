import { test, expect } from '@playwright/test';

function corsHeadersFor(req: import('@playwright/test').Request, extra: Record<string, string> = {}) {
  const origin = req.headers()['origin'] ?? '';
  // Echo the origin so browsers are happy even if credentials are used.
  return {
    'Access-Control-Allow-Origin': origin || '*',
    // Only advertise credentials when we have a concrete origin.
    ...(origin ? { 'Access-Control-Allow-Credentials': 'true', 'Vary': 'Origin' } : {}),
    ...extra,
  };
}

test.describe('Set Current Month', () => {
  test('selects value and posts', async ({ page }) => {
    // Stub data the Settings page loads.
    await page.route('**/api/months/all', route => {
      const headers = corsHeadersFor(route.request());
      route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Jan 2025', is_current: false },
          { id: 2, name: 'Feb 2025', is_current: true },
        ]),
      });
    });
    await page.route('**/api/acc_info', route => {
      const headers = corsHeadersFor(route.request());
      route.fulfill({ status: 200, headers, contentType: 'application/json', body: '[]' });
    });

    let postedBody: any = null;

    await page.route('**/api/settings/current_month', async route => {
      const req = route.request();
      const method = req.method();

      if (method === 'OPTIONS') {
        // Mirror requested headers for a clean preflight
        const acrh = req.headers()['access-control-request-headers'] ?? 'content-type';
        return route.fulfill({
          status: 200,
          headers: corsHeadersFor(req, {
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': acrh,
            'Access-Control-Max-Age': '600',
          }),
          body: '',
        });
      }

      if (method === 'POST') {
        try {
          postedBody = req.postDataJSON();
        } catch {
          const raw = req.postData();
          postedBody = raw ? JSON.parse(raw) : null;
        }
        return route.fulfill({
          status: 200,
          headers: corsHeadersFor(req),
          contentType: 'application/json',
          body: '{"ok":true}',
        });
      }

      return route.fallback();
    });

    await page.goto('/settings');
    await expect(page.getByTestId('page-settings')).toBeVisible();

    // Change the select and click Save
    await page.selectOption('#current-month', '1');

    // Avoid the race: start waiting before we click.
    const postSettled = page.waitForResponse(resp =>
      resp.url().includes('/api/settings/current_month') &&
      resp.request().method() === 'POST'
    );
    await page.getByRole('heading', { name: /set current month/i })
      .locator('..')
      .getByRole('button', { name: /^save$/i })
      .click();
    await postSettled;

    // Assert we captured the body
    expect(postedBody).toBeTruthy();
    expect(postedBody.month_id).toBe(1);

    // Toast should show
    await expect(page.getByTestId('toast')).toBeVisible({ timeout: 5000 });
  });
});
