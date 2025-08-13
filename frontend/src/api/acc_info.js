// api/acc_info.js
import api from './axios';

export async function fetchaccinfo() {
  const response = await api.get('/acc_info');
  return response.data;
}
