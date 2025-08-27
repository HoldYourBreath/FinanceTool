// tests/urls.spec.ts
import { test, expect } from '@playwright/test';

test('URLs', async ({page}) => {
    await page.goto('http://localhost:5173/')
    await page.goto('http://localhost:5173/spending')
    await page.goto('http://localhost:5173/past-months')
    await page.goto('http://localhost:5173/investments')
    await page.goto('http://localhost:5173/house-costs')
    await page.goto('http://localhost:5173/settings')
    await page.goto('http://localhost:5173/car-evaluation')
})

test('APIs', async ({ request }) => {
  const API = process.env.API || 'http://127.0.0.1:5000';
  for (const p of ['/api/acc_info', 
                   '/api/months', 
                   '/api/investments',
                   '/api/planned_purchases', 
                   '/api/financing', 
                   '/api/cars', 
                   '/api/expenses', 
                   '/api/house_costs', 
                   '/api/incomes', 
                   '/api/land_costs', 
                   '/api/loan_adjustments', 
                   '/api/settings/prices']) {
    const url = new URL(p, API).toString();
    const res = await request.get(url);
    const body = await res.text();
    expect(
      res.ok(),
      `${p} should respond 2xx, got ${res.status()} ${body.slice(0, 200)}`
    ).toBeTruthy();
  }
});
