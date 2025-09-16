
import { test, expect } from '@playwright/test';
import { getJSON, isNumberOrNull, isString } from './_helpers/api';

test.describe('Financing tab API', () => {
  test('GET /api/financing is 2xx and returns list (possibly empty)', async ({ request }) => {
    const { json } = await getJSON(request, '/api/financing');
    expect(Array.isArray(json)).toBeTruthy();
    if (!json.length) return;
    const r = json[0];
    expect(r).toHaveProperty('name');
    expect(isString(r.name)).toBeTruthy();
    expect('value' in r).toBeTruthy();
    expect(isNumberOrNull(r.value)).toBeTruthy();
  });
});
