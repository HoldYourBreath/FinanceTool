// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// helpers
const pick = (...vals) =>
  vals.find((v) => typeof v === "string" && v.trim()) || "";
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ""));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // URL the BROWSER uses (host → backend). Demo defaults to :5001.
  const BACKEND_PUBLIC_URL = pick(
    process.env.VITE_API_BASE_URL,
    env.VITE_API_BASE_URL,
    process.env.VITE_API_URL,
    env.VITE_API_URL,
    "http://localhost:5001",
  ).replace(/\/+$/, "");

  // URL the Vite DEV SERVER uses for proxying (inside container).
  // In Docker, "localhost" is the container itself, so default to service name.
  const inDocker =
    truthy(process.env.VITE_IN_DOCKER) ||
    truthy(env.VITE_IN_DOCKER) ||
    truthy(process.env.DOCKER) ||
    truthy(env.DOCKER);

  const PROXY_TARGET = pick(
    process.env.VITE_API_PROXY_TARGET,
    env.VITE_API_PROXY_TARGET,
    inDocker ? "http://backend:5000" : "",
    BACKEND_PUBLIC_URL, // fallback outside Docker
    "http://127.0.0.1:5000",
  ).replace(/\/+$/, "");

  // Optional HMR override when mapping 5174:5173, etc.
  const HMR_HOST = pick(process.env.VITE_DEV_HMR_HOST, env.VITE_DEV_HMR_HOST);
  const HMR_PORT =
    Number(pick(process.env.VITE_DEV_HMR_PORT, env.VITE_DEV_HMR_PORT)) ||
    undefined;

  console.log(
    `[Vite] mode=${mode} • browser base=${BACKEND_PUBLIC_URL} • proxy /api → ${PROXY_TARGET}`,
  );

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: PROXY_TARGET,
          changeOrigin: true,
          secure: false,
          // If Flask has no "/api" prefix, enable:
          // rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
      hmr:
        HMR_HOST || HMR_PORT
          ? { protocol: "ws", host: HMR_HOST || "localhost", port: HMR_PORT }
          : undefined,
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: PROXY_TARGET,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      target: "es2020",
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
    },
  };
});
