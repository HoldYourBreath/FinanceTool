// src/api/cars.js
import api from "./axios";

export async function fetchCars() {
  const res = await api.get("/cars");
  return res.data || [];
}
