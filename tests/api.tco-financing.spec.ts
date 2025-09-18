// tests/api.tco-financing.spec.ts
import { test, expect, request as pwRequest } from "@playwright/test";

// Always talk directly to Flask in these API-only tests.
const BACKEND = process.env.BACKEND_ORIGIN || "http://127.0.0.1:5000";

async function expectJson(resp: any) {
  const ct = (resp.headers()["content-type"] || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const txt = await resp.text();
    throw new Error(
      `Expected JSON from ${resp.url()} but got ${ct || "unknown"}.\n` +
      `Body starts with:\n${txt.slice(0, 200)}`
    );
  }
}

test.describe("TCO reacts to financing settings", () => {
  test("raising interest rate increases 8y TCO", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });

    const first = await api.get("/api/cars");
    expect(first.ok()).toBeTruthy();
    await expectJson(first);
    const cars0 = await first.json();
    if (!cars0?.length) test.skip(true, "No cars available to test against.");

    // Prefer a car with a price so financing matters
    const baseCar = cars0.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars0[0];
    const carId = baseCar.id;

    // low interest
    let resp = await api.post("/api/settings/prices", { data: { interest_rate_pct: 1, downpayment_sek: 0 } });
    expect(resp.ok()).toBeTruthy();

    // fetch cars fresh (cache-buster)
    resp = await api.get(`/api/cars?ts=${Date.now()}`);
    expect(resp.ok()).toBeTruthy();
    await expectJson(resp);
    let cars = await resp.json();
    let low = (cars.find((c: any) => c.id === carId)?.tco_total_8y)
           ?? (cars.find((c: any) => c.id === carId)?.tco_8_years);

    // high interest
    resp = await api.post("/api/settings/prices", { data: { interest_rate_pct: 15, downpayment_sek: 0 } });
    expect(resp.ok()).toBeTruthy();

    resp = await api.get(`/api/cars?ts=${Date.now()}`);
    expect(resp.ok()).toBeTruthy();
    await expectJson(resp);
    cars = await resp.json();
    const hi = (cars.find((c: any) => c.id === carId)?.tco_total_8y)
            ?? (cars.find((c: any) => c.id === carId)?.tco_8_years);

    expect(typeof low).toBe("number");
    expect(typeof hi).toBe("number");
    expect(hi!).toBeGreaterThan(low!);
  });

  test("large downpayment reduces 8y TCO (less interest)", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });

    let resp = await api.get("/api/cars");
    expect(resp.ok()).toBeTruthy();
    await expectJson(resp);
    const cars0 = await resp.json();
    if (!cars0?.length) test.skip(true, "No cars available to test against.");

    const baseCar = cars0.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars0[0];
    const carId = baseCar.id;

    // no downpayment baseline
    resp = await api.post("/api/settings/prices", { data: { downpayment_sek: 0, interest_rate_pct: 5 } });
    expect(resp.ok()).toBeTruthy();

    resp = await api.get(`/api/cars?ts=${Date.now()}`);
    expect(resp.ok()).toBeTruthy();
    await expectJson(resp);
    let cars = await resp.json();
    const base = (cars.find((c: any) => c.id === carId)?.tco_total_8y)
              ?? (cars.find((c: any) => c.id === carId)?.tco_8_years);

    // 50% downpayment
    const half = Math.floor((baseCar.estimated_purchase_price ?? 0) / 2);
    resp = await api.post("/api/settings/prices", { data: { downpayment_sek: half } });
    expect(resp.ok()).toBeTruthy();

    resp = await api.get(`/api/cars?ts=${Date.now()}`);
    expect(resp.ok()).toBeTruthy();
    await expectJson(resp);
    cars = await resp.json();
    const withDown = (cars.find((c: any) => c.id === carId)?.tco_total_8y)
                  ?? (cars.find((c: any) => c.id === carId)?.tco_8_years);

    expect(typeof base).toBe("number");
    expect(typeof withDown).toBe("number");
    expect(withDown!).toBeLessThan(base!);
  });
});
