// frontend/src/api/client.js
import axios from "axios";

const api = axios.create({ baseURL: "/api" });
// minimal logging/interceptor
api.interceptors.request.use((cfg) => {
  // keep it same-origin so Vite proxy handles it
  if (cfg.baseURL && cfg.baseURL.startsWith("http")) cfg.baseURL = "/api";
  return cfg;
});
export default api;
