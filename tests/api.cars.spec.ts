import { test, expect } from '@playwright/test';
import { getJSON, isNumberOrNull, isString } from './_helpers/api';

test.describe('Car Evaluation tab API', () => {
  test('GET /api/cars returns rows with core and derived fields', async ({ request }) => {
    const { json } = await getJSON(request, '/api/cars');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ['id', 'model', 'year']) expect(row).toHaveProperty(k);
    expect(isString(row.model)).toBeTruthy();
    expect(typeof row.year === 'number').toBeTruthy();

    for (const maybeNumKey of [
      'estimated_purchase_price',
      'consumption_kwh_per_100km',
      'battery_capacity_kwh',
      'dc_peak_kw',
      'dc_time_min_10_80',
      'ac_onboard_kw',
      'ac_time_h_0_100',
      'tco_3_years',
      'tco_5_years',
      'tco_8_years',
    ]) {
      if (maybeNumKey in row) expect(isNumberOrNull(row[maybeNumKey])).toBeTruthy();
    }
  });

  test('GET /api/cars/_which is 2xx', async ({ request }) => {
    const { json } = await getJSON(request, '/api/cars/_which');
    if (json) expect(typeof json).toBe('object');
  });

  test('GET /api/cars/categories is 2xx', async ({ request }) => {
    const { json } = await getJSON(request, '/api/cars/categories');
    if (json) expect(typeof json).toBe('object');
  });
});
