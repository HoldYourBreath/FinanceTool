// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Helper: first non-empty string
  const pick = (...vals) =>
    vals.find((v) => typeof v === "string" && v.trim()) || "";

  // Default backend per mode (your demo backend runs on :5001)
  const fallbackPort = mode === "demo" ? "5001" : "5000";
  const defaultUrl = `http://127.0.0.1:${fallbackPort}`;

  const BACKEND_URL = pick(
    process.env.VITE_API_BASE_URL,
    env.VITE_API_BASE_URL,
    process.env.VITE_API_URL,
    env.VITE_API_URL,
    defaultUrl,
  ).replace(/\/+$/, ""); // no trailing slash

  console.log(`[Vite] mode=${mode} → proxy /api -> ${BACKEND_URL}`);

  const proxyConfig = {
    target: BACKEND_URL,
    changeOrigin: true,
    secure: false,
    // If your Flask app were mounted WITHOUT the "/api" prefix,
    // you could strip it here:
    // rewrite: (path) => path.replace(/^\/api/, ""),
  };

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": proxyConfig },
    },
    preview: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": proxyConfig },
    },
  };
});
