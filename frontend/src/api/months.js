// src/api/months.js
import axios from 'axios';

export async function fetchMonths() {
  const res = await axios.get('/months');
  return res.data;
}