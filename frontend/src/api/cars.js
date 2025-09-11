// src/api/cars.js
export async function fetchCars() {
  const res = await fetch('/api/cars');
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.cars ?? []);
  return list.map(c => ({ ...c, range_km: c.range_km ?? null }));
}
