// eslint.config.js
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Ignore
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "**/*.min.*", "*.log", "**/site-packages/**"],
  },

  // Node config files (CJS/JS)
  {
    files: [
      "**/*.cjs",
      "**/*.config.cjs",
      "**/vite.config.*",
      "**/postcss.config.*",
      "**/tailwind.config.*",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.node },
    },
  },

  // App source (JS/JSX for browser)
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }, // ← enables JSX parsing
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": { node: { extensions: [".js", ".jsx"] } },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": a11y,
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...(react.configs["jsx-runtime"]?.rules || {}),
      ...a11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "import/no-unresolved": ["error", { commonjs: true, caseSensitive: true }],
    },
  },

  // Turn off stylistic rules that clash with Prettier
  eslintConfigPrettier,
];
