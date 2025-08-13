// eslint.config.js
import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Ignore build artifacts
  {
    ignores: [
      "dist",
      "build",
      "coverage",
      "node_modules",
      ".vite",
      "vite.config.*.timestamp-*",
    ],
  },

  // Base JS rules (flat-native)
  js.configs.recommended,

  // Convert legacy shareable configs to flat on the fly
  ...compat.extends(
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
  ),

  // Turn off rules that conflict with Prettier
  eslintConfigPrettier,

  // Project-wide settings & extra rules
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      "react-hooks": hooks,
      "jsx-a11y": a11y,
      import: importPlugin,
      prettier,
    },
    rules: {
      "prettier/prettier": "warn",
      "react/prop-types": "off",
      "import/order": ["warn", { "newlines-between": "always" }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
    settings: { react: { version: "detect" } },
  },
];
