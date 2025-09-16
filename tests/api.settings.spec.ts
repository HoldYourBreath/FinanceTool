import { test, expect } from '@playwright/test';
import { API, getJSON, /* isFiniteNumber not needed below */ } from './_helpers/api';

test.describe('Settings tab API', () => {
  test('GET /api/settings/prices returns canonical numeric fields', async ({ request }) => {
    const { json } = await getJSON(request, '/api/settings/prices');
    for (const k of [
      'el_price_ore_kwh',
      'diesel_price_sek_litre',
      'bensin_price_sek_litre',
      'yearly_km',
      'daily_commute_km',
    ]) {
      expect(json, `missing key ${k}`).toHaveProperty(k);
      expect(typeof json[k]).toBe('number');
      expect(Number.isFinite(json[k])).toBe(true);
    }
  });

  // These endpoints are not GET-able right now. Assert the contract we actually have.
  test('GET /api/settings/current_month is not allowed (405) and advertises allowed methods', async ({ request }) => {
    const res = await request.get(`${API}/api/settings/current_month`);
    expect(res.status()).toBe(405);
    const allow = res.headers()['allow'] || '';
    // Accept any write method you actually support
    expect(allow).toMatch(/POST|PUT|PATCH/);
  });

  test('GET /api/settings/accounts is not allowed (405) and advertises allowed methods', async ({ request }) => {
    const res = await request.get(`${API}/api/settings/accounts`);
    expect(res.status()).toBe(405);
    const allow = res.headers()['allow'] || '';
    expect(allow).toMatch(/POST|PUT|PATCH/);
  });
});

