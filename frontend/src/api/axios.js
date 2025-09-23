// frontend/src/api/axios.js
import axios from "axios";

const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) || {};
const DEV = !!viteEnv?.DEV;

// 1) Optional runtime override for static hosting/CI
const fromWindow =
  (typeof window !== "undefined" && window.__BACKEND__) || null;

// 2) Vite build-time env
const fromVite = viteEnv?.VITE_API_BASE_URL || viteEnv?.VITE_API_URL || null;

// 3) Node/SSR env without touching bare `process`
const fromNode =
  globalThis?.process?.env?.VITE_API_BASE_URL ||
  globalThis?.process?.env?.VITE_API_URL ||
  null;

// Final backend origin (no trailing slash)
const BACKEND = String(
  fromWindow || fromVite || fromNode || "http://127.0.0.1:5000",
).replace(/\/$/, "");

// Prefer same-origin + Vite proxy during dev unless explicitly overridden
const useSameOrigin = DEV && !fromWindow && !fromVite && !fromNode;

const api = axios.create({
  baseURL: useSameOrigin ? "" : `${BACKEND}/api`,
  withCredentials: false,
});

// Normalize paths so callers can use 'months' or '/months' without double /api
api.interceptors.request.use((config) => {
  const raw = config.url || "";
  if (/^https?:\/\//i.test(raw)) return config; // already absolute

  let url = raw;

  if (useSameOrigin) {
    // Ensure leading /api for dev proxy
    if (!url.startsWith("/")) url = `/${url}`;
    if (!url.startsWith("/api")) url = `/api${url}`;
    url = url.replace(/^\/api\/api(\/|$)/, "/api$1");
  } else {
    // baseURL already ends in /api — strip any leading / or api/
    url = (url.startsWith("/") ? url.slice(1) : url).replace(/^api\/+/, "");
  }

  config.url = url;
  return config;
});

if (typeof window !== "undefined") {
  console.log(
    `[api] base=${api.defaults.baseURL || "(same-origin via Vite proxy)"}`,
  );
}

export default api;
