// src/api/financing.js
import api from './axios';

export async function fetchFinancing() {
  const response = await api.get('/financing');
  return response.data;
}
