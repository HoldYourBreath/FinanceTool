import { test, expect } from '@playwright/test';
import { getJSON, isFiniteNumber, isString, isStringOrNull } from './_helpers/api';

test.describe('Monthly tab API', () => {
  test('GET /api/months returns months with expected structure', async ({ request }) => {
    const { json } = await getJSON(request, '/api/months');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const m = json[0];
    for (const k of [
      'id',
      'name',
      'startingFunds',
      'endingFunds',
      'surplus',
      'loanRemaining',
      'is_current',
      'incomes',
      'expenses',
      'loanAdjustments',
    ]) {
      expect(m, `missing key ${k}`).toHaveProperty(k);
    }
    expect(isString(m.name)).toBeTruthy();
    expect(isFiniteNumber(m.startingFunds)).toBeTruthy();
    expect(isFiniteNumber(m.endingFunds)).toBeTruthy();
    expect(typeof m.is_current === 'boolean').toBeTruthy();
    expect(Array.isArray(m.incomes)).toBeTruthy();
    expect(Array.isArray(m.expenses)).toBeTruthy();
    expect(Array.isArray(m.loanAdjustments)).toBeTruthy();

    if (m.incomesByPerson) expect(typeof m.incomesByPerson).toBe('object');

    const inc = m.incomes[0];
    if (inc) {
      for (const k of ['name', 'amount']) expect(inc).toHaveProperty(k);
      expect(isString(inc.name)).toBeTruthy();
      expect(isFiniteNumber(Number(inc.amount))).toBeTruthy();
      if ('person' in inc) expect(isStringOrNull(inc.person)).toBeTruthy();
    }

    const exp = m.expenses[0];
    if (exp) {
      for (const k of ['description', 'amount']) expect(exp).toHaveProperty(k);
      expect(isString(exp.description)).toBeTruthy();
      expect(isFiniteNumber(Number(exp.amount))).toBeTruthy();
    }

    const adj = m.loanAdjustments[0];
    if (adj) {
      for (const k of ['name', 'type', 'amount']) expect(adj).toHaveProperty(k);
      expect(isString(adj.name)).toBeTruthy();
      expect(isString(adj.type)).toBeTruthy();
      expect(isFiniteNumber(Number(adj.amount))).toBeTruthy();
      if ('note' in adj) expect(isStringOrNull(adj.note)).toBeTruthy();
    }
  });

  test('GET /api/incomes rows', async ({ request }) => {
    const { json } = await getJSON(request, '/api/incomes');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;
    const row = json[0];
    for (const k of ['id', 'month_id', 'source', 'amount']) expect(row).toHaveProperty(k);
  });

  test('GET /api/expenses rows', async ({ request }) => {
    const { json } = await getJSON(request, '/api/expenses');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;
    const row = json[0];
    for (const k of ['id', 'month_id', 'category', 'description', 'amount']) expect(row).toHaveProperty(k);
  });

  test('GET /api/loan_adjustments rows', async ({ request }) => {
    const { json } = await getJSON(request, '/api/loan_adjustments');
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;
    const row = json[0];
    for (const k of ['id', 'month_id', 'type', 'amount']) expect(row).toHaveProperty(k);
  });
});
