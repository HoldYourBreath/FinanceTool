import { test, expect } from "@playwright/test";

/**
 * Helper: pick an 8-year TOTAL TCO number from a car row, regardless
 * of which field name your backend currently provides.
 */
function pickTco8(car: any): number {
  if (!car) return NaN;
  if (isFiniteNum(car.tco_total_8y)) return car.tco_total_8y;  // preferred
  if (isFiniteNum(car.tco_8_years)) return car.tco_8_years;    // legacy
  // If only per-month is available, convert back to total.
  if (isFiniteNum(car.tco_per_month_8y)) return car.tco_per_month_8y * 96;
  return NaN;
}
const isFiniteNum = (v: any) => typeof v === "number" && Number.isFinite(v);

test.describe("TCO reacts to financing settings", () => {
  test("raising interest rate increases 8y TCO", async ({ request }) => {
    // Ensure we have at least one car to assert on
    const first = await request.get("/api/cars");
    expect(first.ok()).toBeTruthy();
    const cars0 = await first.json();
    if (!cars0?.length) test.skip(true, "No cars available to test against.");

    // Prefer a car with a non-zero price (financing matters then)
    const car = cars0.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars0[0];
    const carId = car.id;

    // Set LOW interest, zero downpayment
    {
      const r = await request.post("/api/settings/prices", {
        data: { interest_rate_pct: 1, downpayment_sek: 0 },
      });
      expect(r.ok()).toBeTruthy();
    }
    const lowResp = await request.get("/api/cars");
    const lowCars = await lowResp.json();
    const lowCar = lowCars.find((c: any) => c.id === carId);
    const tco8_low = pickTco8(lowCar);
    expect(isFiniteNum(tco8_low)).toBeTruthy();

    // Crank interest way up
    {
      const r = await request.post("/api/settings/prices", {
        data: { interest_rate_pct: 40 }, // a clearly higher rate
      });
      expect(r.ok()).toBeTruthy();
    }
    const hiResp = await request.get("/api/cars");
    const hiCars = await hiResp.json();
    const hiCar = hiCars.find((c: any) => c.id === carId);
    const tco8_hi = pickTco8(hiCar);
    expect(isFiniteNum(tco8_hi)).toBeTruthy();

    // Assert TCO increased
    expect(tco8_hi).toBeGreaterThan(tco8_low);
  });

  test("large downpayment reduces 8y TCO (less interest)", async ({ request }) => {
    // Ensure we have a priced car
    const baseResp = await request.get("/api/cars");
    expect(baseResp.ok()).toBeTruthy();
    const cars = await baseResp.json();
    if (!cars?.length) test.skip(true, "No cars available to test against.");

    const car = cars.find((c: any) => (c.estimated_purchase_price ?? 0) > 0) ?? cars[0];
    const carId = car.id;
    const price = Number(car.estimated_purchase_price || 0);

    // Baseline: 10% interest, zero down
    {
      const r = await request.post("/api/settings/prices", {
        data: { interest_rate_pct: 10, downpayment_sek: 0 },
      });
      expect(r.ok()).toBeTruthy();
    }
    const noneResp = await request.get("/api/cars");
    const noneCars = await noneResp.json();
    const noneCar = noneCars.find((c: any) => c.id === carId);
    const tco8_none = pickTco8(noneCar);
    expect(isFiniteNum(tco8_none)).toBeTruthy();

    // Big downpayment (e.g., 80% of price)
    {
      const r = await request.post("/api/settings/prices", {
        data: { interest_rate_pct: 10, downpayment_sek: Math.max(0, price * 0.8) },
      });
      expect(r.ok()).toBeTruthy();
    }
    const bigResp = await request.get("/api/cars");
    const bigCars = await bigResp.json();
    const bigCar = bigCars.find((c: any) => c.id === carId);
    const tco8_big = pickTco8(bigCar);
    expect(isFiniteNum(tco8_big)).toBeTruthy();

    // Assert TCO decreased thanks to less interest
    expect(tco8_big).toBeLessThan(tco8_none);
  });
});
