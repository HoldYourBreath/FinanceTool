import axios from "axios";

export async function fetchPlannedPurchases() {
  const response = await axios.get('api/planned_purchases');
  return response.data;
}

export const createPlannedPurchase = async (purchase) => {
  const response = await axios.post('api/planned_purchases', purchase);
  return response.data;
};

export const deletePlannedPurchase = async (id) => {
  const response = await axios.delete(`api/planned_purchases/${id}`);
  return response.data;
};

export async function updatePlannedPurchase(id, data) {
  const response = await axios.put(`api/planned_purchases/${id}`, data);
  console.log("⏩ Updating purchase:", id, data);
  return response.data;
}
