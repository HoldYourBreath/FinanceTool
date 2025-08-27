// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Default backend URL, can be overridden in CI or locally via env vars
const BACKEND_URL = process.env.VITE_API_URL || "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true, // fail instead of picking a random free port
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false, // allow self-signed certs if you add HTTPS later
      },
    },
  },

  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // suppress warnings for big bundles
  },
});
