// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // loads .env & process env
  const BACKEND_URL =
    (env.VITE_API_BASE_URL && env.VITE_API_BASE_URL.trim()) ||
    (env.VITE_API_URL && env.VITE_API_URL.trim()) ||
    "http://127.0.0.1:5000"; // fallback

  console.log(`[Vite] API proxy -> ${BACKEND_URL}`);

  return defineConfig({
    plugins: [react()],
    server: {
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
  });
};
