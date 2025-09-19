// frontend/src/api/axios.js
import axios from "axios";

const isBrowser = typeof window !== "undefined";

// Create a single shared instance
const api = axios.create({
  // In the browser we let Vite proxy handle it (same-origin).
  baseURL: isBrowser ? "" : (process.env.VITE_API_BASE_URL || "http://127.0.0.1:5000") + "/api",
  withCredentials: false,
});

// ---- Request normalizer: FORCE same-origin + leading /api ----
api.interceptors.request.use((config) => {
  if (!isBrowser) return config;

  let url = config.url || "";
  let base = config.baseURL || "";

  // Build a URL so we can inspect/normalize even if absolute
  let u;
  try {
    u = new URL(url, base || window.location.origin);
  } catch {
    // Fallback for odd strings
    u = new URL((url || "").toString(), window.location.origin);
  }

  const host = u.host;

  // If someone hard-coded localhost/127.0.0.1:5000 or 5001, strip origin
  if (
    host === "localhost:5000" ||
    host === "127.0.0.1:5000" ||
    host === "localhost:5001" ||
    host === "127.0.0.1:5001"
  ) {
    url = u.pathname + u.search + u.hash;
  } else {
    url = u.pathname + u.search + u.hash;
  }

  // Ensure exactly one leading /api
  if (!url.startsWith("/api")) {
    url = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
  }

  // Collapse double /api if someone already passed /api/...
  url = url.replace(/^\/api\/api(\/|$)/, "/api$1");

  config.baseURL = ""; // same-origin
  config.url = url;

  return config;
});

// (Optional) tiny log once so you know it’s armed
if (isBrowser) {
  console.log("[api] global axios interceptor armed (browser: true )");
}

export default api;
