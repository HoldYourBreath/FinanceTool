import { test, expect } from '@playwright/test';
import { getJSON, isFiniteNumber, isString } from './_helpers/api';

test.describe('House Costs tab API', () => {
  test('GET /api/house_costs', async ({ request }) => {
    const { json } = await getJSON(request, '/api/house_costs');
    expect(Array.isArray(json)).toBeTruthy();
    if (!json.length) return;
    const r = json[0];
    for (const k of ['id', 'name', 'amount', 'status']) expect(r).toHaveProperty(k);
    expect(isString(r.name)).toBeTruthy();
    expect(isFiniteNumber(Number(r.amount))).toBeTruthy();
    expect(isString(r.status)).toBeTruthy();
  });

  test('GET /api/land_costs', async ({ request }) => {
    const { json } = await getJSON(request, '/api/land_costs');
    expect(Array.isArray(json)).toBeTruthy();
    if (!json.length) return;
    const r = json[0];
    for (const k of ['id', 'name', 'amount', 'status']) expect(r).toHaveProperty(k);
  });
});
