// api/acc_info.js
import api from "./axios";

export async function fetchaccinfo() {
  const res = await api.get("/acc_info");
  return res.data || [];
}

// update just the numeric balance (used for the Credit row)
export async function updateAccValue(id, value) {
  const res = await api.post("/acc_info/value", { id, value });
  return res.data;
}

