import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

const API = process.env.API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5000';
const header = (res: import('@playwright/test').APIResponse, name: string) =>
  res.headers()[name.toLowerCase()] ??
  res.headersArray().find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

test.describe('CORS preflight', () => {
  let base: APIRequestContext;
  test.beforeAll(async () => { base = await pwRequest.newContext(); });
  test.afterAll(async () => { await base.dispose(); });

  for (const [path, method] of [
    ['/api/acc_info', 'POST'],
    ['/api/settings/accounts', 'POST'],
  ] as const) {
    test(`OPTIONS ${path} advertises CORS for ${method}`, async () => {
      const res = await base.fetch(`${API}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': method,
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      expect([200, 204]).toContain(res.status());
      const allowOrigin = header(res, 'access-control-allow-origin');
      expect(allowOrigin).toBeTruthy();
    });
  }
});
