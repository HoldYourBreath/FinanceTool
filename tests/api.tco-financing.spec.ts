// tests/api.tco-financing.spec.ts
import { test, expect, request as pwRequest } from "@playwright/test";

// Run these API-only tests serially to avoid global settings races.
test.describe.configure({ mode: "serial" });

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

function getTco8y(row: any): number | undefined {
  const fields = ["tco_total_8y", "tco_8_years", "tco8y_total", "tco8y"];
  for (const f of fields) {
    const v = row?.[f];
    if (typeof v === "number" && isFinite(v)) return v;
  }
  const perMonth =
    row?.tco_per_month_8y ?? row?.tco8y_per_month ?? row?.tco_per_month;
  if (typeof perMonth === "number" && isFinite(perMonth)) {
    return perMonth * 12 * 8;
  }
  return undefined;
}

async function fetchCars(api: any) {
  const resp = await api.get(`/api/cars?ts=${Date.now()}`);
  expect(resp.ok()).toBeTruthy();
  await expectJson(resp);
  return resp.json();
}

async function postPrices(api: any, data: Record<string, any>) {
  const resp = await api.post("/api/settings/prices", { data });
  expect(resp.ok()).toBeTruthy();
  // Some backends echo JSON; tolerate either way.
  try {
    await expectJson(resp);
  } catch {
    /* ignore non-JSON POST body */
  }
}

async function waitUntilPricesReflect(
  api: any,
  expected: Record<string, number>,
  timeoutMs = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await api.get("/api/settings/prices");
    if (r.ok()) {
      try {
        await expectJson(r);
        const cur = await r.json();
        const allMatch = Object.entries(expected).every(([k, v]) => {
          const got = Number(cur?.[k]);
          return Number.isFinite(got) && got === v;
        });
        if (allMatch) return;
      } catch {
        // ignore parse hiccups and retry
      }
    }
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("Prices did not reflect expected values in time");
}

test.describe("TCO reacts to financing settings", () => {
  test("raising interest rate increases 8y TCO", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });

    // Establish a known base: low interest, zero down.
    const lowPrices = { interest_rate_pct: 1, downpayment_sek: 0 };
    await postPrices(api, lowPrices);
    await waitUntilPricesReflect(api, lowPrices);

    // Pick a car where financing actually matters.
    let cars = await fetchCars(api);
    if (!cars?.length) test.skip(true, "No cars available to test against.");
    const baseCar =
      cars.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars[0];
    const carId = baseCar.id;

    const lowTco = getTco8y(cars.find((c: any) => c.id === carId));
    expect(typeof lowTco).toBe("number");

    // Crank up the interest rate.
    const highPrices = { interest_rate_pct: 15, downpayment_sek: 0 };
    await postPrices(api, highPrices);
    await waitUntilPricesReflect(api, highPrices);

    cars = await fetchCars(api);
    const highTco = getTco8y(cars.find((c: any) => c.id === carId));
    expect(typeof highTco).toBe("number");

    expect(highTco!).toBeGreaterThan(lowTco!);
  });

  test("large downpayment reduces 8y TCO (less interest)", async () => {
    const api = await pwRequest.newContext({ baseURL: BACKEND });

    // Fix interest to a reasonable constant; start with zero down.
    const basePrices = { interest_rate_pct: 5, downpayment_sek: 0 };
    await postPrices(api, basePrices);
    await waitUntilPricesReflect(api, basePrices);

    let cars = await fetchCars(api);
    if (!cars?.length) test.skip(true, "No cars available to test against.");
    const baseCar =
      cars.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars[0];
    const carId = baseCar.id;

    const baseTco = getTco8y(cars.find((c: any) => c.id === carId));
    expect(typeof baseTco).toBe("number");

    // Apply ~50% downpayment (rounded down).
    const half = Math.floor((baseCar.estimated_purchase_price ?? 0) / 2);
    const downPrices = { interest_rate_pct: 5, downpayment_sek: half };
    await postPrices(api, downPrices);
    await waitUntilPricesReflect(api, downPrices);

    cars = await fetchCars(api);
    const withDown = getTco8y(cars.find((c: any) => c.id === carId));
    expect(typeof withDown).toBe("number");

    expect(withDown!).toBeLessThan(baseTco!);
  });
});
