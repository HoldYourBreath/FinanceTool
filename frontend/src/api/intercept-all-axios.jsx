import axios from "axios";

// Normalize every axios request to same-origin `/api/...` in the browser.
// If any code passes an absolute URL (e.g. http://localhost:5000/api/acc_info/),
// we rewrite it to a relative `/api/...` so Vite's proxy picks the right backend
// (5000 in dev, 5001 in demo), based on your vite.config + env.

function normalizeToApi(url) {
  if (!url) return "/api";

  // Absolute -> strip origin, keep path/query/hash
  if (/^https?:\/\//i.test(url)) {
    const u = new URL(url);
    const path = u.pathname.startsWith("/api/")
      ? u.pathname
      : "/api" + (u.pathname.startsWith("/") ? u.pathname : "/" + u.pathname);
    return path + u.search + u.hash;
  }

  // Relative -> ensure /api prefix
  if (!url.startsWith("/api/")) {
    return url.startsWith("/") ? "/api" + url : "/api/" + url;
  }
  return url;
}

axios.interceptors.request.use((config) => {
  const before = config.url || "";
  const after = normalizeToApi(before);
  config.url = after;

  // In the browser, force same-origin so Vite proxy handles it.
  if (typeof window !== "undefined") {
    config.baseURL = ""; // same-origin
  }

  if (before !== after) {
    // Helpful trace if something tried to hit :5000 directly
    // eslint-disable-next-line no-console
    console.debug(`[api] rewrote URL ${before} → ${after}`);
  }
  return config;
});

// eslint-disable-next-line no-console
console.info("[api] global axios interceptor armed (browser:", typeof window !== "undefined", ")");
