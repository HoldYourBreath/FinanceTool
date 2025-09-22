// tests/api.tco-financing.spec.ts
import { test, expect, request as pwRequest } from "@playwright/test";

// Run these API-only tests serially to avoid global settings races.
test.describe.configure({ mode: "serial" });

// Prefer explicit backend origin, fall back to common var or default.
const BACKEND =
  process.env.BACKEND_ORIGIN || process.env.API_URL || "http://127.0.0.1:5000";

// --- helpers ---------------------------------------------------------------

function pickTco8y(row: any): number | undefined {
  return (
    row?.tco_total_8y ??
    row?.tco_8_years ??
    row?.tco8y_total ??
    row?.tco8y ??
    (Number.isFinite(row?.tco_per_month_8y)
      ? row.tco_per_month_8y * 12 * 8
      : Number.isFinite(row?.tco8y_per_month)
      ? row.tco8y_per_month * 12 * 8
      : Number.isFinite(row?.tco_per_month)
      ? row.tco_per_month * 12 * 8
      : undefined)
  );
}

async function getJSON(resp: any) {
  const ct = (resp.headers()["content-type"] || "").toLowerCase();
  expect(ct.includes("application/json")).toBeTruthy();
  return resp.json();
}

async function getCars(api: any) {
  const r = await api.get(`/api/cars?ts=${Date.now()}`);
  expect(r.ok()).toBeTruthy();
  return getJSON(r);
}

async function pickCarIdWithPrice(api: any): Promise<number> {
  const cars = await getCars(api);
  if (!cars?.length) test.skip(true, "No cars available to test against.");
  const priced = cars.find((c: any) => (c.estimated_purchase_price ?? 0) > 0);
  if (!priced) test.skip(true, "No cars have a purchase price > 0.");
  return priced.id;
}

async function tcoFor(api: any, carId: number): Promise<number> {
  const cars = await getCars(api);
  const car = cars.find((c: any) => c.id === carId);
  const tco = pickTco8y(car);
  expect(typeof tco).toBe("number");
  return tco!;
}

async function mergePostPrices(api: any, patch: Record<string, any>) {
  // Merge with current settings to avoid wiping fields the backend depends on.
  const cur = await api.get("/api/settings/prices");
  expect(cur.ok()).toBeTruthy();
  const current = await getJSON(cur);
  const body = { ...current, ...patch };
  const post = await api.post("/api/settings/prices", { data: body });
  expect(post.ok()).toBeTruthy();
  // Some backends return no JSON body here; don't assert on it.
}

async function forceRecompute(api: any) {
  // Ensure derived TCO values are recomputed before we read /api/cars.
  const r = await api.post("/api/cars/update");
  // Accept 200 or 204 (ok() covers both)
  expect(r.ok()).toBeTruthy();
}

// --- tests ----------------------------------------------------------------

test.describe("TCO reacts to financing settings", () => {
  test("raising interest rate increases 8y TCO", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });
    const carId = await pickCarIdWithPrice(api);

    // Baseline: moderate interest, zero down
    await mergePostPrices(api, { interest_rate_pct: 5, downpayment_sek: 0 });
    await forceRecompute(api);
    const low = await tcoFor(api, carId);

    // Raise interest
    await mergePostPrices(api, { interest_rate_pct: 15, downpayment_sek: 0 });
    await forceRecompute(api);

    await expect
      .poll(async () => await tcoFor(api, carId), {
        timeout: 20_000,
        message: "TCO did not increase after raising interest rate",
      })
      .toBeGreaterThan(low);
  });

  test("large downpayment reduces 8y TCO (less interest)", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });
    const carId = await pickCarIdWithPrice(api);

    // Fix interest; start with zero down
    await mergePostPrices(api, { interest_rate_pct: 5, downpayment_sek: 0 });
    await forceRecompute(api);
    const base = await tcoFor(api, carId);

    // Compute ~50% downpayment for this car
    const cars = await getCars(api);
    const car = cars.find((c: any) => c.id === carId)!;
    const price = Math.max(0, Number(car.estimated_purchase_price) || 0);
    const half = Math.floor(price / 2) || 0;

    await mergePostPrices(api, { downpayment_sek: half });
    await forceRecompute(api);

    await expect
      .poll(async () => await tcoFor(api, carId), {
        timeout: 20_000,
        message: "TCO did not decrease after large downpayment",
      })
      .toBeLessThan(base);
  });
});
