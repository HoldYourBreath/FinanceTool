import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

const API = process.env.API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5000';

test.describe('API health', () => {
  let base: APIRequestContext;
  test.beforeAll(async () => { base = await pwRequest.newContext(); });
  test.afterAll(async () => { await base.dispose(); });

  test('GET /api/health is 2xx', async () => {
    const res = await base.get(`${API}/api/health`);
    expect(res.ok()).toBeTruthy();
  });
});
