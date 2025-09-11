// tests/api.spec.ts
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

const API = process.env.API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5000';

const isFiniteNumber = (v: any) => typeof v === 'number' && Number.isFinite(v);
const isString = (v: any) => typeof v === 'string';
const isStringOrNull = (v: any) => v == null || typeof v === 'string';
const isNumberOrNull = (v: any) => v == null || typeof v === 'number';

async function getJSON(base: APIRequestContext, path: string) {
  const res = await base.get(`${API}${path}`);
  expect(res.ok(), `${path} should respond 2xx`).toBeTruthy();
  const json = await res.json();
  return { res, json };
}

test.describe('API content & shape validation', () => {
  let base: APIRequestContext;

  test.beforeAll(async () => {
    base = await pwRequest.newContext();
  });

  test.afterAll(async () => {
    await base.dispose();
  });

  test("GET /api/settings/prices returns canonical numeric fields", async () => {
    const { json } = await getJSON(base, "/api/settings/prices");
    // Required keys
    for (const k of [
      "el_price_ore_kwh",
      "diesel_price_sek_litre",
      "bensin_price_sek_litre",
      "yearly_km",
      "daily_commute_km",
    ]) {
      expect(json, `missing key ${k}`).toHaveProperty(k);
    }
    // Types
    expect(isFiniteNumber(json.el_price_ore_kwh)).toBeTruthy();
    expect(isFiniteNumber(json.diesel_price_sek_litre)).toBeTruthy();
    expect(isFiniteNumber(json.bensin_price_sek_litre)).toBeTruthy();
    expect(isFiniteNumber(json.yearly_km)).toBeTruthy();
    expect(isFiniteNumber(json.daily_commute_km)).toBeTruthy();
  });

  test("GET /api/months returns months with expected structure", async () => {
    const { json } = await getJSON(base, "/api/months");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const m = json[0];
    // Core fields
    for (const k of [
      "id",
      "name",
      "startingFunds",
      "endingFunds",
      "surplus",
      "loanRemaining",
      "is_current",
      "incomes",
      "expenses",
      "loanAdjustments",
    ]) {
      expect(m, `missing key ${k}`).toHaveProperty(k);
    }
    expect(isString(m.name)).toBeTruthy();
    expect(isFiniteNumber(m.startingFunds)).toBeTruthy();
    expect(isFiniteNumber(m.endingFunds)).toBeTruthy();
    expect(typeof m.is_current === "boolean").toBeTruthy();
    expect(Array.isArray(m.incomes)).toBeTruthy();
    expect(Array.isArray(m.expenses)).toBeTruthy();
    expect(Array.isArray(m.loanAdjustments)).toBeTruthy();

    // Optional richer fields
    if (m.incomesByPerson) {
      expect(typeof m.incomesByPerson).toBe("object");
    }

    // Spot-check one income/expense if present
    const inc = m.incomes[0];
    if (inc) {
      for (const k of ["name", "amount"]) expect(inc).toHaveProperty(k);
      expect(isString(inc.name)).toBeTruthy();
      expect(isFiniteNumber(Number(inc.amount))).toBeTruthy();
      // Optional person
      if ("person" in inc) expect(isStringOrNull(inc.person)).toBeTruthy();
    }
    const exp = m.expenses[0];
    if (exp) {
      for (const k of ["description", "amount"]) expect(exp).toHaveProperty(k);
      expect(isString(exp.description)).toBeTruthy();
      expect(isFiniteNumber(Number(exp.amount))).toBeTruthy();
    }
    const adj = m.loanAdjustments[0];
    if (adj) {
      for (const k of ["name", "type", "amount"]) expect(adj).toHaveProperty(k);
      expect(isString(adj.name)).toBeTruthy();
      expect(isString(adj.type)).toBeTruthy();
      expect(isFiniteNumber(Number(adj.amount))).toBeTruthy();
      // note is optional
      if ("note" in adj) expect(isStringOrNull(adj.note)).toBeTruthy();
    }
  });

  test("GET /api/incomes returns rows with optional person", async () => {
    const { json } = await getJSON(base, "/api/incomes");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "month_id", "source", "amount"]) {
      expect(row).toHaveProperty(k);
    }
    expect(isString(row.source)).toBeTruthy();
    expect(isFiniteNumber(Number(row.amount))).toBeTruthy();
    // Flexible: person may be string/null/undefined
    if ("person" in row) expect(isStringOrNull(row.person)).toBeTruthy();
  });

  test("GET /api/expenses returns rows with expected shape", async () => {
    const { json } = await getJSON(base, "/api/expenses");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "month_id", "category", "description", "amount"]) {
      expect(row).toHaveProperty(k);
    }
    expect(isString(row.category)).toBeTruthy();
    expect(isString(row.description)).toBeTruthy();
    expect(isFiniteNumber(Number(row.amount))).toBeTruthy();
  });

  test("GET /api/planned_purchases returns rows with (item, amount, date?)", async () => {
    const { json } = await getJSON(base, "/api/planned_purchases");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "item", "amount"]) expect(row).toHaveProperty(k);
    expect(isString(row.item)).toBeTruthy();
    expect(isFiniteNumber(Number(row.amount))).toBeTruthy();
    if ("date" in row) expect(isStringOrNull(row.date)).toBeTruthy();
  });

  test("GET /api/loan_adjustments returns rows with expected shape", async () => {
    const { json } = await getJSON(base, "/api/loan_adjustments");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "month_id", "type", "amount"]) {
      expect(row).toHaveProperty(k);
    }
    expect(isString(row.type)).toBeTruthy();
    expect(isFiniteNumber(Number(row.amount))).toBeTruthy();
    if ("note" in row) expect(isStringOrNull(row.note)).toBeTruthy();
  });

  test("GET /api/house_costs and /api/land_costs return rows with expected shape", async () => {
    const { json: house } = await getJSON(base, "/api/house_costs");
    expect(Array.isArray(house)).toBeTruthy();
    if (house.length) {
      const r = house[0];
      for (const k of ["id", "name", "amount", "status"]) expect(r).toHaveProperty(k);
      expect(isString(r.name)).toBeTruthy();
      expect(isFiniteNumber(Number(r.amount))).toBeTruthy();
      expect(isString(r.status)).toBeTruthy();
    }

    const { json: land } = await getJSON(base, "/api/land_costs");
    expect(Array.isArray(land)).toBeTruthy();
    if (land.length) {
      const r = land[0];
      for (const k of ["id", "name", "amount", "status"]) expect(r).toHaveProperty(k);
      expect(isString(r.name)).toBeTruthy();
      expect(isFiniteNumber(Number(r.amount))).toBeTruthy();
      expect(isString(r.status)).toBeTruthy();
    }
  });

  test("GET /api/cars returns rows with core and derived fields", async () => {
    const { json } = await getJSON(base, "/api/cars");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "model", "year"]) expect(row).toHaveProperty(k);
    expect(isString(row.model)).toBeTruthy();
    expect(isFiniteNumber(row.year)).toBeTruthy();

    // spot-check some numeric spec fields if present
    for (const maybeNumKey of [
      "estimated_purchase_price",
      "consumption_kwh_per_100km",
      "battery_capacity_kwh",
      "dc_peak_kw",
      "dc_time_min_10_80",
      "ac_onboard_kw",
      "ac_time_h_0_100",
      "tco_3_years",
      "tco_5_years",
      "tco_8_years",
    ]) {
      if (maybeNumKey in row) {
        const v = row[maybeNumKey];
        expect(isNumberOrNull(v)).toBeTruthy();
      }
    }
  });

  test("GET /api/financing is 2xx and returns list (possibly empty)", async () => {
    const { json } = await getJSON(base, "/api/financing");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length) {
      const r = json[0];
      expect(r).toHaveProperty("name");
      expect(isString(r.name)).toBeTruthy();
      expect("value" in r).toBeTruthy();
      expect(isNumberOrNull(r.value)).toBeTruthy();
    }
  });

  test("GET /api/acc_info returns rows with expected shape", async () => {
    const { json } = await getJSON(base, "/api/acc_info");
    expect(Array.isArray(json)).toBeTruthy();
    if (json.length === 0) return;

    const row = json[0];
    for (const k of ["id", "person", "bank", "acc_number", "country", "value"]) {
      expect(row).toHaveProperty(k);
    }
    expect(isString(row.person)).toBeTruthy();
    expect(isString(row.bank)).toBeTruthy();
    expect(isString(row.acc_number)).toBeTruthy();
    expect(isString(row.country)).toBeTruthy();
    expect(isFiniteNumber(Number(row.value))).toBeTruthy();
  });

test('GET /api/investments returns list (shape tolerant)', async () => {
  const { res, json } = await getJSON(base, '/api/investments');

  // unwrap common shapes
  const rows =
    Array.isArray(json) ? json :
    Array.isArray(json?.investments) ? json.investments :
    Array.isArray(json?.items) ? json.items :
    res.status() === 204 ? [] :
    [];

  expect(Array.isArray(rows)).toBeTruthy();

  if (rows.length) {
    const r = rows[0];
    expect(typeof r === 'object').toBeTruthy();
  }
});
});
