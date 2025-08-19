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

const API = process.env.API_URL || 'http://127.0.0.1:5000';

test('APIs', async ({ request }) => {
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
    const res = await request.get(`${API}${p}`);
    expect(res.ok(), `${p} should respond 2xx`).toBeTruthy();
  }
});

