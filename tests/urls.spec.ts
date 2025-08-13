import {test} from '@playwright/test'

test('URLs', async ({page}) => {
    await page.goto('http://localhost:5173/')
    await page.goto('http://localhost:5173/spending')
    await page.goto('http://localhost:5173/past-months')
    await page.goto('http://localhost:5173/investments')
    await page.goto('http://localhost:5173/house-costs')
    await page.goto('http://localhost:5173/settings')
    await page.goto('http://localhost:5173/car-evaluation')
})

test('APIs', async ({page}) => {
    await page.goto('http://localhost:5000/api/acc_info')
    await page.goto('http://localhost:5000/api/assets')
    await page.goto('http://localhost:5000/api/months')
    await page.goto('http://localhost:5000/api/investments')
    await page.goto('http://localhost:5000/api/planned_purchases')
    await page.goto('http://localhost:5000/api/financing')
    await page.goto('http://localhost:5000/api/cars')
    await page.goto('http://localhost:5000/api/expenses')
    await page.goto('http://localhost:5000/api/house_costs')
    await page.goto('http://localhost:5000/api/house_meta')
    await page.goto('http://localhost:5000/api/incomes')
    await page.goto('http://localhost:5000/api/investment')
    await page.goto('http://localhost:5000/api/land_costs')
    await page.goto('http://localhost:5000/api/loan_adjustments')
    await page.goto('http://localhost:5000/api/price_settings')
})




