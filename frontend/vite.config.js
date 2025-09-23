// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// Optional: enable Sentry upload when CI sets SENTRY_* envs
// import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ mode }) => {
  // Load all env (no VITE_ prefix filter) so we can read CI-provided vars
  const env = loadEnv(mode, process.cwd(), "");

  // Helper: first non-empty string
  const pick = (...vals) =>
    vals.find((v) => typeof v === "string" && v.trim()) || "";

  // --- Backend origin detection -------------------------------------------------
  // Default backend per mode (your demo backend runs on :5001)
  const fallbackPort = mode === "demo" ? "5001" : "5000";
  const defaultUrl = `http://127.0.0.1:${fallbackPort}`;

  const BACKEND_URL = pick(
    process.env.VITE_API_BASE_URL,
    env.VITE_API_BASE_URL,
    process.env.VITE_API_URL,
    env.VITE_API_URL,
    defaultUrl,
  ).replace(/\/+$/, ""); // remove trailing slash

  // --- Sentry (optional) -------------------------------------------------------
  // Turn on when building in CI with secrets; safe to keep off locally
  const enableSentry =
    Boolean(
      process.env.SENTRY_AUTH_TOKEN &&
        process.env.SENTRY_ORG &&
        process.env.SENTRY_PROJECT,
    ) && mode !== "test";

  // Sentry plugin config (only used if you uncomment the import + push into plugins)
  const sentryPlugin = enableSentry
    ? [
        // sentryVitePlugin({
        //   org: process.env.SENTRY_ORG,
        //   project: process.env.SENTRY_PROJECT,
        //   authToken: process.env.SENTRY_AUTH_TOKEN,
        //   release: process.env.SENTRY_RELEASE, // e.g. GITHUB_SHA
        //   sourcemaps: { assets: "./frontend/dist/assets/**" },
        //   include: ["./frontend/dist/assets"],
        //   urlPrefix: "~/assets",
        // }),
      ]
    : [];

  // --- Proxy shared between dev server & preview -------------------------------
  const proxyConfig = {
    target: BACKEND_URL,
    changeOrigin: true,
    secure: false,
    // If your Flask app is mounted WITHOUT the "/api" prefix,
    // you could strip it here:
    // rewrite: (path) => path.replace(/^\/api/, ""),
  };

  // Friendly logs
  console.log(
    `[Vite] mode=${mode} • proxy /api → ${BACKEND_URL}${enableSentry ? " • Sentry ON" : ""}`,
  );

  return {
    base: pick(env.VITE_BASE, "/"),
    plugins: [react(), ...sentryPlugin],
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
    build: {
      // Generate sourcemaps only when Sentry upload is enabled
      sourcemap: enableSentry,
      // Reasonable defaults; tweak as needed
      target: "es2020",
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
    },
    // Quieter HMR overlay in dev if you prefer:
    // clearScreen: false,
    // esbuild: { logOverride: { "this-is-undefined-in-esm": "silent" } },
  };
});
