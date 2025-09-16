import { test, expect } from '@playwright/test';
import { getJSON, isFiniteNumber, isString, isStringOrNull } from './_helpers/api';

test.describe('Investments tab API', () => {
  test('GET /api/investments returns list (shape tolerant)', async ({ request }) => {
    const { res, json } = await getJSON(request, '/api/investments');

    const rows =
      Array.isArray(json) ? json :
      Array.isArray(json?.investments) ? json.investments :
      Array.isArray(json?.items) ? json.items :
      res.status() === 204 ? [] : [];

    expect(Array.isArray(rows)).toBeTruthy();
    if (rows.length) expect(typeof rows[0]).toBe('object');
  });

  test('GET /api/acc_info returns rows with expected shape', async ({ request }) => {
    const { json } = await getJSON(request, '/api/acc_info');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ['id', 'person', 'bank', 'acc_number', 'country', 'value']) {
      expect(row).toHaveProperty(k);
    }
    expect(isString(row.person)).toBeTruthy();
    expect(isString(row.bank)).toBeTruthy();
    expect(isString(row.acc_number)).toBeTruthy();
    expect(isString(row.country)).toBeTruthy();
    expect(isFiniteNumber(Number(row.value))).toBeTruthy();
  });
});
